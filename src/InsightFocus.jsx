import React,{useState} from 'react';

const percent=value=>value==null?'—':value.toFixed(1)+'%';
export default function InsightFocus({data,view,onOpenGame}){
  const [selected,setSelected]=useState(null);
  const [clockControl,setClockControl]=useState('blitz');
  const coaching=data.coaching,decisions=data.decisions;
  let rows=[],note='',unit='Error rate',title=({Recovery:'After a mistake',Conversion:'Winning from ahead or behind','Move timing':'When mistakes happen'})[view]??view;
  if(view==='Recovery'){
    rows=[
      {name:'After an error',...coaching?.recovery.afterError,sources:coaching?.recovery.sources},
      {name:'After other moves',...coaching?.recovery.afterOther}
    ].filter(r=>r.moves!==undefined).map(r=>({...r,value:r.errorRate,sample:r.moves+' moves'}));
    note='How often your next move is another mistake or blunder.';
  }
  if(view==='Conversion'){
    rows=(coaching?.positionStates??[]).filter(s=>s.name!=='Balanced').map(s=>({...s,name:s.name==='Advantage'?'Reached +2 or better':'Reached −2 or worse',value:s.winRate,sample:s.wins+' wins / '+s.games+' games'}));
    unit='Win rate';note='Share of games won after reaching a two-pawn engine lead or deficit. Games can count in both groups.';
  }
  if(view==='Move timing'){
    rows=(decisions?.stages??[]).map(s=>({...s,value:s.errorRate,sample:s.errors+' errors / '+s.moves+' moves',detail:s.firstErrors+' games had their first major error here.'}));
    note='Share of your moves graded mistake or blunder in each move window.';
  }
  if(view==='Clock pressure'){
    const clocks=decisions?.clocks??[];
    const clock=clocks.find(c=>c.control===clockControl)??clocks[0];
    rows=(clock?[clock]:[]).flatMap(c=>[
      {name:c.control+' · low clock',value:c.low.balancedRate,sample:c.low.balancedMoves+' moves'+(c.low.balancedMoves<30?' � small sample':''),sources:c.low.sources},
      {name:c.control+' · more time',value:c.normal.balancedRate,sample:c.normal.balancedMoves+' moves'+(c.normal.balancedMoves<30?' � small sample':'')}
    ]);
    note='Balanced positions (−2 to +2). Low clock ≤10% of starting time, capped at 60s. Groups can differ in difficulty.';
  }
  const current=rows.find(r=>r.name===selected)??rows[0];
  const maximum=Math.max(10,...rows.map(r=>r.value??0));
  const source=current?.sources?.[0];
  return <section className="focus-chart" aria-label={title}>
    <header><h2>{title}</h2><p>{note}</p></header>
    {view==='Clock pressure'&&(decisions?.clocks?.length??0)>1&&<select aria-label="Clock time control" value={decisions.clocks.some(c=>c.control===clockControl)?clockControl:decisions.clocks[0].control} onChange={e=>setClockControl(e.target.value)}>{decisions.clocks.map(c=><option key={c.control} value={c.control}>{c.control}</option>)}</select>}
    <div className="focus-bars"  role="group" aria-label={unit+' comparison'}>
      {rows.map(row=><button key={row.name} aria-pressed={row===current} onClick={()=>setSelected(row.name)} className="focus-bar">
        <span className="focus-bar-label">{row.name}</span><strong>{percent(row.value)}</strong>
        <span className="focus-track"><span style={{transform:'scaleX('+((row.value??0)/maximum)+')'}}/></span>
        <small>{row.sample}</small>
      </button>)}
      {!rows.length&&<p>No data for this selection.</p>}
    </div>
    <footer>{current?.detail&&<p>{current.detail}</p>}{source&&<button className="insight-action" onClick={()=>onOpenGame(source.id,source.index??-1)}>Review vs {source.opponent} ↗</button>}</footer>
  </section>;
}
