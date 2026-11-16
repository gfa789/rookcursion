import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from 'chess.js';
import {decisionFact,decisionInsights} from '../server/decisions.js';
function fixture(){
 const pgn='1. e4 {[%clk 0:00:05]} e5 {[%clk 0:01:00]} 2. Nf3 {[%clk 0:00:07]} Nc6 {[%clk 0:00:59]} 3. Bb5 {[%clk 0:00:06]}';
 const b=new Chess();b.loadPgn(pgn);
 return {game:{id:'x',pgn,color:'w',timeControl:'60+2',timeClass:'bullet',reviewed:true},review:{rows:b.history({verbose:true}).map((m,index)=>({color:m.color,fenAfter:m.after,index,ply:index+1,san:m.san,beforeCp:0,classification:index===2?'Mistake':'Best'}))}};
}
test('clock pressure uses the start of the turn, retains increment, and counts own moves',()=>{
 const {game,review}=fixture(),fact=decisionFact(game,review);
 assert.equal(fact.clocks.low.moves,1);
 assert.equal(fact.clocks.low.errors,1);
 assert.equal(fact.clocks.normal.moves,2);
 assert.equal(fact.clocks.low.balancedErrors,1);
 assert.equal(fact.firstError.index,2);
});
test('missing clocks break the chain and unsupported controls remain excluded',()=>{
 const {game,review}=fixture();
 game.pgn=game.pgn.replace('{[%clk 0:00:05]}','');
 assert.equal(decisionFact(game,review).clocks.low.moves,0);
 game.timeControl='1/86400';
 assert.equal(decisionFact(game,review).clocks.normal.moves,0);
});
test('stage aggregation counts first error once and preserves empty values',()=>{
 const {game,review}=fixture();
 game.decisions=decisionFact(game,review);
 const data=decisionInsights([game,{reviewed:true}]);
 assert.equal(data.games,1);
 assert.equal(data.stages[0].firstErrors,1);
 assert.equal(data.stages[0].moves,3);
 assert.equal(data.stages[1].errorRate,null);
 assert.equal(data.clocks[0].low.balancedRate,100);
});
