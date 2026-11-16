import React from 'react';

const percent=value=>value===null?'—':value+'%';
function Sources({items,onOpenGame}){
  return <div className="trend-examples">{items.map((game,i)=><button key={game.id+':'+game.index+':'+i} onClick={()=>onOpenGame(game.id,game.index)}>vs {game.opponent}<span>Review ↗</span></button>)}</div>;
}
export default function CoachingInsights({data,onOpenGame}){
  if(!data)return null;
  const {recovery,positionStates,opponentBands,coverage,method}=data;
  return <section className="study-trends" aria-label="Coaching insights">
    <h2>Decisions worth studying</h2>
    <p className="trend-coverage">{coverage.games.toLocaleString()} of {coverage.reviewed.toLocaleString()} reviewed games included.</p>
    <div className="study-trend-grid">
      <section className="trend-card">
        <h3>Your next move after an error</h3>
        <p><strong>{percent(recovery.afterError.errorRate)}</strong> are mistakes or blunders after an error, compared with <strong>{percent(recovery.afterOther.errorRate)}</strong> after other moves.</p>
        <p className="trend-coverage">{recovery.afterError.errors} / {recovery.afterError.moves} moves after errors · {recovery.afterOther.errors} / {recovery.afterOther.moves} after other moves. {recovery.sample==='limited'?'Small sample.':''}</p>
        <p>After a mistake, reassess checks, captures, and threats before choosing your reply.</p>
        <p className="trend-coverage">{method.recovery}</p>
        <Sources items={recovery.sources} onOpenGame={onOpenGame}/>
      </section>
      {positionStates.filter(state=>state.name!=='Balanced').map(state=><section className="trend-card" key={state.name}>
        <h3>{state.name==='Advantage'?'Converting an advantage':'Recovering from a disadvantage'}</h3>
        <p><strong>{percent(state.winRate)}</strong> won · {state.wins} wins, {state.draws} draws, {state.losses} losses across {state.games} games.</p>
        <p className="trend-coverage">Reached {state.name==='Advantage'?'+2 or better':'−2 or worse'} before one of your moves. Games can appear in both groups. {state.sample==='limited'?'Small sample.':''}</p>
        <p>{state.name==='Advantage'?'Review how you protected your king and answered threats after gaining the advantage.':'Review the practical chances you found while defending a difficult position.'}</p>
        <Sources items={state.sources} onOpenGame={onOpenGame}/>
      </section>)}
      <section className="trend-card">
        <h3>Results by opponent strength</h3>
        {opponentBands.map(band=><p key={band.name}>{band.name} · <strong>{percent(band.score)}</strong> score from {band.games} games{band.games<20?' · small sample':''}</p>)}
        <p className="trend-coverage">{method.opponents} Score counts a draw as half a point.</p>
      </section>
    </div>
  </section>;
}
