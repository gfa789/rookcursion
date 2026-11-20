import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStudyReport} from '../server/study-report.js';

const game=(index,control='rapid')=>({
  timeClass:control,rated:true,rating:1450+index,ended:index,color:'w',result:'win',
  opening:'Italian Game: Main Line',reviewed:true,ownMoves:20,
  counts:{Blunder:index<50?2:1},phases:{Opening:{errors:1,moves:10}},
  themes:{'Opening decisions':{count:2,impact:1}},
  decisions:{firstError:index===0?null:{window:'Moves 11–20'}},
});

test('report compares equally sized cohorts independently by time control',()=>{
  const facts=Array.from({length:100},(_,index)=>game(index));
  const report=buildStudyReport([...facts,game(101,'blitz')]);
  const [rapid,blitz]=report.comparisons;
  assert.equal(rapid.previous.rate,10);
  assert.equal(rapid.recent.rate,5);
  assert.equal(rapid.recent.moves,1000);
  assert.equal(blitz.previous,null);
  assert.equal(blitz.recent.games,1);
});

test('opening outcomes and recurring mistakes count games using their own denominators',()=>{
  const report=buildStudyReport([game(0),{...game(1),reviewed:false,color:'b',result:'draw'}]);
  assert.equal(report.openings.find(row=>row.color==='b').moves,0);
  assert.equal(report.openings.find(row=>row.color==='b').draw,1);
  assert.equal(report.patterns[0].games,1);
  assert.equal(report.patterns[0].count,2);
  assert.equal(report.timing.rows.at(-1).count,1);
});
