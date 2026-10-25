import test from 'node:test';
import assert from 'node:assert/strict';
import {openingLessons,trainingIdea} from '../server/learning.js';
import {validatedPuzzle} from '../server/puzzles.js';

const fen='4k3/7p/8/3q4/8/2N5/P7/4K3 w - - 0 4';
const game={id:'one',ended:100,color:'w',opponent:'opponent',timeClass:'rapid'};
const row={index:6,ply:7,color:'w',classification:'Mistake',uci:'c3b5',bestUci:'c3d5',fenBefore:fen,fenAfter:'4k3/7p/8/1N1q4/8/8/P7/4K3 b - - 1 4',san:'Nb5',opening:{name:'French Defence: Advance Variation',eco:'C02'},explanation:'The queen can take your knight.'};
test('opening lessons group repeated positions across move counters and rank recurring errors first',()=>{
  const data=openingLessons([{game,row},{game:{...game,id:'two',ended:200},row:{...row,fenBefore:fen.replace('0 4','3 6')}},{game:{...game,id:'three',ended:300},row:{...row,index:8,ply:9,fenBefore:fen.replace('c3','a3').replace('2N5','N7')}}]);
  assert.equal(data.candidates.length,2);assert.equal(data.candidates[0].occurrences,2);assert.equal(data.candidates[0].gameId,'two');assert.equal(data.candidates[0].openingFamily,'French Defence');assert.equal(data.themes[0].count,3);assert.match(trainingIdea(data.candidates[0]),/2 games/);
});
test('learning excludes opponent moves, book moves, and positions beyond move twelve',()=>{
  const data=openingLessons([{game,row},{game,row:{...row,color:'b'}},{game,row:{...row,classification:'Book'}},{game,row:{...row,ply:25}},{game,row:{...row,bestUci:row.uci}}]);
  assert.equal(data.candidates.length,1);assert.equal(data.candidates[0].kind,'opening');assert.match(data.candidates[0].id,/learn-v1$/);
});
test('opening practice accepts a sound non-unique choice while tactics retain the clear-choice requirement',()=>{
  const candidate=openingLessons([{game,row}]).candidates[0],lines=[{best:'c3d5',cp:200,mate:null,depth:14,pv:['c3d5','e8d7']},{best:'c3e4',cp:180,mate:null,depth:14,pv:['c3e4']}];
  assert.ok(validatedPuzzle(candidate,lines));assert.equal(validatedPuzzle({...candidate,kind:undefined},lines),null);
});
test('initial coaching gives a focus without disclosing the solution',()=>{
  const idea=trainingIdea({kind:'opening',openingFamily:'French Defence',occurrences:1});assert.match(idea,/French Defence/);assert.doesNotMatch(idea,/Nxd5/);
  assert.match(trainingIdea({theme:'Allowed a forced mate'}),/king safe/);
});
