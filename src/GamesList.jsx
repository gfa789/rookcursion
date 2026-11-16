import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import LoadingSkeleton from './LoadingSkeleton.jsx';

export default function GamesList({games,selected,loading,onSelect,active,memory,onRemember,listKey,timeControl,date}){
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
  return <div className="game-cards game-scroll" ref={listRef} role="region" aria-label="Games list" tabIndex={0} onScroll={remember}>
    {loading&&<LoadingSkeleton view="games" label="Loading games"/>}
    {games.slice(0,visibleLimit).map(game=>{
      const result={win:'Win',loss:'Loss',draw:'Draw'}[game.result];
      const accuracy=game.accuracy?.[game.color];
      return <button key={game.id} data-game-id={game.id} className={`game-card ${selected===game.id?'active':''}`}
        aria-current={selected===game.id?'true':undefined} onClick={()=>{remember();onSelect(game);}}>
        <span className="game-details"><strong>{game.opponent}</strong>
          <small>{game.timeClass} <span aria-hidden="true">&middot;</span> {timeControl(game.timeControl)}</small>
        </span>
        <span className="game-outcome">
          <span className={`game-result ${game.result}`}>{result}</span>
          <span className="game-date">{date(game.ended)}</span>
        </span>
        {Number.isFinite(accuracy)&&<span className="saved-quality" aria-label={`Review accuracy ${accuracy}%`}>
          {accuracy}%<small>Accuracy</small>
        </span>}
      </button>;
    })}
    <div className="games-list-end" ref={endRef} role="status">{loading?'':!games.length?'No games found.':visibleLimit<games.length?'Loading more...':`${games.length.toLocaleString('en-GB')} games · all shown`}</div>
  </div>;
}
