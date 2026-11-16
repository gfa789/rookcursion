import React from 'react';
const rate=n=>n===null?'—':n+'%';
function Examples({items,onOpenGame}){
  return <div className="trend-examples">{items.map((g,i)=><button key={g.id+':'+g.index+':'+i} onClick={()=>onOpenGame(g.id,g.index)}>vs {g.opponent}<span>Review ↗</span></button>)}</div>;
}
export default function DecisionInsights({data,onOpenGame}){
  if(!data)return null;
  return <section className="study-trends" aria-label="Time and decision insights">
    <h2>When mistakes happen</h2>
    <p className="trend-coverage">{data.games} reviewed games · {data.clean} with no mistakes or blunders. Inaccuracies are excluded.</p>
    <div className="study-trend-grid">
      {data.stages.map(stage=><section className="trend-card" key={stage.name}>
        <h3>{stage.name}</h3>
        <p><strong>{rate(stage.errorRate)}</strong> mistake/blunder rate · {stage.errors} / {stage.moves} moves.</p>
        <p>{stage.firstErrors} games had their first major error here.</p>
        <Examples items={stage.sources} onOpenGame={onOpenGame}/>
      </section>)}
    </div>
    <p className="trend-coverage">{data.stageMethod}</p>
    <h2>Decisions under clock pressure</h2>
    {!data.clocks.length&&<p>No usable clock readings in this selection.</p>}
    <div className="study-trend-grid">
      {data.clocks.map(group=><section className="trend-card" key={group.control}>
        <h3>{group.control[0].toUpperCase()+group.control.slice(1)} · {group.games} games with clocks</h3>
        <p>Low clock <strong>{rate(group.low.errorRate)}</strong> ({group.low.errors}/{group.low.moves} moves).</p>
        <p>More time <strong>{rate(group.normal.errorRate)}</strong> ({group.normal.errors}/{group.normal.moves} moves).</p>
        <p>In balanced positions, {rate(group.low.balancedRate)} with low time ({group.low.balancedMoves} moves), versus {rate(group.normal.balancedRate)} with more time ({group.normal.balancedMoves} moves).</p>
        <p className="trend-coverage">Balanced means between −2 and +2 before your move. {Math.min(group.low.balancedMoves,group.normal.balancedMoves)<30?'Small comparison sample.':''} These groups can still differ in difficulty and game stage.</p>
        <Examples items={group.low.sources} onOpenGame={onOpenGame}/>
      </section>)}
    </div>
    <p className="trend-coverage">{data.clockMethod}</p>
  </section>;
}
