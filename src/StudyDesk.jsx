import React from 'react';
import LoadingSkeleton from './LoadingSkeleton.jsx';
import {Board} from './Board.jsx';

const startPosition='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const results={win:'Win',loss:'Loss',draw:'Draw'};

export default function StudyDesk({game,move,total,loading,onReview,onPractice}){
  if(loading)return <LoadingSkeleton view="desk" label="Loading your study desk"/>;
  const playedAt=game?.ended?new Date(game.ended*1000).toLocaleDateString('en-GB',{
    day:'numeric',month:'long',year:'numeric',
  }):null;

  return (
    <section className="study-desk" aria-labelledby="desk-title" data-enter>
      <header className="desk-intro">
        <p className="desk-label desk-mobile-brand">Afterboard</p>
        <h1 id="desk-title">The chess study desk</h1>
        <p>{total.toLocaleString('en-GB')} games in your library</p>
      </header>
      <div className="app-frame desk-frame">
        <div className="desk-position">
          <Board fen={move?.fenAfter||startPosition} flipped={game?.color==='b'} played={move?.uci} grade={move?.classification}/>
        </div>
        <div className="desk-game">
          <p className="desk-label">{game?'Latest game':'Game library'}</p>
          <h2>{game?`vs ${game.opponent}`:'No games imported yet'}</h2>
          {game&&<p className="desk-game-meta">{[playedAt,game.timeClass,results[game.result]].filter(Boolean).join(' · ')}</p>}
          <div className="desk-actions">
            {game&&<button className="desk-primary" onClick={onReview}><span>Review game</span><span className="desk-action-icon" aria-hidden="true">↗</span></button>}
            <button className="desk-secondary" onClick={onPractice}><span>Practice tactics</span><span className="desk-action-icon" aria-hidden="true">→</span></button>
          </div>
        </div>
      </div>
    </section>
  );
}
