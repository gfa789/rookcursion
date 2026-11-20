import {buildStudyReport} from './study-report.js';
import {decisionFact,decisionInsights} from './decisions.js';
import {coachingFact,coachingInsights} from './coaching.js';
import {Chess} from 'chess.js';
import {gameOpeningMoves} from './openings.js';
import {expectedScore,VALUES} from './grading.js';

export const FACT_VERSION=3;
const mean=values=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null;
const round=value=>Math.round(value*10)/10;
export function phaseOf(row){
  if(row.ply<=20)return 'Opening';
  const material=row.fenBefore.split(' ')[0].split('').reduce((sum,p)=>sum+(/[nbrq]/i.test(p)?VALUES[p.toLowerCase()]:0),0);
  return material<=13?'Endgame':'Middlegame';
}
export function mistakeTheme(row){
  if(row.afterMate!==null&&row.afterMate<0)return 'Allowed a forced mate';
  try{const b=new Chess(row.fenAfter),reply=row.replyLine?.[0]?b.move(row.replyLine[0]):null;if(reply?.captured)return reply.captured==='p'?'Costly moves allowing pawn captures':'Costly moves allowing piece captures';}catch{}
  if(row.bestSan?.includes('+')||row.bestSan?.includes('#'))return 'Missed a stronger checking move';
  return `${phaseOf(row)} decisions`;
}
export function buildGameFact(game,review=null){
  const me=game.color==='w'?game.white:game.black,opponent=game.color==='w'?game.black:game.white;
  let opening=review?.opening||null;
  if(!opening){try{opening=gameOpeningMoves(game.pgn).at(-1)?.opening;}catch{}}
  const fact={version:FACT_VERSION,id:game.id,ended:game.ended,timeClass:game.timeClass,color:game.color,result:game.result,rated:game.rated!==false,rating:me?.rating??null,opponentRating:opponent?.rating??null,opponent:game.opponent,opening:opening?.name||game.opening||'Unclassified opening',eco:opening?.eco||null,reviewed:!!review,depth:review?.depth||null,quality:review?.accuracy?.[game.color]??null,counts:{},phases:{},themes:{},examples:[],ownMoves:0};
  fact.coaching=coachingFact(game,review);
  fact.decisions=decisionFact(game,review);
  if(!review)return fact;
  for(const row of review.rows){
    if(row.color!==game.color)continue;
    fact.ownMoves++;
    fact.counts[row.classification]=(fact.counts[row.classification]||0)+1;
    const phase=phaseOf(row),entry=fact.phases[phase]??={moves:0,errors:0,blunders:0};entry.moves++;
    if(!['Inaccuracy','Mistake','Blunder'].includes(row.classification))continue;
    entry.errors++;if(row.classification==='Blunder')entry.blunders++;
    const theme=mistakeTheme(row),pattern=fact.themes[theme]??={count:0,impact:0};pattern.count++;
    const impact=Math.max(0,expectedScore(row.beforeCp)-expectedScore(row.afterCp));pattern.impact+=impact;
    fact.examples.push({id:game.id,index:row.index,san:row.san,bestSan:row.bestSan,classification:row.classification,theme,impact:round(impact*100),explanation:row.explanation,opponent:game.opponent,ended:game.ended});
  }
  fact.examples.sort((a,b)=>b.impact-a.impact);fact.examples=fact.examples.slice(0,3);
  return fact;
}
export function insightPeriod(key='all',now=Date.now()){
  key=['all','ytd','90d','month'].includes(key)?key:'all';
  const end=new Date(now);let start=null;
  if(key==='ytd')start=Date.UTC(end.getUTCFullYear(),0,1);
  if(key==='90d')start=now-90*86400000;
  if(key==='month'){
    const monthStart=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-1,1));
    const lastDay=new Date(Date.UTC(monthStart.getUTCFullYear(),monthStart.getUTCMonth()+1,0)).getUTCDate();
    monthStart.setUTCDate(Math.min(end.getUTCDate(),lastDay));monthStart.setUTCHours(end.getUTCHours(),end.getUTCMinutes(),end.getUTCSeconds(),end.getUTCMilliseconds());start=monthStart.getTime();
  }
  return {key,start:start===null?null:Math.floor(start/1000),end:Math.floor(now/1000),bucket:key==='all'?'month':key==='ytd'?'week':'day'};
}
function timeBucket(ended,granularity){
  const date=new Date(ended*1000);
  if(granularity==='week')date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  return date.toISOString().slice(0,granularity==='month'?7:10);
}

const openingKey=f=>JSON.stringify([f.opening.split(':')[0],f.color]);

function addSource(list,source){
  if(list.some(item=>item.id===source.id))return;
  list.unshift(source);
  if(list.length>3)list.pop();
}

function compareReviewedGames(reviewed){
  const summarize=games=>{
    const summary={games:games.length,first:games[0]?.ended,last:games.at(-1)?.ended,moves:0,phases:{},themes:{},openings:{}};
    for(const game of games){
      summary.moves+=game.ownMoves;
      for(const [name,p] of Object.entries(game.phases)){
        const phase=summary.phases[name]??={moves:0,errors:0};
        phase.moves+=p.moves;
        phase.errors+=p.errors;
      }
      for(const [name,t] of Object.entries(game.themes))summary.themes[name]=(summary.themes[name]||0)+t.count;
      const opening=summary.openings[openingKey(game)]??={games:0,score:0,moves:0,errors:0};
      opening.games++;
      opening.score+=game.result==='win'?1:game.result==='draw'?.5:0;
      opening.moves+=game.phases.Opening?.moves||0;
      opening.errors+=game.phases.Opening?.errors||0;
    }
    return summary;
  };
  return {recent:summarize(reviewed.slice(-100)),previous:summarize(reviewed.slice(-200,-100))};
}

function studyTrends(facts,openings,granularity){
  const featured=new Set(openings.map(o=>JSON.stringify([o.name,o.color])));
  const buckets=new Map();
  for(const fact of facts){
    const date=timeBucket(fact.ended,granularity);
    const bucket=buckets.get(date)??{date,games:0,reviewed:0,moves:0,phases:{},themes:{},openings:{},sources:{reviewed:[],themes:{},openings:{}}};
    buckets.set(date,bucket);
    bucket.games++;
    const source={id:fact.id,opponent:fact.opponent,ended:fact.ended};
    const key=openingKey(fact);
    if(featured.has(key)){
      addSource(bucket.sources.openings[key]??=[],source);
      const opening=bucket.openings[key]??={games:0,score:0,moves:0,errors:0};
      opening.games++;
      opening.score+=fact.result==='win'?1:fact.result==='draw'?.5:0;
      if(fact.reviewed&&fact.phases.Opening){
        opening.moves+=fact.phases.Opening.moves;
        opening.errors+=fact.phases.Opening.errors;
      }
    }
    if(!fact.reviewed)continue;
    addSource(bucket.sources.reviewed,source);
    for(const example of fact.examples){
      addSource(bucket.sources.themes[example.theme]??=[],{
        ...source,index:example.index,san:example.san,
      });
    }
    bucket.reviewed++;
    bucket.moves+=fact.ownMoves;
    for(const [name,phase] of Object.entries(fact.phases)){
      const totals=bucket.phases[name]??={moves:0,errors:0};
      totals.moves+=phase.moves;
      totals.errors+=phase.errors;
    }
    for(const [name,theme] of Object.entries(fact.themes)){
      bucket.themes[name]=(bucket.themes[name]||0)+theme.count;
    }
  }
  const observed=[...buckets.keys()];
  if(!observed.length)return [];
  const start=observed[0],end=observed.at(-1),monthly=granularity==='month';
  const cursor=new Date(start+(monthly?'-01':'')+'T00:00:00Z');
  const intervals=[];
  for(let key=start;key<=end;key=cursor.toISOString().slice(0,monthly?7:10)){
    intervals.push(buckets.get(key)??{date:key,games:0,reviewed:0,moves:0,phases:{},themes:{},openings:{}});
    if(monthly)cursor.setUTCMonth(cursor.getUTCMonth()+1);
    else cursor.setUTCDate(cursor.getUTCDate()+(granularity==='week'?7:1));
  }
  return intervals;
}

export function aggregateInsights(allFacts,scope='all',options={}){
  const period=insightPeriod(options.range,options.now??Date.now());
  const facts=allFacts.filter(f=>(scope==='all'||f.timeClass===scope)&&(period.start===null||f.ended>=period.start)&&f.ended<=period.end).sort((a,b)=>a.ended-b.ended);
  if(options.studyReport)return {scope,period,...buildStudyReport(facts)};
  const reviewed=facts.filter(f=>f.reviewed),counts={win:0,loss:0,draw:0},grades={},phases={},themes={},openingMap=new Map();
  const colours={w:{games:0,win:0,loss:0,draw:0},b:{games:0,win:0,loss:0,draw:0}};
  let ownMoves=0;
  for(const fact of facts){
    counts[fact.result]++;colours[fact.color].games++;colours[fact.color][fact.result]++;
    const family=fact.opening.split(':')[0],key=`${fact.color}|${family}`;
    if(!openingMap.has(key))openingMap.set(key,{name:family,color:fact.color,eco:fact.eco,games:0,win:0,loss:0,draw:0,reviewed:0,qualities:[],examples:[]});
    const opening=openingMap.get(key);opening.games++;opening[fact.result]++;
    opening.examples.unshift({id:fact.id,opponent:fact.opponent,ended:fact.ended});opening.examples=opening.examples.slice(0,3);
    if(!fact.reviewed)continue;
    opening.reviewed++;if(fact.quality!==null)opening.qualities.push(fact.quality);ownMoves+=fact.ownMoves;
    for(const [grade,n]of Object.entries(fact.counts))grades[grade]=(grades[grade]||0)+n;
    for(const [name,value]of Object.entries(fact.phases)){const p=phases[name]??={moves:0,errors:0,blunders:0};p.moves+=value.moves;p.errors+=value.errors;p.blunders+=value.blunders;}
    for(const [name,value]of Object.entries(fact.themes)){const t=themes[name]??={count:0,impact:0,examples:[]};t.count+=value.count;t.impact+=value.impact;for(const example of fact.examples.filter(e=>e.theme===name))t.examples.push(example);}
  }
  const openings=[...openingMap.values()].map(o=>({...o,qualities:undefined,score:round((o.win+o.draw*.5)/o.games*100),winRate:round(o.win/o.games*100),quality:mean(o.qualities)})).sort((a,b)=>b.games-a.games);
  const eligible=openings.filter(o=>o.games>=5);
  const ranked=(direction)=>[...eligible].sort((a,b)=>direction*(a.score-b.score)||b.games-a.games);
  const patterns=Object.entries(themes).map(([name,t])=>({name,count:t.count,per100:ownMoves?round(t.count/ownMoves*100):0,impact:round(t.impact/t.count*100),examples:t.examples.sort((a,b)=>b.impact-a.impact).slice(0,3)})).sort((a,b)=>b.count-a.count);
  const controls=scope==='all'?['rapid','blitz','bullet','daily']:[scope];
  const ratings=controls.map(control=>{
    const games=facts.filter(f=>f.timeClass===control&&f.rated&&Number.isFinite(f.rating));
    const gameSummary=game=>({id:game.id,ended:game.ended,rating:game.rating,opponent:game.opponent,result:game.result,reviewed:game.reviewed});
    const buckets=new Map();for(const game of games){
      const bucket=timeBucket(game.ended,period.bucket);const previous=buckets.get(bucket);buckets.set(bucket,{date:bucket,rating:game.rating,ended:game.ended,games:[...(previous?.games||[]),gameSummary(game)]});
    }
    const points=[...buckets.values()];if(games.length&&points[0]?.ended!==games[0].ended)points.unshift({date:new Date(games[0].ended*1000).toISOString().slice(0,period.bucket==='month'?7:10),rating:games[0].rating,ended:games[0].ended,games:[gameSummary(games[0])],anchor:true});
    return {control,games:games.length,start:games[0]?.rating??null,current:games.at(-1)?.rating??null,peak:games.length?Math.max(...games.map(g=>g.rating)):null,change:games.length?games.at(-1).rating-games[0].rating:null,points};
  }).filter(r=>r.games);
  const recent=facts.slice(-30),previous=facts.slice(-60,-30),score=list=>list.length?round(list.reduce((s,g)=>s+(g.result==='win'?1:g.result==='draw'?.5:0),0)/list.length*100):null;
  const examples=reviewed.flatMap(f=>f.examples).sort((a,b)=>b.impact-a.impact).slice(0,50);
  const highlights=[];
  if(patterns[0])highlights.push({title:'Your most common recurring issue',body:`${patterns[0].name}: ${patterns[0].count} instances in ${reviewed.length} reviewed games.`,example:patterns[0].examples[0]});
  if(eligible.length>=2){const best=ranked(-1)[0],worst=ranked(1)[0];highlights.push({title:'Your strongest opening results',body:`${best.name} as ${best.color==='w'?'White':'Black'}: ${best.score}% score across ${best.games} games.`,example:best.examples[0]});if(best!==worst)highlights.push({title:'An opening worth revisiting',body:`${worst.name} as ${worst.color==='w'?'White':'Black'}: ${worst.score}% score across ${worst.games} games.`,example:worst.examples[0]});}
  const weakest=Object.entries(phases).filter(([,p])=>p.moves>=30).sort((a,b)=>b[1].errors/b[1].moves-a[1].errors/a[1].moves)[0];
  if(weakest)highlights.push({title:'Focus your next study session',body:`${weakest[0]}: ${round(weakest[1].errors/weakest[1].moves*100)} costly moves per 100 moves, based on ${weakest[1].moves} moves.`});
  if(!highlights.length)highlights.push({title:'Your history is being prepared',body:'Opening and result statistics appear as archives arrive. Engine-based insights build as reviews finish.'});
  const comparisonGames=allFacts.filter(f=>f.reviewed&&f.ended<=period.end&&(scope==='all'||f.timeClass===scope)).sort((a,b)=>a.ended-b.ended);
  return {scope,period,coaching:coachingInsights([...facts].reverse()),decisions:decisionInsights([...facts].reverse()),comparison:compareReviewedGames(comparisonGames),trends:studyTrends(facts,openings,period.bucket),total:facts.length,reviewed:reviewed.length,coverage:facts.length?round(reviewed.length/facts.length*100):0,counts,score:score(facts),quality:mean(reviewed.map(f=>f.quality).filter(v=>v!==null)),ownMoves,grades,blundersPer100:ownMoves?round((grades.Blunder||0)/ownMoves*100):null,errorRate:ownMoves?round(((grades.Inaccuracy||0)+(grades.Mistake||0)+(grades.Blunder||0))/ownMoves*100):null,first:facts[0]?.ended||null,last:facts.at(-1)?.ended||null,recent:{games:recent.length,score:score(recent),previousScore:score(previous)},colours,openings,bestOpenings:ranked(-1),worstOpenings:ranked(1),minimumOpeningSample:5,patterns,phases:Object.entries(phases).map(([name,p])=>({name,...p,errorRate:round(p.errors/p.moves*100)})),ratings,examples,highlights,depths:[...new Set(reviewed.map(f=>f.depth))].sort((a,b)=>a-b)};
}
