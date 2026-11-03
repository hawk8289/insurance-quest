import test from 'node:test';
import assert from 'node:assert/strict';
import { balancedMatch, validateBalancedAssignments } from '../matching.js';
import { ROLE_QUESTIONS, roleScores } from '../questions.js';

const player = (id, answers) => ({uid: `user-${id}`, joinOrder:id+1, answers});
const seededRandom = seed => () => {
  let x = seed += 0x6D2B79F5;
  x = Math.imul(x ^ x >>> 15, x | 1);
  x ^= x + Math.imul(x ^ x >>> 7, x | 61);
  return ((x ^ x >>> 14) >>> 0) / 4294967296;
};
const scoreFor = (player, dept) => roleScores(player.answers)[dept];

test('all 8 role questions have four choices and each group occurs once per question', () => {
  assert.equal(ROLE_QUESTIONS.length,8);
  for (const q of ROLE_QUESTIONS) {
    assert.equal(q.options.length,4);
    assert.deepEqual(q.options.map(o=>o.department).sort(),[0,1,2,3]);
  }
});

test('300 randomized rooms are always split 6 / 6 / 6 / 6', () => {
  const rnd=seededRandom(2026);
  for(let trial=0;trial<300;trial++) {
    const people=Array.from({length:24},(_,i)=>player(i,Array.from({length:8},()=>Math.floor(rnd()*4))));
    const groups=balancedMatch(people,6);
    const counts=[0,0,0,0];
    for(const assigned of Object.values(groups)) counts[assigned]++;
    assert.equal(Object.keys(groups).length,24);
    assert.deepEqual(counts,[6,6,6,6]);
    assert.deepEqual(validateBalancedAssignments(groups,6),[6,6,6,6]);
  }
});

test('a room with fewer than 24 people cannot be published', () => {
  assert.throws(()=>balancedMatch([],6),/24/);
  assert.throws(()=>balancedMatch(Array.from({length:23},(_,i)=>player(i,Array(8).fill(0))),6),/24/);
});

test('assignment optimizes all participants instead of assigning everyone to first preference', () => {
  const people=[
    player(0,Array(8).fill(2)),
    player(1,Array(8).fill(0)),
    player(2,Array(8).fill(1)),
    player(3,Array(8).fill(3)),
  ];
  // A choice index is NOT the same as its department; use the question mapping.
  const groups=balancedMatch(people,1);
  assert.deepEqual(Object.values(groups).sort(),[0,1,2,3]);
  const score=people.reduce((sum,p)=>sum+scoreFor(p,groups[p.uid]),0);
  let optimal=-Infinity;
  for(let a=0;a<4;a++) for(let b=0;b<4;b++) for(let c=0;c<4;c++) for(let d=0;d<4;d++) {
    if(new Set([a,b,c,d]).size!==4)continue;
    optimal=Math.max(optimal,scoreFor(people[0],a)+scoreFor(people[1],b)+scoreFor(people[2],c)+scoreFor(people[3],d));
  }
  assert.equal(score,optimal);
});


test('oversubscribed group is rejected even if total participants is 24', () => {
  const assignments = Object.fromEntries(Array.from({length:24},(_,i)=>[`user-${i}`,Math.min(Math.floor(i/6),3)]));
  assignments['user-6'] = 0; // A has 7, B has 5
  assert.throws(()=>validateBalancedAssignments(assignments,6),/不平均/);
});

test('all players choosing the same group still yields exactly 6 per group', () => {
  const players=Array.from({length:24},(_,i)=>player(i,Array(8).fill(2)));
  const allocation=balancedMatch(players,6);
  assert.deepEqual(validateBalancedAssignments(allocation,6),[6,6,6,6]);
});
