import { DEPARTMENTS, ROLE_QUESTIONS, roleScores } from './questions.js';
import { balancedMatch, validateBalancedAssignments } from './matching.js';
import {
  configured, firebaseClient, createSession, joinSession, getSession,
  listenSession, listenParticipants, listenSelf, currentUid,
  submitRoles, publishAssignments
} from './firebase-service.js';

const app = document.getElementById('app');
const url = new URL(window.location.href);
const PARAM_ROOM = (url.searchParams.get('room') || '').toUpperCase().trim();
const PARAM_HOST = (url.searchParams.get('host') || '').toUpperCase().trim();
const isOnline = configured();
const letters = ['A','B','C','D'];
const state = {
  screen:'landing', busy:false, error:'', mode:'demo', nickname:'', inputRoom:PARAM_ROOM,
  code:'', room:null, players:[], member:null, uid:null, hosting:false,
  roleIndex:0, roleAnswers:Array(8).fill(-1),
  qrLink:'', qrReady:false
};
let disposers = [];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const el = text => escapeHtml(text);
const safeError = error => {
  if (error?.code === 'permission-denied') return 'Firebase 權限不足，請檢查 Firestore 規則與登入設定。';
  if (error?.code === 'auth/unauthorized-domain') return '目前網址未加入 Firebase Authentication 授權網域。';
  if (error?.code === 'auth/operation-not-allowed') return '請先在 Firebase Authentication 開啟匿名登入。';
  if (error?.code === 'unavailable') return '網路暫時無法連線，請檢查 Wi-Fi。';
  return error?.message || '操作失敗，請再試一次。';
};
const urlForRoom = code => `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;
const hostUrl = code => `${window.location.origin}${window.location.pathname}?host=${encodeURIComponent(code)}`;
const topDept = () => roleScores(state.roleAnswers).indexOf(Math.max(...roleScores(state.roleAnswers)));
const assignedDept = () => state.mode === 'demo' ? topDept() : state.room?.assignments?.[state.uid];
const allRolesChosen = () => state.roleAnswers.every(a => Number.isInteger(a) && a >= 0 && a < 4);
const getCacheKey = type => `ns-quest-${type}-${state.code}-${state.uid}`;
const persist = type => {
  if (state.mode === 'demo') return;
  try {
    window.localStorage.setItem(getCacheKey(type), JSON.stringify(state.roleAnswers));
  } catch { /* Storage may be restricted. */ }
};
const restore = (type, length) => {
  try {
    const arr = JSON.parse(window.localStorage.getItem(getCacheKey(type)) || 'null');
    if (Array.isArray(arr) && arr.length === length && arr.every(a => Number.isInteger(a) && a>=-1 && a<=3)) return arr;
  } catch { /* ignore corrupt cache */ }
  return Array(length).fill(-1);
};
const firstUnanswered = answers => {
  const at = answers.indexOf(-1);
  return at === -1 ? answers.length - 1 : at;
};
function setError(message) { state.error = message; render(); }
function clearError() { state.error = ''; }
function cleanupListeners() { disposers.forEach(stop => stop()); disposers = []; }

function mountainMark() {
  return `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M2 27 14 9l10 14 6-8 8 12" stroke="#F4CF70" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/><path d="M4 32h32" stroke="#91D8B9" stroke-width="3" stroke-linecap="round"/></svg></span>`;
}
function scenicMountain() {
  return `<svg class="mountains" viewBox="0 0 560 200" fill="none" aria-hidden="true">
    <circle cx="399" cy="47" r="44" fill="#F3C958" opacity=".82" />
    <path d="M0 180 135 45l118 110 56-54 51 45 72-86 124 120" stroke="#CDE7F4" stroke-width="2" opacity=".6"/>
    <path d="M0 190 135 65l95 100 78-81 103 106" fill="#387BA2" opacity=".72"/>
    <path d="M125 190 296 59l89 91 59-69 116 109" fill="#89BDAC" opacity=".58"/>
    <path d="M0 190h560" stroke="#A5DDD8" stroke-width="2" />
  </svg>`;
}
function layout(content, tag='INTERACTIVE EXPERIENCE', mini='') {
  return `<main class="shell">
    <aside class="visual">
      <div class="brand">${mountainMark()}<span>南山人壽 · 職能探索<small>INSURANCE QUEST</small></span></div>
      <div class="hero-copy">
        <div class="hero-overline">INSURANCE × TEAM BUILDING</div>
        <h1>認識保險，<br/><em>找到你的隊伍。</em></h1>
        <p>透過八道職場情境，找到你的任務小隊。最終分為 A、B、C、D 四組。</p>
        ${scenicMountain()}
      </div>
      <div class="visual-footer">以專業守護每個選擇，以團隊打造更好的服務體驗。<br/>活動視覺為品牌配色靈感設計，非官方網站。</div>
    </aside>
    <section class="workspace"><div class="workspace-inner">
      <div class="topline"><span class="eyebrow"><span class="dot"></span>${el(tag)}</span>
        <span class="pill">${mini ? el(mini) : '01 — 08 · 手機 / 電腦皆適用'}</span></div>
      ${state.error ? `<div class="notice error" role="alert">${el(state.error)}</div>` : ''}
      <div class="card">${content}</div>
      <p class="footnote">© Insurance Quest · 活動示範工具｜請勿輸入真實保戶或敏感個資</p>
    </div></section>
  </main>`;
}
function progress(current, total) {
  return `<div class="step-label"><span>分組任務進度</span><b>第 ${current+1} / ${total} 題</b></div>
    <div class="progress-track" role="progressbar" aria-label="分組題作答進度" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${current+1}">
      <div class="progress-fill" style="width:${(current+1)/total*100}%"></div></div>
    <div class="step-dots" aria-hidden="true">${Array.from({length:total},(_,i)=>`<span class="step-dot ${i<current?'passed':i===current?'current':''}"></span>`).join('')}</div>`;
}
function actionButton(action, label, variant='primary', disabled=false, classes='') {
  return `<button type="button" class="btn ${variant} ${classes}" data-action="${action}" ${disabled||state.busy?'disabled':''}>${el(label)}</button>`;
}
function landingView() {
  const isDirect = Boolean(PARAM_ROOM && isOnline);
  return layout(`
    <div class="titleline">✦　WELCOME TO INSURANCE QUEST</div>
    <h2>${isDirect?'加入保險職能冒險':'你是哪種保險職場人才？'}</h2>
    <p class="subhead">透過八道情境選擇題，探索自己的選擇傾向。完成作答後，將依全體結果分成 A、B、C、D 四個任務小隊。</p>
    <div class="stat-grid"><div class="stat"><strong>08</strong><span>職能分組題</span></div><div class="stat"><strong>06</strong><span>每組人數</span></div><div class="stat"><strong>04</strong><span>任務小隊</span></div></div>
    ${isOnline ? `<div class="notice success">多人連線已啟用，主持人可建立房間並產生專屬 QR Code。</div>` : ''}
    <div class="field"><label for="nickname">你的遊戲暱稱</label><input id="nickname" maxlength="24" autocomplete="nickname" placeholder="例如：小安" value="${el(state.nickname)}" /></div>
    ${isOnline ? `<div class="field"><label for="room-code">活動房間代碼</label><input id="room-code" maxlength="6" autocapitalize="characters" spellcheck="false" placeholder="六碼代碼，或直接掃 QR Code" value="${el(state.inputRoom)}" /></div>`:''}
    ${actionButton(isOnline?'join':'start-demo',isOnline?'加入活動 →':'開始作答 →','primary',false,'full large')}
    ${isOnline ? `<div class="line"></div>${actionButton('go-host','我是主持人 · 建立活動','ghost',false,'full')}` : ''}
    <p class="micro" style="text-align:center;margin-bottom:0">第一階段沒有標準答案；依自己的直覺選擇，每題都必須作答才能進下一題。</p>
  `, 'INSURANCE QUEST · START');
}
function roleView() {
  const q = ROLE_QUESTIONS[state.roleIndex];
  const selected = state.roleAnswers[state.roleIndex];
  return layout(`
    <div class="titleline">✦　GROUPING QUIZ / 分組任務</div>
    <h2>${el(q.title)}</h2>
    ${progress(state.roleIndex,8)}
    <p class="story">${el(q.story)}</p>
    <div class="answer-list" role="radiogroup" aria-label="${el(q.title)}">
      ${q.options.map((option,i) => `<button type="button" class="answer ${selected===i?'selected':''}" role="radio" aria-checked="${selected===i}" data-select-role="${i}" aria-label="${letters[i]}：${el(option.title?option.title+'，'+option.text:option.text)}">
        <span class="answer-letter">${letters[i]}</span><span class="answer-text">${option.title?`<strong class="answer-title">${el(option.title)}</strong><span class="answer-detail">${el(option.text)}</span>`:el(option.text)}</span>${selected===i?'<span class="answer-check">✓</span>':''}</button>`).join('')}
    </div>
    <div class="actions">
      ${actionButton('role-prev','← 上一題','secondary',false,'')}
      ${actionButton('role-next',state.roleIndex===7?'送出答案，進行分組 →':'下一題 →','primary',selected===-1,'grow')}
    </div>
    <p class="micro">沒有選擇任何選項時，「下一題」按鈕將無法點擊。</p>
  `,'STAGE 01 · ROLE DISCOVERY',`第 ${state.roleIndex+1} / 8 題`);
}
function waitView() {
  const done = state.players.filter(p=>p.submitted).length;
  const joined = state.room?.joinedCount ?? state.players.length;
  return layout(`
    <div class="center"><div class="icon-circle">✓</div>
      <h2>八題作答完成！</h2>
      <p>${el(state.nickname)}，你的 8 道選擇題已送出。${state.mode==='demo'?'作答完成，接下來可以檢視你的示範結果。':'等待其他夥伴完成後，由主持人統一公布分組結果。'}</p>
    </div>
    ${state.mode==='demo'?`<div class="notice warning">以下顯示的是個人最高選擇次數所對應的示範組別。</div>`:
      `<div class="stat-grid"><div class="stat"><strong>${joined}/24</strong><span>已加入</span></div><div class="stat"><strong>${done}/24</strong><span>已交卷</span></div><div class="stat"><strong>4 × 6</strong><span>預計分組</span></div></div>
        <div class="notice">正在同步等待主持人公布分組，畫面會自動更新，不需要重新整理。</div>`}
    ${state.mode==='demo'?`<div class="actions">${actionButton('demo-reveal','模擬公布分組 →','primary',false,'full')}</div>`:''}
  `,'TEAM MATCHING · WAITING');
}
function teamView() {
  const index = assignedDept();
  if (!Number.isInteger(index) || index < 0 || index>3) return waitView();
  const team = DEPARTMENTS[index];
  const scores = roleScores(state.roleAnswers);
  return layout(`
    <div class="center"><div class="confetti" aria-hidden="true">🎉</div><div class="titleline" style="justify-content:center">THE TEAM REVEAL</div>
      <h2>歡迎加入你的任務小隊！</h2><p>${el(state.nickname)}，這是${state.mode==='demo'?'依個人作答偏好顯示':'根據全體 24 人答案最佳化配對'}的分組結果。</p></div>
    <div class="team-card" style="--team-color:${team.color}"><div class="team-icon" aria-hidden="true">${team.icon}</div><small>${team.en}</small>
      <h2>${el(team.short)}</h2><p>你的最終分組</p></div>
    <div class="scores"><div class="titleline" style="margin-bottom:0">你的分組選擇分布</div>
    ${DEPARTMENTS.map((d,i)=>`<div class="score-row"><span>${el(d.name)}</span><div class="score-meter"><div style="--score-color:${d.color};--score-width:${scores[i]/8*100}%"></div></div><b>${scores[i]}</b></div>`).join('')}</div>
    <div class="notice ${state.mode==='demo'?'warning':''}">${state.mode==='demo'?'恭喜完成作答，結果將顯示你的最高選擇次數所對應的示範組別':'你的正式組別由全體答案統一分配，每組 6 人；選擇分布是個人作答參考，不一定等於最終分組。'}</div>
    <div class="line"></div>
    <div class="stage-box"><span class="stage-number">💬</span><div><b>分組完成 · 開始破冰</b><p>找到同組夥伴，分享名字與一個平常會做的健康習慣。</p></div></div>
    ${state.mode==='demo'?`<div class="actions">${actionButton('restart-demo','重新作答 ↻','secondary',false,'full')}</div>`:`<div class="notice success" style="margin-top:20px">遊戲已完成，請依主持人指示到所屬組別集合。</div>`}
  `,'GROUP ASSIGNMENT · YOUR TEAM',team.short);
}
function hostEntryView() {
  return layout(`
    <div class="titleline">✦　FACILITATOR CONTROL</div><h2>主持人控制台</h2>
    <p class="subhead">建立專屬活動房間，取得 QR Code，讓 24 位學員掃描進入。同時掌握作答進度，待全員完成後一鍵公布四組結果。</p>
    ${!isOnline?`<div class="notice warning" style="margin-top:20px">目前尚未設定 Firebase，無法建立真正的多人房間。請依 README 完成連線設定。</div>`:''}
    <div class="stage-box" style="margin-top:22px"><span class="stage-number">01</span><div><b>建立房間、分享 QR Code</b><p>玩家掃描 QR Code 加入同一個活動房間。</p></div></div>
    <div class="stage-box" style="margin-top:9px"><span class="stage-number">02</span><div><b>學員完成 8 道情境題</b><p>每位學員自由選擇，系統收集全體答案。</p></div></div>
    <div class="stage-box" style="margin-top:9px"><span class="stage-number">03</span><div><b>公布四組，每組 6 人</b><p>配對完成後，學員查看自己的 A、B、C 或 D 組。</p></div></div>
    <div class="actions">${actionButton('create-room','建立 24 人活動房間 →','primary',!isOnline,'full large')}</div>
    <p class="micro">主持人請使用同一台裝置與瀏覽器管理房間，匿名驗證身分會保留在該瀏覽器。</p>
  `,'FACILITATOR · HOST');
}
function hostView() {
  if (!state.room) return layout('<div class="center"><h2>正在載入房間…</h2></div>','HOST');
  const players = state.players;
  const joined = state.room.joinedCount;
  const rolesDone = players.filter(p=>p.submitted).length;
  const isAssigned = state.room.status === 'assigned';
  const canPublish = !isAssigned && joined===24 && players.length===24 && rolesDone===24 && !state.busy;
  const link = urlForRoom(state.code);
  const teamMembers = DEPARTMENTS.map((d,i) => players.filter(p=>state.room.assignments?.[p.uid]===i));
  return layout(`
    <div class="titleline">✦　LIVE SESSION CONTROL</div><h2>現場活動管理</h2>
    <div class="stat-grid"><div class="stat"><strong>${joined}/24</strong><span>已加入</span></div><div class="stat"><strong>${rolesDone}/24</strong><span>完成分組題</span></div><div class="stat"><strong>4 × 6</strong><span>預定分組</span></div></div>
    <div class="host-cols">
      <div class="card-mini"><h3>學員入場 QR Code</h3><div class="join-code">${el(state.code)}</div>
        <div class="qr-panel" id="qr-panel"><canvas id="join-qr" width="220" height="220" aria-label="學員掃描 QR Code"></canvas>
        <span class="micro">掃描即進入活動房間</span></div>
        <div class="link-view">${el(link)}</div>
        <div class="footer-buttons">${actionButton('copy-link','複製連結','secondary')}${actionButton('download-qr','下載 QR Code','ghost')}</div>
      </div>
      <div class="card-mini"><h3>即時學員名單 <span class="badge-status">${isAssigned?'已公布分組':'尚未分組'}</span></h3>
        <div class="roster" aria-label="參與者名單">${players.length?players.map(p=>`<div class="member"><span>${p.joinOrder}. ${el(p.nickname)}</span><span class="status ${p.submitted?'ready':''}">${isAssigned?el(DEPARTMENTS[state.room.assignments?.[p.uid]]?.short||'—'):p.submitted?'✓ 已交卷':'作答中'}</span></div>`).join(''):'<p class="micro">等待學員掃描 QR Code…</p>'}</div>
      </div>
    </div>
    <div class="line"></div>
    ${!isAssigned?`<div class="titleline">✦　公布分組</div>
      <p class="subhead">必須 <strong>24 人全部完成 8 題</strong> 才能公布結果。系統統一計算全部 24 人的答案，依偏好最佳化配對，A、B、C、D 四組各固定 6 人，不會超收。</p>
      <div class="actions">${actionButton('publish','全員完成，公布 4 組 × 6 人 →','green',!canPublish,'full')}</div>
      ${!canPublish?'<p class="micro">名額或交卷人數不足時，按鈕會保持停用。</p>':''}`:
      `<div class="titleline">✦　分組已公布，學員手機會自動更新</div>
        <div class="team-list">${DEPARTMENTS.map((d,i)=>`<div class="mini-team"><strong>${el(d.name)} · ${teamMembers[i].length} 人</strong>${teamMembers[i].map(p=>`<span>${el(p.nickname)}</span>`).join('')}</div>`).join('')}</div>
        <div class="actions">${actionButton('export-csv','匯出分組與作答 CSV','secondary',false,'full')}</div>`}
    <div class="notice" style="margin-top:18px">活動房間代碼：<strong>${el(state.code)}</strong>。重新開啟主持人網址可查看目前活動，但需使用同一個已登入的瀏覽器。</div>
  `,'HOST PANEL · REAL TIME',isAssigned?'分組已完成':'即時同步');
}
function loadingView() { return layout('<div class="center"><div class="icon-circle">⏳</div><h2>正在連線…</h2><p>正在確認活動資訊。</p></div>','CONNECTING'); }
function errorView() { return layout(`<h2>無法進入活動</h2><p class="subhead">${el(state.error || '請確認連結並重試。')}</p><div class="actions">${actionButton('go-home','返回首頁','secondary',false,'full')}</div>`,'CONNECTION ERROR'); }
function render() {
  document.body.dataset.screen = state.screen;
  const views = {landing:landingView,role:roleView,wait:waitView,team:teamView,'host-entry':hostEntryView,host:hostView,loading:loadingView,error:errorView};
  app.innerHTML = (views[state.screen]||landingView)();
  if (state.screen==='host' && state.room) void renderQr();
}
let qrRenderingFor='';
async function renderQr() {
  const canvas = document.getElementById('join-qr');
  if (!canvas) return;
  const link = urlForRoom(state.code);
  // CDN QRCode generates the bitmap locally; no URL is sent to the QR provider.
  if (window.QRCode?.toCanvas) {
    try {
      await window.QRCode.toCanvas(canvas, link, {width:220,margin:2,errorCorrectionLevel:'H',color:{dark:'#073E70',light:'#FFFFFF'}});
      qrRenderingFor=link; return;
    } catch(err) { console.warn('QR code generation failed',err); }
  }
  const panel=document.getElementById('qr-panel');
  if (panel) panel.innerHTML=`<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}" width="220" height="220" alt="活動加入 QR Code" /><span class="micro">掃描即進入活動房間（備用 QR 服務）</span>`;
}
async function copyLink() {
  const link=urlForRoom(state.code);
  try { await navigator.clipboard.writeText(link); alert('已複製學員加入連結！'); }
  catch { prompt('請複製以下連結：',link); }
}
function downloadQr() {
  const canvas=document.getElementById('join-qr');
  const img=document.querySelector('#qr-panel img');
  let uri='';
  try { if(canvas && qrRenderingFor===urlForRoom(state.code)) uri=canvas.toDataURL('image/png'); } catch { /* fall back */ }
  if (!uri && img) uri=img.src;
  if (!uri) { void copyLink(); return; }
  const a=document.createElement('a'); a.href=uri; a.download=`insurance-quest-${state.code}-QR.png`; a.target='_blank'; document.body.append(a); a.click(); a.remove();
}
function exportCsv() {
  const head=['序號','暱稱','正式組別','8 題答案','A 組選擇次數','B 組選擇次數','C 組選擇次數','D 組選擇次數'];
  const rows=state.players.map(p=>{
    const scores=roleScores(p.answers||[]);
    const gi=state.room.assignments?.[p.uid];
    return [p.joinOrder,p.nickname,DEPARTMENTS[gi]?.name||'',(p.answers||[]).map(i=>letters[i]||'').join(' / '),...scores];
  });
  const csv='\uFEFF'+[head,...rows].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`insurance-quest-${state.code}-results.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
function hydrateMember() {
  if (!state.member) return;
  state.nickname=state.member.nickname;
  if (state.member.submitted) {
    state.roleAnswers=state.member.answers;
    state.screen=state.room?.status==='assigned'?'team':'wait';
  } else {
    state.roleAnswers=restore('role',8);
    state.roleIndex=firstUnanswered(state.roleAnswers);
    state.screen='role';
  }
  render();
}
function startRoomListeners(code, asHost=false) {
  cleanupListeners();
  state.code=code;
  state.hosting=asHost;
  state.screen='loading'; render();
  disposers.push(listenSession(code, room=>{
    state.room=room;
    if (!room) {state.screen='error';setError('找不到這個活動房間。');return;}
    if (asHost) {
      if (room.hostId!==currentUid()) {state.screen='error';setError('這個房間是由其他瀏覽器建立，無法取得主持人權限。');return;}
      state.screen='host';render();
    } else if (state.member && room.status==='assigned' && state.member.submitted && state.screen==='wait') {
      state.screen='team';render();
    } else if (state.screen==='wait') render();
  }, e=>setError(safeError(e))));
  if (asHost) {
    disposers.push(listenParticipants(code, players=>{state.players=players;if(state.screen==='host')render();},e=>setError(safeError(e))));
  } else {
    disposers.push(listenSelf(code, member=>{
      const hadMember=Boolean(state.member);
      state.member=member;
      if (!member) return;
      if (!hadMember) hydrateMember();
      else if (member.submitted && state.screen==='role') {state.screen='wait';render();}
    },e=>setError(safeError(e))));
    disposers.push(listenParticipants(code, players=>{state.players=players;if(state.screen==='wait')render();},e=>setError(safeError(e))));
  }
}
async function busyOperation(fn) {
  if (state.busy) return;
  clearError(); state.busy=true;render();
  try { await fn(); }
  catch(error) { console.error(error);setError(safeError(error)); }
  finally {state.busy=false;render();}
}
async function handleAction(action) {
  switch(action) {
    case 'start-demo': {
      if (!state.nickname.trim()) {setError('請先輸入暱稱。');return;}
      state.mode='demo';state.screen='role';state.roleIndex=0;state.roleAnswers=Array(8).fill(-1);clearError();render();break;
    }
    case 'restart-demo': { state.screen='landing';state.roleAnswers=Array(8).fill(-1);state.roleIndex=0;clearError();render();break; }
    case 'role-prev': {if(state.roleIndex>0)state.roleIndex--;else if(state.mode==='demo')state.screen='landing';render();break;}
    case 'role-next': {
      if(state.roleAnswers[state.roleIndex]===-1)return;
      if(state.roleIndex<7) {state.roleIndex++;render();return;}
      if(!allRolesChosen()) {setError('還有未完成的職能題，請先作答。');return;}
      if(state.mode==='demo') {state.screen='wait';render();return;}
      await busyOperation(async()=>{await submitRoles(state.code,[...state.roleAnswers]);state.screen='wait';});
      break;
    }
    case 'demo-reveal': {state.screen='team';render();break;}
    case 'go-home': {cleanupListeners();state.screen='landing';clearError();history.replaceState({},'',window.location.pathname);render();break;}
    case 'go-host': {if(!isOnline)return;state.screen='host-entry';render();break;}
    case 'create-room': {
      await busyOperation(async()=>{
        const code=await createSession();state.mode='online';state.code=code;
        history.replaceState({},'',hostUrl(code));startRoomListeners(code,true);
      });break;
    }
    case 'join': {
      const nickname=state.nickname.trim();const code=state.inputRoom.trim().toUpperCase();
      if(!nickname) {setError('請先輸入暱稱。');return;}
      if(!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {setError('請輸入正確的六碼活動代碼，或由主持人提供 QR Code。');return;}
      await busyOperation(async()=>{
        state.uid=await joinSession(code,nickname);
        state.mode='online';state.code=code;
        history.replaceState({},'',urlForRoom(code));startRoomListeners(code,false);
      });break;
    }
    case 'publish': {
      if(state.room?.status!=='lobby'||state.players.length!==24||state.players.some(p=>!p.submitted)) return;
      await busyOperation(async()=>{
        const groups=balancedMatch(state.players,6);
        validateBalancedAssignments(groups,6);
        await publishAssignments(state.code,groups);
      });break;
    }
    case 'copy-link': await copyLink();break;
    case 'download-qr': downloadQr();break;
    case 'export-csv': exportCsv();break;
  }
}
app.addEventListener('click', event=>{
  const selectedRole=event.target.closest('[data-select-role]');
  if(selectedRole && state.screen==='role' && !state.busy) {
    state.roleAnswers[state.roleIndex]=Number(selectedRole.dataset.selectRole);persist('role');render();return;
  }
  const button=event.target.closest('[data-action]');
  if(button && !button.disabled) void handleAction(button.dataset.action);
});
app.addEventListener('input', event=>{
  if(event.target.id==='nickname')state.nickname=event.target.value;
  if(event.target.id==='room-code') {state.inputRoom=event.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);event.target.value=state.inputRoom;}
});
app.addEventListener('keydown', event=>{
  if(event.key==='Enter' && (event.target.id==='nickname'||event.target.id==='room-code')) {
    event.preventDefault();void handleAction(isOnline?'join':'start-demo');
  }
});
async function boot() {
  if (!isOnline) {
    state.screen=PARAM_HOST?'host-entry':'landing';
    if(PARAM_ROOM)state.error='這個網站目前尚未連接 Firebase，無法加入多人房間。';
    render();return;
  }
  state.screen='loading';render();
  try {
    const f=await firebaseClient();state.uid=f.user.uid;
    if(PARAM_HOST && PARAM_HOST!=='1') {
      state.mode='online';startRoomListeners(PARAM_HOST,true);
    } else if(PARAM_HOST==='1') {
      state.screen='host-entry';render();
    } else {
      state.screen='landing';render();
    }
  } catch(error) {state.screen='error';setError(safeError(error));}
}
void boot();
