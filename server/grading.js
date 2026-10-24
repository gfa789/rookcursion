import { Chess } from 'chess.js';

export const VERSION = 'stockfish-review-v1';
export const VALUES = {p:1,n:3,b:3.25,r:5,q:9,k:0};
export function expectedScore(cp) { return 1 / (1 + Math.exp(-cp / 250)); }
export function classify({best, played, before, after, sacrifice=false}) {
  const loss = Math.max(0, expectedScore(before)-expectedScore(after));
  if (best === played) return sacrifice && before > -80 && after > -80 ? 'Brilliant' : 'Best';
  if (loss < .015) return 'Excellent';
  if (loss < .045) return 'Good';
  if (loss < .10) return 'Inaccuracy';
  if (loss < .22) return 'Mistake';
  return 'Blunder';
}
export function sanLine(fen, pv, limit=8) {
  const board = new Chess(fen), result=[];
  for (const uci of pv.slice(0,limit)) {
    try { const move=board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]}); if(!move) break; result.push(move.san); } catch { break; }
  }
  return result;
}
export function material(board, color) {
  return board.board().flat().filter(Boolean).reduce((v,p)=>v+(p.color===color?1:-1)*VALUES[p.type],0);
}
// Conservative, explicit approximation: an accurate material investment which the
// opponent's principal reply actually accepts, and which remains sound afterward.
export function isSacrifice(fen, played, replyPv, before, after) {
  if(before < -80 || after < -80) return false;
  const board=new Chess(fen), color=board.turn(), initial=material(board,color);
  try {
    board.move({from:played.slice(0,2),to:played.slice(2,4),promotion:played[4]});
    const reply=replyPv[0]; if(!reply) return false;
    const capture=board.move({from:reply.slice(0,2),to:reply.slice(2,4),promotion:reply[4]});
    return Boolean(capture.captured) && initial-material(board,color)>=2;
  } catch { return false; }
}
const NAMES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const enemy=c=>c==='w'?'b':'w';
const playUci=(board,uci)=>board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});

// These comments are grounded in legal moves and board features. They describe
// verified ideas rather than asking a language model to guess a move's purpose.
function idea(fen,uci) {
  const board=new Chess(fen), piece=board.get(uci.slice(0,2));
  if(!piece)return '';
  const opponent=enemy(piece.color), threatened=board.isAttacked(uci.slice(0,2),opponent);
  const move=playUci(board,uci), name=NAMES[move.piece], captured=NAMES[move.captured];
  if(move.san.includes('#'))return `${move.san} finishes the attack with checkmate.`;
  if(move.promotion)return `${move.san} turns your pawn into a ${NAMES[move.promotion]}.`;
  if(move.isKingsideCastle()||move.isQueensideCastle())return `${move.san} tucks your king away and brings a rook closer to the centre.`;
  if(move.captured){
    const advanced=move.captured==='p'&&((opponent==='w'&&Number(move.to[1])>=5)||(opponent==='b'&&Number(move.to[1])<=4));
    return `${move.san} ${advanced?'removes the advanced pawn before it can get closer to promotion':`takes the ${captured} on ${move.to}`}${move.san.includes('+')?' with check, so your opponent must deal with their king first':''}.`;
  }
  if(move.san.includes('+'))return `${move.san} gives check, making your opponent answer the threat to their king before carrying out their own plan.`;
  if(threatened&&!board.isAttacked(move.to,opponent))return `${move.san} gets your attacked ${name} out of danger.`;
  const forkTargets=board.board().flat().filter(p=>p&&p.color===opponent&&VALUES[p.type]>=3&&board.attackers(p.square,piece.color).includes(move.to));
  if(forkTargets.length>=2)return `${move.san} attacks the ${NAMES[forkTargets[0].type]} on ${forkTargets[0].square} and ${NAMES[forkTargets[1].type]} on ${forkTargets[1].square} at the same time.`;
  const target=forkTargets.find(p=>VALUES[p.type]>VALUES[move.piece]);
  if(target)return `${move.san} challenges their ${NAMES[target.type]} on ${target.square} with your less valuable ${name}.`;
  if(['n','b'].includes(move.piece)&&move.from[1]===(piece.color==='w'?'1':'8'))return `${move.san} develops your ${name} off the back rank, bringing another piece into the game.`;
  if(['d4','e4','d5','e5'].includes(move.to))return `${move.san} puts your ${name} in the centre, where it can influence more of the board.`;
  const defended=board.board().flat().filter(p=>p&&p.color===piece.color&&VALUES[p.type]>=1&&board.isAttacked(p.square,opponent)&&board.attackers(p.square,piece.color).includes(move.to));
  if(defended.length)return `${move.san} adds a defender to your ${NAMES[defended[0].type]} on ${defended[0].square}, which is under attack.`;
  if(move.piece==='r'){
    const pawns=board.board().flat().filter(p=>p&&p.type==='p'&&p.square[0]===move.to[0]);
    if(!pawns.some(p=>p.color===piece.color))return `${move.san} puts your rook on ${pawns.length?'a half-open':'an open'} file, with no friendly pawn blocking that file.`;
  }
  return `${move.san} is the engine's preferred way to continue. Play through the suggested line to see how the position develops.`;
}
export function explain(fen,move,row) {
  if(row.classification==='Book')return `${move.san} is a recognised book move${row.opening?.name?` in the ${row.opening.name}`:''}. You’re following established opening theory.`;
  const parts=[],isBest=row.bestUci===row.uci;
  const introductions={Brilliant:`A bold find! ${move.san} invests material while keeping a sound position.`,Best:`Nice find — ${move.san} is the strongest move here.`,Excellent:`${move.san} is excellent — very close to the strongest move.`,Good:`${move.san} is a reasonable move, but there is a stronger option.`,Inaccuracy:`${move.san} gives away a little of your position.`,Mistake:`${move.san} lets a useful opportunity slip away.`,Blunder:`${move.san} gives your opponent a big opportunity.`};
  parts.push(introductions[row.classification]||`${move.san} has been reviewed.`);
  if(!isBest){
    if(row.afterMate!==null&&row.afterMate<0)parts.push(`It allows a forced mate in ${Math.abs(row.afterMate)}.`);
    else {
      const board=new Chess(move.after);
      try{
        const reply=board.move(row.replyLine?.[0]);
        if(reply?.captured)parts.push(`They can play ${reply.san}, taking your ${NAMES[reply.captured]}${reply.san.includes('+')?' with check':''}.`);
        else if(reply?.san.includes('+'))parts.push(`Their reply ${reply.san} comes with check.`);
        else if(row.beforeMate!==null&&row.beforeMate>0&&row.afterMate===null)parts.push('It misses a forced mating sequence.');
      }catch{/* A missing principal reply never becomes a fabricated tactic. */}
    }
  }
  const suggestion=idea(fen,row.bestUci);
  if(suggestion)parts.push(isBest?suggestion:`Instead, ${suggestion}`);
  return parts.join(' ');
}
