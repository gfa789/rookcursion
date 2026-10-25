import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateInsights,phaseOf,mistakeTheme} from '../server/insights.js';
import {Chess} from 'chess.js';

function fact(id,timeClass,result,reviewed=false){return {id:String(id),ended:1609459200+id*2678400,timeClass,color:timeClass==='rapid'?'w':'b',result,rated:true,rating:1000+id*10,opponentRating:1000,opponent:'rival',opening:timeClass==='rapid'?'Italian Game: Main Line':'Sicilian Defense: Dragon',reviewed,depth:reviewed?12:null,quality:reviewed?90:null,ownMoves:reviewed?20:0,counts:reviewed?{Best:18,Mistake:1,Blunder:1}:{},phases:reviewed?{Opening:{moves:20,errors:2,blunders:1}}:{},themes:reviewed?{'Opening decisions':{count:2,impact:.2}}:{},examples:[]};}
test('scope filters and reviewed coverage use distinct denominators',()=>{
  const games=[...Array.from({length:5},(_,i)=>fact(i+1,'rapid',i<4?'win':'loss',i<2)),...Array.from({length:6},(_,i)=>fact(i+6,'blitz',i===0?'win':'loss'))];
  const all=aggregateInsights(games),rapid=aggregateInsights(games,'rapid');
  assert.equal(all.total,11);assert.equal(all.reviewed,2);assert.equal(all.quality,90);assert.equal(all.score,45.5);assert.equal(rapid.total,5);assert.equal(rapid.score,80);assert.equal(rapid.errorRate,10);assert.equal(all.ratings.length,2);
  assert.equal(all.bestOpenings[0].name,'Italian Game');assert.equal(all.worstOpenings[0].name,'Sicilian Defense');assert.equal(all.patterns[0].count,4);
});
test('opening rankings require enough games and empty scopes remain valid',()=>{
  const data=aggregateInsights([fact(1,'rapid','win',true)],'rapid');assert.equal(data.openings.length,1);assert.equal(data.bestOpenings.length,0);
  const empty=aggregateInsights([fact(1,'rapid','win',true)],'bullet');assert.equal(empty.total,0);assert.equal(empty.quality,null);assert.deepEqual(empty.ratings,[]);
});
test('rating series stay separated by time control and exclude unrated games',()=>{
  const games=[fact(1,'rapid','win'),fact(2,'blitz','loss'),{...fact(3,'rapid','win'),rated:false,rating:2500}];const result=aggregateInsights(games);
  assert.equal(result.ratings.find(r=>r.control==='rapid').current,1010);assert.equal(result.ratings.find(r=>r.control==='blitz').current,1020);
});
test('mistake patterns describe concrete engine replies without assuming a hanging piece',()=>{
  const b=new Chess('4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1');const m=b.move('Nb5');
  const row={ply:21,fenBefore:m.before,fenAfter:m.after,afterMate:null,replyLine:['Qxb5'],bestSan:'Nxd5'};
  assert.equal(mistakeTheme(row),'Costly moves allowing piece captures');assert.equal(phaseOf({...row,ply:3}),'Opening');
});
