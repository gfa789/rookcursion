import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import ChessPiece from './ChessPiece.jsx';
import LoadingSkeleton from './LoadingSkeleton.jsx';

const dayKey=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',dateStyle:'short'});
const dayHeading=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'full'});
const results={win:'Win',loss:'Loss',draw:'Draw'};

export default function GamesList({games,selected,loading,onSelect,active,memory,onRemember,listKey,timeControl}){
  const [limit,setLimit]=useState(()=>memory.current.get(listKey)?.limit||24);
  const listRef=useRef(null),endRef=useRef(null);
  const anchorId=memory.current.get(listKey)?.anchor;
  const anchorIndex=anchorId?games.findIndex(game=>game.id===anchorId):-1;
  const visibleLimit=Math.max(limit,anchorIndex+1);
  function remember(){
    const list=listRef.current;if(!list?.clientHeight||loading||!games.length)return;
    const bounds=list.getBoundingClientRect();
    const anchor=[...list.querySelectorAll('[data-game-id]')].find(node=>node.getBoundingClientRect().bottom>bounds.top);
    const position={limit:visibleLimit,top:list.scrollTop,anchor:anchor?.dataset.gameId,offset:anchor?anchor.getBoundingClientRect().top-bounds.top:0};
    memory.current.set(listKey,position);
    onRemember(position);
  }
  useLayoutEffect(()=>{
    const list=listRef.current,saved=memory.current.get(listKey);if(!list?.clientHeight||!saved)return;
    const anchor=[...list.querySelectorAll('[data-game-id]')].find(node=>node.dataset.gameId===saved.anchor);
    if(anchor)list.scrollTop+=anchor.getBoundingClientRect().top-list.getBoundingClientRect().top-saved.offset;
    else list.scrollTop=saved.top;
  },[active,games,listKey,memory]);
  useLayoutEffect(()=>{remember();},[limit]);
  useEffect(()=>{
    const root=listRef.current,end=endRef.current;if(!root||!end||visibleLimit>=games.length)return;
    const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting&&root.clientHeight)setLimit(n=>Math.min(games.length,Math.max(n,visibleLimit)+24));},{root,rootMargin:'200px'});
    observer.observe(end);return()=>observer.disconnect();
  },[visibleLimit,games.length,active]);
  const dates=new Map();
  for(const game of games.slice(0,visibleLimit)){
    const timestamp=game.ended*1000;
    const day=dayKey.format(timestamp);
    if(!dates.has(day))dates.set(day,{label:dayHeading.format(timestamp),games:[]});
    dates.get(day).games.push(game);
  }
  return <section className="games-ledger" aria-label="Game history">
    <div className="game-cards game-scroll" ref={listRef} role="region" aria-label="Games list" tabIndex={0} onScroll={remember}>
    {loading&&<LoadingSkeleton view="games" label="Loading games"/>}
    {[...dates].map(([day,group])=><section className="game-day" key={day} aria-label={group.label}>
      <h2>{group.label}</h2>
      <div className="game-day-matches">
        {group.games.map(game=>{
          const accuracy=game.accuracy?.[game.color];
          return <button key={game.id} data-game-id={game.id} className={`game-card ${selected===game.id?'active':''}`}
            aria-current={selected===game.id?'true':undefined} onClick={event=>{remember();onSelect(game,event);}}>
            <span className="game-side" role="img" aria-label={game.color==='w'?'Played as White':'Played as Black'}>
              <ChessPiece type="k" color={game.color}/>
            </span>
            <span className="game-details"><strong>{game.opponent}</strong>
              <small>{game.timeClass} &middot; {timeControl(game.timeControl)}</small>
            </span>
            <span className="game-outcome"><span className={`game-result ${game.result}`}>{results[game.result]}</span>
              {Number.isFinite(accuracy)&&<span className="game-accuracy" aria-label={`Review accuracy ${accuracy}%`}>{accuracy}% acc.</span>}
            </span>
            <span className="game-open" aria-hidden="true">&rsaquo;</span>
          </button>;
        })}
      </div>
    </section>)}
    <div className="games-list-end" ref={endRef} role="status">{loading?'':!games.length?'No games found.':visibleLimit<games.length?'Loading more...':`${games.length.toLocaleString('en-GB')} games · all shown`}</div>
  </div></section>;
}
