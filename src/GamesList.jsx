import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';

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
    {games.slice(0,visibleLimit).map(g=><button key={g.id} data-game-id={g.id} className={`game-card ${selected===g.id?'active':''}`} onClick={()=>{remember();onSelect(g);}}>
      <span className={`result ${g.result}`}>{g.result==='win'?'1':g.result==='loss'?'0':'½'}</span>
      <span className="game-details"><strong>{g.opponent}</strong><small>{g.timeClass} · {timeControl(g.timeControl)} · {date(g.ended)}</small></span>
      <span className="saved-quality">{g.accuracy?`${g.accuracy[g.color]}%`:'→'}</span>
    </button>)}
    <div className="games-list-end" ref={endRef} role="status">{loading?'Loading games...':!games.length?'No games found.':visibleLimit<games.length?'Loading more...':`${games.length.toLocaleString('en-GB')} games · all shown`}</div>
  </div>;
}
