import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { classify, sanLine, isSacrifice, expectedScore, explain } from '../server/grading.js';
import { Engine } from '../server/engine.js';

test('move categories use loss from the mover perspective',()=>{
  const grade=after=>classify({best:'e2e4',played:'d2d4',before:0,after});
  assert.equal(grade(-5),'Excellent');assert.equal(grade(-30),'Good');
  assert.equal(grade(-80),'Inaccuracy');assert.equal(grade(-150),'Mistake');assert.equal(grade(-500),'Blunder');
  assert.equal(classify({best:'e2e4',played:'e2e4',before:0,after:0}),'Best');
  assert.equal(classify({best:'e2e4',played:'e2e4',before:0,after:0,sacrifice:true}),'Brilliant');
  assert.ok(expectedScore(200)>expectedScore(-200));
});
test('engine continuations use legal SAN and stop at invalid moves',()=>{
  const fen=new Chess().fen();
  assert.deepEqual(sanLine(fen,['e2e4','e7e5','g1f3','invalid']),['e4','e5','Nf3']);
  assert.equal(isSacrifice(fen,'e2e4',['e7e5'],0,0),false);
});
test('coach explains the real capture allowed and the better capture',()=>{
  const board=new Chess('4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1');
  const fen=board.fen(),move=board.move('Nb5');
  const text=explain(fen,move,{uci:'c3b5',bestUci:'c3d5',classification:'Blunder',replyLine:['Qxb5'],afterMate:null,beforeMate:null});
  assert.match(text,/taking your knight/);assert.match(text,/Nxd5 takes the queen on d5/);
});
test('coach explains development without fabricating a tactical threat',()=>{
  const board=new Chess(),fen=board.fen(),move=board.move('Nf3');
  const text=explain(fen,move,{uci:'g1f3',bestUci:'g1f3',classification:'Best',replyLine:[],afterMate:null,beforeMate:null});
  assert.match(text,/develops your knight off the back rank/);assert.doesNotMatch(text,/forced mate|taking your/);
});
test('coach identifies the purpose of a quiet pawn move that attacks a bishop',()=>{
  const board=new Chess('4k3/8/8/8/6b1/8/7P/4K3 w - - 0 1'),fen=board.fen(),move=board.move('h4');
  const text=explain(fen,move,{uci:'h2h4',bestUci:'h2h3',classification:'Good',replyLine:[],afterMate:null,beforeMate:null});
  assert.match(text,/h3 challenges their bishop on g4 with your less valuable pawn/);
});
test('Stockfish starts, evaluates a forced mate for Black and accepts subsequent searches',async()=>{
  const engine=new Engine();
  try {
    const b=new Chess();['f3','e5','g4'].forEach(m=>b.move(m));
    const result=await engine.evaluate(b.fen(),8);
    assert.equal(result.best,'d8h4');assert.equal(result.mate,1);assert.ok(result.cp>90000);
    const normal=await engine.evaluate(new Chess().fen(),8);
    assert.match(normal.best,/^[a-h][1-8][a-h][1-8][qrbn]?$/);assert.ok(normal.pv.length>0);
    assert.ok(normal.depth>=8);
  }finally{engine.close();}
});
