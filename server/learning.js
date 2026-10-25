const eligible=new Set(['Inaccuracy','Mistake','Blunder']);
const positionKey=fen=>fen.split(' ').slice(0,4).join(' ');

// Repeated positions and opening families are counted across reviewed history,
// independently of the recent tactical-puzzle sample.
export function openingLessons(records){
  const positions=new Map(),families=new Map(),games=new Set();
  for(const {game,row} of records){
    if(row.color!==game.color||row.ply<1||row.ply>24||!eligible.has(row.classification)||row.uci===row.bestUci)continue;
    games.add(game.id);
    const opening=row.opening?.name||game.opening||'Unclassified opening';
    const family=opening.split(':')[0],theme=`${family} · ${game.color==='w'?'White':'Black'}`;
    families.set(theme,(families.get(theme)||0)+1);
    const key=positionKey(row.fenBefore),entry=positions.get(key);
    if(entry){entry.games.add(game.id);if(game.ended>entry.game.ended){entry.game=game;entry.row=row;}continue;}
    positions.set(key,{game,row,opening,family,theme,games:new Set([game.id])});
  }
  const candidates=[...positions.values()].map(({game,row,opening,family,theme,games})=>({
    id:`${game.id}:${row.index}:learn-v1`,kind:'opening',gameId:game.id,index:row.index,ended:game.ended,opponent:game.opponent,timeClass:game.timeClass,color:game.color,fen:row.fenBefore,theme,phase:'Opening',opening,openingFamily:family,eco:row.opening?.eco||null,occurrences:games.size,openingMistakes:families.get(theme),row,
  })).sort((a,b)=>b.occurrences-a.occurrences||b.openingMistakes-a.openingMistakes||b.ended-a.ended);
  return {candidates,themes:[...families].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),reviewedGames:games.size};
}

export function trainingIdea(puzzle){
  if(puzzle.kind==='opening')return puzzle.occurrences>1?`You’ve misplayed this position in ${puzzle.occurrences} games. Find a stronger continuation in your ${puzzle.openingFamily}.`:`Revisit a position you misplayed in your ${puzzle.openingFamily}. Find a stronger continuation.`;
  if(puzzle.theme==='Allowed a forced mate')return 'Check your opponent’s threats and keep your king safe.';
  if(puzzle.theme.includes('piece captures'))return 'Look for threats to your pieces, then check for forcing moves of your own.';
  if(puzzle.theme.includes('pawn captures'))return 'Check which pawns are under pressure and look for an active response.';
  if(puzzle.theme.includes('checking'))return 'Look for forcing checks and the follow-up they make possible.';
  if(puzzle.phase==='Endgame')return 'Look for an active king, useful pawn moves and concrete threats.';
  if(puzzle.phase==='Opening')return 'Look for active development, central control and king safety.';
  return 'Look for forcing moves and your opponent’s threats before choosing a plan.';
}
