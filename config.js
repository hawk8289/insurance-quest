/**
 * 在 Firebase Console 建立 Web App，複製「firebaseConfig」取代下方 null。
 * Firebase Web 設定值不屬於機密；真正的存取控制由 firestore.rules 保護。
 * 未設定雲端服務時，各裝置僅能獨立預覽，無法進行 24 人平均分組。
 */
window.NANSHAN_GAME_CONFIG = {
  firebase: null,
  maxPlayers: 24,
  teamSize: 6
};

// 範例：
// window.NANSHAN_GAME_CONFIG.firebase = {
//   apiKey: "...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   appId: "..."
// };
