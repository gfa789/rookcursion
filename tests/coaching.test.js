import test from 'node:test';
import assert from 'node:assert/strict';
import {coachingFact,coachingInsights} from '../server/coaching.js';

const row=(index,classification,beforeCp=250,color='b')=>({index,color,classification,beforeCp,afterCp:0,san:'a6'});
test('coaching uses own perspective and next own move, with no cross-game follow-up',()=>{
  const game={id:'a',color:'b',result:'win',reviewed:true};
  game.coaching=coachingFact(game,{rows:[row(0,'Blunder',250,'w'),row(1,'Mistake'),row(2,'Best',-250,'w'),row(3,'Blunder')]});
  assert.equal(game.coaching.states.Advantage.moves,2);
  assert.deepEqual(game.coaching.followUp.afterError,{moves:1,errors:1});
  const data=coachingInsights([game,game]);
  assert.equal(data.recovery.afterError.moves,2);
  assert.equal(data.positionStates[0].games,2);
  assert.equal(data.positionStates[0].winRate,100);
});
test('missing and legacy data have null rates and explicit coverage',()=>{
  const data=coachingInsights([{reviewed:true}]);
  assert.equal(data.coverage.games,0);
  assert.equal(data.coverage.reviewed,1);
  assert.equal(data.recovery.afterError.errorRate,null);
  assert.equal(data.recovery.difference,null);
  assert.equal(data.opponentBands[0].score,null);
});
test('opponent bands exclude unrated and absent ratings and count draws as half',()=>{
  const base={rated:true,rating:1500,opponentRating:1600,result:'draw'};
  const data=coachingInsights([base,{...base,rated:false},{...base,rating:null}]);
  const band=data.opponentBands.find(b=>b.name==='Similar rating');
  assert.equal(band.games,1);
  assert.equal(band.score,50);
});
