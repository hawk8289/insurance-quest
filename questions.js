/** 第一階段：8 題選擇題。department 為內部計算組別的代碼 0–3。畫面僅顯示 A–D 組。 */
export const DEPARTMENTS = [
  { name: '組別 A', short: 'A 組', en: 'TEAM A', icon: '◈', color: '#2767A9', role: '任務小隊 A', detail: '' },
  { name: '組別 B', short: 'B 組', en: 'TEAM B', icon: '✳', color: '#C76D56', role: '任務小隊 B', detail: '' },
  { name: '組別 C', short: 'C 組', en: 'TEAM C', icon: '✦', color: '#238C74', role: '任務小隊 C', detail: '' },
  { name: '組別 D', short: 'D 組', en: 'TEAM D', icon: '◆', color: '#8664AC', role: '任務小隊 D', detail: '' }
];

export const ROLE_QUESTIONS = [
  { category: '保戶需求', title: '你的第一個任務',
    story: '你剛加入保險公司，主管交給你四個案件。如果可以自由挑選，你最想負責哪一個？',
    options: [
      { text: '幫助剛出院的保戶申請住院醫療保險金', department: 1 },
      { text: '協助調查保戶續期保費扣款失敗的原因', department: 3 },
      { text: '評估有慢性疾病的客戶是否符合承保條件', department: 0 },
      { text: '協助保戶變更聯絡地址及保單資料', department: 2 }
    ] },
  { category: '工作成就', title: '哪件事最有成就感？',
    story: '完成第一個月的工作後，你覺得以下哪一種成果最有成就感？',
    options: [
      { text: '讓每筆保費正確入帳，減少帳務差異', department: 3 },
      { text: '讓保戶不必臨櫃就能完成契約變更', department: 2 },
      { text: '根據健康及風險資訊做出合理承保判斷', department: 0 },
      { text: '讓符合保障條件的保戶順利獲得理賠給付', department: 1 }
    ] },
  { category: '保險科技創新', title: '下一代保險科技，由你決定！',
    story: '公司即將啟動新一代智慧保險服務平台，結合 AI、數位身分驗證與自動化技術，改善保戶體驗。以下四項創新專案，你最想參與哪一項？',
    options: [
      { title: '虛擬保險櫃檯', text: '結合 AI 智慧客服、預約視訊、數位身分驗證與電子簽署。保戶透過手機就能辦理資料變更及部分契約服務，複雜問題再轉接真人專員，減少往返服務中心。', department: 2 },
      { title: 'AI 極速理賠', text: '保戶用手機上傳診斷證明與醫療收據，AI 搭配 OCR 自動擷取資料、檢查文件完整性，依契約及規則輔助審核；符合條件的簡單案件可快速處理，減少等待與補件。', department: 1 },
      { title: 'AI 智慧核保', text: '運用 AI 與核保規則引擎整理健康告知、既往病史及相關風險資訊。單純案件依規則進行自動化審查；複雜案件提供風險摘要，協助核保人員加速判斷。', department: 0 },
      { title: '智慧保費管家', text: '整合行動支付、繳費提醒、自動對帳與回饋管理，集中顯示每張保單的繳費狀態及到期日；扣款失敗即時提醒，並依商品約定將符合資格的保費折扣反映在帳單。', department: 3 }
    ] },
  { category: '異常排除', title: '誰來解決這個問題？',
    story: '保戶服務流程出現異常，主管希望你找出原因。你對哪個問題最有興趣？',
    options: [
      { text: '為什麼理賠申請總是需要重複補件？', department: 1 },
      { text: '為什麼投保資料不完整，導致審查延遲？', department: 0 },
      { text: '為什麼資料已變更，系統卻沒有更新？', department: 2 },
      { text: '為什麼保戶已繳費，帳務卻顯示未入帳？', department: 3 }
    ] },
  { category: '工作特質', title: '你最重視哪件事？',
    story: '四位同事都在處理重要任務。如果你要成為其中一人的搭檔，你最喜歡哪種工作方式？',
    options: [
      { text: '仔細檢視資料與風險，維持一致的評估標準', department: 0 },
      { text: '確認每筆金額與交易紀錄都正確無誤', department: 3 },
      { text: '簡化流程，讓保戶更便利地完成申請', department: 2 },
      { text: '確認事故事實與保障範圍，公平審核給付', department: 1 }
    ] },
  { category: '團隊協作', title: '跨部門任務開始',
    story: '公司成立跨部門改善小組，要提升保戶服務品質。你想擔任哪一種角色？',
    options: [
      { text: '統整契約變更需求，改善保戶操作流程', department: 2 },
      { text: '建立投保風險檢核流程，減少審查差異', department: 0 },
      { text: '改善理賠補件機制，縮短案件處理時間', department: 1 },
      { text: '優化扣款異常通知與繳費作業', department: 3 }
    ] },
  { category: '外溢保單', title: '健康外溢保單登場',
    story: '公司推出一張外溢保單，達成約定的健康目標可以獲得回饋。你最感興趣的是哪一個服務環節？',
    options: [
      { text: '讓符合資格的保費折扣正確呈現在續期帳單', department: 3 },
      { text: '協助保戶查詢健康任務進度與回饋資格', department: 2 },
      { text: '了解投保時的健康告知及風險評估', department: 0 },
      { text: '發生保險事故時，依契約審核理賠', department: 1 }
    ] },
  { category: '最後挑戰', title: '你想改善什麼？',
    story: '假設你有機會主導一項改善保戶體驗的專案，你會最優先選哪個目標？',
    options: [
      { text: '讓投保審查更有效率、承保規則更清楚', department: 0 },
      { text: '提升理賠申請便利性與處理透明度', department: 1 },
      { text: '減少扣款失敗，提升收費作業正確率', department: 3 },
      { text: '簡化契約變更流程，降低保戶操作困難', department: 2 }
    ] }
];


export function roleScores(answers) {
  const result = [0, 0, 0, 0];
  answers.forEach((answer, index) => {
    if (Number.isInteger(answer) && answer >= 0 && answer < 4 && ROLE_QUESTIONS[index]) {
      result[ROLE_QUESTIONS[index].options[answer].department]++;
    }
  });
  return result;
}
