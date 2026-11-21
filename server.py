#!/usr/bin/env python3
"""おむかえナビ (omukae-navi) バックエンドサーバー（Python標準ライブラリのみ使用）"""

import base64
import json
import mimetypes
import os
import re
import socket
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
ENV_PATH = BASE_DIR / ".env"
LAST_MODEL_CACHE_PATH = BASE_DIR / ".last_model"

_MODEL_STATE_LOCK = threading.Lock()
_CACHED_CANDIDATES = None
_CACHED_LOCAL_IP = None
_LAST_WORKING_MODEL = (
    LAST_MODEL_CACHE_PATH.read_text(encoding="utf-8").strip()
    if LAST_MODEL_CACHE_PATH.is_file()
    else None
) or None
_MODEL_COOLDOWN_UNTIL = {}

MODEL_TIMEOUT_SEC = 14
TEXT_MODEL_TIMEOUT_SEC = 9
TOTAL_REQUEST_BUDGET_SEC = 48
COOLDOWN_BY_CODE = {
    404: 86400,  # 廃止・非対応モデルはスキップ
    429: 35,     # 1分あたりの回数制限は数十秒で回復
    503: 20,     # 一時混雑は短時間で回復
    500: 30,
    502: 30,
    504: 30,
}
TIMEOUT_COOLDOWN_SEC = 300

RETRYABLE_HTTP_CODES = {404, 429, 500, 502, 503, 504}
EXCLUDED_MODEL_KEYWORDS = (
    "tts",
    "image",
    "audio",
    "live",
    "embedding",
    "robotics",
    "computer-use",
    "customtools",
    "thinking",
    "omni",
)
# 実測で応答が速く安定しているモデルを優先し、混雑・429時は高速Lite系へ即座にローテーション
PREFERRED_FAST_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
]
FALLBACK_DEFAULT_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-flash-lite-latest",
]

PET_LABELS = {
    "cat": "保護猫",
    "dog": "保護犬",
}

PRESET_DETAILS = {
    "standard": {
        "name": "自治体・動物愛護管理センター",
        "focus": "完全室内飼い（猫）・安全な飼育空間、窓や網戸のロック、脱走防止、有毒植物や誤飲物の有無、基本的な衛生・安全管理。",
    },
    "strict_cat": {
        "name": "民間の保護団体・保護カフェ",
        "focus": "玄関の二重扉・脱走防止ゲート、窓の補助ロック・網戸ストッパー、ベランダ転落防止、キッチンや浴室への侵入防止を特に重視。",
    },
    "personal": {
        "name": "個人の保護主さん・これから検討中",
        "focus": "初めてのお迎えでも無理なく実践できる基本の脱走防止・誤飲防止・有毒植物対策・安心できる居場所づくりをわかりやすく案内。",
    },
    "multi_pet": {
        "name": "自治体・動物愛護管理センター（先住ペットあり）",
        "focus": "通常の脱走・危険物対策に加え、お迎え初期に先住ペットと分けて過ごせる隔離スペース（ケージや別室）の確保、ストレス軽減の工夫を重視。",
    },
}

RESIDENT_PET_FOCUS = (
    "【先住ペットあり】お迎え初期に先住ペットと分けて過ごせる隔離スペース（ケージや別室）の確保、"
    "感染症対策やにおい交換など段階的な顔合わせ・ストレス軽減の工夫もあわせて重視。"
)


def describe_adoption_source(preset_id, has_resident_pet=False):
    preset = PRESET_DETAILS.get(preset_id, PRESET_DETAILS["standard"])
    name = preset["name"]
    focus = preset["focus"]
    if has_resident_pet and "先住ペット" not in name:
        name = f"{name}（先住ペットあり）"
        focus = f"{focus} {RESIDENT_PET_FOCUS}"
    return name, focus

AREA_GUIDES = {
    "window": "窓・網戸・ベランダ（鍵・補助ロック・網戸ストッパー・隙間・転落や脱走リスク）",
    "entrance": "玄関・出入口（飛び出し防止ゲート・リビングとの間の扉・二重対策・荷物の隙間の危険）",
    "living": "リビング・植物・危険物（猫や犬に有毒な観葉植物・切り花、電気コード、ひも類、小さな誤飲物、転倒しやすい家具）",
    "space": "飼育スペース（ケージやトイレ、水・ごはんの置き場所、空調や直射日光、落ち着いて休める環境）",
}


def load_env():
    """Load simple KEY=VALUE pairs from .env without external dependencies."""
    env = {}
    if ENV_PATH.exists():
        for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key:
                env[key] = val
    return env


def get_api_key():
    env = load_env()
    key = os.environ.get("GEMINI_API_KEY") or env.get("GEMINI_API_KEY", "")
    if not key or "ここにAPIキー" in key or key == "YOUR_API_KEY":
        return ""
    return key.strip()


def get_configured_model():
    env = load_env()
    return (os.environ.get("GEMINI_MODEL") or env.get("GEMINI_MODEL", "")).strip()


def get_ssl_context():
    return ssl.create_default_context()


class GeminiHTTPError(RuntimeError):
    def __init__(self, status_code, body):
        self.status_code = status_code
        self.body = body
        super().__init__(f"Gemini API HTTP {status_code}: {body[:400]}")


def format_user_friendly_error(err):
    if isinstance(err, GeminiHTTPError):
        code = err.status_code
        if code in (401, 403):
            return "Gemini APIキーが無効か権限がありません。.env の GEMINI_API_KEY をご確認ください。"
        if code == 429:
            return "Gemini API の利用回数上限または一時的な混雑です。少し時間をおいてもう一度お試しください。"
        if code in (500, 502, 503, 504):
            return "現在 Gemini のAIサーバーが一時的に混み合っています（複数モデルへの自動切替も試みましたが混雑中でした）。10〜30秒ほどおいてもう一度お試しください。"
    msg = str(err)
    if "timed out" in msg.lower():
        return "Gemini からの応答が混み合って時間切れになりました。少し時間をおいてもう一度お試しください。"
    return msg


def http_json(url, method="GET", payload=None, timeout=45):
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=get_ssl_context()) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise GeminiHTTPError(e.code, body) from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"ネットワーク接続エラー: {e.reason}") from e


def _score_model(m_name):
    s = 0
    ver_match = re.search(r"gemini-(\d+(?:\.\d+)?)", m_name)
    if ver_match:
        s += int(float(ver_match.group(1)) * 100)
    if "lite" not in m_name:
        s += 20
    if "preview" not in m_name and "exp" not in m_name:
        s += 10
    if m_name.endswith("-latest"):
        s += 5
    return s


def _model_family_key(m_name):
    ver_match = re.search(r"gemini-(\d+(?:\.\d+)?)", m_name)
    ver = ver_match.group(1) if ver_match else "other"
    tier = "lite" if "lite" in m_name else "flash"
    return (ver, tier)


def get_candidate_models(api_key):
    """Return ordered list of Gemini Flash models with automatic fallback across model families."""
    global _CACHED_CANDIDATES

    with _MODEL_STATE_LOCK:
        cached = _CACHED_CANDIDATES

    if cached is None:
        discovered = []
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={urllib.parse.quote(api_key)}"
        try:
            data = http_json(url, method="GET", timeout=15)
            models = data.get("models", [])
            for m in models:
                name = m.get("name", "")
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" not in methods:
                    continue
                short = name.replace("models/", "")
                if "flash" not in short:
                    continue
                if any(kw in short for kw in EXCLUDED_MODEL_KEYWORDS):
                    continue
                discovered.append(short)
        except Exception as e:
            print(f"[おむかえナビ] モデル一覧取得フォールバック: {e}")

        discovered.sort(key=_score_model, reverse=True)

        # Pick one representative per (version, tier) family first so fallbacks switch across distinct backends quickly.
        primary_wave = []
        secondary_wave = []
        seen_families = set()
        for m in discovered:
            fam = _model_family_key(m)
            if fam not in seen_families:
                seen_families.add(fam)
                primary_wave.append(m)
            else:
                secondary_wave.append(m)

        ordered = []
        discovered_set = set(discovered)
        # 1) API一覧に存在する高速・安定実績モデルを最優先
        for m in PREFERRED_FAST_MODELS:
            if m in discovered_set and m not in ordered:
                ordered.append(m)
        # 2) その他の各世代代表モデル → 残りの候補 → デフォルト予備
        for m in primary_wave + secondary_wave + FALLBACK_DEFAULT_MODELS:
            if m and m not in ordered:
                ordered.append(m)

        with _MODEL_STATE_LOCK:
            if _CACHED_CANDIDATES is None:
                _CACHED_CANDIDATES = ordered
                cached = ordered
                print(
                    f"[おむかえナビ] 利用可能なGeminiモデル候補: {', '.join(_CACHED_CANDIDATES[:6])}",
                    flush=True,
                )
            else:
                cached = _CACHED_CANDIDATES

    configured = get_configured_model()
    with _MODEL_STATE_LOCK:
        last_working = _LAST_WORKING_MODEL
        cooldowns = dict(_MODEL_COOLDOWN_UNTIL)
        candidate_list = list(cached)

    prioritized = []
    if configured:
        prioritized.append(configured)
    if last_working and last_working not in prioritized:
        prioritized.append(last_working)
    for m in candidate_list:
        if m not in prioritized:
            prioritized.append(m)

    now = time.time()
    healthy = [m for m in prioritized if cooldowns.get(m, 0) <= now]
    cooling = [m for m in prioritized if cooldowns.get(m, 0) > now]
    return healthy + cooling


def extract_json_text(raw_text):
    """Extract a JSON object from Gemini output, handling prose and fenced blocks safely."""
    text = raw_text.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    candidates = []
    if fence_match:
        candidates.append(fence_match.group(1).strip())
    candidates.append(text)

    decoder = json.JSONDecoder()
    parsed = None
    for cand in candidates:
        try:
            parsed = json.loads(cand)
            break
        except json.JSONDecodeError:
            pass
        for idx, ch in enumerate(cand):
            if ch in "{[":
                try:
                    obj, _ = decoder.raw_decode(cand, idx)
                    parsed = obj
                    break
                except json.JSONDecodeError:
                    continue
        if parsed is not None:
            break

    if parsed is None:
        raise ValueError("Gemini APIの応答から有効なJSONを抽出できませんでした。")
    if isinstance(parsed, list):
        if len(parsed) == 1 and isinstance(parsed[0], dict):
            return parsed[0]
        raise ValueError("Gemini APIの応答形式がオブジェクトではありませんでした。")
    if not isinstance(parsed, dict):
        raise ValueError("Gemini APIの応答形式が不正です。")
    return parsed


def _as_str_list(value):
    if isinstance(value, list):
        return [str(x).strip() for x in value if x is not None and str(x).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_photo_result(data):
    if not isinstance(data, dict):
        raise ValueError("写真診断の結果形式が不正です。")
    status = data.get("status", "caution")
    if status not in ("safe", "caution", "action_needed"):
        status = "caution"
    default_score = {"safe": 90, "caution": 70, "action_needed": 50}[status]
    try:
        score = max(0, min(100, int(round(float(data.get("score", default_score))))))
    except (TypeError, ValueError):
        score = default_score
    raw_items = data.get("shoppingItems")
    shopping_items = []
    if isinstance(raw_items, list):
        for entry in raw_items:
            if isinstance(entry, dict) and str(entry.get("item", "")).strip():
                shopping_items.append(
                    {
                        "item": str(entry.get("item", "")).strip(),
                        "where": str(entry.get("where", "100円ショップ・ホームセンター")).strip(),
                        "estimatedPrice": str(entry.get("estimatedPrice", "")).strip(),
                        "reason": str(entry.get("reason", "")).strip(),
                    }
                )
    return {
        "status": status,
        "score": score,
        "summary": str(data.get("summary") or "").strip(),
        "goodPoints": _as_str_list(data.get("goodPoints")),
        "risks": _as_str_list(data.get("risks")),
        "improvements": _as_str_list(data.get("improvements")),
        "shoppingItems": shopping_items,
        "staffCheckPoint": str(data.get("staffCheckPoint") or "").strip(),
    }


def _normalize_hearing_result(data):
    if not isinstance(data, dict):
        raise ValueError("ヒアリング応答の形式が不正です。")
    try:
        answered = max(0, min(5, int(data.get("answeredCount", 0))))
    except (TypeError, ValueError):
        answered = 0
    raw_summary = data.get("summary")
    keys = ["housing", "careRoutine", "familyAgreement", "safetyAwareness", "emergencyPlan"]
    summary = {
        k: (str(raw_summary.get(k) or "").strip() if isinstance(raw_summary, dict) else "")
        for k in keys
    }
    return {
        "reply": str(data.get("reply") or "ありがとうございます。続けて教えてください。").strip(),
        "answeredCount": answered,
        "isComplete": bool(data.get("isComplete", False)) or answered >= 5,
        "quickReplies": _as_str_list(data.get("quickReplies")),
        "summary": summary,
    }


def _normalize_report_result(data):
    if not isinstance(data, dict):
        raise ValueError("レポート生成結果の形式が不正です。")
    readiness = data.get("overallReadiness", "almost")
    if readiness not in ("ready", "almost", "needs_prep"):
        readiness = "almost"
    raw_shop = data.get("shoppingList")
    shopping_list = []
    if isinstance(raw_shop, list):
        for entry in raw_shop:
            if isinstance(entry, dict) and str(entry.get("item", "")).strip():
                shopping_list.append(
                    {
                        "item": str(entry.get("item", "")).strip(),
                        "where": str(entry.get("where", "100円ショップ等")).strip(),
                        "estimatedPrice": str(entry.get("estimatedPrice", "")).strip(),
                        "priority": str(entry.get("priority", "あると安心")).strip(),
                        "note": str(entry.get("note", "")).strip(),
                    }
                )
    return {
        "overallReadiness": readiness,
        "overallLabel": str(data.get("overallLabel") or "").strip(),
        "overallComment": str(data.get("overallComment") or "").strip(),
        "staffSummary": str(data.get("staffSummary") or "").strip(),
        "recommendedNextStep": str(data.get("recommendedNextStep") or "").strip(),
        "priorityActions": _as_str_list(data.get("priorityActions")),
        "shoppingList": shopping_list,
    }


def _thinking_config_for_model(model):
    """Keep latency fast (2-5s) by minimizing hidden thinking tokens on Flash models."""
    if model.startswith("gemini-3"):
        return {"thinkingLevel": "MINIMAL"}
    if model.startswith("gemini-2.5"):
        return {"thinkingBudget": 0}
    return None


def _request_gemini_once(api_key, model, parts, system_instruction, temperature, timeout=MODEL_TIMEOUT_SEC):
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model)}:generateContent?key={urllib.parse.quote(api_key)}"
    )
    gen_config = {
        "temperature": temperature,
        "responseMimeType": "application/json",
    }
    thinking_cfg = _thinking_config_for_model(model)
    if thinking_cfg:
        gen_config["thinkingConfig"] = thinking_cfg

    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": gen_config,
    }
    try:
        res = http_json(url, method="POST", payload=payload, timeout=timeout)
    except GeminiHTTPError as e:
        # もしモデルが thinkingConfig 非対応で 400 を返した場合は thinkingConfig なしで即再試行
        if e.status_code == 400 and "thinkingConfig" in gen_config:
            gen_config.pop("thinkingConfig", None)
            res = http_json(url, method="POST", payload=payload, timeout=timeout)
        else:
            raise
    candidates = res.get("candidates", [])
    if not candidates:
        raise RuntimeError("AIから有効な応答が返されませんでした。")
    out_parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in out_parts if "text" in p)
    if not text:
        raise RuntimeError("AIの応答テキストが空でした。")
    return extract_json_text(text)


def call_gemini_json(api_key, parts, system_instruction, temperature=0.3, model_timeout=MODEL_TIMEOUT_SEC):
    global _LAST_WORKING_MODEL
    candidates = get_candidate_models(api_key)[:6]
    last_err = None
    deadline = time.time() + TOTAL_REQUEST_BUDGET_SEC

    for model in candidates:
        remaining = deadline - time.time()
        if remaining < 4:
            break
        per_model_timeout = min(model_timeout, max(6, int(remaining)))
        try:
            parsed = _request_gemini_once(
                api_key, model, parts, system_instruction, temperature, timeout=per_model_timeout
            )
            with _MODEL_STATE_LOCK:
                _MODEL_COOLDOWN_UNTIL.pop(model, None)
                changed = _LAST_WORKING_MODEL != model
                _LAST_WORKING_MODEL = model
                try:
                    LAST_MODEL_CACHE_PATH.write_text(model + "\n", encoding="utf-8")
                except Exception:
                    pass
            if changed:
                print(f"[おむかえナビ] 使用モデル確定: {model}", flush=True)
            return parsed, model
        except GeminiHTTPError as e:
            last_err = e
            if e.status_code in RETRYABLE_HTTP_CODES:
                cd = COOLDOWN_BY_CODE.get(e.status_code, 30)
                with _MODEL_STATE_LOCK:
                    _MODEL_COOLDOWN_UNTIL[model] = time.time() + cd
                    if _LAST_WORKING_MODEL == model:
                        _LAST_WORKING_MODEL = None
                print(
                    f"[おむかえナビ] {model} が一時エラー (HTTP {e.status_code}) のため次のモデルへ切替します",
                    flush=True,
                )
                continue
            raise RuntimeError(format_user_friendly_error(e)) from e
        except Exception as e:
            last_err = e
            with _MODEL_STATE_LOCK:
                _MODEL_COOLDOWN_UNTIL[model] = time.time() + TIMEOUT_COOLDOWN_SEC
                if _LAST_WORKING_MODEL == model:
                    _LAST_WORKING_MODEL = None
            print(f"[おむかえナビ] {model} で応答遅延/エラー ({e}) のため次のモデルへ切替します", flush=True)
            continue

    raise RuntimeError(
        format_user_friendly_error(
            last_err
            or RuntimeError(
                "現在 Gemini の応答が混み合っています。10秒ほどおいてもう一度お試しください。"
            )
        )
    )


def analyze_photo_with_gemini(api_key, body):
    image_data_url = body.get("imageDataUrl", "")
    area_id = body.get("areaId", "living")
    pet_type = body.get("petType", "cat")
    preset_id = body.get("shelterPreset", "standard")
    has_resident_pet = bool(body.get("hasResidentPet", False))
    user_note = (body.get("note") or "").strip()

    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", image_data_url, re.DOTALL)
    if not match:
        raise ValueError("画像データの形式が正しくありません。")
    mime_type, b64_data = match.group(1), match.group(2)

    pet_label = PET_LABELS.get(pet_type, "保護猫")
    source_name, source_focus = describe_adoption_source(preset_id, has_resident_pet)
    area_guide = AREA_GUIDES.get(area_id, AREA_GUIDES["living"])

    system_instruction = (
        "あなたは自治体（動物愛護管理センター）や保護猫・保護犬団体の譲渡前チェックに詳しい、"
        "優しくて頼りになる飼育環境アドバイザーです。\n"
        "目的は「応募者を厳しく落選させること」ではなく、「受け入れ前に危険なポイントに気づき、"
        "誰でもすぐに対策できるよう優しくサポートすること」および「自治体・団体職員の確認作業を助けること」です。\n"
        "「評価困難」「不合格」「不十分」「問題あり」など応募者が落ち込む冷たい表現は使わず、"
        "写真に写っていない部分は『写真の外にある部分は、面談や追加写真で一緒に確認しましょう』のように柔らかく正直に伝えてください。\n"
        "専門用語を使う場合は中学生にも分かる短い説明を添え、必ず指定されたJSON形式のみで返答してください。"
    )

    prompt = f"""
以下の条件で、添付されたお部屋の写真を診断してください。

- お迎え予定のペット: {pet_label}
- お迎え元（受け入れ元）: {source_name}（重視ポイント: {source_focus}）
- チェック対象エリア: {area_guide}
- 応募者からの補足メモ: {user_note if user_note else "なし"}

特に注目すべき実務チェック項目:
- 窓・網戸・ベランダの場合: 窓の鍵（クレセント錠）、網戸のロック/ストッパー、手すりの隙間、転落・脱走の危険性。
- 玄関の場合: ドアを開けた際の飛び出しリスク、リビングとの間に仕切り扉や脱走防止ゲートがあるか。
- リビング・植物・危険物の場合: 観葉植物や切り花（特に猫にはユリ科・ポトス・ドラセナ等の中毒リスク）、むき出しの電気コード、ひもや輪ゴムなどの誤飲物、登って落ちそうな不安定な棚。
- 飼育スペースの場合: ケージやトイレの配置、落ち着いた休息場所、エアコンの風や直射日光への配慮。

必ず以下のJSONスキーマで出力してください:
{{
  "status": "safe" または "caution" または "action_needed",
  "score": 0から100の整数,
  "summary": "写真全体を見た優しい要約（60〜110文字程度）",
  "goodPoints": ["良い点や安心できる点（1〜3個）"],
  "risks": ["気づいたリスクや写真からは確認できなかった点（0〜4個）"],
  "improvements": ["100円ショップやホームセンター等ですぐできる具体的な改善アイデア（1〜3個）"],
  "shoppingItems": [
    {{
      "item": "具体的な対策グッズ名（例: 引き戸・網戸ストッパー、コード保護チューブ など）",
      "where": "100円ショップ" または "ホームセンター" または "ペットショップ・通販",
      "estimatedPrice": "目安金額（例: 約110〜220円）",
      "reason": "どんな安全対策に役立つかの短い理由（20〜45文字）"
    }}
  ],
  "staffCheckPoint": "自治体・保護団体の職員がレポートを見た時に確認すべき1行メモ"
}}
※ shoppingItems は写真から見つけた改善点に合わせて1〜3個（十分に安全な場合も、あるとさらに安心な小物を0〜1個）提案してください。
"""

    parts = [
        {"inline_data": {"mime_type": mime_type, "data": b64_data}},
        {"text": prompt},
    ]
    raw_result, model = call_gemini_json(api_key, parts, system_instruction, temperature=0.25)
    result = _normalize_photo_result(raw_result)
    result["model"] = model
    return result


HEARING_FALLBACK_STEPS = [
    (
        "housing",
        "現在のお住まいは、ペットの飼育が可能な環境（持ち家・ペット可賃貸など）でしょうか？",
        ["ペット可の賃貸（規約確認済み）", "持ち家（戸建て・マンション）", "これから管理会社に確認する"],
    ),
    (
        "careRoutine",
        "ありがとうございます！住居の条件が確認できました。\n\n続いて【2/5】普段のお留守番時間は1日あたり何時間くらいになりそうですか？主にお世話される方も教えてください。",
        ["日中は在宅（留守番ほぼなし）", "平日は6〜8時間ほど留守番", "家族で交代して見守れる"],
    ),
    (
        "familyAgreement",
        "生活リズムがよく分かりました。無理なく見守れそうですね！\n\n続いて【3/5】同居されているご家族全員がお迎えに同意されていますか？また、動物アレルギーのある方はいらっしゃいますか？",
        ["全員同意・アレルギーなし", "一人暮らし・アレルギーなし", "これから家族ともう一度話す"],
    ),
    (
        "safetyAwareness",
        "ご家族の協力体制があるのはとても心強いです！\n\n続いて【4/5】完全室内飼い（猫の場合）や脱走防止、終生飼養（最後まで責任を持って育てること）について、現在のお考えを教えてください。",
        ["完全室内飼いで最後まで大切に育てる", "脱走防止対策をしっかり整えて迎える"],
    ),
    (
        "emergencyPlan",
        "素敵な心構えですね！いよいよ最後の質問です。\n\n【5/5】かかりつけ予定の動物病院は近くにありますか？また、急病や災害時の備え・預け先のイメージはありますか？",
        ["徒歩・車圏内に動物病院あり、キャリーも準備予定", "これから近所の病院を探す予定"],
    ),
]


def build_hearing_fallback_reply(messages, current_answered=None, current_summary=None, pet_type="cat"):
    """Gemini APIが一時的に全モデル混雑した際もヒアリング会話を止めないセーフティネット"""
    keys = ["housing", "careRoutine", "familyAgreement", "safetyAwareness", "emergencyPlan"]
    filtered_msgs = [
        m
        for m in (messages or [])
        if isinstance(m, dict)
        and str(m.get("text") or "").strip()
        and not (
            m.get("role") == "ai"
            and "通信が一時的に不安定でした" in str(m.get("text") or "")
        )
    ]

    # 連続するユーザー発言は「1問への補足つき回答」として1ブロックにまとめる
    user_turns = []
    current_group = []
    for m in filtered_msgs:
        role = m.get("role")
        text = str(m.get("text") or "").strip()
        if role == "user":
            if text != "もう一度つなぐ":
                current_group.append(text)
        else:
            if current_group:
                user_turns.append(" / ".join(current_group))
                current_group = []
    trailing_user_answer = " / ".join(current_group) if current_group else ""
    if current_group:
        user_turns.append(trailing_user_answer)

    base_summary = (
        {k: str(current_summary.get(k) or "").strip() for k in keys}
        if isinstance(current_summary, dict)
        else {k: "" for k in keys}
    )

    if current_answered is not None:
        try:
            answered_before = max(0, min(5, int(current_answered)))
        except (TypeError, ValueError):
            answered_before = 0
        summary = dict(base_summary)
        for i, k in enumerate(keys):
            if not summary[k] and i < answered_before and i < len(user_turns):
                summary[k] = user_turns[i]
        if trailing_user_answer and answered_before < 5:
            if not summary[keys[answered_before]]:
                summary[keys[answered_before]] = trailing_user_answer
            answered = min(5, answered_before + 1)
        else:
            answered = answered_before
    else:
        answered = min(5, len(user_turns))
        summary = {
            k: (base_summary.get(k) or (user_turns[i] if i < len(user_turns) else ""))
            for i, k in enumerate(keys)
        }

    if answered >= 5:
        return {
            "reply": "5つの項目の確認が完了しました！丁寧にお答えいただきありがとうございます。\n右下の「ステップ4：提出用レポートを作成する」ボタンから、結果と提出用レポートを確認できます。",
            "answeredCount": 5,
            "isComplete": True,
            "quickReplies": [],
            "summary": summary,
            "model": "guided-continuity-fallback",
            "fallbackUsed": True,
        }

    step_key, next_q, chips = HEARING_FALLBACK_STEPS[answered]
    if step_key == "safetyAwareness" and pet_type == "dog":
        next_q = (
            "ご家族の協力体制があるのはとても心強いです！\n\n"
            "続いて【4/5】室内飼育・脱走防止対策や、終生飼養（最後まで責任を持って育てること）について、現在のお考えを教えてください。"
        )
        chips = ["室内飼育で最後まで大切に育てる", "脱走防止対策をしっかり整えて迎える"]

    return {
        "reply": next_q,
        "answeredCount": answered,
        "isComplete": False,
        "quickReplies": chips,
        "summary": summary,
        "model": "guided-continuity-fallback",
        "fallbackUsed": True,
    }


def hearing_chat_with_gemini(api_key, body):
    pet_type = body.get("petType", "cat")
    preset_id = body.get("shelterPreset", "standard")
    has_resident_pet = bool(body.get("hasResidentPet", False))
    messages = body.get("messages", [])
    photo_summaries = body.get("photoSummaries", [])
    current_answered = body.get("answeredCount")
    current_summary = body.get("hearingSummary")

    pet_label = PET_LABELS.get(pet_type, "保護猫")
    source_name, source_focus = describe_adoption_source(preset_id, has_resident_pet)

    system_instruction = (
        "あなたは自治体（動物愛護管理センター）や保護団体の事前ヒアリングを代行・支援する、"
        "丁寧で親しみやすいAIナビゲーター「おむかえナビ」です。\n"
        "訪問審査の代わりに、受け入れ希望者から必要な5項目を1つずつテンポよく確認します。\n"
        "必ず指定のJSON形式のみで回答してください。専門用語には中学生にも分かる短い説明を付けてください。"
    )

    history_text = "\n".join(
        f"{'応募者' if m.get('role') == 'user' else 'AI'}: {m.get('text', '')}"
        for m in messages
    )
    photo_text = "\n".join(f"- {s}" for s in photo_summaries) if photo_summaries else "まだ写真診断は未実施"

    prompt = f"""
対象ペット: {pet_label}
お迎え元（受け入れ元）: {source_name}（重視ポイント: {source_focus}）

写真チェックの要点:
{photo_text}

これまでのヒアリング会話:
{history_text if history_text else "（これから最初の質問を始めます）"}

確認すべき5つの必須項目:
1. お住まいの環境（ペット可の持ち家・賃貸か、規約確認済みか）
2. 普段のお留守番時間と、主にお世話をする人の体制
3. 同居家族全員の同意と、動物アレルギーの有無
4. 完全室内飼い・脱走防止・終生飼養（最後まで責任を持って育てること）への考え方
5. 近くの動物病院の確認と、急病や災害時の預け先・備え

ルール:
- まだ確認できていない項目を「1問ずつ」やさしく質問してください。
- 応募者が前の質問に答えたら、まず温かく共感・一言アドバイスしてから次の質問へ進んでください。
- 5項目すべて確認できたら `isComplete` を true にして、お礼と「次のレポート作成へ進んでください」という案内を `reply` に書き、`summary` に団体職員向けの簡潔な要約を入れてください。
- 応募者がスマホでタップして答えやすい `quickReplies`（短い選択肢2〜4個）を必ず提案してください（完了時は空配列 `[]`）。

必ず以下のJSON形式で出力してください:
{{
  "reply": "AIからの返答と次の質問（120〜220文字程度）",
  "answeredCount": 0から5の整数（確認完了した項目数）,
  "isComplete": true または false,
  "quickReplies": ["タップ用回答候補1", "タップ用回答候補2", "タップ用回答候補3"],
  "summary": {{
    "housing": "住居・ペット可否の要約（未確認なら空文字）",
    "careRoutine": "留守番時間・お世話体制の要約（未確認なら空文字）",
    "familyAgreement": "家族の同意・アレルギーの要約（未確認なら空文字）",
    "safetyAwareness": "室内飼い・脱走対策意識の要約（未確認なら空文字）",
    "emergencyPlan": "動物病院・緊急時の備えの要約（未確認なら空文字）"
  }}
}}
"""

    try:
        raw_result, model = call_gemini_json(
            api_key,
            [{"text": prompt}],
            system_instruction,
            temperature=0.35,
            model_timeout=TEXT_MODEL_TIMEOUT_SEC,
        )
        result = _normalize_hearing_result(raw_result)
        result["model"] = model
        return result
    except Exception as e:
        print(f"[おむかえナビ] ヒアリング一時混雑のため継続フォールバックを使用: {e}", flush=True)
        return build_hearing_fallback_reply(
            messages,
            current_answered=current_answered,
            current_summary=current_summary,
            pet_type=pet_type,
        )


def generate_report_with_gemini(api_key, body):
    applicant_name = (body.get("applicantName") or "応募者").strip()
    pet_type = body.get("petType", "cat")
    preset_id = body.get("shelterPreset", "standard")
    has_resident_pet = bool(body.get("hasResidentPet", False))
    photo_results = body.get("photoResults", {})
    hearing_summary = body.get("hearingSummary", {})
    hearing_messages = body.get("hearingMessages", [])

    pet_label = PET_LABELS.get(pet_type, "保護猫")
    source_name, _ = describe_adoption_source(preset_id, has_resident_pet)

    system_instruction = (
        "あなたは自治体（動物愛護管理センター）および地域の保護猫・保護犬団体の譲渡審査をサポートするAIです。\n"
        "AIが最終合否を決めるのではなく、職員の事前訪問の負担を減らし、"
        "オンライン面談や追加写真確認の判断を助けるための「事前環境チェックレポート」を作成してください。\n"
        "重要ルール：\n"
        "- 『評価困難』『判定不能』『不十分』『不合格』などの突き放す表現や否定的なレッテルは絶対に使わないでください。\n"
        "- 写真やヒアリングが一部未入力の場合でも、すでに確認できた良い点を丁寧に拾い、未確認の項目は『これから確認する項目（面談・追加写真で確認予定）』として前向きかつ客観的に記載してください。\n"
        "- 専門用語を使う場合は中学生にも分かる短い説明を添えてください。\n"
        "- 必ず指定のJSON形式のみで出力してください。"
    )

    prompt = f"""
以下の情報をもとに、自治体・保護団体へ提出できる「飼育環境 事前確認レポート」を作成してください。

- 応募者名: {applicant_name}
- お迎え予定: {pet_label}
- お迎え元（受け入れ元）: {source_name}
- 写真診断結果(JSON): {json.dumps(photo_results, ensure_ascii=False)}
- ヒアリング要約(JSON): {json.dumps(hearing_summary, ensure_ascii=False)}
- ヒアリング会話ログ: {json.dumps(hearing_messages[-12:], ensure_ascii=False)}

以下のJSON形式で出力してください:
{{
  "overallReadiness": "ready" または "almost" または "needs_prep",
  "overallLabel": "お迎え準備バッチリ！" または "あと少しの準備でさらに安心" または "お迎え前に安全ポイントを整えましょう",
  "overallComment": "応募者へ向けた温かい総合コメント（120〜180文字。努力や良い点をまず褒め、安心感を与える内容にする）",
  "staffSummary": "自治体・保護団体の職員に向けた確認サマリー（140〜220文字。確認できた項目と、オンライン面談や追加写真で確認すると良い点を建設的・客観的に記載。『評価困難』などの否定表現は使わない）",
  "recommendedNextStep": "職員側におすすめの確認フロー（例: 『オンライン面談のみで最終確認可能』『窓ロック設置後の写真1枚追加で完了』など）",
  "priorityActions": ["お迎え日までに実施するとさらに安心なアクション（2〜4個）"],
  "shoppingList": [
    {{
      "item": "お迎え日までに揃えると安心な対策グッズ名",
      "where": "100円ショップ" または "ホームセンター" または "ペットショップ・通販",
      "estimatedPrice": "目安金額（例: 約110〜220円）",
      "priority": "優先" または "あると安心",
      "note": "どのエリア・目的で使うかの短いメモ（20〜45文字）"
    }}
  ]
}}
※ shoppingList は各写真の診断結果（shoppingItems等）とヒアリング内容をまとめて重複を整理し、100円ショップやホームセンターで買える身近なものを中心に2〜5個提案してください。
"""

    raw_result, model = call_gemini_json(api_key, [{"text": prompt}], system_instruction, temperature=0.3)
    result = _normalize_report_result(raw_result)
    result["model"] = model
    return result


def get_local_ip():
    global _CACHED_LOCAL_IP
    with _MODEL_STATE_LOCK:
        if _CACHED_LOCAL_IP:
            return _CACHED_LOCAL_IP
    s = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        if s is not None:
            try:
                s.close()
            except Exception:
                pass
    with _MODEL_STATE_LOCK:
        if not _CACHED_LOCAL_IP:
            _CACHED_LOCAL_IP = ip
        return _CACHED_LOCAL_IP


class OmukaeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {format % args}")

    def send_json(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def read_json_body(self):
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except (TypeError, ValueError):
            raise ValueError("Content-Length ヘッダーが不正です。")
        if length < 0:
            raise ValueError("Content-Length ヘッダーが不正です。")
        if length > 20 * 1024 * 1024:
            raise ValueError("データサイズが大きすぎます（20MB以下にしてください）。")
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            decoded = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("リクエストの文字コードがUTF-8ではありません。")
        try:
            data = json.loads(decoded)
        except json.JSONDecodeError:
            raise ValueError("JSONの形式が正しくありません。")
        if not isinstance(data, dict):
            raise ValueError("JSONのルートはオブジェクトである必要があります。")
        return data

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/status":
            api_key = get_api_key()
            with _MODEL_STATE_LOCK:
                active_model = (
                    _LAST_WORKING_MODEL
                    or get_configured_model()
                    or (_CACHED_CANDIDATES[0] if _CACHED_CANDIDATES else "auto (Gemini Flash)")
                )
            self.send_json(
                {
                    "apiKeyConfigured": bool(api_key),
                    "model": active_model,
                    "localIp": get_local_ip(),
                }
            )
            return

        # Serve static files from public/
        unquoted_path = urllib.parse.unquote(path)
        rel = "index.html" if unquoted_path in ("", "/") else unquoted_path.lstrip("/")
        public_root = PUBLIC_DIR.resolve()
        try:
            target = (public_root / rel).resolve()
            is_allowed = target.is_relative_to(public_root) and target.is_file()
        except (ValueError, OSError):
            is_allowed = False
        if not is_allowed:
            self.send_json({"error": "Not Found"}, status=404)
            return

        mime_type, _ = mimetypes.guess_type(str(target))
        content = target.read_bytes()
        resolved_mime = mime_type or "application/octet-stream"
        if resolved_mime.startswith("text/") or resolved_mime in (
            "application/javascript",
            "application/json",
            "image/svg+xml",
        ):
            content_type = f"{resolved_mime}; charset=utf-8"
        else:
            content_type = resolved_mime
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        api_key = get_api_key()
        if not api_key:
            self.send_json(
                {
                    "error": "GEMINI_API_KEY が未設定です。.env ファイルに API キーを設定してください。",
                    "code": "NO_API_KEY",
                },
                status=400,
            )
            return

        try:
            body = self.read_json_body()
            if path == "/api/analyze-photo":
                result = analyze_photo_with_gemini(api_key, body)
                self.send_json(result)
            elif path == "/api/hearing-chat":
                result = hearing_chat_with_gemini(api_key, body)
                self.send_json(result)
            elif path == "/api/generate-report":
                result = generate_report_with_gemini(api_key, body)
                self.send_json(result)
            else:
                self.send_json({"error": "Unknown API endpoint"}, status=404)
        except ValueError as e:
            self.send_json({"error": str(e)}, status=400)
        except Exception as e:
            print(f"[ERROR] {path}: {e}")
            self.send_json({"error": str(e)}, status=500)


def main():
    env = load_env()
    port = int(os.environ.get("PORT") or env.get("PORT") or 8080)
    server = ThreadingHTTPServer(("0.0.0.0", port), OmukaeHandler)
    local_ip = get_local_ip()
    key_ok = bool(get_api_key())
    print("=" * 56)
    print("🐾 おむかえナビ (omukae-navi) サーバーを起動しました！")
    print(f"   PCから開く    : http://localhost:{port}")
    print(f"   スマホから開く: http://{local_ip}:{port} (同じWi-Fi内)")
    print(f"   Gemini API    : {'✅ 設定済み' if key_ok else '⚠️ 未設定（デモ体験モードで動作可能）'}")
    print("   終了するとき  : Ctrl + C")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nサーバーを終了しました。")


if __name__ == "__main__":
    main()
