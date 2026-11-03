import { roleScores } from './questions.js';

/**
 * Hungarian algorithm (min-cost assignment).
 * Every participant is assigned to one of 24 distinct seats: 6 seats per department.
 * This maximizes the total number of chosen department preferences matched.
 * Unlike choosing each player's top score independently, it GUARANTEES 6 per team.
 */
export function balancedMatch(participants, teamSize = 6) {
  if (!Array.isArray(participants) || participants.length !== teamSize * 4) {
    throw new Error(`需要剛好 ${teamSize * 4} 位玩家才能分組。`);
  }
  if (participants.some(p => !Array.isArray(p.answers) || p.answers.length !== 8 || p.answers.some(a => !Number.isInteger(a) || a < 0 || a > 3))) {
    throw new Error('有人還沒完成八道職能題，無法分組。');
  }
  const players = [...participants].sort((a,b) => a.joinOrder - b.joinOrder);
  const n = players.length;
  const cost = Array.from({ length: n }, (_,i) => {
    const scores = roleScores(players[i].answers);
    return Array.from({ length: n }, (_,j) => {
      const group = Math.floor(j / teamSize);
      // Minor stable tie-breaks never override 1 full preference point (1000).
      const tie = ((i + 3) * 29 + (j + 7) * 17 + i * j * 3) % 13;
      return (8 - scores[group]) * 1000 + tie;
    });
  });

  // Hungarian potentials, indexed 1..n; p[j] = row assigned to column j.
  const u = Array(n + 1).fill(0);
  const v = Array(n + 1).fill(0);
  const p = Array(n + 1).fill(0);
  const way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity);
    const used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else { minv[j] -= delta; }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const assignments = {};
  for (let j = 1; j <= n; j++) {
    assignments[players[p[j] - 1].uid] = Math.floor((j - 1) / teamSize);
  }
  return assignments;
}

/** Reject any published allocation that is not exactly six people in each team. */
export function validateBalancedAssignments(assignments, teamSize = 6) {
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    throw new Error('分組結果格式錯誤。');
  }
  const values = Object.values(assignments);
  if (values.length !== teamSize * 4 || values.some(v => !Number.isInteger(v) || v < 0 || v > 3)) {
    throw new Error(`分組結果必須包含 ${teamSize * 4} 人，且組別只能是 A、B、C、D。`);
  }
  const counts = [0,0,0,0];
  for (const v of values) counts[v] += 1;
  if (counts.some(count => count !== teamSize)) {
    throw new Error(`分組人數不平均：${counts.join(' / ')}。每組必須剛好 ${teamSize} 人。`);
  }
  return counts;
}
