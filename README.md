# Insurance Quest｜八題分組冒險

手機／平板／桌面皆可操作的 RWD 分組遊戲。以南山人壽藍、黃、綠配色作為非官方活動設計靈感。

## 本次改版內容

- 只保留 **8 題選擇題**，取消原來第二階段的 3 題外溢知識題。
- 最後顯示 **A 組／B 組／C 組／D 組**；結果畫面、主持人名單及 CSV 均不顯示專業部門名稱。
- 結果頁的「你的職能偏好分數」已改為「**你的分組選擇分布**」，依據 8 題選擇顯示 A 至 D 組的次數。
- 一題一頁、顯示 **第 N / 8 題** 和進度條，**沒有選擇不能前往下一題**，可返回上一題修改。
- 24 人完成後，主持人按「公布分組」，根據全員答案最佳化配對，**每組固定 6 人**，不事先分組。

## 本機試玩

正式 GitHub Pages 專案為 ES modules，不建議直接以 `file://` 開啟。請在專案目錄執行：

```bash
python3 -m http.server 8000
```

開啟 `http://localhost:8000/` 即可單人試玩。亦可直接開啟另附的 **insurance-quest-ABCD-8q.html** 單檔預覽版，無需啟動伺服器。單檔版沒有設定 Firebase 時僅供單人試玩。

## 正式多人連線設定

GitHub Pages 是靜態網站，若希望 **24 人使用不同手機同步作答並自動接收分組結果**，需要建立 Firebase 專案：

1. 前往 [Firebase Console](https://console.firebase.google.com/) 建立專案，新增 Web App。
2. 在 Authentication 開啟匿名登入 (Anonymous)。
3. 在 Firestore Database 建立資料庫，於 Rules 貼入專案內的 `firestore.rules` 並 Publish。
4. 將 Web App 的 Firebase 設定複製到 `config.js` 中的 `firebase: null`（替換成 config 物件）。
5. 在 Authentication 的 Authorized domains 加入 GitHub Pages 網域。
6. 將專案上傳 GitHub Repository，於 Settings → Pages 將部署來源設為 GitHub Actions。
7. 以 `https://你的帳號.github.io/你的repo/?host=1` 進入主持人管理頁，建立房間，即顯示 QR Code 與學員加入連結。
8. 全部 24 人掃碼加入並完成八題後，主持人點選公布。現場每人的手機會同步顯示 A、B、C 或 D 組。

`config.js` 範例：

```js
window.NANSHAN_GAME_CONFIG = {
  firebase: {
    apiKey: "你的 apiKey",
    authDomain: "你的專案.firebaseapp.com",
    projectId: "你的 projectId",
    appId: "你的 appId"
  },
  maxPlayers: 24,
  teamSize: 6
};
```

**注意：** Firebase Web config 不需要保密；應以 Firestore 安全規則管理權限。主持人要使用建立房間時的同一個瀏覽器。活動只需使用暱稱，不應輸入保戶資料或敏感個資。正式活動前請用測試房間做跨裝置驗證。

## 主持人功能

- 六碼房間、掃描加入 QR Code、複製活動連結、下載 QR Code。
- 即時查看加入及完成八題的人數。
- **24/24 全數交卷才能公布**；配對使用 Hungarian algorithm，最大化八題答案對各組的偏好分數，並限制 A/B/C/D 各 6 人。
- 匯出 CSV（序號、暱稱、正式組別、8 題答案與 A/B/C/D 選擇次數）。

## 開發者

- `questions.js`：八題題庫。每題四個選項的 `department: 0/1/2/3` 為內部 A/B/C/D 組代碼。
- `app.js`：畫面與互動、進度條、主持人管理。
- `matching.js`：最佳化平衡分組。
- `firebase-service.js`、`firestore.rules`：雲端連線與權限。
- `style.css`：RWD 及配色。
- `config.js`：Firebase 設定。

如已安裝 Node.js，可執行 `node --test tests/matching.test.mjs` 測試 24 人平衡分組演算法。

本網站為內部工作坊用途的非官方設計示範，不是南山人壽官方網站。


## Q03 更新

第三題已調整為保險科技創新專案（虛擬保險櫃檯、AI 極速理賠、AI 智慧核保、智慧保費管家）。各選項的內部組別對應維持不變。


## 24 人分組上限（重點）

- **正式多人活動**：最多允許 24 個登入帳號加入；主持人需在 24 位玩家全部交卷後才能公布結果。
- 分組採用四組各 6 席的最佳化演算法；送出前再做 `validateBalancedAssignments` 檢查，任何一組多於 6 人都會被拒絕，Firestore 安全規則也會檢查四組人數。
- 發布分組使用 Firestore transaction：再次確認活動狀態與 24 位玩家均已完成作答，避免多個主持人分頁競爭更新。
- **純 HTML 單人開啟**仍可體驗畫面，但每支手機互相獨立，無法管理四組上限。要讓 24 位學員真的各分到 6 人，請在 GitHub Pages 部署完整專案，並連接 Firebase。
- 已移除首頁原本的模式提示，避免干擾活動畫面。
