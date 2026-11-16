import {expectedScore} from './grading.js';

const round=value=>Math.round(value*10)/10;
const costly=row=>['Mistake','Blunder'].includes(row.classification);
const stateOf=cp=>cp>=200?'Advantage':cp<=-200?'Disadvantage':'Balanced';

// Evaluations are stored from the moving player's perspective.
export function coachingFact(game,review){
  if(!review)return null;
  const rows=review.rows.filter(row=>row.color===game.color&&Number.isFinite(row.beforeCp)&&Number.isFinite(row.afterCp));
  const states={},followUp={afterError:{moves:0,errors:0},afterOther:{moves:0,errors:0}};
  let previous=null;
  const sources=[];
  for(const row of rows){
    const state=stateOf(row.beforeCp);
    const bucket=states[state]??={moves:0,errors:0,loss:0,firstIndex:row.index};
    bucket.moves++;
    bucket.errors+=Number(costly(row));
    bucket.loss+=Math.max(0,expectedScore(row.beforeCp)-expectedScore(row.afterCp))*100;
    if(previous){
      const next=followUp[costly(previous)?'afterError':'afterOther'];
      next.moves++;
      next.errors+=Number(costly(row));
      if(costly(previous)&&costly(row))sources.push({index:row.index,san:row.san});
    }
    previous=row;
  }
  return {states,followUp,sources:sources.slice(0,3),moves:rows.length};
}

function rate(errors,moves){return moves?round(100*errors/moves):null;}
function source(fact,index){return {id:fact.id,index,opponent:fact.opponent,ended:fact.ended};}

export function coachingInsights(facts){
  const usable=facts.filter(f=>f.reviewed&&f.coaching?.moves);
  const states={},followUp={afterError:{moves:0,errors:0},afterOther:{moves:0,errors:0}};
  const recoverySources=[];
  for(const fact of usable){
    for(const [name,state] of Object.entries(fact.coaching.states)){
      const total=states[name]??={games:0,wins:0,draws:0,losses:0,moves:0,errors:0,loss:0,sources:[]};
      total.games++;
      total.wins+=Number(fact.result==='win');
      total.draws+=Number(fact.result==='draw');
      total.losses+=Number(fact.result==='loss');
      total.moves+=state.moves;
      total.errors+=state.errors;
      total.loss+=state.loss;
      if(total.sources.length<3)total.sources.push(source(fact,state.firstIndex));
    }
    for(const key of Object.keys(followUp)){
      followUp[key].moves+=fact.coaching.followUp[key].moves;
      followUp[key].errors+=fact.coaching.followUp[key].errors;
    }
    for(const row of fact.coaching.sources)if(recoverySources.length<3)recoverySources.push({...source(fact,row.index),san:row.san});
  }
  const positionStates=Object.entries(states).map(([name,s])=>({
    name,...s,loss:undefined,errorRate:rate(s.errors,s.moves),winRate:rate(s.wins,s.games),
    score:rate(s.wins+s.draws*.5,s.games),meanEvaluationLoss:s.moves?round(s.loss/s.moves):null,
    sample:s.games>=20?'established':'limited'
  }));
  const afterError={...followUp.afterError,errorRate:rate(followUp.afterError.errors,followUp.afterError.moves)};
  const afterOther={...followUp.afterOther,errorRate:rate(followUp.afterOther.errors,followUp.afterOther.moves)};
  const opponentBands=['Lower rated','Similar rating','Higher rated'].map(name=>{
    const games=facts.filter(f=>{
      if(!f.rated||!Number.isFinite(f.rating)||!Number.isFinite(f.opponentRating))return false;
      const gap=f.opponentRating-f.rating;
      return (gap>100?'Higher rated':gap< -100?'Lower rated':'Similar rating')===name;
    });
    return {name,games:games.length,score:rate(games.reduce((sum,g)=>sum+(g.result==='win'?1:g.result==='draw'?.5:0),0),games.length),sources:games.slice(-3).reverse().map(g=>source(g,-1))};
  });
  return {
    coverage:{games:usable.length,reviewed:facts.filter(f=>f.reviewed).length},
    positionStates,recovery:{afterError,afterOther,sources:recoverySources,
      difference:afterError.errorRate===null||afterOther.errorRate===null?null:round(afterError.errorRate-afterOther.errorRate),
      sample:afterError.moves>=30&&afterOther.moves>=30?'established':'limited'},
    opponentBands,
    method:{
      advantage:'At least +2 pawns before one of your moves, from your perspective. A game can appear in several position groups.',
      errors:'Mistakes and blunders only. Rates use your reviewed moves as the denominator.',
      recovery:'Your next move after a mistake or blunder, compared with your next move after any other grade. Association does not establish a cause.',
      opponents:'Rated games only. Similar rating means within 100 rating points.',
      evaluation:'Evaluation loss uses the existing engine score transformation. It is an estimate, not a calibrated winning probability.'
    }
  };
}
