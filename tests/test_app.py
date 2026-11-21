#!/usr/bin/env python3
"""おむかえナビ (omukae-navi) 自動テストスイート（Python標準ライブラリのみ使用）"""

import concurrent.futures
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest import mock

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

import server  # noqa: E402


class FakeHeaders:
    def __init__(self, headers):
        self._headers = {k.lower(): v for k, v in headers.items()}

    def get(self, key, default=None):
        return self._headers.get(key.lower(), default)


class _NonClosingBytesIO(io.BytesIO):
    def close(self):
        self.flush()


class _FakeSocket:
    def __init__(self, raw_request: bytes):
        self._rfile = io.BytesIO(raw_request)
        self._wfile = _NonClosingBytesIO()

    def makefile(self, mode, *args, **kwargs):
        return self._rfile if "r" in mode else self._wfile

    def sendall(self, data):
        self._wfile.write(data)

    def close(self):
        pass


class _SilentOmukaeHandler(server.OmukaeHandler):
    def log_message(self, format, *args):
        pass


class TestPathTraversalAndHTTP(unittest.TestCase):
    """静的ファイル配信・APIエンドポイントのHTTP統合テスト"""

    @classmethod
    def setUpClass(cls):
        cls.tmp_dir = tempfile.TemporaryDirectory()
        base = Path(cls.tmp_dir.name)
        cls.public_dir = base / "public"
        cls.public_dir.mkdir()
        (cls.public_dir / "index.html").write_text("<h1>OK</h1>", encoding="utf-8")
        (cls.public_dir / "styles.css").write_text("body{}", encoding="utf-8")

        # プレフィックスが一致する兄弟ディレクトリ（public_secret）と親ファイル（secret.txt）
        cls.sibling_dir = base / "public_secret"
        cls.sibling_dir.mkdir()
        (cls.sibling_dir / "leak.txt").write_text("SECRET_SIBLING", encoding="utf-8")
        (base / "secret.txt").write_text("SECRET_PARENT", encoding="utf-8")

        cls._orig_public_dir = server.PUBLIC_DIR
        server.PUBLIC_DIR = cls.public_dir

    @classmethod
    def tearDownClass(cls):
        server.PUBLIC_DIR = cls._orig_public_dir
        cls.tmp_dir.cleanup()

    def _raw_http(self, raw_request: bytes) -> tuple[int, str]:
        sock = _FakeSocket(raw_request)
        _SilentOmukaeHandler(sock, ("127.0.0.1", 55555), None)
        raw_resp = sock._wfile.getvalue().decode("utf-8", errors="replace")
        head, _, body = raw_resp.partition("\r\n\r\n")
        status_line = head.splitlines()[0]
        code = int(status_line.split()[1])
        return code, body

    def test_valid_static_files_served(self):
        code, body = self._raw_http(b"GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        self.assertEqual(code, 200)
        self.assertIn("<h1>OK</h1>", body)

        code2, body2 = self._raw_http(b"GET /styles.css HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        self.assertEqual(code2, 200)
        self.assertEqual(body2, "body{}")

    def test_blocks_traversal_and_sibling_prefix_bypass(self):
        attacks = [
            b"GET /../secret.txt HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
            b"GET /../public_secret/leak.txt HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
            b"GET /%2e%2e/public_secret/leak.txt HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
            b"GET /%2e%2e/secret.txt HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
            b"GET /%00index.html HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
        ]
        for req in attacks:
            code, body = self._raw_http(req)
            self.assertEqual(code, 404, msg=f"Attack was not blocked: {req!r}")
            self.assertNotIn("SECRET_", body)

    def test_api_status_and_local_ip_cache(self):
        code, body = self._raw_http(b"GET /api/status HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
        self.assertEqual(code, 200)
        data = json.loads(body)
        self.assertIn("apiKeyConfigured", data)
        self.assertIn("model", data)
        self.assertIn("localIp", data)

    def test_malformed_post_requests_return_400_not_500(self):
        with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "dummy-test-key"}):
            # 1) 不正な Content-Length（数値以外）
            code, body = self._raw_http(
                b"POST /api/hearing-chat HTTP/1.1\r\nHost: localhost\r\nContent-Length: abc\r\nConnection: close\r\n\r\n"
            )
            self.assertEqual(code, 400)
            self.assertIn("Content-Length", json.loads(body)["error"])

            # 2) 負の Content-Length
            code, body = self._raw_http(
                b"POST /api/hearing-chat HTTP/1.1\r\nHost: localhost\r\nContent-Length: -5\r\nConnection: close\r\n\r\n"
            )
            self.assertEqual(code, 400)

            # 3) JSONルートが配列（[]）
            payload = b"[]"
            code, body = self._raw_http(
                b"POST /api/hearing-chat HTTP/1.1\r\nHost: localhost\r\n"
                + f"Content-Length: {len(payload)}\r\nConnection: close\r\n\r\n".encode("ascii")
                + payload
            )
            self.assertEqual(code, 400)

            # 4) 壊れたJSON
            bad_json = b"{not-json"
            code, body = self._raw_http(
                b"POST /api/hearing-chat HTTP/1.1\r\nHost: localhost\r\n"
                + f"Content-Length: {len(bad_json)}\r\nConnection: close\r\n\r\n".encode("ascii")
                + bad_json
            )
            self.assertEqual(code, 400)

    def test_read_json_body_rejects_oversized_payload(self):
        handler = server.OmukaeHandler.__new__(server.OmukaeHandler)
        handler.headers = FakeHeaders({"Content-Length": str(21 * 1024 * 1024)})
        handler.rfile = io.BytesIO(b"")
        with self.assertRaises(ValueError):
            handler.read_json_body()


class TestJsonAndNormalization(unittest.TestCase):
    """Gemini応答JSON抽出・スキーマ正規化の単体テスト"""

    def test_extract_json_with_leading_prose_and_fence(self):
        raw = 'はい、診断しました！\n```json\n{"status": "safe", "score": 92}\n```\nご確認ください。'
        self.assertEqual(server.extract_json_text(raw), {"status": "safe", "score": 92})

    def test_extract_json_with_bare_prose_prefix(self):
        raw = '以下が診断結果です： {"status": "caution", "score": 75} 以上です。'
        self.assertEqual(server.extract_json_text(raw), {"status": "caution", "score": 75})

    def test_extract_json_unwraps_single_object_list(self):
        raw = '[{"status": "safe", "score": 88}]'
        self.assertEqual(server.extract_json_text(raw), {"status": "safe", "score": 88})

    def test_extract_json_rejects_non_object_or_invalid(self):
        for bad in ('[1, 2, 3]', '"hello"', "これはJSONではありません"):
            with self.assertRaises(ValueError):
                server.extract_json_text(bad)

    def test_normalize_photo_result(self):
        norm = server._normalize_photo_result({
            "status": "unknown_status",
            "score": 150,
            "summary": None,
            "goodPoints": "良い点1つ",
            "risks": [None, " 隙間あり "],
            "improvements": 123,
            "shoppingItems": ["invalid", {"item": "網戸ロック", "where": "100均"}],
        })
        self.assertEqual(norm["status"], "caution")
        self.assertEqual(norm["score"], 100)
        self.assertEqual(norm["summary"], "")
        self.assertEqual(norm["goodPoints"], ["良い点1つ"])
        self.assertEqual(norm["risks"], ["隙間あり"])
        self.assertEqual(norm["improvements"], [])
        self.assertEqual(len(norm["shoppingItems"]), 1)
        self.assertEqual(norm["shoppingItems"][0]["item"], "網戸ロック")

    def test_normalize_hearing_and_report_result(self):
        h = server._normalize_hearing_result({
            "reply": "",
            "answeredCount": 9,
            "quickReplies": "はい",
            "summary": None,
        })
        self.assertEqual(h["answeredCount"], 5)
        self.assertTrue(h["isComplete"])
        self.assertTrue(len(h["reply"]) > 0)
        self.assertEqual(h["quickReplies"], ["はい"])
        self.assertEqual(set(h["summary"].keys()), {
            "housing", "careRoutine", "familyAgreement", "safetyAwareness", "emergencyPlan"
        })

        r = server._normalize_report_result({
            "overallReadiness": "bad",
            "priorityActions": "対策1",
            "shoppingList": [None, {"item": "コードカバー"}],
        })
        self.assertEqual(r["overallReadiness"], "almost")
        self.assertEqual(r["priorityActions"], ["対策1"])
        self.assertEqual(len(r["shoppingList"]), 1)


class TestHearingFallbackAndThreadSafety(unittest.TestCase):
    """ヒアリング継続フォールバックと並行処理・キャッシュのテスト"""

    def test_consecutive_user_messages_do_not_skip_questions(self):
        msgs = [
            {"role": "ai", "text": "【1/5】お住まいを教えてください。"},
            {"role": "user", "text": "ペット可の賃貸です"},
            {"role": "user", "text": "管理規約も確認しました"},
        ]
        res = server.build_hearing_fallback_reply(msgs)
        self.assertEqual(res["answeredCount"], 1)
        self.assertFalse(res["isComplete"])
        self.assertIn("ペット可の賃貸です", res["summary"]["housing"])
        self.assertEqual(res["summary"]["careRoutine"], "")

    def test_carries_over_existing_progress_across_error_retry(self):
        msgs = [
            {"role": "ai", "text": "【1/5】住居は？"},
            {"role": "user", "text": "ペット可マンション"},
            {"role": "ai", "text": "深掘り質問です"},
            {"role": "user", "text": "規約も提出可能です"},
            {"role": "ai", "text": "【2/5】留守番時間は？"},
            {"role": "user", "text": "日中は在宅です"},
            {"role": "ai", "text": "【3/5】ご家族の同意は？"},
            {"role": "user", "text": "家族全員賛成です"},
            {"role": "ai", "text": "通信が一時的に不安定でした（timeout）"},
        ]
        res = server.build_hearing_fallback_reply(
            msgs,
            current_answered=2,
            current_summary={"housing": "ペット可マンション（規約あり）", "careRoutine": "在宅勤務"},
            pet_type="dog",
        )
        self.assertEqual(res["answeredCount"], 3)
        self.assertEqual(res["summary"]["housing"], "ペット可マンション（規約あり）")
        self.assertEqual(res["summary"]["careRoutine"], "在宅勤務")
        self.assertEqual(res["summary"]["familyAgreement"], "家族全員賛成です")
        self.assertIn("室内飼育・脱走防止対策", res["reply"])
        self.assertNotIn("猫の場合", res["reply"])

    def test_completes_on_fifth_answer(self):
        res = server.build_hearing_fallback_reply(
            [{"role": "user", "text": "徒歩5分に病院があります"}],
            current_answered=4,
            current_summary={
                "housing": "持ち家",
                "careRoutine": "留守番少なめ",
                "familyAgreement": "同意済み",
                "safetyAwareness": "完全室内飼い",
                "emergencyPlan": "",
            },
        )
        self.assertEqual(res["answeredCount"], 5)
        self.assertTrue(res["isComplete"])
        self.assertEqual(res["quickReplies"], [])

    def test_get_local_ip_caches_result(self):
        orig_ip = server._CACHED_LOCAL_IP
        try:
            server._CACHED_LOCAL_IP = None
            fake_sock = mock.MagicMock()
            fake_sock.getsockname.return_value = ("192.168.1.42", 12345)
            with mock.patch("server.socket.socket", return_value=fake_sock) as sock_cls:
                self.assertEqual(server.get_local_ip(), "192.168.1.42")
                self.assertEqual(server.get_local_ip(), "192.168.1.42")
                self.assertEqual(server.get_local_ip(), "192.168.1.42")
                self.assertEqual(sock_cls.call_count, 1)
        finally:
            server._CACHED_LOCAL_IP = orig_ip

    def test_concurrent_model_fallback_with_lock(self):
        orig_candidates = server._CACHED_CANDIDATES
        orig_last = server._LAST_WORKING_MODEL
        orig_cooldown = dict(server._MODEL_COOLDOWN_UNTIL)
        try:
            server._CACHED_CANDIDATES = ["gemini-2.5-flash", "gemini-2.0-flash"]
            server._LAST_WORKING_MODEL = None
            server._MODEL_COOLDOWN_UNTIL.clear()

            def fake_once(api_key, model, parts, system_instruction, temperature, timeout):
                if model == "gemini-2.5-flash":
                    raise server.GeminiHTTPError(503, "unavailable")
                return {"ok": True, "used": model}

            with mock.patch("server._request_gemini_once", side_effect=fake_once):
                with mock.patch("pathlib.Path.write_text"):
                    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                        results = list(
                            pool.map(
                                lambda _: server.call_gemini_json("key", [{"text": "hi"}], "sys"),
                                range(12),
                            )
                        )
            for parsed, model in results:
                self.assertEqual(model, "gemini-2.0-flash")
                self.assertTrue(parsed["ok"])
        finally:
            server._CACHED_CANDIDATES = orig_candidates
            server._LAST_WORKING_MODEL = orig_last
            server._MODEL_COOLDOWN_UNTIL.clear()
            server._MODEL_COOLDOWN_UNTIL.update(orig_cooldown)


class TestInputHardeningAndEdgeCases(unittest.TestCase):
    """非文字列・異常型ペイロードに対するAPI境界防御のテスト"""

    def test_analyze_photo_rejects_non_string_image_and_coerces_note(self):
        with self.assertRaises(ValueError):
            server.analyze_photo_with_gemini("k", {"imageDataUrl": 123})

        with mock.patch(
            "server.call_gemini_json",
            return_value=({"status": "safe", "score": 90}, "gemini-2.0-flash"),
        ):
            res = server.analyze_photo_with_gemini(
                "k",
                {"imageDataUrl": "data:image/jpeg;base64,AAAA", "note": 123, "areaId": None},
            )
        self.assertEqual(res["status"], "safe")
        self.assertEqual(res["model"], "gemini-2.0-flash")

    def test_hearing_chat_handles_malformed_list_and_items(self):
        with mock.patch(
            "server.call_gemini_json",
            return_value=({"reply": "質問1です", "answeredCount": 0}, "gemini-2.0-flash"),
        ):
            res = server.hearing_chat_with_gemini(
                "k",
                {
                    "messages": ["not-a-dict", {"role": "user", "text": "持ち家です"}],
                    "photoSummaries": [None, 42],
                },
            )
            self.assertEqual(res["reply"], "質問1です")

            res2 = server.hearing_chat_with_gemini(
                "k",
                {"messages": "invalid", "photoSummaries": "invalid"},
            )
            self.assertEqual(res2["reply"], "質問1です")

    def test_generate_report_handles_malformed_types(self):
        with mock.patch(
            "server.call_gemini_json",
            return_value=({"overallReadiness": "ready"}, "gemini-2.0-flash"),
        ):
            res = server.generate_report_with_gemini(
                "k",
                {
                    "applicantName": 999,
                    "photoResults": "bad",
                    "hearingSummary": [],
                    "hearingMessages": "bad",
                },
            )
        self.assertEqual(res["overallReadiness"], "ready")

    def test_request_gemini_once_handles_null_content(self):
        with mock.patch(
            "server.http_json",
            return_value={"candidates": [{"content": None}]},
        ):
            with self.assertRaises(RuntimeError):
                server._request_gemini_once("k", "gemini-2.0-flash", [{"text": "hi"}], "sys", 0.3)


class TestFrontendAndRepoHygiene(unittest.TestCase):
    """フロントエンドJS/HTMLの静的検証と機密情報チェック"""

    def test_relative_paths_for_github_pages_preserved(self):
        html = (ROOT_DIR / "public" / "index.html").read_text(encoding="utf-8")
        self.assertIn("./styles.css", html)
        self.assertIn("./app.js", html)
        self.assertIn("./images/", html)
        self.assertNotIn('href="/styles.css"', html)
        self.assertNotIn('src="/app.js"', html)

    def test_app_js_fixes_present_and_balanced(self):
        js = (ROOT_DIR / "public" / "app.js").read_text(encoding="utf-8")
        required_tokens = [
            "demoDog:",
            "getDemoAreaData",
            "getDemoHearingStep",
            "buildDynamicDemoReport",
            "SAMPLE_PREVIEW_REPORT_DOG",
            "getSamplePreviewReport",
            "sampleCheckedShopping",
            "getShoppingItemKey",
            "renderSingleArea",
            "buildAreaCard",
            "toArray",
            "resetUnstartedHearingIfNeeded",
            "getFullYear()",
            "answeredCount: state.hearingAnswered",
            "hearingSummary: state.hearingSummary",
            "if (state.hearingLoading) return;",
            "if (stepNum !== 4)",
            'p.loading ? "disabled" : ""',
        ]
        for token in required_tokens:
            self.assertIn(token, js, msg=f"Expected symbol {token!r} missing in public/app.js")
        self.assertNotIn("2026年 ＿＿月 ＿＿日", js)

        # 文字・コメントを除いた括弧・ブレースのバランス確認
        stack = []
        pairs = {"(": ")", "{": "}", "[": "]"}
        i = 0
        n = len(js)
        in_str = None
        while i < n:
            ch = js[i]
            nxt = js[i + 1] if i + 1 < n else ""
            if in_str:
                if ch == "\\":
                    i += 2
                    continue
                if ch == in_str:
                    in_str = None
                i += 1
                continue
            if ch == "/" and nxt == "/":
                end = js.find("\n", i)
                i = n if end == -1 else end + 1
                continue
            if ch == "/" and nxt == "*":
                end = js.find("*/", i + 2)
                self.assertNotEqual(end, -1, "Unclosed block comment in public/app.js")
                i = end + 2
                continue
            if ch in ("'", '"', "`"):
                in_str = ch
                i += 1
                continue
            if ch in pairs:
                stack.append((ch, i))
            elif ch in pairs.values():
                self.assertTrue(stack, f"Unexpected closing {ch!r} at offset {i}")
                top, _ = stack.pop()
                self.assertEqual(pairs[top], ch, f"Mismatched {top!r} and {ch!r} at offset {i}")
            i += 1
        self.assertIsNone(in_str, "Unclosed string literal in public/app.js")
        self.assertEqual(stack, [], f"Unclosed delimiters in public/app.js: {stack}")

    def test_no_api_key_or_secret_patterns_in_source_files(self):
        pattern = re.compile(r"AIzaSy[0-9A-Za-z_-]{20,}")
        for path in [ROOT_DIR / "server.py", ROOT_DIR / "public" / "app.js", ROOT_DIR / "public" / "index.html"]:
            content = path.read_text(encoding="utf-8")
            self.assertIsNone(pattern.search(content), msg=f"Potential API key found in {path}")


if __name__ == "__main__":
    unittest.main()
