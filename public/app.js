/* おむかえナビ (omukae-navi) フロントエンドロジック */

const STORAGE_KEY = "omukae_navi_state_v2";

const SVG_PATHS = {
  window: `<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="10.2" y1="10" x2="10.2" y2="14"/>`,
  entrance: `<path d="M5 20V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15"/><line x1="3" y1="20" x2="21" y2="20"/><circle cx="15" cy="12" r="1.1"/>`,
  living: `<path d="M12 21V11"/><path d="M12 13C7.5 13 5 9.8 5 5.5c4.3 0 7 2.5 7 7.5z"/><path d="M12 11c0-4.2 2.8-6.8 7-6.8 0 4.2-2.6 6.8-7 6.8z"/>`,
  space: `<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M12 17.2s-3-1.8-3-3.7a1.7 1.7 0 0 1 3-1.1 1.7 1.7 0 0 1 3 1.1c0 1.9-3 3.7-3 3.7z"/>`,
  camera: `<path d="M4 8h3l1.6-2.5A1.5 1.5 0 0 1 9.9 5h4.2a1.5 1.5 0 0 1 1.3.5L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="13.5" r="3.2"/>`,
  sparkle: `<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>`,
  checkCircle: `<circle cx="12" cy="12" r="9"/><path d="M8.5 12.2l2.3 2.3 4.7-4.8"/>`,
  check: `<polyline points="5 12.5 10 17.5 19 7.5"/>`,
  alert: `<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12.5"/><circle cx="12" cy="16" r="0.8" fill="currentColor"/>`,
  bulb: `<path d="M9 18h6"/><path d="M10 21h4"/><path d="M8.5 14.5C7 13.3 6 11.6 6 9.5a6 6 0 1 1 12 0c0 2.1-1 3.8-2.5 5-.7.6-1.2 1.4-1.4 2.5h-4.2c-.2-1.1-.7-1.9-1.4-2.5z"/>`,
  bag: `<path d="M6 8h12l1 12a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>`,
  clipboard: `<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>`,
  lock: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`
};

const PAW_BADGE_SVG = `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M10 29L32 11.5L54 29" stroke="#e07a5f" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M44 17V13.5" stroke="#e07a5f" stroke-width="4.4" stroke-linecap="round"/><circle cx="22.5" cy="35.5" r="3.7" fill="#2f7d64"/><circle cx="32" cy="31" r="4" fill="#2f7d64"/><circle cx="41.5" cy="35.5" r="3.7" fill="#2f7d64"/><circle cx="17.2" cy="43.2" r="3" fill="#2f7d64"/><circle cx="46.8" cy="43.2" r="3" fill="#2f7d64"/><path d="M22.5 46.8c0-4.6 4.2-8.1 9.5-8.1s9.5 3.5 9.5 8.1c0 3.5-2.8 5.6-6 5.6-1.8 0-2.6-.7-3.5-.7s-1.7.7-3.5.7c-3.2 0-6-2.1-6-5.6z" fill="#2f7d64"/></svg>`;

function svgIcon(name, extraClass = "") {
  const path = SVG_PATHS[name] || "";
  return `<svg class="ui-icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const AREAS = [
  {
    id: "window",
    iconName: "window",
    title: "窓・網戸・ベランダ",
    tip: "窓のロックや網戸ストッパー、ベランダの隙間が写るように撮影してください",
    sampleImage: "./images/sample-window.jpg",
    demoStatus: "caution",
    demoScore: 76,
    demoSummary: "窓の鍵（クレセント錠）は確認できましたが、網戸ロックはこれから追加するとさらに安心です。",
    demoGoodPoints: ["窓ガラスに大きな破損がなく、周囲が整理されています。"],
    demoRisks: [
      "猫は網戸を自分で開けて脱走することがあります（網戸ストッパーが見当たりません）。",
      "換気時に少し開けた隙間からの飛び出しに注意が必要です。"
    ],
    demoImprovements: [
      "100円ショップの「引き戸・網戸ストッパー」を上下2箇所に貼ると安心です。",
      "換気時は補助ロックを活用し、猫が通れない幅（3cm以下）に制限しましょう。"
    ],
    demoShoppingItems: [
      {
        item: "引き戸・網戸ストッパー（2個組）",
        where: "100円ショップ",
        estimatedPrice: "約110〜220円",
        reason: "猫が自分で網戸を開けて脱走するのを防ぐため"
      },
      {
        item: "サッシ用 補助ロック（窓ロック）",
        where: "ホームセンター",
        estimatedPrice: "約500〜900円",
        reason: "換気時の窓の開き幅を安全に制限するため"
      }
    ],
    demoStaffPoint: "網戸ロック追加後の写真を1枚確認できれば、窓まわりの安全性は十分と判断できます。",
    demoDog: {
      status: "caution",
      score: 78,
      summary: "窓まわりの整理は良好ですが、誤って飛び出さないための網戸・サッシロックがあるとさらに安心です。",
      goodPoints: ["窓周辺に誤飲しやすそうな細かいものが少なく見通しが良いです。"],
      risks: [
        "外の音や犬に反応して網戸に体当たりし、外れてしまう危険があります。",
        "ベランダへ出る場合は手すりや柵の隙間をすり抜けないか確認が必要です。"
      ],
      improvements: [
        "サッシ用の補助ロックを付けて、換気時も犬が通れない開き幅に制限しましょう。",
        "ベランダに出る機会がある場合は隙間防止ネットや転落防止対策を整えると安心です。"
      ],
      shoppingItems: [
        {
          item: "サッシ用 補助ロック（窓ロック）",
          where: "ホームセンター",
          estimatedPrice: "約500〜900円",
          reason: "換気中に窓が開きすぎて犬が飛び出すのを防ぐため"
        }
      ],
      staffPoint: "窓ロック追加とベランダ柵の隙間確認ができれば、窓まわりの安全性は十分と判断できます。"
    }
  },
  {
    id: "entrance",
    iconName: "entrance",
    title: "玄関・出入口",
    tip: "ドアを開けたときの廊下や、リビングとの間の扉が写るように撮影してください",
    sampleImage: "./images/sample-entrance.jpg",
    demoStatus: "safe",
    demoScore: 90,
    demoSummary: "玄関とリビングの間に仕切り扉があり、二重の脱走対策として良好な環境です。",
    demoGoodPoints: [
      "玄関ドアと居住空間の間に中扉があり、帰宅時の飛び出しリスクを抑えられます。",
      "足元に誤飲しそうな小物が少なくスッキリしています。"
    ],
    demoRisks: ["中扉を開けっぱなしにしない習慣づくり（ご家族全員での共有）が大切です。"],
    demoImprovements: ["「ドアを閉めてね」ステッカーを貼っておくと来客時もさらに安心です。"],
    demoShoppingItems: [
      {
        item: "脱走注意ステッカー（ドア用）",
        where: "100円ショップ",
        estimatedPrice: "約110円",
        reason: "家族や来客が中扉を閉め忘れないようにするため"
      }
    ],
    demoStaffPoint: "中扉による二重構造を確認済み。玄関からの脱走リスクは低めです。",
    demoDog: {
      status: "safe",
      score: 88,
      summary: "玄関とリビングの間に仕切り扉があり、帰宅時や来客時の飛び出し防止として安心な構造です。",
      goodPoints: [
        "玄関ドアと生活スペースの間に仕切りがあり、二段階の飛び出し防止になっています。",
        "床に散歩用品や小物が散らばっておらず、安全に出入りできそうです。"
      ],
      risks: ["チャイムが鳴ったときや荷物受け取り時に中扉が開けっぱなしにならないよう注意が必要です。"],
      improvements: ["足腰が元気な犬種の場合は、ペットゲートの併用もさらに安心です。"],
      shoppingItems: [
        {
          item: "脱走注意ステッカー（ドア用）",
          where: "100円ショップ",
          estimatedPrice: "約110円",
          reason: "家族や来客が扉の閉め忘れにすぐ気づけるようにするため"
        }
      ],
      staffPoint: "二重扉による飛び出し防止を確認済み。玄関からの逸走リスクは低めです。"
    }
  },
  {
    id: "living",
    iconName: "living",
    title: "リビング・植物・危険物",
    tip: "観葉植物・花瓶・電気コード・床の小物が写る全体写真を撮影してください",
    sampleImage: "./images/sample-living.jpg",
    demoStatus: "action_needed",
    demoScore: 62,
    demoSummary: "室内の広さは十分ですが、観葉植物と電気コードの対策をお迎え前に行うのがおすすめです。",
    demoGoodPoints: ["明るく見通しのよいリビングで、健康状態を観察しやすい環境です。"],
    demoRisks: [
      "観葉植物が写っています（ポトス・ユリ科・ドラセナ等は猫に中毒の危険があります）。",
      "テレビ裏などの電源コードをかじってしまう恐れがあります。"
    ],
    demoImprovements: [
      "植物の種類を確認し、ペットに有害な場合は猫が入らない部屋へ移動しましょう。",
      "電源コードには100円ショップの「スパイラルチューブ（保護カバー）」を巻くと安全です。"
    ],
    demoShoppingItems: [
      {
        item: "スパイラルチューブ（配線保護カバー）",
        where: "100円ショップ",
        estimatedPrice: "約110〜220円",
        reason: "むき出しの電気コードをかじって感電するのを防ぐため"
      },
      {
        item: "ケーブル収納ボックス（タップ隠し）",
        where: "100円ショップ",
        estimatedPrice: "約330〜550円",
        reason: "電源タップや余ったコードをまとめて安全に隠すため"
      }
    ],
    demoStaffPoint: "写っている観葉植物の品種確認、または撤去・移動の確認を推奨します。",
    demoDog: {
      status: "action_needed",
      score: 64,
      summary: "明るく過ごしやすいリビングですが、観葉植物・電気コード・床の滑りやすさ対策をおすすめします。",
      goodPoints: ["視界が開けており、犬の様子を見守りやすいリビング環境です。"],
      risks: [
        "犬が届く高さに観葉植物があると、誤食して体調を崩す恐れがあります。",
        "電源コードをかじって感電するリスクや、フローリングで関節を痛める可能性があります。"
      ],
      improvements: [
        "観葉植物は犬に安全か確認し、口が届かない高さや別室へ移動しましょう。",
        "よく走る場所にはクッションマットやラグを敷き、コード類はカバーで保護しましょう。"
      ],
      shoppingItems: [
        {
          item: "スパイラルチューブ（配線保護カバー）",
          where: "100円ショップ",
          estimatedPrice: "約110〜220円",
          reason: "犬が電気コードをかじることによる感電や誤飲を防ぐため"
        },
        {
          item: "滑り止めクッションマット・ジョイントマット",
          where: "100円ショップ・ホームセンター",
          estimatedPrice: "約550〜2,000円",
          reason: "フローリングでの足腰・関節の負担や滑りを防ぐため"
        }
      ],
      staffPoint: "観葉植物の移動・種類確認、および電気コードと床の滑り対策の予定確認を推奨します。"
    }
  },
  {
    id: "space",
    iconName: "space",
    title: "飼育スペース（ケージ・トイレ）",
    tip: "ケージやトイレ、ごはん置き場を予定しているスペースを撮影してください",
    sampleImage: "./images/sample-space.jpg",
    demoStatus: "safe",
    demoScore: 88,
    demoSummary: "落ち着いて過ごせるスペースが確保されており、お迎え初期の環境として安心です。",
    demoGoodPoints: [
      "ケージとトイレを無理なく置けるスペースがあります。",
      "直射日光が当たりすぎず、人の気配を感じながら休めそうです。"
    ],
    demoRisks: ["エアコンの風が直接当たらないか、季節ごとの温度調整を確認しておきましょう。"],
    demoImprovements: ["お迎え初日はケージに薄手の布を少しかけると、猫が隠れ場所を作れて安心します。"],
    demoShoppingItems: [
      {
        item: "ケージ目隠し用の薄手ブランケット・大判布",
        where: "100円ショップ",
        estimatedPrice: "約330〜550円",
        reason: "お迎え初日の緊張をやわらげる隠れ場所を作るため"
      }
    ],
    demoStaffPoint: "飼育スペースは確保済み。お迎え時のケージ設置予定をオンライン面談で確認でOK。",
    demoDog: {
      status: "safe",
      score: 88,
      summary: "サークルやクレートを無理なく置ける広さがあり、落ち着いて過ごせる飼育スペースです。",
      goodPoints: [
        "寝床とトイレを少し離して配置できる十分なスペースが確保されています。",
        "直射日光を避けながら家族の気配を感じられる落ち着いた場所です。"
      ],
      risks: ["床材が滑りやすい場合は、サークル内にペット用マットを敷くと足腰にやさしいです。"],
      improvements: ["お迎え初期はサークルの一部を布で覆うと、犬が安心できる巣穴のような空間になります。"],
      shoppingItems: [
        {
          item: "滑り止めシート・サークル用マット",
          where: "100円ショップ・ホームセンター",
          estimatedPrice: "約330〜880円",
          reason: "犬がサークル内で踏ん張りやすくし、関節を守るため"
        }
      ],
      staffPoint: "飼育スペースは確保済み。サークルとトイレの配置予定を面談で確認できれば問題ありません。"
    }
  }
];

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) return [val.trim()];
  return [];
}

function getDemoAreaData(area, petType = state.petType) {
  if (petType === "dog" && area.demoDog) {
    return area.demoDog;
  }
  return {
    status: area.demoStatus,
    score: area.demoScore,
    summary: area.demoSummary,
    goodPoints: area.demoGoodPoints || [],
    risks: area.demoRisks || [],
    improvements: area.demoImprovements || [],
    shoppingItems: area.demoShoppingItems || [],
    staffPoint: area.demoStaffPoint || ""
  };
}

const DEMO_HEARING_SCRIPT = [
  {
    q: "こんにちは！おむかえナビのAIヒアリング担当です。\n自治体や保護団体への事前確認として、5つの質問を順番にお伺いしますね。\n\n【1/5】現在のお住まいは、ペットの飼育が可能な環境（持ち家・ペット可賃貸など）でしょうか？",
    chips: ["ペット可の賃貸（規約確認済み）", "持ち家（戸建て・マンション）", "これから管理会社に確認する"]
  },
  {
    q: "ありがとうございます！住居の条件が確認できました。\n\n【2/5】普段のお留守番時間は1日あたり何時間くらいになりそうですか？主にお世話される方も教えてください。",
    chips: ["日中は在宅（留守番ほぼなし）", "平日は6〜8時間ほど留守番", "家族で交代して見守れる"]
  },
  {
    q: "生活リズムがよく分かりました。無理なく見守れそうですね！\n\n【3/5】同居されているご家族全員がお迎えに同意されていますか？また、動物アレルギーのある方はいらっしゃいますか？",
    chips: ["全員同意・アレルギーなし", "一人暮らし・アレルギーなし", "これから家族ともう一度話す"]
  },
  {
    q: "ご家族の協力体制があるのはとても心強いです！\n\n【4/5】猫の場合は完全室内飼い、犬猫共通で脱走防止や終生飼養（最後まで責任を持って育てること）について、現在のお考えを教えてください。",
    chips: ["完全室内飼いで最後まで大切に育てる", "脱走防止対策をしっかり整えて迎える"]
  },
  {
    q: "素敵な心構えですね！いよいよ最後の質問です。\n\n【5/5】かかりつけ予定の動物病院は近くにありますか？また、急病や災害時の備え・預け先のイメージはありますか？",
    chips: ["徒歩・車圏内に動物病院あり、キャリーも準備予定", "これから近所の病院を探す予定"]
  }
];

function getDemoHearingStep(idx, petType = state.petType) {
  if (idx === 3 && petType === "dog") {
    return {
      q: "ご家族の協力体制があるのはとても心強いです！\n\n【4/5】室内での安全な居場所づくりや脱走防止、終生飼養（最後まで責任を持って育てること）について、現在のお考えを教えてください。",
      chips: ["室内の安全環境と脱走防止対策を整えて迎える", "終生飼養の責任を持って最後まで大切に育てる"]
    };
  }
  return DEMO_HEARING_SCRIPT[idx] || DEMO_HEARING_SCRIPT[DEMO_HEARING_SCRIPT.length - 1];
}

const SAMPLE_PREVIEW_REPORT = {
  overallReadiness: "almost",
  overallLabel: "あと少しの準備でさらに安心してお迎えできます",
  overallComment:
    "お部屋のスペースや玄関の二重対策など、大切なポイントがしっかり整っています！窓の網戸ロックと観葉植物の確認だけお迎え前に済ませれば、さらに安心して新しい家族を迎えられます。",
  staffSummary:
    "写真およびヒアリング内容から、基本的な飼育スペース・脱走防止意識・ご家族の同意が確認できました。玄関は中扉ありで良好です。観葉植物の品種確認と網戸ロック設置後の写真を追加確認いただければ、現地訪問を省略してオンライン面談へ進める水準です。",
  recommendedNextStep: "網戸ロック・植物対策の写真追加 ＋ 15分程度のオンライン面談で最終確認",
  priorityActions: [
    "窓・網戸に補助ストッパーを設置する（100円ショップ等で入手可能）",
    "リビングの観葉植物がペットに安全か確認し、有害な場合は別室へ移動する",
    "お迎え日までに近隣の動物病院の診療時間・休診日をメモしておく"
  ],
  shoppingList: [
    {
      item: "引き戸・網戸ストッパー（上下2箇所用）",
      where: "100円ショップ",
      estimatedPrice: "約220円",
      priority: "優先",
      note: "窓・網戸からの脱走対策としてお迎え前に設置"
    },
    {
      item: "スパイラルチューブ（電気コード保護カバー）",
      where: "100円ショップ",
      estimatedPrice: "約110〜220円",
      priority: "優先",
      note: "リビングのテレビ裏や電源タップのコード保護に"
    },
    {
      item: "ケーブル収納ボックス",
      where: "100円ショップ",
      estimatedPrice: "約330〜550円",
      priority: "あると安心",
      note: "電源タップのホコリ・いたずら防止に"
    },
    {
      item: "ハードタイプのキャリーケース",
      where: "ペットショップ・通販",
      estimatedPrice: "約2,500〜4,500円",
      priority: "あると安心",
      note: "お迎え当日や動物病院への通院・災害時の移動用に"
    }
  ]
};

const state = {
  step: 1,
  apiKeyConfigured: false,
  modelName: "",
  petType: "cat",
  shelterPreset: "standard",
  hasResidentPet: false,
  applicantName: "",
  shelterName: "",
  photos: {}, // areaId -> { dataUrl, note, result, previousResult, loading }
  hearingMessages: [],
  hearingAnswered: 0,
  hearingComplete: false,
  hearingSummary: {
    housing: "",
    careRoutine: "",
    familyAgreement: "",
    safetyAwareness: "",
    emergencyPlan: ""
  },
  hearingLoading: false,
  quickReplies: [],
  report: null,
  checkedShopping: {}, // itemKey -> boolean
  reportView: "applicant", // "applicant" | "submission"
  samplePreviewMode: false
};

// サンプル見本プレビュー専用のチェック状態（本番の保存データに混ぜない）
let sampleCheckedShopping = {};

function getShoppingItemKey(itemObj, idx = 0) {
  const name = String(itemObj?.item || "").trim();
  return name || `item-${idx}`;
}

function buildDynamicDemoReport() {
  const analyzedAreas = AREAS
    .map((area) => ({ area, photo: state.photos[area.id] }))
    .filter((entry) => entry.photo && entry.photo.result);

  const safeCount = analyzedAreas.filter((e) => e.photo.result.status === "safe").length;
  const cautionCount = analyzedAreas.filter((e) => e.photo.result.status === "caution").length;
  const actionCount = analyzedAreas.filter((e) => e.photo.result.status === "action_needed").length;
  const analyzedNames = analyzedAreas.map((e) => e.area.title).join("・") || "未実施";
  const missingCount = AREAS.length - analyzedAreas.length;
  const petLabel = PET_LABELS[state.petType] || "保護猫・保護犬";

  let overallReadiness = "almost";
  let overallLabel = "あと少しの準備でさらに安心してお迎えできます";
  if (analyzedAreas.length === 0) {
    overallReadiness = "needs_prep";
    overallLabel = "まずは写真チェックとヒアリングを進めましょう";
  } else if (actionCount > 0) {
    overallReadiness = "almost";
    overallLabel = "お迎え前の優先対策ポイントを確認しておきましょう";
  } else if (cautionCount === 0 && missingCount === 0 && state.hearingAnswered >= 5) {
    overallReadiness = "ready";
    overallLabel = "おうち環境の準備がしっかり整っています！";
  }

  const recheckedAreas = analyzedAreas.filter((e) => Boolean(e.photo.previousResult));
  const areaPhrase = missingCount === 0
    ? "4箇所すべてのチェック"
    : `${analyzedNames}（計${analyzedAreas.length}箇所）のチェック`;
  const recheckPhrase = recheckedAreas.length
    ? `また、${recheckedAreas.map((e) => e.area.title).join("・")}では対策後の再確認も完了しています。`
    : "";
  const hearingPhrase = state.hearingAnswered >= 5
    ? "事前ヒアリング5項目も確認済みです。"
    : `事前ヒアリングは現在 ${state.hearingAnswered}/5 問まで回答済みです。`;

  const overallComment =
    `${petLabel}のお迎えに向けた${areaPhrase}が完了しました。${recheckPhrase}${hearingPhrase}` +
    (actionCount + cautionCount > 0
      ? "気になったポイントだけ事前に対策しておくと、より安心して新しい家族を迎えられます。"
      : "良い点が多く、このまま前向きにお迎え準備を進められる状態です。");

  const staffSummary =
    `Web体験モードによる事前確認サマリー（診断済み：${analyzedAreas.length}/${AREAS.length}箇所、` +
    `準備バッチリ ${safeCount}・あと少し ${cautionCount}・要対策 ${actionCount}、` +
    `ヒアリング ${state.hearingAnswered}/5問回答）。` +
    (missingCount > 0 ? "未登録の場所はオンライン面談または追加写真で確認可能です。" : "");

  const recommendedNextStep =
    actionCount + cautionCount > 0
      ? "気になるポイントの対策写真追加 ＋ オンライン面談での最終確認"
      : missingCount > 0 || state.hearingAnswered < 5
        ? "未確認項目のヒアリング・追加写真確認 ＋ オンライン面談"
        : "15分程度のオンライン面談による最終確認";

  const seenActions = new Set();
  const priorityActions = [];
  analyzedAreas.forEach(({ photo }) => {
    const res = photo.result;
    if (res.status === "safe") return;
    toArray(res.improvements).forEach((imp) => {
      if (imp && !seenActions.has(imp) && priorityActions.length < 4) {
        seenActions.add(imp);
        priorityActions.push(imp);
      }
    });
  });
  if (state.hearingAnswered < 5) {
    priorityActions.push("ステップ3の残りヒアリング項目を完了しておくと提出内容がより充実します");
  }
  if (priorityActions.length === 0) {
    priorityActions.push("お迎え日までに近隣の動物病院の診療時間・休診日をメモしておく");
  }

  const seenShop = new Set();
  const shoppingList = [];
  analyzedAreas.forEach(({ area, photo }) => {
    const items = Array.isArray(photo.result.shoppingItems) ? photo.result.shoppingItems : [];
    items.forEach((s) => {
      const name = String(s.item || "").trim();
      if (!name || seenShop.has(name)) return;
      seenShop.add(name);
      shoppingList.push({
        item: name,
        where: s.where || "100円ショップ等",
        estimatedPrice: s.estimatedPrice || "",
        priority: photo.result.status === "action_needed" ? "優先" : "あると安心",
        note: s.reason || `${area.title}の安全対策`
      });
    });
  });

  return {
    overallReadiness,
    overallLabel,
    overallComment,
    staffSummary,
    recommendedNextStep,
    priorityActions,
    shoppingList
  };
}

const PET_LABELS = { cat: "保護猫", dog: "保護犬" };
const PRESET_LABELS = {
  standard: "自治体・動物愛護管理センター",
  strict_cat: "民間の保護団体・保護カフェ",
  personal: "個人の保護主さん・検討中"
};

function getAdoptionSourceLabel() {
  const base = PRESET_LABELS[state.shelterPreset] || PRESET_LABELS.standard;
  return state.hasResidentPet ? `${base}（先住ペットあり）` : base;
}
const STATUS_LABELS = {
  pending: "未チェック",
  safe: "準備バッチリ",
  caution: "あと少し",
  action_needed: "ここを対策"
};

const METER_CAPTIONS = {
  safe: "安心してお迎えできる状態です",
  caution: "あと少しの工夫でさらに安心になります",
  action_needed: "お迎え前にここを整えておきましょう"
};

/* ---------- Initialization ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const restored = loadState();
  checkApiStatus();
  bindNavigation();
  bindStep1();
  syncStep1Inputs();
  renderAreas();
  bindChat();
  bindReportActions();
  updateStepperUI();

  if (restored) {
    document.getElementById("restoreBanner").classList.remove("hidden");
  }
});

async function checkApiStatus() {
  const badge = document.getElementById("apiStatusBadge");
  const demoNotice = document.getElementById("demoNotice");
  try {
    const res = await fetch("/api/status");
    if (!res.ok) throw new Error("static host");
    const data = await res.json();
    state.apiKeyConfigured = Boolean(data.apiKeyConfigured);
    state.modelName = data.model || "Gemini";
    if (state.apiKeyConfigured) {
      badge.innerHTML = `${svgIcon("sparkle", "icon-xs")} Gemini AI 接続中`;
      badge.className = "status-pill live";
      demoNotice.classList.add("hidden");
    } else {
      badge.textContent = "体験版モード（APIキー未設定）";
      badge.className = "status-pill demo";
      demoNotice.classList.remove("hidden");
    }
  } catch (e) {
    state.apiKeyConfigured = false;
    badge.textContent = "Web体験版モード";
    badge.className = "status-pill demo";
    demoNotice.classList.remove("hidden");
  }
}

/* ---------- Auto Save / Restore ---------- */
function saveState() {
  const compactPhotos = {};
  Object.entries(state.photos).forEach(([id, p]) => {
    if (!p) return;
    compactPhotos[id] = {
      dataUrl: p.dataUrl || "",
      note: p.note || "",
      result: p.result || null,
      previousResult: p.previousResult || null
    };
  });

  const payload = {
    petType: state.petType,
    shelterPreset: state.shelterPreset,
    hasResidentPet: state.hasResidentPet,
    applicantName: state.applicantName,
    shelterName: state.shelterName,
    photos: compactPhotos,
    hearingMessages: state.hearingMessages,
    hearingAnswered: state.hearingAnswered,
    hearingComplete: state.hearingComplete,
    hearingSummary: state.hearingSummary,
    quickReplies: state.quickReplies,
    report: state.report,
    checkedShopping: state.checkedShopping
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    // 画像が大きく容量超過した場合は、画像データだけ除いて診断結果とテキストを安全保存
    try {
      const textOnlyPhotos = {};
      Object.entries(compactPhotos).forEach(([id, p]) => {
        textOnlyPhotos[id] = { ...p, dataUrl: "" };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, photos: textOnlyPhotos }));
    } catch (_) {
      // ignore storage failure
    }
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const hasMeaningfulData =
      saved.applicantName ||
      saved.shelterName ||
      (saved.photos && Object.keys(saved.photos).length > 0) ||
      (saved.hearingMessages && saved.hearingMessages.length > 0);
    if (!hasMeaningfulData) return false;

    state.petType = saved.petType || "cat";
    if (saved.shelterPreset === "multi_pet") {
      state.shelterPreset = "standard";
      state.hasResidentPet = true;
    } else {
      state.shelterPreset = PRESET_LABELS[saved.shelterPreset] ? saved.shelterPreset : "standard";
      state.hasResidentPet = Boolean(saved.hasResidentPet);
    }
    state.applicantName = saved.applicantName || "";
    state.shelterName = saved.shelterName || "";
    state.photos = saved.photos || {};
    state.hearingMessages = saved.hearingMessages || [];
    state.hearingAnswered = Number(saved.hearingAnswered || 0);
    state.hearingComplete = Boolean(saved.hearingComplete);
    state.hearingSummary = { ...state.hearingSummary, ...(saved.hearingSummary || {}) };
    state.quickReplies = Array.isArray(saved.quickReplies) ? saved.quickReplies : [];
    state.report = saved.report || null;
    state.checkedShopping = saved.checkedShopping || {};
    return true;
  } catch (e) {
    return false;
  }
}

function clearSavedStateAndReload() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    // ignore
  }
  window.location.reload();
}

/* ---------- Readiness & Stepper ---------- */
function getReadinessStats() {
  const analyzedCount = Object.values(state.photos).filter((p) => p && p.result).length;
  const hearingAnswered = Math.min(5, Number(state.hearingAnswered || 0));
  const hearingDone = state.hearingComplete || hearingAnswered >= 5;
  const readyForReport = analyzedCount >= 1 && hearingAnswered >= 1;
  return { analyzedCount, hearingAnswered, hearingDone, readyForReport };
}

function updateStepperUI() {
  const { analyzedCount, hearingDone, readyForReport } = getReadinessStats();

  const btn1 = document.getElementById("stepBtn-1");
  const btn2 = document.getElementById("stepBtn-2");
  const btn3 = document.getElementById("stepBtn-3");
  const btn4 = document.getElementById("stepBtn-4");

  btn1.classList.toggle("completed", state.step > 1);
  btn1.querySelector(".step-state").innerHTML = state.step > 1 ? svgIcon("check", "icon-xs") : "";

  btn2.classList.toggle("completed", analyzedCount >= 1);
  btn2.querySelector(".step-state").innerHTML = analyzedCount >= 1 ? svgIcon("check", "icon-xs") : "";

  btn3.classList.toggle("completed", hearingDone);
  btn3.querySelector(".step-state").innerHTML = hearingDone ? svgIcon("check", "icon-xs") : "";

  btn4.classList.toggle("locked", !readyForReport);
  btn4.classList.toggle("completed", readyForReport && Boolean(state.report));
  btn4.querySelector(".step-state").innerHTML = !readyForReport
    ? svgIcon("lock", "icon-xs")
    : state.report
      ? svgIcon("check", "icon-xs")
      : "";
}

/* ---------- Navigation ---------- */
function bindNavigation() {
  document.getElementById("brandHomeLink").addEventListener("click", (e) => {
    e.preventDefault();
    goToStep(1);
  });

  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Number(btn.dataset.step)));
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Number(btn.dataset.goto)));
  });

  document.getElementById("toStep2Btn").addEventListener("click", () => goToStep(2));
  document.getElementById("toStep3Btn").addEventListener("click", () => goToStep(3));
  document.getElementById("toStep4Btn").addEventListener("click", () => goToStep(4));
  document.getElementById("clearSavedBtn").addEventListener("click", () => {
    if (confirm("保存されている入力内容をリセットして最初から始めますか？")) {
      clearSavedStateAndReload();
    }
  });
}

function goToStep(stepNum) {
  state.applicantName = document.getElementById("applicantName").value.trim();
  state.shelterName = document.getElementById("shelterName").value.trim();
  state.step = stepNum;
  saveState();

  document.querySelectorAll(".step-panel").forEach((el) => el.classList.remove("active"));
  document.getElementById(`step-${stepNum}`).classList.add("active");

  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.step) === stepNum);
  });

  updateStepperUI();
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (stepNum === 3) {
    if (state.hearingMessages.length === 0) {
      startHearing();
    } else {
      renderChat(state.quickReplies);
    }
  }
  if (stepNum === 4) {
    enterStep4();
  }
}

/* ---------- Step 1 ---------- */
function resetUnstartedHearingIfNeeded() {
  if (state.hearingAnswered === 0 && state.hearingMessages.length <= 1) {
    state.hearingMessages = [];
    state.quickReplies = [];
  }
}

function bindStep1() {
  document.querySelectorAll("#petChoices .choice-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("#petChoices .choice-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.petType = card.dataset.pet;
      state.report = null;
      resetUnstartedHearingIfNeeded();
      saveState();
    });
  });

  document.querySelectorAll("#presetChoices .choice-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("#presetChoices .choice-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.shelterPreset = card.dataset.preset;
      state.report = null;
      resetUnstartedHearingIfNeeded();
      saveState();
    });
  });

  const residentInput = document.getElementById("hasResidentPet");
  const residentCard = document.getElementById("residentPetCard");
  residentInput.addEventListener("change", (e) => {
    state.hasResidentPet = e.target.checked;
    residentCard.classList.toggle("selected", state.hasResidentPet);
    state.report = null;
    resetUnstartedHearingIfNeeded();
    saveState();
  });

  ["applicantName", "shelterName"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (e) => {
      state[id] = e.target.value.trim();
      saveState();
    });
  });
}

function syncStep1Inputs() {
  document.getElementById("applicantName").value = state.applicantName;
  document.getElementById("shelterName").value = state.shelterName;
  document.querySelectorAll("#petChoices .choice-card").forEach((c) => {
    c.classList.toggle("selected", c.dataset.pet === state.petType);
  });
  document.querySelectorAll("#presetChoices .choice-card").forEach((c) => {
    c.classList.toggle("selected", c.dataset.preset === state.shelterPreset);
  });
  document.getElementById("hasResidentPet").checked = state.hasResidentPet;
  document.getElementById("residentPetCard").classList.toggle("selected", state.hasResidentPet);
}

/* ---------- Step 2: Photo AI Check ---------- */
function buildAreaCard(area) {
  const p = state.photos[area.id] || {};
  const status = p.result ? p.result.status : "pending";
  const needsImprovement = p.result && (status === "caution" || status === "action_needed");

  const card = document.createElement("div");
  card.className = "area-card";
  card.id = `area-card-${area.id}`;
  card.innerHTML = `
      <div class="area-head">
        <div>
          <h3 class="area-title"><span class="area-icon-badge">${svgIcon(area.iconName)}</span>${area.title}</h3>
          <p class="area-tip">${area.tip}</p>
        </div>
        <span class="badge ${status}">${STATUS_LABELS[status] || "未チェック"}</span>
      </div>

      <label class="upload-zone" for="file-${area.id}">
        ${
          p.dataUrl
            ? `<img src="${p.dataUrl}" alt="${area.title}の写真" />
               <div class="recheck-overlay">${svgIcon("camera", "icon-xs")} タップして写真を撮り直す・変更する</div>`
            : `<div class="upload-placeholder">
                 <strong>${svgIcon("camera")} 写真を撮る / 画像を選ぶ</strong>
                 スマホカメラ・PCフォルダに対応
               </div>`
        }
        <input
          type="file"
          id="file-${area.id}"
          accept="image/*"
          class="hidden"
        />
      </label>

      <input
        type="text"
        class="area-note-input"
        id="note-${area.id}"
        placeholder="補足メモ（例：賃貸で穴あけ不可、この植物はフェイクグリーンです 等）"
        value="${escapeHtml(p.note || "")}"
      />

      <div class="area-controls">
        <button type="button" class="btn primary" id="analyze-${area.id}" ${!p.dataUrl || p.loading ? "disabled" : ""}>
          ${
            p.loading
              ? "診断中...（10〜20秒ほど）"
              : p.result
                ? `${svgIcon("sparkle", "icon-xs")} もう一度AIチェックする`
                : `${svgIcon("sparkle", "icon-xs")} Geminiでチェックする`
          }
        </button>
        <button type="button" class="btn ghost" id="sample-${area.id}" ${p.loading ? "disabled" : ""}>
          サンプル写真で試す
        </button>
      </div>

      <div id="result-${area.id}">
        ${p.result ? renderAreaResultHtml(area, p, needsImprovement) : ""}
      </div>
    `;

  const fileInput = card.querySelector(`#file-${area.id}`);
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImageFile(file, 840, 0.78);
      const prev = state.photos[area.id] || {};
      // すでに診断済みの結果があれば「対策前（ビフォー）」として保持する
      const archivedPrevious = prev.result ? prev.result : prev.previousResult || null;
      state.photos[area.id] = {
        ...prev,
        dataUrl: resized,
        previousResult: archivedPrevious,
        result: null,
        loading: false
      };
      state.report = null;
      saveState();
      renderSingleArea(area);
      updateStepperUI();
    } catch (_) {
      alert("画像の読み込みに失敗しました。JPEG や PNG などの画像ファイルでお試しください。");
    } finally {
      e.target.value = "";
    }
  });

  const noteInput = card.querySelector(`#note-${area.id}`);
  noteInput.addEventListener("input", (e) => {
    state.photos[area.id] = {
      ...(state.photos[area.id] || {}),
      note: e.target.value
    };
    saveState();
  });

  const recheckBtn = card.querySelector(`#recheck-${area.id}`);
  if (recheckBtn) {
    recheckBtn.addEventListener("click", () => fileInput.click());
  }

  card.querySelector(`#analyze-${area.id}`).addEventListener("click", () => analyzeArea(area));
  card.querySelector(`#sample-${area.id}`).addEventListener("click", () => loadSampleForArea(area));
  return card;
}

function renderSingleArea(area) {
  const existing = document.getElementById(`area-card-${area.id}`);
  if (!existing) {
    renderAreas();
    return;
  }
  const activeEl = document.activeElement;
  const wasNoteFocused = activeEl && activeEl.id === `note-${area.id}`;
  const selStart = wasNoteFocused ? activeEl.selectionStart : null;
  const selEnd = wasNoteFocused ? activeEl.selectionEnd : null;

  const nextCard = buildAreaCard(area);
  existing.replaceWith(nextCard);
  updateAnalyzedCount();

  if (wasNoteFocused) {
    const nextNote = nextCard.querySelector(`#note-${area.id}`);
    if (nextNote) {
      nextNote.focus();
      if (selStart !== null && selEnd !== null) {
        nextNote.setSelectionRange(selStart, selEnd);
      }
    }
  }
}

function renderAreas() {
  const grid = document.getElementById("areasGrid");
  grid.innerHTML = "";
  AREAS.forEach((area) => {
    grid.appendChild(buildAreaCard(area));
  });
  updateAnalyzedCount();
}

function computeMeterPercent(res) {
  const raw = Number(res?.score);
  if (Number.isFinite(raw)) {
    return Math.max(24, Math.min(100, Math.round(raw)));
  }
  if (res?.status === "safe") return 92;
  if (res?.status === "caution") return 68;
  return 44;
}

function renderSafetyMeterHtml(res, compact = false) {
  const status = res?.status || "caution";
  const pct = computeMeterPercent(res);
  const label = STATUS_LABELS[status] || "確認済み";
  const caption = METER_CAPTIONS[status] || "";

  if (compact) {
    return `
      <div class="safety-meter compact">
        <div class="safety-meter-track">
          <div class="safety-meter-fill ${status}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }

  return `
    <div class="safety-meter">
      <div class="safety-meter-head">
        <span class="safety-meter-title">おうち安心メーター</span>
        <span class="safety-meter-level ${status}">${escapeHtml(label)}</span>
      </div>
      <div class="safety-meter-track">
        <div class="safety-meter-fill ${status}" style="width:${pct}%"></div>
      </div>
      <div class="safety-meter-caption">${escapeHtml(caption)}</div>
    </div>
  `;
}

function formatBeforeAfterMessage(prev, curr) {
  const oldLabel = STATUS_LABELS[prev.status] || "対策前";
  const newLabel = STATUS_LABELS[curr.status] || "対策後";
  if (oldLabel !== newLabel) {
    return `対策アップデート記録：${oldLabel} → ${newLabel}`;
  }
  if (Number(curr.score) > Number(prev.score)) {
    return `対策アップデート記録：さらに安心度がアップしました！`;
  }
  return `対策アップデート記録：再チェックを反映しました（${newLabel}）`;
}

function renderAreaResultHtml(area, p, needsImprovement) {
  const res = p.result;
  const good = toArray(res.goodPoints).map((g) => `<li>${escapeHtml(g)}</li>`).join("");
  const risks = toArray(res.risks).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  const imps = toArray(res.improvements).map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const shopItems = Array.isArray(res.shoppingItems) ? res.shoppingItems : [];
  const shopHtml = shopItems
    .map((s) => {
      const where = s.where || "100円ショップ・ホームセンター";
      const whereClass = where.includes("100") ? "hyakkin" : "homecenter";
      return `
        <div class="mini-shop-item">
          <div class="mini-shop-top">
            <span class="shop-where ${whereClass}">${escapeHtml(where)}</span>
            <strong class="mini-shop-name">${escapeHtml(s.item || "")}</strong>
            ${s.estimatedPrice ? `<span class="shop-price">${escapeHtml(s.estimatedPrice)}</span>` : ""}
          </div>
          ${s.reason ? `<div class="mini-shop-reason">${escapeHtml(s.reason)}</div>` : ""}
        </div>
      `;
    })
    .join("");

  let beforeAfterHtml = "";
  if (p.previousResult) {
    beforeAfterHtml = `
      <div class="before-after-badge">
        ${svgIcon("sparkle", "icon-xs")} ${escapeHtml(formatBeforeAfterMessage(p.previousResult, res))}
      </div>
    `;
  }

  return `
    <div class="area-result">
      ${beforeAfterHtml}
      ${renderSafetyMeterHtml(res, false)}
      <p class="area-result-summary">${escapeHtml(res.summary || "")}</p>
      ${good ? `<div class="result-subhead">${svgIcon("checkCircle", "icon-xs icon-safe")} 良い点</div><ul class="result-list">${good}</ul>` : ""}
      ${risks ? `<div class="result-subhead">${svgIcon("alert", "icon-xs icon-caution")} 気づいたポイント・確認事項</div><ul class="result-list">${risks}</ul>` : ""}
      ${imps ? `<div class="result-subhead">${svgIcon("bulb", "icon-xs icon-accent")} すぐできる改善アイデア</div><ul class="result-list">${imps}</ul>` : ""}
      ${shopHtml ? `<div class="result-subhead">${svgIcon("bag", "icon-xs icon-primary")} おすすめ対策グッズ（目安）</div><div class="mini-shop-list">${shopHtml}</div>` : ""}
      ${
        needsImprovement
          ? `<div class="recheck-cta">
               <span>対策できたら撮り直すと、改善記録がレポートに載ります！</span>
               <button type="button" class="btn ghost" id="recheck-${area.id}">${svgIcon("camera", "icon-xs")} 対策後に撮り直す</button>
             </div>`
          : ""
      }
      ${
        res.staffCheckPoint
          ? `<details class="staff-memo-fold">
               <summary>自治体・保護団体 提出用メモを見る（任意）</summary>
               <p>${escapeHtml(res.staffCheckPoint)}</p>
             </details>`
          : ""
      }
    </div>
  `;
}

function updateAnalyzedCount() {
  const count = Object.values(state.photos).filter((p) => p && p.result).length;
  document.getElementById("analyzedCount").textContent = String(count);
}

function loadImageUrlAsDataUrl(url, maxSize = 840, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width >= height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function createFallbackSampleIllustration(area) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 520;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f4ece1";
  ctx.fillRect(0, 0, 800, 520);
  ctx.fillStyle = "#e3d5c3";
  ctx.fillRect(0, 390, 800, 130);

  ctx.fillStyle = "rgba(44, 38, 33, 0.8)";
  ctx.fillRect(20, 20, 360, 44);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`サンプル：${area.title}`, 34, 49);

  return canvas.toDataURL("image/jpeg", 0.85);
}

async function loadSampleForArea(area) {
  let dataUrl;
  try {
    dataUrl = await loadImageUrlAsDataUrl(area.sampleImage);
  } catch (e) {
    dataUrl = createFallbackSampleIllustration(area);
  }

  const prev = state.photos[area.id] || {};
  const archivedPrevious = prev.result ? prev.result : prev.previousResult || null;
  state.photos[area.id] = {
    ...prev,
    dataUrl,
    previousResult: archivedPrevious,
    result: null,
    loading: false
  };
  state.report = null;
  renderSingleArea(area);
  await analyzeArea(area);
}

async function analyzeArea(area) {
  const p = state.photos[area.id];
  if (!p || !p.dataUrl) return;

  p.loading = true;
  renderSingleArea(area);

  if (!state.apiKeyConfigured) {
    await sleep(650);
    p.loading = false;
    // 体験版でも「対策後に撮り直す」と安心度がアップするビフォー／アフターを体験可能にする
    const isRecheck = Boolean(p.previousResult);
    const demo = getDemoAreaData(area, state.petType);
    p.result = isRecheck
      ? {
          status: "safe",
          score: 94,
          summary: "対策後の写真を再チェックしました！安全面がしっかり整い、安心してお迎えできる状態です。",
          goodPoints: [
            "以前気になったポイントに対して丁寧に対策されています。",
            ...(demo.goodPoints || []).slice(0, 1)
          ],
          risks: [],
          improvements: ["お迎え当日までこのまま安全な状態をキープしましょう。"],
          shoppingItems: [],
          staffCheckPoint: "対策後の再提出写真で改善を確認済み。オンライン面談のみで最終確認へ進める水準です。"
        }
      : {
          status: demo.status,
          score: demo.score,
          summary: demo.summary,
          goodPoints: demo.goodPoints,
          risks: demo.risks,
          improvements: demo.improvements,
          shoppingItems: demo.shoppingItems || [],
          staffCheckPoint: demo.staffPoint
        };
    state.report = null;
    saveState();
    renderSingleArea(area);
    updateStepperUI();
    return;
  }

  try {
    const res = await fetchWithTimeout("/api/analyze-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl: p.dataUrl,
        areaId: area.id,
        areaLabel: area.title,
        petType: state.petType,
        shelterPreset: state.shelterPreset,
        hasResidentPet: state.hasResidentPet,
        note: p.note || ""
      })
    }, 60000);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "診断に失敗しました");
    p.result = data;
    state.report = null;
    state.samplePreviewMode = false;
    saveState();
  } catch (err) {
    alert(`AI診断エラー: ${err.message}`);
  } finally {
    p.loading = false;
    renderSingleArea(area);
    updateStepperUI();
  }
}

/* ---------- Step 3: AI Hearing Chat ---------- */
function bindChat() {
  const form = document.getElementById("chatForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text || state.hearingLoading) return;
    input.value = "";
    sendHearingMessage(text);
  });
}

async function startHearing() {
  // 1問目は待ち時間ゼロ＆API回数節約のため即時表示し、2問目以降の応答からGeminiと対話する
  const petLabel = PET_LABELS[state.petType] || "保護猫";
  const sourceLabel = getAdoptionSourceLabel();
  const firstChips = getDemoHearingStep(0, state.petType).chips;
  const greeting =
    `こんにちは！おむかえナビのAIヒアリング担当です。\n` +
    `${petLabel}（お迎え元：${sourceLabel}）の事前確認として、5つの質問を順番にお伺いしますね。\n\n` +
    `【1/5】現在のお住まいは、ペットの飼育が可能な環境（持ち家・ペット可賃貸など）でしょうか？`;

  state.hearingMessages.push({ role: "ai", text: greeting });
  state.quickReplies = firstChips;
  saveState();
  renderChat(firstChips);
}

async function sendHearingMessage(text) {
  if (text !== "もう一度つなぐ") {
    state.hearingMessages.push({ role: "user", text });
  }
  state.report = null;
  state.samplePreviewMode = false;

  if (!state.apiKeyConfigured) {
    const idx = state.hearingAnswered;
    const keys = ["housing", "careRoutine", "familyAgreement", "safetyAwareness", "emergencyPlan"];
    if (keys[idx]) state.hearingSummary[keys[idx]] = text;
    state.hearingAnswered = Math.min(5, idx + 1);
    renderChat([]);
    await sleep(420);

    if (state.hearingAnswered < DEMO_HEARING_SCRIPT.length) {
      const next = getDemoHearingStep(state.hearingAnswered, state.petType);
      state.hearingMessages.push({ role: "ai", text: next.q });
      state.quickReplies = next.chips;
      saveState();
      updateStepperUI();
      renderChat(next.chips);
    } else {
      state.hearingComplete = true;
      state.quickReplies = [];
      state.hearingMessages.push({
        role: "ai",
        text: "5つの項目の確認が完了しました！ご協力ありがとうございます。\n右下の「ステップ4：提出用レポートを作成する」ボタンから、結果と提出用レポートを確認できます。"
      });
      saveState();
      updateStepperUI();
      renderChat([]);
    }
    return;
  }

  state.hearingLoading = true;
  renderChat([]);
  await fetchNextHearingTurn();
}

async function fetchNextHearingTurn() {
  const photoSummaries = AREAS.filter((a) => state.photos[a.id]?.result).map(
    (a) => `${a.title}: ${state.photos[a.id].result.summary}`
  );

  try {
    const res = await fetchWithTimeout("/api/hearing-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        petType: state.petType,
        shelterPreset: state.shelterPreset,
        hasResidentPet: state.hasResidentPet,
        messages: state.hearingMessages,
        photoSummaries,
        answeredCount: state.hearingAnswered,
        hearingSummary: state.hearingSummary
      })
    }, 60000);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ヒアリング通信エラー");

    state.hearingMessages.push({ role: "ai", text: data.reply });
    state.hearingAnswered = Math.max(state.hearingAnswered, Number(data.answeredCount || 0));
    state.hearingComplete = Boolean(data.isComplete);
    if (data.summary) {
      Object.entries(data.summary).forEach(([k, v]) => {
        if (v) state.hearingSummary[k] = v;
      });
    }
    state.hearingLoading = false;
    const replies = Array.isArray(data.quickReplies) && data.quickReplies.length > 0
      ? data.quickReplies
      : getFallbackQuickReplies();
    state.quickReplies = state.hearingComplete ? [] : replies;
    saveState();
    updateStepperUI();
    renderChat(state.quickReplies);
  } catch (err) {
    state.hearingLoading = false;
    state.hearingMessages.push({
      role: "ai",
      text: `通信が一時的に不安定でした（${err.message}）。下のボタンまたはもう一度送信してください。`
    });
    state.quickReplies = ["もう一度つなぐ", ...getFallbackQuickReplies()];
    saveState();
    renderChat(state.quickReplies);
  }
}

function getFallbackQuickReplies() {
  if (state.hearingComplete) return [];
  const idx = Math.min(DEMO_HEARING_SCRIPT.length - 1, Math.max(0, Number(state.hearingAnswered || 0)));
  return getDemoHearingStep(idx, state.petType).chips || [];
}

function renderChat(quickReplies = null) {
  const box = document.getElementById("chatMessages");
  box.innerHTML = state.hearingMessages
    .map((m) => {
      if (m.role === "ai") {
        return `
          <div class="chat-row ai">
            <img src="./images/navi-cat.jpg?v=4" alt="AIナビ" class="chat-avatar" />
            <div class="chat-bubble ai">${escapeHtml(m.text)}</div>
          </div>
        `;
      }
      return `
        <div class="chat-row user">
          <div class="chat-bubble user">${escapeHtml(m.text)}</div>
        </div>
      `;
    })
    .join("");

  if (state.hearingLoading) {
    box.innerHTML += `
      <div class="chat-row ai">
        <img src="./images/navi-cat.jpg?v=4" alt="AIナビ" class="chat-avatar" />
        <div class="chat-bubble ai">Geminiが考えています...</div>
      </div>
    `;
  }
  box.scrollTop = box.scrollHeight;

  const progress = Math.min(5, state.hearingAnswered);
  document.getElementById("hearingProgressText").textContent = `${progress} / 5`;
  document.getElementById("hearingProgressBar").style.width = `${(progress / 5) * 100}%`;

  const chipsWrap = document.getElementById("quickReplies");
  chipsWrap.innerHTML = "";
  let activeReplies = [];
  if (!state.hearingLoading && !state.hearingComplete) {
    if (Array.isArray(quickReplies) && quickReplies.length > 0) {
      activeReplies = quickReplies;
    } else if (Array.isArray(state.quickReplies) && state.quickReplies.length > 0) {
      activeReplies = state.quickReplies;
    } else {
      activeReplies = getFallbackQuickReplies();
    }
  }
  if (activeReplies.length > 0) {
    activeReplies.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => sendHearingMessage(label));
      chipsWrap.appendChild(btn);
    });
  }

  document.getElementById("chatSendBtn").disabled = state.hearingLoading;
}

/* ---------- Step 4: Report Gate & Generation ---------- */
function bindReportActions() {
  document.getElementById("printReportBtn").addEventListener("click", () => window.print());
  document.getElementById("regenerateReportBtn").addEventListener("click", () => {
    state.samplePreviewMode = false;
    const stats = getReadinessStats();
    if (!stats.readyForReport) {
      enterStep4();
      return;
    }
    generateReport(true);
  });
  document.getElementById("resetAllBtn").addEventListener("click", () => {
    if (confirm("入力内容と診断結果をリセットして最初からやり直しますか？")) {
      clearSavedStateAndReload();
    }
  });

  document.querySelectorAll("#reportViewTabs .report-tab").forEach((tab) => {
    tab.addEventListener("click", () => setReportView(tab.dataset.view));
  });

  document.getElementById("previewSampleReportBtn").addEventListener("click", () => {
    state.samplePreviewMode = true;
    enterStep4();
  });

  document.getElementById("exitSamplePreviewBtn").addEventListener("click", () => {
    state.samplePreviewMode = false;
    goToStep(2);
  });
}

function setReportView(view) {
  state.reportView = view === "submission" ? "submission" : "applicant";
  const sheet = document.getElementById("reportSheet");
  sheet.classList.toggle("view-applicant", state.reportView === "applicant");
  sheet.classList.toggle("view-submission", state.reportView === "submission");

  document.querySelectorAll("#reportViewTabs .report-tab").forEach((tab) => {
    const active = tab.dataset.view === state.reportView;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function enterStep4() {
  const stats = getReadinessStats();
  const gateEl = document.getElementById("reportGate");
  const mainEl = document.getElementById("reportMainArea");
  const sampleBanner = document.getElementById("samplePreviewBanner");

  if (!stats.readyForReport && !state.samplePreviewMode) {
    gateEl.classList.remove("hidden");
    mainEl.classList.add("hidden");
    renderReportGate(stats);
    return;
  }

  gateEl.classList.add("hidden");
  mainEl.classList.remove("hidden");
  sampleBanner.classList.toggle("hidden", !state.samplePreviewMode);
  const regenBtn = document.getElementById("regenerateReportBtn");
  if (regenBtn) regenBtn.classList.toggle("hidden", state.samplePreviewMode);
  setReportView(state.reportView);

  if (state.samplePreviewMode) {
    renderReportSheet(SAMPLE_PREVIEW_REPORT, true);
  } else {
    generateReport(false);
  }
}

function renderReportGate(stats) {
  const listEl = document.getElementById("gateChecklist");
  const photoDone = stats.analyzedCount >= 1;
  const hearingStarted = stats.hearingAnswered >= 1;

  listEl.innerHTML = `
    <div class="gate-item ${photoDone ? "done" : ""}">
      <div class="gate-item-info">
        <strong>${photoDone ? svgIcon("checkCircle", "icon-safe") : "1."} お部屋の写真AIチェック（現在 ${stats.analyzedCount} / 4 箇所）</strong>
        <small>${photoDone ? "写真の診断が済んでいます！" : "まずは気になる場所を1箇所だけでも写真診断してみましょう（サンプル写真でも試せます）。"}</small>
      </div>
      <button type="button" class="btn ${photoDone ? "secondary" : "primary"}" id="gateGoStep2">
        ${photoDone ? "写真を追加する" : "ステップ2へ進む →"}
      </button>
    </div>
    <div class="gate-item ${hearingStarted ? "done" : ""}">
      <div class="gate-item-info">
        <strong>${hearingStarted ? svgIcon("checkCircle", "icon-safe") : "2."} AIやさしいヒアリング（現在 ${stats.hearingAnswered} / 5 問）</strong>
        <small>${
          stats.hearingDone
            ? "5問すべての確認が完了しています！"
            : hearingStarted
              ? "残りも回答すると、より充実したレポートになります。"
              : "住居や留守番時間などの質問にチャットで答えます（タップだけで簡単に答えられます）。"
        }</small>
      </div>
      <button type="button" class="btn ${hearingStarted ? "secondary" : "primary"}" id="gateGoStep3">
        ${hearingStarted ? "ヒアリングの続きへ" : "ステップ3へ進む →"}
      </button>
    </div>
  `;

  listEl.querySelector("#gateGoStep2").addEventListener("click", () => goToStep(2));
  listEl.querySelector("#gateGoStep3").addEventListener("click", () => goToStep(3));
}

async function generateReport(force = false) {
  const loadingEl = document.getElementById("reportLoading");
  const sheetEl = document.getElementById("reportSheet");

  if (state.report && !force) {
    renderReportSheet(state.report, false);
    return;
  }

  loadingEl.classList.remove("hidden");
  sheetEl.innerHTML = "";

  const photoResultsPayload = {};
  AREAS.forEach((a) => {
    const p = state.photos[a.id];
    if (p?.result) {
      photoResultsPayload[a.title] = {
        ...p.result,
        beforeAfterHistory: p.previousResult
          ? {
              beforeStatus: p.previousResult.status,
              beforeScore: p.previousResult.score,
              afterStatus: p.result.status,
              afterScore: p.result.score
            }
          : null
      };
    }
  });

  if (!state.apiKeyConfigured) {
    await sleep(550);
    const dynamicReport = buildDynamicDemoReport();
    state.report = dynamicReport;
    saveState();
    updateStepperUI();
    loadingEl.classList.add("hidden");
    renderReportSheet(dynamicReport, false);
    return;
  }

  try {
    const res = await fetchWithTimeout("/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicantName: state.applicantName || "未記入",
        petType: state.petType,
        shelterPreset: state.shelterPreset,
        hasResidentPet: state.hasResidentPet,
        photoResults: photoResultsPayload,
        hearingSummary: state.hearingSummary,
        hearingMessages: state.hearingMessages
      })
    }, 60000);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "レポート生成に失敗しました");
    state.report = data;
    saveState();
    updateStepperUI();
    renderReportSheet(data, false);
  } catch (err) {
    sheetEl.innerHTML = `<p style="color: var(--danger);">レポート生成エラー: ${escapeHtml(err.message)}</p>`;
  } finally {
    loadingEl.classList.add("hidden");
  }
}

function renderReportSheet(rep, isSamplePreview = false) {
  const sheetEl = document.getElementById("reportSheet");
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const photoCardsHtml = AREAS.map((area) => {
    const demo = isSamplePreview ? getDemoAreaData(area, state.petType) : null;
    const p = isSamplePreview
      ? {
          dataUrl: area.sampleImage,
          result: {
            status: demo.status,
            score: demo.score,
            summary: demo.summary,
            improvements: demo.improvements,
            staffCheckPoint: demo.staffPoint
          }
        }
      : state.photos[area.id];

    if (!p || !p.result) {
      return `
        <div class="report-photo-item">
          <div class="report-photo-head">
            <strong class="report-photo-title">${svgIcon(area.iconName, "icon-xs icon-primary")} ${area.title}</strong>
            <span class="badge pending">今後確認</span>
          </div>
          <p class="helper-text" style="margin:0;">写真はまだ未登録です（必要に応じて面談や追加写真で確認できます）。</p>
        </div>
      `;
    }
    const r = p.result;
    const beforeAfterLine = p.previousResult
      ? `<div class="before-after-badge" style="margin:0 0 8px;padding:5px 8px;font-size:0.76rem;">
           ${svgIcon("sparkle", "icon-xs")} ${escapeHtml(formatBeforeAfterMessage(p.previousResult, r))}
         </div>`
      : "";
    const firstTip = toArray(r.improvements)[0] || "";

    return `
      <div class="report-photo-item">
        ${p.dataUrl ? `<img src="${p.dataUrl}" alt="${area.title}" />` : ""}
        <div class="report-photo-head">
          <strong class="report-photo-title">${svgIcon(area.iconName, "icon-xs icon-primary")} ${area.title}</strong>
          <span class="badge ${r.status}">${STATUS_LABELS[r.status] || ""}</span>
        </div>
        ${renderSafetyMeterHtml(r, true)}
        ${beforeAfterLine}
        <p style="margin:6px 0;">${escapeHtml(r.summary || "")}</p>
        ${
          firstTip
            ? `<div class="applicant-only report-tip-line">${svgIcon("bulb", "icon-xs icon-accent")} <strong>ひと工夫：</strong>${escapeHtml(firstTip)}</div>`
            : ""
        }
        ${
          r.staffCheckPoint
            ? `<div class="submission-only report-staff-point"><strong>職員様確認ポイント：</strong>${escapeHtml(r.staffCheckPoint)}</div>`
            : ""
        }
      </div>
    `;
  }).join("");

  const hs = isSamplePreview
    ? {
        housing: "ペット可の賃貸マンション（管理規約を確認済み）",
        careRoutine: "平日のお留守番は6時間ほど、ご家族と交代で見守り予定",
        familyAgreement: "同居家族全員が賛成・動物アレルギーなし",
        safetyAwareness:
          state.petType === "dog"
            ? "室内の安全確保・脱走防止対策を整えて最後まで大切に育てる"
            : "完全室内飼い・脱走防止対策を整えて最後まで大切に育てる",
        emergencyPlan: "車で10分圏内に動物病院あり、キャリーケースも準備予定"
      }
    : state.hearingSummary;

  const actionsHtml = toArray(rep.priorityActions)
    .map((act) => `<li>${escapeHtml(act)}</li>`)
    .join("");

  // レポート側の shoppingList を優先し、無ければ各写真診断の shoppingItems を集約
  const checkStore = isSamplePreview ? sampleCheckedShopping : state.checkedShopping;
  const shoppingList = collectReportShoppingList(rep, isSamplePreview);
  const checkedCount = shoppingList.filter((s, idx) => Boolean(checkStore[getShoppingItemKey(s, idx)])).length;
  const shoppingHtml = shoppingList.length
    ? shoppingList
        .map((s, idx) => {
          const key = getShoppingItemKey(s, idx);
          const isChecked = Boolean(checkStore[key]);
          const where = s.where || "100円ショップ等";
          const whereClass = where.includes("100") ? "hyakkin" : "homecenter";
          const isPriority = s.priority === "優先" || s.priority === "高";
          return `
            <label class="shopping-row ${isChecked ? "checked" : ""}">
              <input
                type="checkbox"
                class="shopping-checkbox no-print"
                data-shop-key="${escapeHtml(key)}"
                ${isChecked ? "checked" : ""}
              />
              <span class="print-check-mark" aria-hidden="true">${isChecked ? "☑" : "☐"}</span>
              <div class="shopping-main">
                <div class="shopping-title-line">
                  ${isPriority ? `<span class="shop-priority">優先</span>` : ""}
                  <span class="shop-where ${whereClass}">${escapeHtml(where)}</span>
                  <strong class="shopping-item-name">${escapeHtml(s.item || "")}</strong>
                </div>
                ${s.note ? `<div class="shopping-note">${escapeHtml(s.note)}</div>` : ""}
              </div>
              <div class="shopping-right">
                ${s.estimatedPrice ? `<span class="shop-price">${escapeHtml(s.estimatedPrice)}</span>` : ""}
                <span class="shop-status-tag">${isChecked ? "準備済み" : "準備予定"}</span>
              </div>
            </label>
          `;
        })
        .join("")
    : `<p class="helper-text" style="margin:0;">追加で購入が必要な対策グッズは特に見つかりませんでした。</p>`;

  sheetEl.innerHTML = `
    <div class="submission-intro-note submission-only no-print">
      こちらは自治体・保護団体の担当者様へ確認をお願いするための提出用プレビューです（PDF保存・印刷時はこちらの内容が出力されます）。
    </div>

    <div class="report-header">
      <div class="report-brand-row">
        <span class="report-brand-paw" aria-hidden="true">${PAW_BADGE_SVG}</span>
        <div>
          <div class="report-logo-kicker"><span class="logo-omukae">おむかえ</span><span class="logo-navi">ナビ</span> 事前提出シート</div>
          <h3>飼育環境 事前確認レポート</h3>
          <div class="report-meta">
            お迎え予定: <strong>${PET_LABELS[state.petType]}</strong> ｜ お迎え元: ${escapeHtml(getAdoptionSourceLabel())}
          </div>
        </div>
      </div>
      <div class="report-meta-box">
        <div>作成日: <strong>${today}</strong></div>
        <div>応募者: <strong>${escapeHtml(isSamplePreview ? "大阪 太郎（見本）" : state.applicantName || "未記入")}</strong></div>
        <div>提出先: ${escapeHtml(isSamplePreview ? "大阪府動物愛護管理センター（見本）" : state.shelterName || "自治体・保護団体")}</div>
      </div>
    </div>

    <div class="report-banner ${rep.overallReadiness || "almost"}">
      <strong style="font-size:1.05rem;">おうち準備のまとめ：${escapeHtml(rep.overallLabel || "")}</strong>
      <p style="margin:6px 0 0;">${escapeHtml(rep.overallComment || "")}</p>
    </div>

    <div class="report-section submission-only">
      <h4>自治体・保護団体 職員様向け 確認サマリー</h4>
      <div class="staff-box">
        <p style="margin:0 0 8px;">${escapeHtml(rep.staffSummary || "")}</p>
        <div><strong>推奨される次のステップ：</strong>${escapeHtml(rep.recommendedNextStep || "")}</div>
        <div class="staff-check-row">
          <span><strong>担当者様 確認欄：</strong></span>
          <span>☐ オンライン面談で確認</span>
          <span>☐ 追加写真で確認</span>
          <span>☐ 訪問確認を実施</span>
        </div>
      </div>
    </div>

    <div class="report-section">
      <h4>お迎え日までの安心チェックリスト</h4>
      <ul class="result-list">${actionsHtml || "<li>このまま安心してお迎え準備を進めましょう。</li>"}</ul>
    </div>

    <div class="report-section">
      <div class="shopping-section-head">
        <h4>${svgIcon("bag", "icon-primary")} 100均・ホームセンター対策お買い物リスト（目安）</h4>
        ${
          shoppingList.length
            ? `<span class="shopping-progress-pill" id="shoppingProgressPill">準備済み: ${checkedCount} / ${shoppingList.length} 点</span>`
            : ""
        }
      </div>
      <p class="helper-text no-print" style="margin-bottom:10px;">
        そろえたグッズにチェックを入れると、進捗が自動保存され提出用レポートにも「☑ 準備済み」と反映されます。
      </p>
      <div class="shopping-list-wrap">${shoppingHtml}</div>
    </div>

    <div class="report-section">
      <h4>お部屋の写真AIチェック結果</h4>
      <div class="report-photo-grid">${photoCardsHtml}</div>
    </div>

    <div class="report-section">
      <h4>事前ヒアリング確認内容</h4>
      <table class="hearing-table">
        <tr><th>住居・ペット可否</th><td>${escapeHtml(hs.housing || "面談時に確認予定")}</td></tr>
        <tr><th>留守番時間・お世話体制</th><td>${escapeHtml(hs.careRoutine || "面談時に確認予定")}</td></tr>
        <tr><th>ご家族の同意・アレルギー</th><td>${escapeHtml(hs.familyAgreement || "面談時に確認予定")}</td></tr>
        <tr><th>室内飼い・脱走防止意識</th><td>${escapeHtml(hs.safetyAwareness || "面談時に確認予定")}</td></tr>
        <tr><th>動物病院・緊急時の備え</th><td>${escapeHtml(hs.emergencyPlan || "面談時に確認予定")}</td></tr>
      </table>
    </div>

    <div class="report-section submission-only staff-receipt-box">
      <div class="staff-receipt-grid">
        <div><strong>受付日：</strong>${new Date().getFullYear()}年 ＿＿月 ＿＿日</div>
        <div><strong>ご担当：</strong>＿＿＿＿＿＿＿＿＿＿</div>
      </div>
      <div class="staff-receipt-memo"><strong>自治体・保護団体 担当者様メモ欄：</strong></div>
    </div>

    <div class="applicant-submit-hint applicant-only no-print">
      <span>自治体・保護団体へ提出する内容（職員様向けメモを含むA4提出レイアウト）を確認できます。</span>
      <button type="button" class="btn secondary" id="switchToSubmissionBtn">${svgIcon("clipboard", "icon-xs")} 提出用プレビューを見る</button>
    </div>

    <div class="report-disclaimer">
      ※ 本レポートは Google Gemini を用いた事前セルフチェックおよび確認支援のための参考資料です。最終的な譲渡可否の判断および必要に応じたオンライン面談・訪問確認は、各自治体・保護団体の基準に基づき職員様が行います。
    </div>
  `;

  const switchBtn = sheetEl.querySelector("#switchToSubmissionBtn");
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      setReportView("submission");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  sheetEl.querySelectorAll(".shopping-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const key = e.target.dataset.shopKey;
      checkStore[key] = e.target.checked;
      if (!isSamplePreview) {
        saveState();
      }

      const row = e.target.closest(".shopping-row");
      if (row) {
        row.classList.toggle("checked", e.target.checked);
        const mark = row.querySelector(".print-check-mark");
        if (mark) mark.textContent = e.target.checked ? "☑" : "☐";
        const tag = row.querySelector(".shop-status-tag");
        if (tag) tag.textContent = e.target.checked ? "準備済み" : "準備予定";
      }
      const pill = sheetEl.querySelector("#shoppingProgressPill");
      if (pill) {
        const done = shoppingList.filter((s, idx) => Boolean(checkStore[getShoppingItemKey(s, idx)])).length;
        pill.textContent = `準備済み: ${done} / ${shoppingList.length} 点`;
      }
    });
  });
}

function collectReportShoppingList(rep, isSamplePreview) {
  if (Array.isArray(rep.shoppingList) && rep.shoppingList.length > 0) {
    return rep.shoppingList;
  }
  const merged = [];
  const seen = new Set();
  AREAS.forEach((area) => {
    const items = isSamplePreview
      ? area.demoShoppingItems || []
      : state.photos[area.id]?.result?.shoppingItems || [];
    items.forEach((s) => {
      const name = (s.item || "").trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      merged.push({
        item: name,
        where: s.where || "100円ショップ等",
        estimatedPrice: s.estimatedPrice || "",
        priority: "優先",
        note: s.reason || `${area.title}の安全対策`
      });
    });
  });
  return merged;
}

/* ---------- Helpers ---------- */
function resizeImageFile(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function fetchWithTimeout(url, options, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("AIの応答が混み合って時間切れになりました。もう一度お試しください。");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
