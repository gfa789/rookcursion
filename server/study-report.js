const resultKeys=['win','draw','loss'];
const windows=['Moves 1–10','Moves 11–20','Moves 21–30','Moves 31+'];
const cohortSize=50;

function mistakeRate(games){
  let moves=0,errors=0;
  for(const game of games){
    moves+=game.ownMoves;
    errors+=(game.counts.Mistake??0)+(game.counts.Blunder??0);
  }
  return {games:games.length,moves,errors,rate:moves?100*errors/moves:null};
}

// Facts arrive oldest first, already filtered by period and time control.
export function buildStudyReport(facts){
  const reviewed=facts.filter(game=>game.reviewed&&game.ownMoves>0);
  const controls=[...new Set(facts.map(game=>game.timeClass))];
  const ratings=controls.map(control=>{
    const games=facts.filter(game=>game.timeClass===control&&game.rated&&Number.isFinite(game.rating));
    const stride=Math.max(1,Math.ceil(games.length/100));
    const points=games.flatMap((game,index)=>index%stride===0||index===games.length-1?
      [{rating:game.rating,ended:game.ended,game:index+1}]:[]);
    return {control,games:games.length,points,
      change:games.length>1?games.at(-1).rating-games[0].rating:null,
      peak:games.reduce((peak,game)=>Math.max(peak,game.rating),0)};
  }).filter(series=>series.games).sort((a,b)=>b.games-a.games);

  const openingGroups=new Map();
  for(const game of facts){
    if(!resultKeys.includes(game.result))continue;
    const name=game.opening.split(':')[0],key=JSON.stringify([name,game.color]);
    const row=openingGroups.get(key)??{key,name,color:game.color,games:0,win:0,draw:0,loss:0,moves:0,errors:0};
    openingGroups.set(key,row);
    row.games++;
    row[game.result]++;
    const phase=game.reviewed&&game.phases.Opening;
    row.moves+=phase?.moves??0;
    row.errors+=phase?.errors??0;
  }
  const openings=[...openingGroups.values()].sort((a,b)=>b.games-a.games||a.name.localeCompare(b.name));

  const patterns=new Map();
  const firstErrors=Object.fromEntries(windows.map(name=>[name,0]));
  let timingGames=0,clean=0;
  for(const game of reviewed){
    for(const [name,theme] of Object.entries(game.themes)){
      const row=patterns.get(name)??{name,games:0,count:0,impact:0};
      patterns.set(name,row);
      row.games++;
      row.count+=theme.count;
      row.impact+=theme.impact;
    }
    if(game.decisions){
      timingGames++;
      const window=game.decisions.firstError?.window;
      if(window in firstErrors)firstErrors[window]++;
      else clean++;
    }
  }
  // Keep the mix of time controls out of the recent-vs-previous comparison.
  const comparisons=controls.map(control=>{
    const games=reviewed.filter(game=>game.timeClass===control);
    return {control,available:games.length,
      recent:mistakeRate(games.slice(-cohortSize)),
      previous:games.length>=cohortSize*2?mistakeRate(games.slice(-cohortSize*2,-cohortSize)):null};
  }).sort((a,b)=>b.available-a.available);
  return {total:facts.length,reviewed:reviewed.length,ratings,openings,comparisons,
    timing:{games:timingGames,rows:[...windows.map(name=>({name,count:firstErrors[name]})),{name:'No major error',count:clean}]},
    patterns:[...patterns.values()].sort((a,b)=>b.games-a.games||b.impact-a.impact)};
}
