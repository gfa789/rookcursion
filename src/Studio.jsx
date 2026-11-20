import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import LoadingSkeleton from './LoadingSkeleton.jsx';
import {Chess} from 'chess.js';
import {Board,Player,PromotionPicker,GRADES,MARKS} from './Board.jsx';
import MoveCarousel from './MoveCarousel.jsx';
import {refreshAnalysis} from './analysis-refresh.js';
import Insights from './Insights.jsx';
import Puzzles from './Puzzles.jsx';
import Navigation from './Navigation.jsx';
import StudyDesk from './StudyDesk.jsx';
import GamesList from './GamesList.jsx';
const START=new Chess().fen();
const date=n=>new Date(n*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const timeControl=n=>{const [base,inc]=String(n).split('+');return Number(base)<3600?`${Number(base)/60}${inc?' + '+inc:''} min`:'Daily';};
function score(row){if(!row||row.whiteCp===undefined)return '—';if(new Chess(row.fenAfter).isCheckmate())return 'Checkmate';if(Math.abs(row.whiteCp)>=90000)return `${row.whiteCp>0?'White':'Black'} mates`;return `${row.whiteCp>=0?'+':''}${(row.whiteCp/100).toFixed(1)}`;}
async function api(route,body,token){const response=await fetch(`api/${route}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Review-Token':token},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;}
function Icon({name,size=18}){
  const paths={left:<path d="m15 5-7 7 7 7"/>,right:<path d="m9 5 7 7-7 7"/>,first:<path d="M5 5v14m13-14-8 7 8 7"/>,last:<path d="M19 5v14M6 5l8 7-8 7"/>,flip:<path d="M7 4v16m-3-3 3 3 3-3M17 20V4m-3 3 3-3 3 3"/>,play:<path d="m8 5 11 7-11 7Z"/>,pause:<path d="M8 5v14M16 5v14"/>,refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1"/></>,close:<path d="m6 6 12 12M18 6 6 18"/>,book:<path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>,bolt:<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>,download:<path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/>};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Coach({row,review,index,variationMove,compact=false}){
  const copyRef=useRef(null),openingRef=useRef(null),closeRef=useRef(null),readRef=useRef(null);
  const [clipped,setClipped]=useState(false),[expanded,setExpanded]=useState(false);
  const explanation=variationMove?'Play another move to explore this line, or return to the game.':row?.explanation||(review?'Choose a move to see what worked and what you can improve.':'Analyze this game for move grades and explanations of the strongest ideas.');
  useEffect(()=>{const copy=copyRef.current,opening=openingRef.current;if(!compact||!copy)return;const measure=()=>setClipped(copy.scrollHeight>copy.clientHeight+1||!!opening&&opening.scrollWidth>opening.clientWidth+1);const observer=new ResizeObserver(measure);observer.observe(copy);if(opening)observer.observe(opening);measure();return()=>observer.disconnect();},[compact,explanation,row?.opening?.name]);
  useEffect(()=>{if(expanded)closeRef.current?.focus();},[expanded]);
  function closeExplanation(){setExpanded(false);readRef.current?.focus();}
  return <section className={`coach ${compact?'phone-coach':'desktop-coach'}`} aria-label="Move coach"><div className="coach-avatar" aria-hidden="true">♞</div><div className="speech-bubble">
    <div className="coach-top"><span className="coach-name">YOUR COACH</span><strong className={row?.classification?.toLowerCase()}>{row?`${Math.ceil((index+1)/2)}${row.color==='w'?'.':'…'} ${row.san} · ${row.classification||'Not reviewed'}`:variationMove?'Exploring a variation':'Ready to review'}</strong><span className="engine-score" title="Engine evaluation from White’s perspective">{score(row)}{row?.whiteCp!==undefined&&Math.abs(row.whiteCp)<90000&&<small> White</small>}</span></div>
    <div className="coach-opening" title={row?.opening?.name||'Opening not identified yet'}><span ref={openingRef}>{variationMove?.san||row?.opening?.name||(index<0?'Starting position':'Opening not identified yet')}</span>{row?.opening?.eco&&<small>{row.opening.eco}</small>}</div>
    <div className={`coach-copy ${clipped?'clipped':''}`}><p ref={copyRef}>{explanation}</p>{compact&&clipped&&<button className="read-explanation" ref={readRef} onClick={()=>setExpanded(true)}>Read</button>}</div>
  </div>{expanded&&<div className="explanation-dialog" role="dialog" aria-modal="true" aria-label="Full coach explanation" onKeyDown={e=>{if(e.key==='Escape')closeExplanation();if(e.key==='Tab'){e.preventDefault();closeRef.current?.focus();}}}><div className="explanation-sheet"><header><span className="coach-avatar" aria-hidden="true">♞</span><h2>{row?`${row.san} · ${row.classification||'Not reviewed'}`:'Your coach'}</h2></header><span className="engine-score">Engine evaluation: {score(row)} (White’s perspective)</span><p className="full-opening">{row?.opening?.name||"Opening not identified yet"}{row?.opening?.eco?` · ${row.opening.eco}`:""}</p><p>{explanation}</p><button className="primary" ref={closeRef} onClick={closeExplanation}>Back to board</button></div></div>}</section>;
}
function Summary({game,review,job,depth,setDepth,onAnalyze,onGrade,onEnter,index,onMove}){
  const quality=review?.accuracy[game?.color],counts=review?.counts[game?.color]||{},learning=review?.rows.filter(r=>r.color===game.color&&['Inaccuracy','Mistake','Blunder'].includes(r.classification)).length;
  return <section className="summary" aria-label="Game summary"><div className="summary-heading"><span>GAME SUMMARY</span><span>{review?`Stockfish · depth ${review.depth}`:'Stockfish 19'}</span></div>
    <div className="quality"><div><strong>{quality??'—'}<small>{quality!==undefined?'%':''}</small></strong><span>Your move quality</span></div><div className="summary-message"><EvaluationChart review={review} index={index} onMove={onMove}/><span>{review?`${learning} moments worth another look.`:'Analyze to reveal the turning points.'}</span></div></div>
    <div className="grade-counts">{GRADES.map(g=><button key={g} disabled={!counts[g]} onClick={()=>onGrade(g)} aria-label={`Find ${g} moves`}><span className={`grade-symbol ${g.toLowerCase()}`}>{MARKS[g]}</span><span>{g}</span><b>{review?counts[g]||0:'—'}</b></button>)}</div>
    <div className="analyze-row"><select aria-label="Analysis depth" disabled={job?.status==='running'} value={depth} onChange={e=>setDepth(Number(e.target.value))}><option value={12}>Quick · depth 12</option><option value={15}>Standard · depth 15</option><option value={18}>Deep · depth 18</option></select><button className="primary" disabled={!game||job?.status==='running'} onClick={onAnalyze}><Icon name="bolt" size={14}/>{job?.status==='running'?'Analyzing…':job?.status==='queued'?'Analyze next':review?'Reanalyze':'Analyze game'}</button></div>
    {['queued','running'].includes(job?.status)&&<div className="analysis-progress" role="status"><progress max="100" value={job.percent}/><span>{job.status==='queued'?'Queued · recent and requested games go first':job.total?`${job.completed} / ${job.total} moves`:'Starting engine…'} · {job.percent}%</span></div>}
    <button className="primary enter-review" disabled={!game} onClick={onEnter}>{review?'Enter game review':'Explore game'}<Icon name="right" size={17}/></button><p className="summary-note">Local engine estimates. Move grades and percentages may differ from Chess.com.</p>
  </section>;
}
function EvaluationChart({review,index,onMove}){return <div className="chart"><div className="chart-title"><span>GAME EVALUATION</span><span>White advantage ↑</span></div>{review?<div className="graph"><svg viewBox="0 0 600 50" preserveAspectRatio="none" aria-label="Evaluation through the game"><line x1="0" y1="25" x2="600" y2="25" stroke="var(--line)" strokeDasharray="3 5"/><polyline points={`0,25 ${review.rows.map((r,i)=>`${(i+1)/review.rows.length*600},${25-Math.tanh(r.whiteCp/450)*22}`).join(' ')}`} fill="none" stroke="var(--accent)" strokeWidth="1.6"/>{index>=0&&<line x1={(index+1)/review.rows.length*600} x2={(index+1)/review.rows.length*600} y1="0" y2="50" stroke="#e5b974"/>}</svg><input type="range" min="-1" max={review.rows.length-1} value={index} aria-label="Explore game evaluation by move" onChange={e=>onMove(Number(e.target.value))}/></div>:<span className="chart-empty">Analyze to reveal the turning points.</span>}</div>;}
const gamesViewKey='afterboard.gamesView.v1';
const gameFilters=['all','rapid','blitz','bullet'];

function readGamesView(){
  try {
    const saved=JSON.parse(localStorage.getItem(gamesViewKey));
    if(saved&&gameFilters.includes(saved.filter)&&typeof saved.search==='string')return saved;
  } catch {}
  return {filter:'all',search:'',position:null};
}

function writeGamesView(filter,search,position){
  try {
    localStorage.setItem(gamesViewKey,JSON.stringify({filter,search,position}));
  } catch {}
}

const tabs=['desk','games','review','puzzles','learn','insights'];
const insightSections=['Ratings','Openings','Mistakes'];

function readLocation(){
  const query=new URLSearchParams(window.location.search);
  const tab=query.get('tab');
  const id=query.get('game');
  const move=query.get('move');
  return {
    view:tabs.includes(tab)&& (tab!=='review'||id)?tab:'desk',
    section:insightSections.find(name=>name.toLowerCase()===query.get('section'))??'Ratings',
    id,
    index:move&&/^-?\d+$/.test(move)&&Number.isSafeInteger(Number(move))?Math.max(-1,Number(move)):-1,
    screen:query.get('screen')==='summary'?'summary':'review',
  };
}

function writeLocation({view,section,id,index,screen},replace=false){
  const url=new URL(window.location.href);
  for(const key of ['tab','section','game','move','screen'])url.searchParams.delete(key);
  if(view!=='desk')url.searchParams.set('tab',view);
  if(view==='insights'&&section!=='Ratings')url.searchParams.set('section',section.toLowerCase());
  if(view==='review'&&id){
    url.searchParams.set('game',id);
    if(index>=0)url.searchParams.set('move',index);
    if(screen==='summary')url.searchParams.set('screen','summary');
  }
  if(url.href!==window.location.href)window.history[replace?'replaceState':'pushState'](null,'',url);
}

export default function Studio(){
  const [initialLocation]=useState(readLocation);
  const [status,setStatus]=useState(null),[games,setGames]=useState([]),[selected,setSelected]=useState(initialLocation.view==='review'?initialLocation.id:null),[game,setGame]=useState(null),[review,setReview]=useState(null),[job,setJob]=useState(null);
  const [failedGame,setFailedGame]=useState(null);
  const [index,setIndex]=useState(-1),[flipped,setFlipped]=useState(false),[syncing,setSyncing]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [savedGamesView]=useState(readGamesView);
  const [filter,setFilter]=useState(savedGamesView.filter),[search,setSearch]=useState(savedGamesView.search),[depth,setDepth]=useState(15),[playing,setPlaying]=useState(false),[library,setLibrary]=useState(initialLocation.view==='games'),[screen,setScreen]=useState('summary');
  const [view,setView]=useState(initialLocation.view);
  const [insightSection,setInsightSection]=useState(initialLocation.section);
  const [insightFilters,setInsightFilters]=useState(null);
  function selectInsightSection(section,event){
    if(section===insightSection)setInsightFilters({keyboard:event.detail===0});
    else {setInsightSection(section);writeLocation({view,section});}
  }
  const [insightsVisited,setInsightsVisited]=useState(false),[reviewReturn,setReviewReturn]=useState('games');
  useEffect(()=>{if(view==='insights')setInsightsVisited(true);},[view]);
  const [practiceViews,setPracticeViews]=useState([]);
  useEffect(()=>{if(['puzzles','learn'].includes(view))setPracticeViews(visited=>visited.includes(view)?visited:[...visited,view]);},[view]);
  const listKey=filter+':'+search;
  const gameListMemory=useRef(new Map([[savedGamesView.filter+':'+savedGamesView.search,savedGamesView.position]]));
  useEffect(()=>{
    writeGamesView(filter,search,gameListMemory.current.get(listKey)??null);
  },[filter,search,listKey]);
  const selectedRef=useRef(null),tableRef=useRef(null),pendingInsightRef=useRef(initialLocation.view==='review'?initialLocation:null),revisionRef=useRef(null);
  const [moveRows,setMoveRows]=useState(8);
  useEffect(()=>{const element=tableRef.current;if(!element)return;const observer=new ResizeObserver(entries=>{const height=entries[0].contentRect.height;if(height>0)setMoveRows(Math.max(1,Math.min(8,Math.floor(height/24))));});observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{selectedRef.current=selected;},[selected]);
  const loadGames=async()=>{const data=await api('games');setGames(data.games);return data.games;};
  async function syncGames(s=status){setSyncing(true);setError('');try{const result=await api('sync',{},s.token);const list=await loadGames();setStatus(old=>({...old,lastSync:result.lastSync}));setNotice(`Updated · ${list.length} games`);if(!selectedRef.current&&list.length)setSelected(list[0].id);}catch(e){setError(e.message);}finally{setSyncing(false);}}
  useEffect(()=>{let alive=true;(async()=>{try{const s=await api('status');if(!alive)return;setStatus(s);const list=await loadGames();if(!alive)return;if(list.length)setSelected(current=>current??list[0].id);else await syncGames(s);}catch(e){if(alive)setError(e.message);}finally{if(alive)setLoading(false);}})();return()=>{alive=false;};},[]);
  useEffect(()=>{if(!selected)return;let alive=true;setFailedGame(null);setGame(null);setReview(null);setJob(null);setIndex(-1);setPlaying(false);setScreen('summary');api(`games/${selected}`).then(data=>{if(alive){setGame(data.game);setReview(data.review);setJob(data.job);setFlipped(data.game.color==='b');if(pendingInsightRef.current?.id===selected){setIndex(pendingInsightRef.current.index);setScreen(pendingInsightRef.current.screen??(data.review||pendingInsightRef.current.index>=0?'review':'summary'));pendingInsightRef.current=null;}}}).catch(e=>{if(alive){setFailedGame(selected);setError(e.message);}});return()=>{alive=false;};},[selected]);
  useEffect(()=>{if(!['queued','running'].includes(job?.status)||!selected)return;let alive=true,busy=false;const poll=async()=>{if(busy||!alive)return;busy=true;try{await refreshAnalysis({readJob:()=>api(`jobs/${selected}`),readGame:()=>api(`games/${selected}`),isActive:()=>alive,onProgress:setJob,onError:setError,onComplete:(savedReview,finishedJob)=>{setReview(savedReview);setJob(finishedJob);setError('');setNotice('Review saved');loadGames().catch(e=>setError(e.message));}});}catch(e){if(alive)setError(e.message);}finally{busy=false;}};const timer=setInterval(poll,1200);poll();return()=>{alive=false;clearInterval(timer);};},[selected,job?.status]);
  useEffect(()=>{let alive=true,busy=false;const refresh=async()=>{if(busy||!alive)return;busy=true;try{const next=await api('status');if(!alive)return;setStatus(next);if(next.background?.revision!==revisionRef.current){revisionRef.current=next.background?.revision;await loadGames();const id=selectedRef.current;if(id){const data=await api(`games/${id}`);if(alive&&selectedRef.current===id){setReview(old=>old?.createdAt===data.review?.createdAt&&old?.bookVersion===data.review?.bookVersion?old:data.review);setJob(data.job);}}}}catch(e){if(alive)setError(e.message);}finally{busy=false;}};const timer=setInterval(refresh,15000);const focus=()=>{if(document.visibilityState==='visible')refresh();};document.addEventListener('visibilitychange',focus);return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',focus);};},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
  const parsed=useMemo(()=>{if(!game)return null;try{const b=new Chess();b.loadPgn(game.pgn);const history=b.history({verbose:true});return {initial:history[0]?.before||START,moves:history.map((m,i)=>({index:i,san:m.san,color:m.color,fenBefore:m.before,fenAfter:m.after,uci:m.from+m.to+(m.promotion||''),...game.openingMoves?.[i]}))};}catch{return null;}},[game]);
  const moves=review?.rows||parsed?.moves||[],total=moves.length,current=moves[index];
  const [variation,setVariation]=useState([]);
  const [reviewSquare,setReviewSquare]=useState(null);
  const [promotion,setPromotion]=useState(null);
  const resetBoard=useCallback(()=>{
    setVariation([]);
    setReviewSquare(null);
    setPromotion(null);
  },[]);
  useEffect(resetBoard,[resetBoard,selected,index,view,screen]);
  const go=useCallback(n=>{setIndex(Math.max(-1,Math.min(total-1,n)));setPlaying(false);resetBoard();},[resetBoard,total]);
  useEffect(()=>{const handle=e=>{if(e.defaultPrevented||view!=='review'||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(index+(e.key==='ArrowRight'?1:-1));}};window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);},[index,go,view]);
  useEffect(()=>{if(!playing)return;const timer=setInterval(()=>{setIndex(n=>{if(n>=total-1){setPlaying(false);return n;}return n+1;});},1600);return()=>clearInterval(timer);},[playing,total]);
  const filtered=useMemo(()=>games.filter(g=>(filter==='all'||g.timeClass===filter)&&g.opponent.toLowerCase().includes(search.toLowerCase())),[games,filter,search]);
  const pageSize=moveRows*2,movePage=Math.floor(Math.max(0,index)/pageSize),pageMoves=moves.slice(movePage*pageSize,(movePage+1)*pageSize);
  const variationMove=variation.at(-1);
  const fen=variationMove?.after||current?.fenAfter||parsed?.initial||START;
  const played=variationMove?variationMove.lan:current?.uci;
  const grade=variationMove?undefined:current?.classification;
  const best=!variationMove&&current?.classification!=='Book'&&current?.bestUci!==current?.uci?current?.bestUci:null;
  const topColor=flipped?'w':'b',bottomColor=flipped?'b':'w';
  const reviewBoard=useMemo(()=>new Chess(fen),[fen]);
  const reviewTargets=useMemo(()=>reviewSquare?reviewBoard.moves({square:reviewSquare,verbose:true}).map(move=>move.to):[],[reviewBoard,reviewSquare]);
  const boardInteractive=view==='review'&&!playing;

  function playVariation(from,to,piece){
    const uci=from+to+(piece||'');
    if(!variationMove&&moves[index+1]?.uci===uci){
      go(index+1);
      return;
    }
    const next=new Chess(fen).move({from,to,promotion:piece});
    setVariation(line=>[...line,next]);
    setReviewSquare(null);
    setPromotion(null);
  }
  function exploreMove(from,to){
    if(promotion)return false;
    const candidates=reviewBoard.moves({square:from,verbose:true}).filter(move=>move.to===to);
    if(!candidates.length)return false;
    if(candidates.some(move=>move.promotion))setPromotion({from,to});
    else playVariation(from,to);
    return true;
  }
  function chooseReviewSquare(square){
    if(promotion)return;
    if(reviewSquare&&exploreMove(reviewSquare,square))return;
    setReviewSquare(square!==reviewSquare&&reviewBoard.get(square)?.color===reviewBoard.turn()?square:null);
  }
  function undoVariation(){
    setVariation(line=>line.slice(0,-1));
    setReviewSquare(null);
    setPromotion(null);
  }
  function enter(n=index<0?0:index){go(n);setScreen('review');}
  function findGrade(g){const rows=review.rows.filter(r=>r.color===game.color&&r.classification===g);enter((rows.find(r=>r.index>index)||rows[0]).index);}
  async function analyze(){setError('');try{setJob(await api(`games/${game.id}/analyze`,{depth},status.token));}catch(e){setError(e.message);}}
  useEffect(()=>{
    function restoreLocation(){
      const next=readLocation();
      setView(next.view);
      setLibrary(next.view==='games');
      setInsightSection(next.section);
      setInsightFilters(null);
      setPlaying(false);
      if(next.view==='review'){
        setReviewReturn('games');
        if(next.id===game?.id){
          go(next.index);
          setScreen(next.screen);
        }else{
          pendingInsightRef.current=next;
          setSelected(next.id);
        }
      }
    }
    window.addEventListener('popstate',restoreLocation);
    return ()=>window.removeEventListener('popstate',restoreLocation);
  },[game,go]);
  useEffect(()=>{
    const location=readLocation();
    if(view==='review'&&game?.id===selected&&location.view===view&&location.id===selected){
      writeLocation({view,id:selected,index:Math.min(index,total-1),screen},true);
      if(index>=total)setIndex(total-1);
    }
  },[view,game,selected,index,screen,total]);
  function openInsight(id,targetIndex=0,returnTo='games'){
    writeLocation({view:'review',id,index:targetIndex});
    setReviewReturn(returnTo);
    setView('review');
    setLibrary(false);
    if(id===selected){go(targetIndex);setScreen(review||targetIndex>=0?'review':'summary');}
    else{pendingInsightRef.current={id,index:targetIndex};setSelected(id);}
  }
  const [drill,setDrill]=useState(null);
  function openDrill(scope,theme){
    setDrill(previous=>({scope,theme,sequence:(previous?.sequence??0)+1}));
    navigate('puzzles');
  }
  function navigate(nextView){
    writeLocation({view:nextView,section:insightSection});
    setPlaying(false);
    setLibrary(nextView==='games');
    setView(nextView);
  }

  const latestGame=games[0];
  const [deskPosition,setDeskPosition]=useState(null);
  const latestId=latestGame?.id;
  const loadedLatestMove=game?.id===latestId?moves.at(-1):null;
  useEffect(()=>{
    if(loadedLatestMove)setDeskPosition({id:latestId,move:loadedLatestMove});
  },[latestId,loadedLatestMove]);
  useEffect(()=>{
    if(view!=='desk'||!latestId||deskPosition?.id===latestId||selected===latestId)return;
    let active=true;
    api(`games/${latestId}`).then(({game:latest,review:latestReview})=>{
      if(!active)return;
      const reviewedMove=latestReview?.rows.at(-1);
      if(reviewedMove){setDeskPosition({id:latestId,move:reviewedMove});return;}
      const board=new Chess();
      board.loadPgn(latest.pgn);
      const last=board.history({verbose:true}).at(-1);
      const move=last?{fenAfter:last.after,uci:last.from+last.to+(last.promotion||'')}:null;
      setDeskPosition({id:latestId,move});
    }).catch(()=>{});
    return ()=>{active=false;};
  },[view,latestId,deskPosition?.id,selected]);
  const featuredMove=loadedLatestMove??(deskPosition?.id===latestId?deskPosition?.move:null);
  const boardColumnRef=useRef(null);
  const animatedGame=useRef(null);
  useEffect(()=>{
    if(view!=='review'||!game||game.id!==selected||animatedGame.current!==game.id)return;
    animatedGame.current=null;
    if(!window.matchMedia('(min-width:901px) and (prefers-reduced-motion:no-preference)').matches)return;
    const animation=boardColumnRef.current?.animate(
      [{opacity:.55,transform:'translateX(5px)'},{opacity:1,transform:'translateX(0)'}],
      {duration:180,easing:'cubic-bezier(.23,1,.32,1)'}
    );
    return ()=>animation?.cancel();
  },[view,game,selected]);
  function selectLibraryGame(next,event){
    writeLocation({view:'review',id:next.id,screen:'summary'});
    animatedGame.current=event.detail>0&&next.id!==selected?next.id:null;
    setReviewReturn('games');
    setSelected(next.id);
    setView('review');
    setScreen('summary');
    setLibrary(false);
  }
  const coachProps={row:current,review,index};
  return <div className={`studio screen-${screen} view-${view} ${view==='review'?'review-active':''}`}><a className="skip-workspace" href={view==='games'?'#game-library':'#workspace'}>Skip to workspace</a><aside id="game-library" tabIndex={-1} hidden={view!=='games'&&view!=='review'} className={`library ${library?'open':''}`} aria-label="Game library"><header className="library-title games-heading">
      <h1>Games</h1>
      <button className="sync-button" disabled={syncing||!status} onClick={()=>syncGames()} aria-label={syncing?'Syncing games':'Sync latest games'} title="Sync latest games"><Icon name="refresh"/></button>
    </header>
    <input className="search" aria-label="Search opponents" placeholder="Find an opponent…" value={search} onChange={e=>{setSearch(e.target.value);}}/><div className="filters" aria-label="Game time control">{gameFilters.map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'active':''} onClick={()=>{setFilter(f);}}>{f==='all'?'All games':f}</button>)}</div>
    <GamesList key={listKey} listKey={listKey} onRemember={position=>writeGamesView(filter,search,position)} memory={gameListMemory} active={view==='games'} games={filtered} selected={selected} loading={loading} timeControl={timeControl} onSelect={selectLibraryGame}/></aside>
    <main id="workspace" tabIndex={-1} className={`main ${view!=="review"?`${view}-mode`:""}`}><div className="game-toolbar" hidden={!["games","review"].includes(view)}>{view==='games'&&game&&<button className="preview-review" onClick={()=>openInsight(game.id,index)}>Review selected game</button>}<button className="icon-button" aria-label="Flip board" onClick={()=>setFlipped(f=>!f)}><Icon name="flip"/></button><span className={`result-label ${game?.result}`}>{game?.result}</span><button className="phone-button summary-link" onClick={()=>screen==='summary'?enter():setScreen('summary')}>{screen==='summary'?'Board':'Summary'}<Icon name="right" size={14}/></button>{game&&<a className="icon-button download" href={`api/games/${game.id}/pgn`} aria-label="Download game PGN" title="Download PGN"><Icon name="download"/></a>}</div>
    {error&&<div className="toast error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}>×</button></div>}{notice&&<div className="toast" role="status">{notice}</div>}
    {view==='desk'&&<StudyDesk game={latestGame} move={featuredMove} total={games.length} loading={loading}
      onReview={()=>openInsight(latestGame.id,0,'desk')} onPractice={()=>navigate('puzzles')}/>}
    {practiceViews.map(practiceView=><div key={practiceView} className="practice-view" hidden={view!==practiceView} inert={view!==practiceView}><Puzzles key={practiceView==='puzzles'?drill?.sequence:undefined} initialScope={practiceView==='puzzles'?drill?.scope:undefined} initialTheme={practiceView==='puzzles'?drill?.theme:undefined} active={view===practiceView} mode={practiceView==="learn"?"learn":"puzzles"} token={status?.token} onOpenGame={(id,moveIndex)=>openInsight(id,moveIndex,practiceView)}/></div>)}
    {insightsVisited&&<div className="practice-view" hidden={view!=="insights"} inert={view!=="insights"}><Insights section={insightSection} onDrill={openDrill} active={view==="insights"} filters={insightFilters} onCloseFilters={()=>setInsightFilters(null)}/></div>}{["games","review"].includes(view)&&(loading||selected&&selected!==game?.id&&failedGame!==selected)&&<LoadingSkeleton view="review" label="Loading game review"/>}
    <div className="review-workspace" hidden={!["games","review"].includes(view)||loading||!!selected&&selected!==game?.id}><section ref={boardColumnRef} className="board-column" aria-label="Game board"><Coach {...(variationMove?{variationMove}:coachProps)} compact/><Player player={game?.[topColor==='w'?'white':'black']} color={topColor} isYou={game?.color===topColor}/><div className="board-frame"><div className="board-and-eval">
        <div className={`eval-bar ${flipped?'flipped':''}`} aria-label={variationMove?'Evaluation unavailable for the variation':`Evaluation ${score(current)} from White�s perspective`}><div style={{height:`${!variationMove&&current?.whiteCp!==undefined?Math.max(3,Math.min(97,50+current.whiteCp/15)):50}%`}}/></div>
        <div className="interactive-board">
          <Board fen={fen} flipped={flipped} played={played} best={best} grade={grade} selected={reviewSquare} targets={reviewTargets} onSquare={boardInteractive?chooseReviewSquare:undefined} onDrop={boardInteractive&&!promotion?exploreMove:undefined}/>
          {promotion&&<PromotionPicker onChoose={piece=>playVariation(promotion.from,promotion.to,piece)} onCancel={()=>setPromotion(null)}/>}
        </div></div></div><Player player={game?.[bottomColor==='w'?'white':'black']} color={bottomColor} isYou={game?.color===bottomColor}/>
      <nav className="move-navigation" aria-label="Move navigation"><button className="icon-button desktop-control" aria-label="First position" disabled={index<0} onClick={()=>go(-1)}><Icon name="first"/></button><button className="icon-button previous" aria-label="Previous move" disabled={index<0} onClick={()=>go(index-1)}><Icon name="left"/></button><button className="play-button desktop-control" aria-label={playing?'Pause replay':'Play replay'} disabled={!total} onClick={()=>{resetBoard();if(index===total-1)setIndex(-1);setPlaying(p=>!p);}}><Icon name={playing?'pause':'play'}/></button>{variationMove?<div className="variation-controls">
        <span role="status">Variation <small>{variationMove.san}</small></span>
        <button type="button" aria-label="Undo variation move" onClick={undoVariation}>Undo</button>
        <button type="button" onClick={resetBoard}>Return to game</button>
      </div>:<MoveCarousel moves={moves} index={index} onMove={go}/>}<button className="icon-button next" aria-label="Next move" disabled={index>=total-1} onClick={()=>go(index+1)}><Icon name="right"/></button><button className="icon-button desktop-control" aria-label="Last move" disabled={index>=total-1} onClick={()=>go(total-1)}><Icon name="last"/></button><span className="move-counter">{index+1} / {total}</span></nav>
    </section><aside className="review-panel" aria-label="Game analysis"><Summary index={index} onMove={go} game={game} review={review} job={job} depth={depth} setDepth={setDepth} onAnalyze={analyze} onGrade={findGrade} onEnter={()=>enter()}/><Coach {...(variationMove?{variationMove}:coachProps)}/><section className="desktop-moves" aria-label="Move list"><div className="move-list-title"><span>MOVE BY MOVE</span><span>{total?`${Math.ceil(total/2)} moves`:'—'}</span></div><div className="move-table" ref={tableRef} style={{"--move-rows":moveRows}}>{Array.from({length:moveRows},(_,n)=>{const pair=pageMoves.slice(n*2,n*2+2);return <div className="move-row" key={n}><span>{pair.length?movePage*moveRows+n+1+'.':''}</span>{[0,1].map(c=>pair[c]?<button key={c} aria-current={pair[c].index===index?'step':undefined} onClick={()=>go(pair[c].index)}><span>{pair[c].san}</span><b className={pair[c].classification?.toLowerCase()}>{MARKS[pair[c].classification]}</b></button>:<span key={c}/>)}</div>;})}</div><div className="move-pages"><button className="icon-button" aria-label="Previous move page" disabled={movePage===0} onClick={()=>go(movePage*pageSize-pageSize)}><Icon name="left" size={15}/></button><span>{movePage+1} / {Math.max(1,Math.ceil(total/pageSize))}</span><button className="icon-button" aria-label="Next move page" disabled={(movePage+1)*pageSize>=total} onClick={()=>go((movePage+1)*pageSize)}><Icon name="right" size={15}/></button></div></section><div className="method-note">Grades are local estimates · Brilliant uses a sacrifice heuristic.</div></aside></div></main>
    <Navigation view={view} insightSection={insightSection} onInsightSection={selectInsightSection} onBack={()=>navigate(reviewReturn)} onFlip={()=>setFlipped(f=>!f)} onNavigate={navigate}/>
  </div>;
}
