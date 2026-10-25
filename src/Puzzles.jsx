import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Chess} from 'chess.js';
import {Board} from './Board.jsx';
import './puzzles.css';

async function request(route,body,token,signal){
  const response=await fetch(`api/${route}`,body===undefined?{signal}:{method:'POST',signal,headers:{'Content-Type':'application/json','X-Review-Token':token},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load your practice.');return data;
}
function Idea({text}){
  const [page,setPage]=useState(0),words=text.replace(/^Nice find[^.]*\.\s*/,'').split(/\s+/),parts=[];let part='';
  for(const word of words){if((part+' '+word).length>100&&part){parts.push(part);part='';}part+=(part?' ':'')+word;}if(part)parts.push(part);
  useEffect(()=>setPage(0),[text]);
  const index=Math.min(page,parts.length-1);
  return <div className="idea-copy"><p>{parts[index]}</p>{parts.length>1&&<button className="idea-more" aria-label="Read next idea page" onClick={()=>setPage(n=>(n+1)%parts.length)}>More<span>{index+1} / {parts.length}</span></button>}</div>;
}
function ControlIcon({name}){
  const paths={hint:<><path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9Z"/></>,reveal:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,options:<path d="M4 7h16M4 17h16M9 4v6m6 4v6"/>,left:<path d="m14 5-7 7 7 7"/>,right:<path d="m10 5 7 7-7 7"/>,next:<path d="M4 12h16m-7-7 7 7-7 7"/>};
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export default function Puzzles({token,onOpenGame,mode='puzzles'}){
  const [scope,setScope]=useState('all'),[theme,setTheme]=useState('all'),[round,setRound]=useState(0),[exclude,setExclude]=useState('');
  const [puzzle,setPuzzle]=useState(null),[meta,setMeta]=useState(null),[session,setSession]=useState(null),[fen,setFen]=useState(null),[completed,setCompleted]=useState(0);
  const [idea,setIdea]=useState(''),[selected,setSelected]=useState(null),[result,setResult]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[promotion,setPromotion]=useState(null),[sheet,setSheet]=useState(null),[lineIndex,setLineIndex]=useState(0),[played,setPlayed]=useState(null);
  const replyTimer=useRef(null),generation=useRef(0),closeSheet=useRef(null),openSheet=useRef(null);
  useEffect(()=>{
    const controller=new AbortController();const version=++generation.current;let assigned=false,inFlight=false;
    clearTimeout(replyTimer.current);setPuzzle(null);setSession(null);setResult(null);setSelected(null);setMessage('');setPromotion(null);setError('');setLineIndex(0);setCompleted(0);setPlayed(null);setBusy(false);setIdea('');
    if(!token)return()=>controller.abort();
    async function read(){
      if(inFlight||assigned)return;inFlight=true;
      try{
        const data=await request(`puzzles?${new URLSearchParams({scope,theme,exclude,mode})}`,undefined,undefined,controller.signal);
        if(controller.signal.aborted)return;setMeta(data);
        if(data.puzzle){
          const start=await request(`puzzles/${encodeURIComponent(data.puzzle.id)}/answer`,{action:'start'},token,controller.signal);
          if(controller.signal.aborted||version!==generation.current)return;
          assigned=true;setPuzzle(data.puzzle);setSession(start.sessionId);setFen(start.fen);setIdea(data.puzzle.idea);
        }
      }catch(e){if(!controller.signal.aborted)setError(e.message);}finally{inFlight=false;}
    }
    read();const timer=setInterval(read,4000);return()=>{controller.abort();clearInterval(timer);clearTimeout(replyTimer.current);generation.current++;};
  },[scope,theme,round,exclude,token,mode]);
  useEffect(()=>{if(sheet)closeSheet.current?.focus();},[sheet]);
  const board=useMemo(()=>fen?new Chess(fen):null,[fen]);
  const targets=board&&selected&&!result&&!busy?board.moves({square:selected,verbose:true}).map(m=>m.to):[];
  const shown=useMemo(()=>{
    if(!result||!puzzle)return fen;
    const b=new Chess(puzzle.fen);
    for(const uci of result.pv.slice(0,lineIndex+1))b.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
    return b.fen();
  },[fen,puzzle,result,lineIndex]);
  async function submit(body){
    if(busy||!puzzle||!session)return;setBusy(true);setError('');const version=generation.current;
    try{
      const data=await request(`puzzles/${encodeURIComponent(puzzle.id)}/answer`,{...body,sessionId:session,step:completed},token);
      if(version!==generation.current)return;
      if(data.hint){setSelected(data.from);setMessage('Hint');setIdea(data.hint);setBusy(false);}
      else if(data.complete){setResult(data);setFen(data.fen);setCompleted(data.completedMoves);setSelected(null);setLineIndex(data.pv.length-1);setPlayed(data.pv.at(-1));setMessage(data.correct?'Puzzle solved!':'Solution revealed');setBusy(false);}
      else if(data.correct){
        setFen(data.playerFen);setPlayed(data.playerMove);setSelected(null);setMessage('Good move.');setIdea(data.explanation);setCompleted(data.completedMoves);
        replyTimer.current=setTimeout(()=>{if(version!==generation.current)return;setFen(data.fen);setPlayed(data.reply);setMessage('Your move.');setBusy(false);},550);
      }else{setMessage('Not quite. Try again.');setSelected(null);setBusy(false);}
    }catch(e){if(version===generation.current){setError(e.message);setBusy(false);}}finally{if(version===generation.current)setPromotion(null);}
  }
  function choose(square){
    if(busy||result||!board)return;
    const piece=board.get(square);
    if(selected===square){setSelected(null);return;}
    if(selected){const moves=board.moves({square:selected,verbose:true}).filter(m=>m.to===square);
      if(moves.length){if(moves.some(m=>m.promotion)){setPromotion({from:selected,to:square});return;}submit({move:selected+square});return;}
    }
    setSelected(piece?.color===puzzle.color?square:null);
  }
  async function next(){
    if(busy)return;
    if(puzzle&&!result){setBusy(true);try{await request(`puzzles/${encodeURIComponent(puzzle.id)}/answer`,{action:'skip'},token);}catch(e){setError(e.message);setBusy(false);return;}}
    setSheet(null);setExclude(puzzle?.id||'');setRound(n=>n+1);
  }
  function dismiss(){setSheet(null);openSheet.current?.focus();}
  return <section className="puzzles-panel" aria-label={mode==='learn'?'Opening lessons':'Personalised puzzles'}>
    <section className="puzzle-idea" aria-label="Move idea"><div className="idea-heading"><strong title={mode==='learn'?puzzle?.opening:undefined}>{mode==='learn'?(puzzle?.openingFamily||'Your openings'):'The idea'}</strong><span role="status" aria-live="polite">{result?`${result.correct?'Solved':'Solution'} · ${result.line[lineIndex]||''}`:message||(puzzle?`${puzzle.color==='w'?'White':'Black'} to move`:'Preparing…')}</span></div><Idea text={result?(result.ideas?.[lineIndex]||result.explanation):(idea||'Preparing a position from your games…')}/></section>
    {(error||meta?.error)&&<div className="puzzle-error" role="alert">{error||meta.error}<button onClick={()=>setRound(n=>n+1)}>Retry</button></div>}
    {puzzle?<><div className="puzzle-board-slot"><div className="puzzle-board-wrap"><Board fen={shown} flipped={puzzle.color==='b'} onSquare={result?undefined:choose} selected={selected} targets={targets} played={result?.pv[lineIndex]||played}/>{promotion&&<div className="puzzle-promotion" role="dialog" aria-label="Choose promotion"><strong>Promote to</strong>{[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([p,label])=><button key={p} onClick={()=>submit({move:promotion.from+promotion.to+p})}>{label}</button>)}<button onClick={()=>setPromotion(null)}>Cancel</button></div>}</div></div>
      <nav className="puzzle-actions" aria-label={mode==='learn'?'Lesson controls':'Puzzle controls'}>{result?<><button aria-label="Previous solution position" disabled={lineIndex===0} onClick={()=>setLineIndex(n=>n-1)}><ControlIcon name="left"/><span>Prev move</span></button><button aria-label="Next solution position" disabled={lineIndex>=result.pv.length-1} onClick={()=>setLineIndex(n=>n+1)}><ControlIcon name="right"/><span>Next move</span></button><button ref={openSheet} aria-label="Practice options" onClick={()=>setSheet('filters')}><ControlIcon name="options"/><span>Options</span></button><button className="puzzle-next" onClick={next} aria-label={mode==='learn'?'Next lesson':'Next puzzle'}><ControlIcon name="next"/><span>{mode==='learn'?'Next lesson':'Next puzzle'}</span></button></>:<><button disabled={busy||!session} onClick={()=>submit({action:'hint'})}><ControlIcon name="hint"/><span>Hint</span></button><button disabled={busy||!session} onClick={()=>submit({action:'reveal'})}><ControlIcon name="reveal"/><span>Reveal</span></button><button ref={openSheet} disabled={busy} aria-label="Practice options" onClick={()=>setSheet('filters')}><ControlIcon name="options"/><span>Options</span></button><button className="puzzle-next" onClick={next} disabled={busy}><ControlIcon name="next"/><span>Skip</span></button></>}</nav></>:<div className="puzzle-empty"><span aria-hidden="true">♞</span><h2>{meta?.generating?(mode==='learn'?'Preparing opening lessons…':'Preparing puzzles…'):meta?.waiting?'You’re up to date.':meta&&!meta.generating?(mode==='learn'?'No matching lesson yet.':'No matching puzzle yet.'):'Finding your next puzzle…'}</h2><button onClick={()=>setSheet('filters')}>Change filters</button><button onClick={()=>{setExclude('');setRound(n=>n+1);}}>Try again</button></div>}
    {sheet&&<div className="puzzle-overlay" onClick={dismiss}><section className="puzzle-sheet" role="dialog" aria-modal="true" aria-label="Practice options" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')dismiss();if(e.key==='Tab'){const nodes=[...e.currentTarget.querySelectorAll('button:not(:disabled),select')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><h2>{mode==='learn'?'Your openings':'Practice options'}</h2><button ref={closeSheet} aria-label="Close puzzle panel" onClick={dismiss}>×</button></header>{<><div className="puzzle-scopes" aria-label="Puzzle time control">{['all','rapid','blitz','bullet'].map(s=><button key={s} aria-pressed={scope===s} onClick={()=>{setScope(s);setTheme('all');setExclude('');}}>{s==='all'?'All games':s}</button>)}</div><label>{mode==='learn'?'Opening':'Weakness'}<select aria-label={mode==='learn'?'Practice opening':'Practice weakness'} value={theme} onChange={e=>{setTheme(e.target.value);setExclude('');}}><option value="all">{mode==='learn'?'All your openings':'Mixed weaknesses'}</option>{meta?.themes.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}</select></label><button className="puzzle-next" onClick={dismiss}>Back to board</button></>}{result&&<button onClick={()=>onOpenGame(result.gameId,result.index)}>Original game vs {puzzle.opponent} ↗</button>}</section></div>}
  </section>;
}
