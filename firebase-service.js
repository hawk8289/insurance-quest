import { validateBalancedAssignments } from './matching.js';
/** Firebase is loaded ONLY for real multiplayer; offline demo needs no Firebase or build. */
const VERSION = '11.10.0';
let fb = null;

export function configured() {
  const conf = window.NANSHAN_GAME_CONFIG?.firebase;
  return !!(conf?.apiKey && conf?.projectId && conf?.appId);
}
export async function firebaseClient() {
  if (fb) return fb;
  if (!configured()) throw new Error('尚未設定 Firebase。請先編輯 config.js。');
  const [appLib, authLib, dbLib] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`)
  ]);
  const app = appLib.initializeApp(window.NANSHAN_GAME_CONFIG.firebase);
  const auth = authLib.getAuth(app);
  // Restore an existing anonymous identity before creating a new one;
  // otherwise a reload could accidentally consume another one of the 24 seats.
  await auth.authStateReady();
  const user = auth.currentUser || (await authLib.signInAnonymously(auth)).user;
  const db = dbLib.getFirestore(app);
  fb = { app, auth, user, db, ...dbLib };
  return fb;
}

function randomRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => chars[byte % chars.length]).join('');
}

export async function createSession() {
  const f = await firebaseClient();
  for (let attempts = 0; attempts < 8; attempts++) {
    const code = randomRoomCode();
    const ref = f.doc(f.db, 'sessions', code);
    try {
      await f.runTransaction(f.db, async tx => {
        const existing = await tx.get(ref);
        if (existing.exists()) throw new Error('ROOM_COLLISION');
        tx.set(ref, {
          code, hostId: f.user.uid, status: 'lobby',
          maxPlayers: 24, joinedCount: 0, assignments: {},
          createdAt: f.serverTimestamp()
        });
      });
      return code;
    } catch(e) { if (e.message !== 'ROOM_COLLISION') throw e; }
  }
  throw new Error('房間碼產生失敗，請再試一次。');
}

export async function joinSession(code, nickname) {
  const f = await firebaseClient();
  const sessionRef = f.doc(f.db, 'sessions', code);
  const memberRef = f.doc(f.db, 'sessions', code, 'participants', f.user.uid);
  const name = nickname.trim().slice(0, 24);
  await f.runTransaction(f.db, async tx => {
    const room = await tx.get(sessionRef);
    const member = await tx.get(memberRef);
    if (!room.exists()) throw new Error('找不到活動房間，請確認代碼。');
    if (member.exists()) return; // same anonymous user may rejoin after refresh
    const session = room.data();
    if (session.status !== 'lobby') throw new Error('活動已經完成分組，無法加入新玩家。');
    if (session.joinedCount >= session.maxPlayers) throw new Error('此活動已達 24 人上限。');
    tx.set(memberRef, {
      uid: f.user.uid, nickname: name, joinOrder: session.joinedCount + 1,
      answers: [], submitted: false,
      createdAt: f.serverTimestamp()
    });
    tx.update(sessionRef, { joinedCount: session.joinedCount + 1 });
  });
  return f.user.uid;
}

export function listenSession(code, onUpdate, onError) {
  const f = fb;
  return f.onSnapshot(f.doc(f.db,'sessions',code), snap => {
    onUpdate(snap.exists()?snap.data():null);
  }, onError);
}
export function listenParticipants(code, onUpdate, onError) {
  const f = fb;
  return f.onSnapshot(f.collection(f.db,'sessions',code,'participants'), snap => {
    onUpdate(snap.docs.map(doc => doc.data()).sort((a,b) => a.joinOrder-b.joinOrder));
  }, onError);
}
export function listenSelf(code, onUpdate, onError) {
  const f = fb;
  return f.onSnapshot(f.doc(f.db,'sessions',code,'participants',f.user.uid), snap => {
    onUpdate(snap.exists()?snap.data():null);
  }, onError);
}
export async function submitRoles(code, answers) {
  const f = await firebaseClient();
  await f.updateDoc(f.doc(f.db,'sessions',code,'participants',f.user.uid), {
    answers, submitted: true
  });
}
export async function publishAssignments(code, assignments) {
  // No team can exceed six: validate capacity before attempting a write.
  validateBalancedAssignments(assignments, 6);
  const f = await firebaseClient();
  const roomRef = f.doc(f.db, 'sessions', code);
  const ids = Object.keys(assignments);
  // A transaction prevents multiple host tabs from publishing conflicting results.
  // Read all 24 participant records and verify no one is missing or unfinished.
  await f.runTransaction(f.db, async tx => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error('活動房間不存在。');
    const room = roomSnap.data();
    if (room.hostId !== f.user.uid) throw new Error('只有建立房間的主持人能公布分組。');
    if (room.status !== 'lobby') throw new Error('分組已公布，無法重複分配。');
    if (room.joinedCount !== 24 || room.maxPlayers !== 24) throw new Error('尚未達到 24 位參與者。');
    for (const uid of ids) {
      const memberSnap = await tx.get(f.doc(f.db, 'sessions', code, 'participants', uid));
      if (!memberSnap.exists() || memberSnap.data().submitted !== true
          || !Array.isArray(memberSnap.data().answers) || memberSnap.data().answers.length !== 8) {
        throw new Error('仍有參與者未完成 8 題，無法公布分組。');
      }
    }
    tx.update(roomRef, { assignments, status: 'assigned', assignedAt: f.serverTimestamp() });
  });
}
export async function getSession(code) {
  const f = await firebaseClient();
  const doc = await f.getDoc(f.doc(f.db, 'sessions', code));
  return doc.exists() ? doc.data() : null;
}
export function currentUid() { return fb?.user.uid; }
