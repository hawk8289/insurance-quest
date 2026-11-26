import { roleScores } from './questions.js';

/**
 * Assign 25 players across four teams as 6 / 6 / 6 / 7.
 * The seven-person team is selected by maximizing the total match between
 * players' eight answers and the four department preferences.
 * Ties use a stable secondary ordering, so reloading cannot reshuffle results.
 */
function solveHungarian(players, seatGroups) {
  const n = players.length;
  const cost = Array.from({ length:n }, (_,i) => {
    const scores = roleScores(players[i].answers);
    return seatGroups.map((group,j) => {
      // 25 tie-break values total at most 300, < one whole preference point.
      const tie = ((i + 3)*29 + (j + 7)*17 + i*j*3) % 13;
      return (8 - scores[group])*1000 + tie;
    });
  });
  const u=Array(n+1).fill(0), v=Array(n+1).fill(0);
  const p=Array(n+1).fill(0), way=Array(n+1).fill(0);
  for(let i=1;i<=n;i++) {
    p[0]=i;
    let j0=0;
    const minv=Array(n+1).fill(Infinity);
    const used=Array(n+1).fill(false);
    do {
      used[j0]=true;
      const i0=p[j0]; let delta=Infinity, j1=0;
      for(let j=1;j<=n;j++) {
        if(used[j]) continue;
        const cur=cost[i0-1][j-1]-u[i0]-v[j];
        if(cur<minv[j]) {minv[j]=cur;way[j]=j0;}
        if(minv[j]<delta) {delta=minv[j];j1=j;}
      }
      for(let j=0;j<=n;j++) {
        if(used[j]) {u[p[j]]+=delta;v[j]-=delta;}
        else {minv[j]-=delta;}
      }
      j0=j1;
    } while(p[j0]!==0);
    do {
      const j1=way[j0]; p[j0]=p[j1]; j0=j1;
    } while(j0!==0);
  }
  const assignments={}; let totalCost=0;
  for(let j=1;j<=n;j++) {
    const row=p[j]-1;
    assignments[players[row].uid]=seatGroups[j-1];
    totalCost+=cost[row][j-1];
  }
  return {assignments,totalCost};
}

export function balancedMatch(participants, baseSize=6) {
  const expected=baseSize*4+1;
  if(!Array.isArray(participants)||participants.length!==expected) {
    throw new Error(`需要剛好 ${expected} 位玩家才能分組。`);
  }
  if(participants.some(p=>!p?.uid || !Array.isArray(p.answers)||p.answers.length!==8||p.answers.some(a=>!Number.isInteger(a)||a<0||a>3))) {
    throw new Error('有人尚未完成八道職能題，無法分組。');
  }
  if(new Set(participants.map(p=>p.uid)).size!==expected) throw new Error('玩家身分重複，無法分組。');
  const players=[...participants].sort((a,b)=>a.joinOrder-b.joinOrder);
  let best=null;
  // Try each possible team as the seven-person team, choose the best overall.
  for(let extra=0;extra<4;extra++) {
    const seats=Array.from({length:4},(_,group)=>Array(baseSize+(group===extra?1:0)).fill(group)).flat();
    const candidate=solveHungarian(players,seats);
    if(!best||candidate.totalCost<best.totalCost) best=candidate;
  }
  return best.assignments;
}

/** Reject any allocation except three teams of 6 and one team of 7. */
export function validateBalancedAssignments(assignments,baseSize=6) {
  if(!assignments||typeof assignments!=='object'||Array.isArray(assignments)) {
    throw new Error('分組結果格式錯誤。');
  }
  const values=Object.values(assignments);
  const expected=baseSize*4+1;
  if(values.length!==expected||values.some(v=>!Number.isInteger(v)||v<0||v>3)) {
    throw new Error(`分組結果必須包含 ${expected} 人，且組別只能是 A、B、C、D。`);
  }
  const counts=[0,0,0,0];
  values.forEach(v=>counts[v]++);
  if(counts.filter(n=>n===baseSize).length!==3 || counts.filter(n=>n===baseSize+1).length!==1) {
    throw new Error(`分組人數不符合 6／6／6／7：${counts.join(' / ')}。`);
  }
  return counts;
}
