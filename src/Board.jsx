import React,{useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Chess} from 'chess.js';
import ChessPiece from './ChessPiece.jsx';
export const GRADES=['Book','Brilliant','Best','Excellent','Good','Inaccuracy','Mistake','Blunder'];
export const GRADE_COLORS={Book:'#916d4f',Brilliant:'#257b76',Best:'#799c44',Excellent:'#75914c',Good:'#6c8550',Inaccuracy:'#d2a742',Mistake:'#cb8446',Blunder:'#c55f4b'};
export const MARKS={Book:<svg className="book-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5.5C9 3.7 5.8 3.5 3 4.5v14c3-1 6.2-.8 9 1 2.8-1.8 6-2 9-1v-14c-2.8-1-6-.8-9 1Z"/><path d="M12 5.5v14M6 8l3 .5M6 11l3 .5M15 8.5l3-.5M15 11.5l3-.5"/></svg>,Brilliant:'!!',Best:'★',Excellent:'✓',Good:'•',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const NAMES={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
export function Board({fen,flipped,played,best,grade,onSquare,onDrop,selected,targets=[]}){
  const board=useMemo(()=>new Chess(fen),[fen]);
  const files=(flipped?'hgfedcba':'abcdefgh').split(''),ranks=flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
  const Square=onSquare?'button':'div';
  const markerId=useId();
  const drag=useRef(null),ghost=useRef(null),highlight=useRef(null),returnMotion=useRef(null);
  const ignoreClick=useRef(false);
  const [lifted,setLifted]=useState(null);
  const [keyboardSquare,setKeyboardSquare]=useState('e4');
  const draggable=Boolean(onDrop);

  function highlightSquare(square){
    if(highlight.current===square)return;
    highlight.current?.removeAttribute('data-drop-target');
    square?.setAttribute('data-drop-target','');
    highlight.current=square;
  }

  useLayoutEffect(()=>{
    const gesture=drag.current;
    drag.current=null;
    if(gesture?.square.hasPointerCapture(gesture.id))gesture.square.releasePointerCapture(gesture.id);
    returnMotion.current?.cancel();
    highlightSquare(null);
    setLifted(null);
  },[fen,flipped,draggable]);

  function startDrag(event){
    if(!event.isPrimary||event.button!==0)return;
    ignoreClick.current=false;
    if(!draggable||drag.current)return;
    const square=event.target.closest('[data-square]');
    const from=square?.dataset.square;
    const piece=from&&board.get(from);
    if(piece?.color!==board.turn())return;
    const moves=board.moves({square:from,verbose:true});
    if(!moves.length)return;
    returnMotion.current?.cancel();
    setLifted(null);
    const bounds=event.currentTarget.getBoundingClientRect();
    const origin=square.getBoundingClientRect();
    drag.current={
      id:event.pointerId,square,from,piece,bounds,
      x:event.clientX,y:event.clientY,moved:false,
      originX:origin.left+origin.width/2,originY:origin.top+origin.height/2,
      targets:new Set(moves.map(move=>move.to))
    };
    square.setPointerCapture(event.pointerId);
  }

  function translate(x,y,gesture){
    return `translate3d(${x-gesture.bounds.left}px,${y-gesture.bounds.top}px,0) translate(-50%,-50%)`;
  }

  function dropSquare(event){
    const square=event.currentTarget.ownerDocument.elementFromPoint(event.clientX,event.clientY)?.closest('[data-square]');
    return square&&event.currentTarget.contains(square)?square:null;
  }

  function moveDrag(event){
    const gesture=drag.current;
    if(gesture?.id!==event.pointerId)return;
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<5)return;
    if(!gesture.moved){
      gesture.moved=true;
      setLifted(gesture);
    }
    ghost.current.style.transform=translate(event.clientX,event.clientY,gesture);
    const square=dropSquare(event);
    highlightSquare(gesture.targets.has(square?.dataset.square)?square:null);
  }

  function finishDrag(event,canceled=false){
    const gesture=drag.current;
    if(gesture?.id!==event.pointerId)return;
    drag.current=null;
    if(!gesture.moved)return;
    ignoreClick.current=true;
    highlightSquare(null);

    const destination=canceled?null:dropSquare(event)?.dataset.square;
    if(gesture.targets.has(destination)&&onDrop?.(gesture.from,destination)!==false){
      setLifted(null);
      return;
    }
    if(canceled||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      setLifted(null);
      return;
    }
    const motion=ghost.current.animate([
      {transform:ghost.current.style.transform},
      {transform:translate(gesture.originX,gesture.originY,gesture)}
    ],{duration:140,easing:'cubic-bezier(.23,1,.32,1)',fill:'forwards'});
    returnMotion.current=motion;
    motion.onfinish=()=>{
      setLifted(null);
      returnMotion.current=null;
      motion.cancel();
    };
  }

  function moveFocus(event){
    const square=event.target.dataset.square;
    if(!onSquare||!square)return;
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!direction)return;
    event.preventDefault();
    const file=files[files.indexOf(square[0])+direction[0]];
    const rank=ranks[ranks.indexOf(Number(square[1]))+direction[1]];
    if(file&&rank)event.currentTarget.querySelector(`[data-square="${file+rank}"]`)?.focus({preventScroll:true});
  }

  const pos=s=>({x:files.indexOf(s[0])*12.5+6.25,y:ranks.indexOf(Number(s[1]))*12.5+6.25});
  const arrow=(uci,type)=>{if(!uci)return null;const a=pos(uci.slice(0,2)),b=pos(uci.slice(2,4));return <line className={`${type}-arrow`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={`url(#${markerId}-${type}-head)`}/>;};
  return <div className={`board ${onDrop?'draggable-board':''}`} onPointerDown={startDrag} onPointerMove={moveDrag}
    onPointerUp={e=>finishDrag(e)} onPointerCancel={e=>finishDrag(e,true)}
    onLostPointerCapture={e=>finishDrag(e,true)} onKeyDown={moveFocus} style={{'--move-color':GRADE_COLORS[grade]||'#6d9fe2','--better-color':GRADE_COLORS.Best}} role={onSquare?'group':'img'} aria-label={`${onSquare?'Interactive chess position':'Position after the selected move'}. ${board.turn()==='w'?'White':'Black'} to move${grade?`. Last move: ${grade}`:''}.`}>
    {ranks.flatMap((rank,y)=>files.map((file,x)=>{const square=file+rank,piece=board.get(square),from=played?.slice(0,2)===square,to=played?.slice(2,4)===square,suggested=best?.slice(2,4)===square;return <Square key={square} onClick={onSquare?event=>{if(event.detail&&ignoreClick.current){ignoreClick.current=false;return;}onSquare(square);}:undefined} onFocus={onSquare?()=>setKeyboardSquare(square):undefined} tabIndex={onSquare?(keyboardSquare===square?0:-1):undefined} aria-pressed={onSquare?selected===square:undefined} className={`square ${(x+y)%2?'dark':'light'} ${from?'move-from':''} ${to?'move-to':''} ${suggested?'suggested-square':''} ${selected===square?'puzzle-selected':''} ${targets.includes(square)?'puzzle-target':''}`} data-square={square} data-draggable={draggable&&piece?.color===board.turn()?true:undefined} data-lifted={lifted?.from===square?true:undefined} data-played={to?'destination':from?'origin':undefined} aria-label={`${square}${piece?` ${piece.color==='w'?'white':'black'} ${NAMES[piece.type]}`:''}`}>
      {x===0&&<span className="rank">{rank}</span>}{y===7&&<span className="file">{file}</span>}{piece&&lifted?.from!==square&&<ChessPiece type={piece.type} color={piece.color}/>}{to&&grade&&<span className={`board-grade ${grade.toLowerCase()}`} aria-label={`${grade} on ${square}`} title={grade}>{MARKS[grade]}</span>}
    </Square>;}))}
    <svg className="board-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id={`${markerId}-played-head`} markerWidth="3.2" markerHeight="3.2" refX="2.6" refY="1.6" orient="auto"><path d="M0 0 3.2 1.6 0 3.2Z" fill="var(--move-color)"/></marker><marker id={`${markerId}-better-head`} markerWidth="3.6" markerHeight="3.6" refX="2.8" refY="1.8" orient="auto"><path d="M0 0 3.6 1.8 0 3.6Z" fill="var(--better-color)"/></marker></defs>{arrow(played,'played')}{arrow(best,'better')}</svg>
    {draggable&&<div ref={ghost} className="board-drag-piece" aria-hidden="true">{lifted&&<ChessPiece type={lifted.piece.type} color={lifted.piece.color}/>}</div>}
  </div>;
}
export function Player({player,color,isYou}){return <div className="player"><span className={`avatar ${color==='w'?'white-avatar':''}`}><ChessPiece type="k" color={color}/></span><strong>{player?.username||'…'}{isYou&&<small>YOU</small>}</strong><span className="rating">{player?.rating||'—'}</span><span className="side">{color==='w'?'White':'Black'}</span></div>;}

export function PromotionPicker({onChoose,onCancel}){
  const first=useRef(null);
  useLayoutEffect(()=>{
    const previous=document.activeElement;
    first.current?.focus({preventScroll:true});
    return ()=>previous?.focus({preventScroll:true});
  },[]);
  return <div className="puzzle-promotion" role="dialog" aria-label="Choose promotion" onKeyDown={event=>{
    if(event.key==='Escape')onCancel();
  }}>
    <strong>Promote to</strong>
    {[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(([piece,label])=>
      <button key={piece} ref={piece==='q'?first:undefined} onClick={()=>onChoose(piece)}>{label}</button>
    )}
    <button onClick={onCancel}>Cancel</button>
  </div>;
}
