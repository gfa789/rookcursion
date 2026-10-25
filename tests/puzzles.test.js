import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Chess} from 'chess.js';
import {puzzleCandidates,validatedPuzzle,publicPuzzle,sequencePuzzle,PuzzleService} from '../server/puzzles.js';
import {Engine} from '../server/engine.js';
const fen='4k3/7p/8/3q4/8/2N5/P7/4K3 w - - 0 1';
const row={index:0,ply:25,color:'w',classification:'Blunder',uci:'c3b5',bestUci:'c3d5',fenBefore:fen,fenAfter:'4k3/7p/8/1N1q4/8/8/P7/4K3 b - - 1 1',san:'Nb5',lossCp:800,afterMate:null,replyLine:['Qxb5'],bestSan:'Nxd5',explanation:'Nb5 lets the queen take your knight.'};
const game={id:'source',color:'w',ended:1700000000,opponent:'opponent',timeClass:'rapid'};
const candidate=puzzleCandidates([{game,review:{rows:[row]}}]).candidates[0];
const pv=['c3d5','e8d7','d5f6','d7d6','f6e4','d6d5'];
const lines=[{best:pv[0],pv,cp:320,mate:null,depth:14},{best:'c3b5',pv:['c3b5'],cp:-600,mate:null,depth:14}];
const play=(b,m)=>b.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]});
function mockEngine(){const positions=new Map(),b=new Chess(fen);for(let i=0;i<pv.length;i++){positions.set(b.fen(),pv.slice(i));play(b,pv[i]);}return {evaluateMulti:async f=>{const line=positions.get(f)||[new Chess(f).moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||''))[0]];return [{...lines[0],best:line[0],pv:line},{...lines[1]}];},evaluate:async f=>{const m=new Chess(f).moves({verbose:true})[0];return {cp:900,mate:null,best:m.from+m.to+(m.promotion||'')};}};}
function service(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE games(id TEXT PRIMARY KEY,ended INTEGER,body TEXT); CREATE TABLE reviews(id TEXT PRIMARY KEY,body TEXT);');return new PuzzleService({db,engine:mockEngine()});}
async function seed(s){const p=await sequencePuzzle(validatedPuzzle(candidate,lines),s.engine);s.db.prepare('INSERT INTO puzzles VALUES (?,?)').run(p.id,JSON.stringify(p));return p;}
async function start(s,p){return (await s.answer(p.id,{action:'start'})).sessionId;}

test('candidates include only personal mistakes, keeping book and opponent moves out',()=>{
  const result=puzzleCandidates([{game,review:{rows:[row,{...row,color:'b'},{...row,classification:'Book'}]}}]);assert.equal(result.candidates.length,1);assert.equal(result.themes[0].count,1);
});
test('ambiguous or shallow initial choices are rejected; public puzzles hide the line',async()=>{
  assert.equal(validatedPuzzle(candidate,[lines[0],{...lines[1],cp:300}]),null);
  assert.equal(validatedPuzzle(candidate,[{...lines[0],depth:12},lines[1]]),null);
  const p=await sequencePuzzle(validatedPuzzle(candidate,lines),mockEngine()),pub=publicPuzzle(p);assert.equal(pub.totalMoves,3);assert.equal(pub.solution,undefined);assert.equal(pub.steps,undefined);
});
test('a puzzle is solved only after all three player moves and automatic replies',async()=>{
  const s=service(),p=await seed(s),sessionId=await start(s,p);
  const first=await s.answer(p.id,{sessionId,step:0,move:pv[0]});assert.equal(first.complete,false);assert.equal(first.reply,pv[1]);assert.equal(first.completedMoves,1);assert.equal(s.progress(p.id).solved,0);assert.equal(first.pv,undefined);
  const duplicate=await s.answer(p.id,{sessionId,step:0,move:pv[0]});assert.equal(duplicate.status,409);
  const second=await s.answer(p.id,{sessionId,step:1,move:pv[2]});assert.equal(second.complete,false);assert.equal(second.reply,pv[3]);
  const done=await s.answer(p.id,{sessionId,step:2,move:pv[4]});assert.equal(done.complete,true);assert.equal(done.correct,true);assert.equal(s.progress(p.id).solved,1);assert.equal(s.progress(p.id).attempts,1);assert.ok(s.progress(p.id).due>Date.now()+6*86400000);assert.deepEqual(done.pv,pv.slice(0,5));
  assert.deepEqual(await s.answer(p.id,{sessionId,step:2,move:pv[4]}),done);s.db.close();
});
test('later hints refer to the current position and assisted sequences are not clean',async()=>{
  const s=service(),p=await seed(s),sessionId=await start(s,p);await s.answer(p.id,{sessionId,step:0,move:pv[0]});
  assert.equal((await s.answer(p.id,{sessionId,step:1,action:'hint'})).from,'d5');await s.answer(p.id,{sessionId,step:1,move:pv[2]});
  const done=await s.answer(p.id,{sessionId,step:2,move:pv[4]});assert.equal(done.assisted,true);assert.ok(s.progress(p.id).due<Date.now()+11*60000);s.db.close();
});
test('wrong answers retain the position and reveal never marks a sequence solved',async()=>{
  const s=service(),p=await seed(s),sessionId=await start(s,p);const wrong=await s.answer(p.id,{sessionId,step:0,move:'c3b5'});assert.equal(wrong.correct,false);assert.equal(wrong.solution,undefined);
  assert.equal((await s.answer(p.id,{sessionId,step:0,move:'a1a8'})).status,400);
  const reveal=await s.answer(p.id,{sessionId,step:0,action:'reveal'});assert.equal(reveal.complete,true);assert.equal(reveal.correct,false);assert.deepEqual(reveal.pv,pv.slice(0,5));assert.equal(s.progress(p.id).solved,0);assert.equal(s.progress(p.id).assisted,1);s.db.close();
});
test('equivalent alternatives are accepted and branch to a legal reply',async()=>{
  const s=service(),p=await seed(s),sessionId=await start(s,p);s.engine.evaluate=async()=>({cp:-300,mate:null,best:'d5b5'});
  const result=await s.answer(p.id,{sessionId,step:0,move:'c3b5'});assert.equal(result.correct,true);assert.equal(result.reply,'d5b5');assert.equal(new Chess(result.fen).turn(),'w');s.db.close();
});
test('generation saves sequences and excludes old single-move puzzles from the pool',async()=>{
  const s=service();s.db.prepare('INSERT INTO games VALUES (?,?,?)').run(game.id,game.ended,JSON.stringify(game));s.db.prepare('INSERT INTO reviews VALUES (?,?)').run(game.id,JSON.stringify({rows:[row]}));s.db.prepare('INSERT INTO puzzles VALUES (?,?)').run('legacy',JSON.stringify({...validatedPuzzle(candidate,lines),id:'legacy'}));
  await s.generate('rapid');assert.equal(s.pool('rapid').length,1);assert.equal(s.pool('bullet').length,0);assert.equal(s.next({scope:'rapid'}).puzzle.totalMoves,3);s.db.close();
});
test('sequence builder excludes positions which end after just one player move',async()=>{
  const initial={...validatedPuzzle(candidate,lines),fen:'4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1'};
  assert.equal(await sequencePuzzle(initial,{evaluateMulti:async()=>lines}),null);
});
test('Learn uses opening mistakes from history, keeps its pool separate and refreshes cached lessons',async()=>{
  const s=service(),openingRow={...row,ply:7,opening:{name:'French Defence: Advance Variation',eco:'C02'}};
  s.db.prepare('INSERT INTO games VALUES (?,?,?)').run(game.id,game.ended,JSON.stringify(game));
  s.db.prepare('INSERT INTO reviews VALUES (?,?)').run(game.id,JSON.stringify({rows:[openingRow,{...openingRow,ply:30}]}));
  const sample=s.lessons('rapid');assert.equal(sample.candidates.length,1);assert.equal(s.lessons('rapid'),sample);assert.equal(s.lessons('bullet').candidates.length,0);
  await s.generate('rapid','learn');assert.equal(s.pool('rapid','learn').length,1);assert.equal(s.pool('rapid').length,0);
  assert.equal(s.next({scope:'rapid',mode:'learn'}).puzzle.openingFamily,'French Defence');
  s.db.prepare('INSERT OR REPLACE INTO reviews VALUES (?,?)').run(game.id,JSON.stringify({rows:[{...openingRow,opening:{name:'Sicilian Defence'}}]}));
  assert.equal(s.lessons('rapid').candidates[0].openingFamily,'Sicilian Defence');s.db.close();
});
test('real Stockfish MultiPV searches preserve subsequent game-review searches',async()=>{
  const engine=new Engine();try{const result=await engine.evaluateMulti(fen,14);assert.equal(result.length,2);assert.equal(result[0].best,'c3d5');assert.ok(result[0].depth>=14);const single=await engine.evaluate(new Chess().fen(),8);assert.equal(single.depth,8);}finally{engine.close();}
});
