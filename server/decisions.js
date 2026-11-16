import {Chess} from 'chess.js';

const isError=row=>['Mistake','Blunder'].includes(row.classification);
const percent=(n,d)=>d?Math.round(n/d*1000)/10:null;
const windows=['Moves 1–10','Moves 11–20','Moves 21–30','Moves 31+'];
const windowOf=ply=>windows[Math.min(3,Math.floor((ply-1)/20))];

export function decisionFact(game,review){
  if(!review)return null;
  const own=review.rows.filter(row=>row.color===game.color);
  const stages={};
  let firstError=null;
  for(const row of own){
    const name=windowOf(row.ply);
    const stage=stages[name]??={moves:0,errors:0};
    stage.moves++;
    stage.errors+=Number(isError(row));
    if(!firstError&&isError(row))firstError={window:name,index:row.index,san:row.san};
  }
  const clocks={low:{moves:0,errors:0,balancedMoves:0,balancedErrors:0,sources:[]},normal:{moves:0,errors:0,balancedMoves:0,balancedErrors:0,sources:[]}};
  const control=/^(\d+)(?:\+(\d+))?$/.exec(String(game.timeControl));
  if(control&&['rapid','blitz','bullet'].includes(game.timeClass)){
    try{
      const board=new Chess();
      board.loadPgn(game.pgn);
      const comments=new Map(board.getComments().map(item=>[item.fen,item.comment]));
      let remaining=Number(control[1]);
      const threshold=Math.min(60,remaining*.1);
      for(const row of own){
        // The previous own clock is the time available at the start of this turn.
        const match=/\[%clk\s+(\d+):(\d{2}):(\d{2}(?:\.\d+)?)\]/.exec(comments.get(row.fenAfter)||'');
        const next=match?Number(match[1])*3600+Number(match[2])*60+Number(match[3]):null;
        if(remaining!==null&&next!==null&&Number(match[2])<60&&Number(match[3])<60){
          const bucket=clocks[remaining<=threshold?'low':'normal'];
          bucket.moves++;
          bucket.errors+=Number(isError(row));
          if(Number.isFinite(row.beforeCp)&&Math.abs(row.beforeCp)<200){bucket.balancedMoves++;bucket.balancedErrors+=Number(isError(row));}
          if(isError(row)&&bucket.sources.length<3)bucket.sources.push(row.index);
        }
        remaining=next;
      }
      return {stages,firstError,clocks,threshold};
    }catch{}
  }
  return {stages,firstError,clocks,threshold:null};
}

export function decisionInsights(facts){
  const usable=facts.filter(f=>f.reviewed&&f.decisions);
  const stages=windows.map(name=>({name,moves:0,errors:0,firstErrors:0,sources:[]}));
  const controls=['rapid','blitz','bullet'].map(control=>({control,games:0,low:{moves:0,errors:0,balancedMoves:0,balancedErrors:0,sources:[]},normal:{moves:0,errors:0,balancedMoves:0,balancedErrors:0,sources:[]}}));
  const addSource=(list,f,index)=>{if(list.length<3)list.push({id:f.id,index,opponent:f.opponent,ended:f.ended});};
  let clean=0;
  for(const f of usable){
    if(!f.decisions.firstError)clean++;
    for(const stage of stages){
      const data=f.decisions.stages[stage.name];
      if(data){stage.moves+=data.moves;stage.errors+=data.errors;}
      if(f.decisions.firstError?.window===stage.name){
        stage.firstErrors++;
        addSource(stage.sources,f,f.decisions.firstError.index);
      }
    }
    const group=controls.find(c=>c.control===f.timeClass);
    if(!group)continue;
    const clocks=f.decisions.clocks;
    if(clocks.low.moves+clocks.normal.moves)group.games++;
    for(const key of ['low','normal']){
      group[key].moves+=clocks[key].moves;
      group[key].errors+=clocks[key].errors;
      group[key].balancedMoves+=clocks[key].balancedMoves;
      group[key].balancedErrors+=clocks[key].balancedErrors;
      for(const index of clocks[key].sources)addSource(group[key].sources,f,index);
    }
  }
  return {
    games:usable.length,clean,
    stages:stages.map(s=>({...s,errorRate:percent(s.errors,s.moves)})),
    clocks:controls.filter(c=>c.games).map(c=>({...c,low:{...c.low,errorRate:percent(c.low.errors,c.low.moves),balancedRate:percent(c.low.balancedErrors,c.low.balancedMoves)},normal:{...c.normal,errorRate:percent(c.normal.errors,c.normal.moves),balancedRate:percent(c.normal.balancedErrors,c.normal.balancedMoves)}})),
    clockMethod:'Low time means starting your turn with at most 10% of the initial clock, capped at 60 seconds. Previous move clock readings include increment. Moves with missing readings and unsupported time controls are excluded. Clock pressure and position difficulty can overlap.',
    stageMethod:'Mistakes and blunders per 100 of your reviewed moves. First errors count each game once. Later move windows include only games that lasted that long.'
  };
}
