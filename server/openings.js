import {readFileSync} from 'node:fs';
import {Chess} from 'chess.js';
import {expectedScore,explain} from './grading.js';

const data=JSON.parse(readFileSync(new URL('./book/openings.json',import.meta.url),'utf8'));
export const BOOK_VERSION=`lichess-${data.revision}-v1`;
const edges=new Set(data.edges),positions=data.positions,bookPositions=data.bookPositions;
export const positionKey=fen=>fen.split(' ').slice(0,4).join(' ');
export function openingMoves(history){
  let opening=null;
  return history.map(move=>{
    const uci=move.uci||move.from+move.to+(move.promotion||''),after=move.fenAfter||move.after,before=move.fenBefore||move.before;
    const named=positions[positionKey(after)]||bookPositions[positionKey(after)];
    if(named)opening={name:named.name,eco:named.eco};
    const book=edges.has(`${positionKey(before)}|${uci}`)||Object.hasOwn(bookPositions,positionKey(after));
    return {book,opening:opening?{...opening}:null,...(book?{classification:'Book',explanation:explain(before,{san:move.san},{classification:'Book',opening})}:{})};
  });
}
export function gameOpeningMoves(pgn){const board=new Chess();board.loadPgn(pgn);return openingMoves(board.history({verbose:true}));}
export function applyOpeningBook(review){
  const annotations=openingMoves(review.rows),counts={w:{},b:{}},scores={w:[],b:[]};
  review.rows.forEach((row,n)=>{
    const annotation=annotations[n];
    row.engineClassification??=row.classification;
    Object.assign(row,{book:annotation.book,opening:annotation.opening,classification:annotation.book?'Book':row.engineClassification});
    const move=new Chess(row.fenBefore).move({from:row.uci.slice(0,2),to:row.uci.slice(2,4),promotion:row.uci[4]});
    row.explanation=explain(row.fenBefore,move,row);
    counts[row.color][row.classification]=(counts[row.color][row.classification]||0)+1;
    scores[row.color].push(row.book||row.bestUci===row.uci?1:Math.min(1,Math.max(0,1-(expectedScore(row.beforeCp)-expectedScore(row.afterCp))*2)));
  });
  review.counts=counts;
  review.accuracy=Object.fromEntries(['w','b'].map(color=>[color,scores[color].length?Math.round(scores[color].reduce((a,b)=>a+b,0)/scores[color].length*100):null]));
  review.opening=annotations.at(-1)?.opening||null;
  review.bookVersion=BOOK_VERSION;
  return review;
}
