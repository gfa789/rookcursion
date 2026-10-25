import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateInsights,phaseOf,mistakeTheme,insightPeriod} from '../server/insights.js';
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
test('period boundaries use YTD, rolling 90 days and a clamped calendar month',()=>{
  const now=Date.parse('2026-10-25T12:00:00Z');
  assert.equal(insightPeriod('ytd',now).start,Date.parse('2026-01-01T00:00:00Z')/1000);
  assert.equal(insightPeriod('90d',now).start,(now-90*86400000)/1000);
  assert.equal(insightPeriod('month',now).start,Date.parse('2026-09-25T12:00:00Z')/1000);
  assert.equal(insightPeriod('month',Date.parse('2026-03-31T18:30:00Z')).start,Date.parse('2026-02-28T18:30:00Z')/1000);
  assert.equal(insightPeriod('month',Date.parse('2024-03-31T18:30:00Z')).start,Date.parse('2024-02-29T18:30:00Z')/1000);
  assert.equal(insightPeriod('invalid',now).key,'all');
});
test('date filtering changes counts, openings, errors and ratings together with inclusive boundaries',()=>{
  const now=Date.parse('2026-10-25T12:00:00Z'),start=insightPeriod('90d',now).start;
  const games=[{...fact(1,'rapid','win',true),ended:start-1},{...fact(2,'rapid','loss',true),ended:start},{...fact(3,'rapid','win'),ended:now/1000},{...fact(4,'rapid','loss',true),ended:now/1000+1},{...fact(5,'blitz','win',true),ended:start+1}];
  const data=aggregateInsights(games,'rapid',{range:'90d',now});
  assert.equal(data.total,2);assert.equal(data.reviewed,1);assert.equal(data.score,50);assert.equal(data.openings[0].games,2);assert.equal(data.patterns[0].count,2);assert.equal(data.ownMoves,20);assert.equal(data.ratings[0].start,1020);assert.equal(data.ratings[0].current,1030);assert.equal(data.ratings[0].change,10);
  assert.ok(data.ratings[0].points.every(p=>p.ended>=start&&p.ended<=now/1000));
  assert.equal(aggregateInsights(games,'bullet',{range:'month',now}).total,0);
});
test('short rating ranges retain daily detail and the real period-start rating',()=>{
  const now=Date.parse('2026-10-25T12:00:00Z');
  const games=Array.from({length:20},(_,i)=>({...fact(i+1,'rapid','win'),ended:Date.parse(`2026-10-${String(i+1).padStart(2,'0')}T10:00:00Z`)/1000}));
  const short=aggregateInsights(games,'rapid',{range:'month',now}),all=aggregateInsights(games,'rapid',{range:'all',now});
  assert.equal(short.period.bucket,'day');assert.equal(short.ratings[0].points.length,20);assert.equal(all.period.bucket,'month');assert.equal(all.ratings[0].points.length,2);assert.equal(all.ratings[0].points[0].rating,1010);assert.equal(all.ratings[0].points.at(-1).rating,1200);
});

test('rating checkpoints expose exactly the rated games in their bucket and control',()=>{
  const now=Date.parse('2026-10-25T12:00:00Z');
  const make=(id,day,control='rapid')=>({...fact(id,control,'win',id===2),ended:Date.parse(`2026-10-${day}T10:00:00Z`)/1000});
  const games=[make(1,'01'),make(2,'02'),make(3,'02'),make(4,'03','blitz'),{...make(5,'02'),rated:false},make(6,'25')];
  const monthly=aggregateInsights(games,'all',{now}).ratings.find(r=>r.control==='rapid');
  assert.equal(monthly.points[0].anchor,true);assert.deepEqual(monthly.points[0].games.map(g=>g.id),['1']);
  assert.deepEqual(monthly.points.at(-1).games.map(g=>g.id),['1','2','3','6']);
  assert.equal(monthly.points.at(-1).rating,1060);assert.equal(monthly.points.at(-1).games[1].reviewed,true);
  const daily=aggregateInsights(games,'rapid',{range:'month',now}).ratings[0];
  const point=daily.points.find(p=>p.date==='2026-10-02');assert.deepEqual(point.games.map(g=>g.id),['2','3']);assert.equal(point.rating,1030);
  const weekly=aggregateInsights(games,'rapid',{range:'ytd',now}).ratings[0];
  assert.deepEqual(weekly.points.find(p=>!p.anchor&&p.date==='2026-09-28').games.map(g=>g.id),['1','2','3']);
  assert.ok(daily.points.every(p=>p.games.every(g=>g.ended<=now/1000)));
});
