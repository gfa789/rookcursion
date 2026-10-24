import React from 'react';
import {Chess} from 'chess.js';
export const GRADES=['Book','Brilliant','Best','Excellent','Good','Inaccuracy','Mistake','Blunder'];
export const MARKS={Book:'▤',Brilliant:'!!',Best:'★',Excellent:'✓',Good:'•',Inaccuracy:'?!',Mistake:'?',Blunder:'??'};
const PIECES={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'},NAMES={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
function Pawn({color}){return <svg className="piece pawn-piece" viewBox="0 0 45 45" aria-label={`${color==='w'?'White':'Black'} pawn`} data-piece-color={color} fill={color==='w'?'#fffdf0':'#26352b'} stroke={color==='w'?'#35442e':'#142319'} strokeWidth="1.4" strokeLinejoin="round"><circle cx="22.5" cy="10" r="5.5"/><path d="M17.5 16h10l-2 5v7l5 6h-16l5-6v-7Z"/><path d="M13 34h19l2 5H11Z"/></svg>;}
export function Board({fen,flipped,played,best,grade}){
  const board=new Chess(fen),files=(flipped?'hgfedcba':'abcdefgh').split(''),ranks=flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1];
  const pos=s=>({x:files.indexOf(s[0])*12.5+6.25,y:ranks.indexOf(Number(s[1]))*12.5+6.25});
  const arrow=(uci,type)=>{if(!uci)return null;const a=pos(uci.slice(0,2)),b=pos(uci.slice(2,4));return <line className={`${type}-arrow`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} markerEnd={`url(#${type}-head)`}/>;};
  return <div className="board" role="img" aria-label={`Position after the selected move. ${board.turn()==='w'?'White':'Black'} to move${grade?`. Last move: ${grade}`:''}.`}>
    {ranks.flatMap((rank,y)=>files.map((file,x)=>{const square=file+rank,piece=board.get(square),from=played?.slice(0,2)===square,to=played?.slice(2,4)===square,suggested=best?.slice(2,4)===square;return <div key={square} className={`square ${(x+y)%2?'dark':'light'} ${from?'move-from':''} ${to?'move-to':''} ${suggested?'suggested-square':''}`} data-square={square} data-played={to?'destination':from?'origin':undefined} aria-label={`${square}${piece?` ${piece.color==='w'?'white':'black'} ${NAMES[piece.type]}`:''}`}>
      {x===0&&<span className="rank">{rank}</span>}{y===7&&<span className="file">{file}</span>}{piece&&(piece.type==='p'?<Pawn color={piece.color}/>:<span className={`piece ${piece.color==='w'?'white-piece':'black-piece'}`}>{PIECES[piece.type]+'\uFE0E'}</span>)}{to&&grade&&<span className={`board-grade ${grade.toLowerCase()}`} aria-label={`${grade} on ${square}`} title={grade}>{MARKS[grade]}</span>}
    </div>;}))}
    <svg className="board-arrows" viewBox="0 0 100 100" aria-hidden="true"><defs><marker id="played-head" markerWidth="3.2" markerHeight="3.2" refX="2.6" refY="1.6" orient="auto"><path d="M0 0 3.2 1.6 0 3.2Z" fill="#6d9fe2"/></marker><marker id="better-head" markerWidth="3.6" markerHeight="3.6" refX="2.8" refY="1.8" orient="auto"><path d="M0 0 3.6 1.8 0 3.6Z" fill="#f4c16d"/></marker></defs>{arrow(played,'played')}{arrow(best,'better')}</svg>
  </div>;
}
export function Player({player,color,isYou}){return <div className="player"><span className={`avatar ${color==='w'?'white-avatar':''}`}>{color==='w'?'♔':'♚'}</span><strong>{player?.username||'…'}{isYou&&<small>YOU</small>}</strong><span className="rating">{player?.rating||'—'}</span><span className="side">{color==='w'?'White':'Black'}</span></div>;}
