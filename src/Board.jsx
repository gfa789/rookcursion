import React,{useId,useRef,useState} from 'react';
import {Chess} from 'chess.js';
import ChessPiece from './ChessPiece.jsx';
export const GRADES=['Book','Brilliant','Best','Excellent','Good','Inaccuracy','Mistake','Blunder'];
export const GRADE_COLORS={Book:'#916d4f',Brilliant:'#257b76',Best:'#799c44',Excellent:'#75914c',Good:'#6c8550',Inaccuracy:'#d2a742',Mistake:'#cb8446',Blunder:'#c55f4b'};
export const MARKS={Book:<svg className="book-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5.5C9 3.7 5.8 3.5 3 4.5v14c3-1 6.2-.8 9 1 2.8-1.8 6-2 9-1v-14c-2.8-1-6-.8-9 1Z"/><path d="M12 5.5v14M6 8l3 .5M6 11l3 .5M15 8.5l3-.5M15 11.5l3-.5"/></svg>,Brilliant:'!!',Best:'★',Excellent:'✓',Good:'•',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const NAMES={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
export function Board({fen,flipped,played,best,grade,onSquare,onDrop,selected,targets=[]}){
  const board=new Chess(fen),files=(flipped?'hgfedcba':'abcdefgh').split(''),ranks=flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
  const Square=onSquare?'button':'div';
  const markerId=useId();
  const drag=useRef(null),ghost=useRef(null),ignoreClick=useRef(false);
  const [lifted,setLifted]=useState(null);
  function startDrag(event){
    ignoreClick.current=false;
    if(!onDrop||!event.isPrimary||event.button!==0)return;
    const square=event.target.closest('[data-square]');
    const from=square?.dataset.square;
    const piece=from&&board.get(from);
    if(piece?.color!==board.turn())return;
    const bounds=event.currentTarget.getBoundingClientRect();
    drag.current={id:event.pointerId,from,piece,bounds,x:event.clientX,y:event.clientY,moved:false};
    square.setPointerCapture(event.pointerId);
    placeGhost(event,drag.current);
  }
  function placeGhost(event,gesture){
    ghost.current.style.transform=`translate3d(${event.clientX-gesture.bounds.left}px,${event.clientY-gesture.bounds.top}px,0) translate(-50%,-50%)`;
  }
  function moveDrag(event){
    const gesture=drag.current;
    if(gesture?.id!==event.pointerId)return;
    if(!gesture.moved&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<5)return;
    if(!gesture.moved){gesture.moved=true;setLifted(gesture);}
    placeGhost(event,gesture);
  }
  function finishDrag(event,canceled=false){
    const gesture=drag.current;
    if(gesture?.id!==event.pointerId)return;
    drag.current=null;
    if(!gesture.moved)return;
    ignoreClick.current=true;
    setLifted(null);
    if(canceled)return;
    const square=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-square]');
    if(square&&event.currentTarget.contains(square)&&square.dataset.square!==gesture.from)onDrop?.(gesture.from,square.dataset.square);
  }
  const pos=s=>({x:files.indexOf(s[0])*12.5+6.25,y:ranks.indexOf(Number(s[1]))*12.5+6.25});
  const arrow=(uci,type)=>{if(!uci)return null;const a=pos(uci.slice(0,2)),b=pos(uci.slice(2,4));return <line className={`${type}-arrow`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={`url(#${markerId}-${type}-head)`}/>;};
  return <div className={`board ${onDrop?'draggable-board':''}`} onPointerDown={startDrag} onPointerMove={moveDrag}
    onPointerUp={finishDragEvent=>finishDrag(finishDragEvent)} onPointerCancel={e=>finishDrag(e,true)}
    onLostPointerCapture={e=>finishDrag(e,true)} style={{'--move-color':GRADE_COLORS[grade]||'#6d9fe2','--better-color':GRADE_COLORS.Best}} role={onSquare?'group':'img'} aria-label={`${onSquare?'Puzzle position':'Position after the selected move'}. ${board.turn()==='w'?'White':'Black'} to move${grade?`. Last move: ${grade}`:''}.`}>
    {ranks.flatMap((rank,y)=>files.map((file,x)=>{const square=file+rank,piece=board.get(square),from=played?.slice(0,2)===square,to=played?.slice(2,4)===square,suggested=best?.slice(2,4)===square;return <Square key={square} onClick={onSquare?event=>{if(event.detail&&ignoreClick.current){ignoreClick.current=false;return;}onSquare(square);}:undefined} aria-pressed={onSquare?selected===square:undefined} className={`square ${(x+y)%2?'dark':'light'} ${from?'move-from':''} ${to?'move-to':''} ${suggested?'suggested-square':''} ${selected===square?'puzzle-selected':''} ${targets.includes(square)?'puzzle-target':''}`} data-square={square} data-played={to?'destination':from?'origin':undefined} aria-label={`${square}${piece?` ${piece.color==='w'?'white':'black'} ${NAMES[piece.type]}`:''}`}>
      {x===0&&<span className="rank">{rank}</span>}{y===7&&<span className="file">{file}</span>}{piece&&lifted?.from!==square&&<ChessPiece type={piece.type} color={piece.color}/>}{to&&grade&&<span className={`board-grade ${grade.toLowerCase()}`} aria-label={`${grade} on ${square}`} title={grade}>{MARKS[grade]}</span>}
    </Square>;}))}
    <svg className="board-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id={`${markerId}-played-head`} markerWidth="3.2" markerHeight="3.2" refX="2.6" refY="1.6" orient="auto"><path d="M0 0 3.2 1.6 0 3.2Z" fill="var(--move-color)"/></marker><marker id={`${markerId}-better-head`} markerWidth="3.6" markerHeight="3.6" refX="2.8" refY="1.8" orient="auto"><path d="M0 0 3.6 1.8 0 3.6Z" fill="var(--better-color)"/></marker></defs>{arrow(played,'played')}{arrow(best,'better')}</svg>
    {onSquare&&<div ref={ghost} className="board-drag-piece" aria-hidden="true">{lifted&&<ChessPiece type={lifted.piece.type} color={lifted.piece.color}/>}</div>}
  </div>;
}
export function Player({player,color,isYou}){return <div className="player"><span className={`avatar ${color==='w'?'white-avatar':''}`}><ChessPiece type="k" color={color}/></span><strong>{player?.username||'…'}{isYou&&<small>YOU</small>}</strong><span className="rating">{player?.rating||'—'}</span><span className="side">{color==='w'?'White':'Black'}</span></div>;}
