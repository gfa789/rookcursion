import {Chess} from 'chess.js';
import {mistakeTheme,phaseOf} from './insights.js';
import {expectedScore,sanLine,explain} from './grading.js';
import {randomUUID} from 'node:crypto';
import {openingLessons,trainingIdea} from './learning.js';

const uciMove=(board,uci)=>board.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
export function puzzleCandidates(entries){
  const candidates=[],counts={};
  for(const {game,review} of entries){
    const rows=review.rows.filter(r=>r.color===game.color&&['Mistake','Blunder'].includes(r.classification)&&r.bestUci!==r.uci);
    for(const row of rows){const theme=mistakeTheme(row);counts[theme]=(counts[theme]||0)+1;}
    for(const row of rows.sort((a,b)=>b.lossCp-a.lossCp).slice(0,3)){
      const theme=mistakeTheme(row);
      candidates.push({id:`${game.id}:${row.index}:v2`,gameId:game.id,index:row.index,ended:game.ended,opponent:game.opponent,timeClass:game.timeClass,color:game.color,fen:row.fenBefore,theme,phase:phaseOf(row),row});
    }
  }
  const newest=Math.max(0,...candidates.map(p=>p.ended));
  // Recency matters more than raw frequency; recurring themes break ties.
  candidates.sort((a,b)=>(Math.exp(-(newest-b.ended)/86400/45)*5+Math.log1p(counts[b.theme]))-(Math.exp(-(newest-a.ended)/86400/45)*5+Math.log1p(counts[a.theme])));
  // Round robin themes so a session does not become the same exercise repeatedly.
  const groups=new Map();for(const p of candidates){if(!groups.has(p.theme))groups.set(p.theme,[]);groups.get(p.theme).push(p);}
  const balanced=[];while([...groups.values()].some(g=>g.length))for(const g of groups.values())if(g.length)balanced.push(g.shift());
  return {candidates:balanced,themes:Object.entries(counts).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count)};
}

export function validatedPuzzle(candidate,lines){
  const [best,second]=lines;
  if(!best||!second||best.depth<14||second.depth<14||best.best===candidate.row.uci||best.cp < -400)return null;
  // Skip ambiguous choices and positions where several moves force mate.
  if(candidate.kind!=='opening'&&(best.cp-second.cp<120||(best.mate>0&&second.mate>0)||expectedScore(best.cp)-expectedScore(second.cp)<.06))return null;
  try{
    const board=new Chess(candidate.fen),move=uciMove(board,best.best);
    if(!move||board.isStalemate())return null;
    const line=sanLine(candidate.fen,best.pv,6);
    const explanation=explain(candidate.fen,{...move,after:board.fen()},{...candidate.row,uci:best.best,bestUci:best.best,classification:'Best',beforeMate:best.mate,afterMate:best.mate===null?null:Math.max(0,best.mate-1)});
    const {row,...puzzle}=candidate;
    return {...puzzle,solution:best.best,san:move.san,after:board.fen(),pv:best.pv.slice(0,line.length),line,explanation,originalSan:row.san,originalExplanation:row.explanation,depth:14};
  }catch{return null;}
}

export function publicPuzzle(puzzle){
  return {id:puzzle.id,fen:puzzle.fen,color:puzzle.color,theme:puzzle.theme,phase:puzzle.phase,timeClass:puzzle.timeClass,opponent:puzzle.opponent,ended:puzzle.ended,totalMoves:puzzle.steps.length,idea:trainingIdea(puzzle),opening:puzzle.opening,openingFamily:puzzle.openingFamily,occurrences:puzzle.occurrences};
}

async function engineStep(fen,engine){
  const best=(await engine.evaluateMulti(fen,14))[0];
  if(!best||best.depth<14)throw new Error('The engine could not check the continuation. Please retry.');
  const board=new Chess(fen),move=uciMove(board,best.best),playerFen=board.fen();
  const explanation=explain(fen,{...move,after:playerFen},{uci:best.best,bestUci:best.best,classification:'Best',beforeMate:best.mate,afterMate:null});
  let reply=null,replySan=null;
  if(!board.isGameOver()){
    reply=best.pv[1]||(await engine.evaluate(playerFen,14)).best;
    replySan=uciMove(board,reply).san;
  }
  return {fen,solution:best.best,san:move.san,playerFen,reply,replySan,nextFen:board.fen(),cp:best.cp,mate:best.mate,explanation};
}
export async function sequencePuzzle(puzzle,engine){
  const steps=[];let fen=puzzle.fen;
  for(let n=0;n<3;n++){
    const step=await engineStep(fen,engine);steps.push(step);fen=step.nextFen;
    if(new Chess(fen).isGameOver())break;
  }
  if(steps.length<2)return null;
  return {...puzzle,solution:steps[0].solution,steps,sequenceVersion:2};
}

export class PuzzleService{
  constructor({db,engine}){
    this.db=db;this.engine=engine;this.generating=false;this.checked=0;this.error=null;this.lastGenerated=new Map();this.sessionLocks=new Set();this.lessonCache=new Map();
    db.exec(`CREATE TABLE IF NOT EXISTS puzzles(id TEXT PRIMARY KEY,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS puzzle_checks(id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS puzzle_sessions(id TEXT PRIMARY KEY,puzzleId TEXT NOT NULL,body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS puzzle_progress(id TEXT PRIMARY KEY,attempts INTEGER DEFAULT 0,solved INTEGER DEFAULT 0,assisted INTEGER DEFAULT 0,last INTEGER DEFAULT 0,due INTEGER DEFAULT 0);`);
  }
  recent(scope='all'){
    return this.db.prepare(`SELECT g.body game,r.body review FROM games g JOIN reviews r ON r.id=g.id ${scope==='all'?'':"WHERE json_extract(g.body,'$.timeClass')=?"} ORDER BY g.ended DESC LIMIT 80`).all(...(scope==='all'?[]:[scope])).map(r=>({game:JSON.parse(r.game),review:JSON.parse(r.review)}));
  }
  lessons(scope='all'){
    const signature=this.db.prepare('SELECT COUNT(*) count,MAX(rowid) latest FROM reviews').get(),key=`${scope}:${signature.count}:${signature.latest}`;
    if(this.lessonCache.has(key))return this.lessonCache.get(key);
    const records=this.db.prepare(`SELECT g.id,g.ended,json_extract(g.body,'$.color') color,json_extract(g.body,'$.timeClass') timeClass,json_extract(g.body,'$.opponent') opponent,json_extract(g.body,'$.opening') opening,m.value move FROM games g JOIN reviews r ON r.id=g.id JOIN json_each(r.body,'$.rows') m WHERE (?='all' OR json_extract(g.body,'$.timeClass')=?) AND json_extract(m.value,'$.ply') BETWEEN 1 AND 24 AND json_extract(m.value,'$.color')=json_extract(g.body,'$.color') AND json_extract(m.value,'$.classification') IN ('Inaccuracy','Mistake','Blunder')`).all(scope,scope).map(({move,...game})=>({game,row:JSON.parse(move)}));
    const result=openingLessons(records);if(this.lessonCache.size>8)this.lessonCache.clear();this.lessonCache.set(key,result);return result;
  }
  pool(scope='all',mode='puzzles'){
    return this.db.prepare('SELECT p.body,s.attempts,s.solved,s.assisted,s.last,s.due FROM puzzles p LEFT JOIN puzzle_progress s ON s.id=p.id').all().map(r=>({...r,puzzle:JSON.parse(r.body)})).filter(r=>r.puzzle.sequenceVersion===2&&(mode==='learn'?r.puzzle.kind==='opening':r.puzzle.kind!=='opening')&&(scope==='all'||r.puzzle.timeClass===scope));
  }
  async generate(scope,mode='puzzles',theme='all'){
    const generationKey=`${mode}:${scope}:${theme}`;
    if(this.generating||Date.now()-(this.lastGenerated.get(generationKey)||0)<60000)return;
    this.generating=true;this.error=null;this.checked=0;
    try{
      const {candidates}=mode==='learn'?this.lessons(scope):puzzleCandidates(this.recent(scope));let added=0;
      for(const candidate of candidates){
        if(theme!=='all'&&candidate.theme!==theme)continue;
        if(this.db.prepare('SELECT id FROM puzzle_checks WHERE id=?').get(candidate.id))continue;
        const lines=await this.engine.evaluateMulti(candidate.fen,14),initial=validatedPuzzle(candidate,lines);
        const puzzle=initial?await sequencePuzzle(initial,this.engine):null;
        this.db.prepare('INSERT OR IGNORE INTO puzzle_checks VALUES (?)').run(candidate.id);this.checked++;
        if(puzzle){this.db.prepare('INSERT OR IGNORE INTO puzzles VALUES (?,?)').run(puzzle.id,JSON.stringify(puzzle));added++;}
        if(added>=12||this.checked>=48)break;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
    }catch(error){this.error=error.message;}finally{this.generating=false;this.lastGenerated.set(generationKey,Date.now());}
  }
  get(id){const row=this.db.prepare('SELECT body FROM puzzles WHERE id=?').get(id);return row?JSON.parse(row.body):null;}
  next({scope='all',theme='all',exclude='',mode='puzzles'}){
    this.generate(scope,mode,theme).catch(()=>{});
    const recent=mode==='learn'?null:this.recent(scope),sample=mode==='learn'?this.lessons(scope):puzzleCandidates(recent),{themes}=sample,pool=this.pool(scope,mode),now=Date.now();
    const options=pool.filter(r=>(theme==='all'||r.puzzle.theme===theme)&&r.puzzle.id!==exclude);
    // Unsolved / previously missed positions first; successful ones return in a week.
    options.sort((a,b)=>Number((a.due||0)>now)-Number((b.due||0)>now)||(a.last||0)-(b.last||0)||b.puzzle.ended-a.puzzle.ended);
    const selected=options.find(r=>!r.due||r.due<=now);
    return {puzzle:selected?publicPuzzle(selected.puzzle):null,themes,stats:{available:pool.length,solved:pool.filter(r=>r.solved).length,clean:pool.filter(r=>r.solved&&!r.assisted&&r.attempts===1).length},generating:this.generating,checked:this.checked,error:this.error,reviewedGames:recent?.length??sample.reviewedGames,waiting:!!options.length&&!selected};
  }
  progress(id){return this.db.prepare('SELECT * FROM puzzle_progress WHERE id=?').get(id)||{id,attempts:0,solved:0,assisted:0,last:0,due:0};}
  save(p){this.db.prepare('INSERT OR REPLACE INTO puzzle_progress VALUES (?,?,?,?,?,?)').run(p.id,p.attempts,p.solved,p.assisted,p.last,p.due);}
  saveSession(session){this.db.prepare('INSERT OR REPLACE INTO puzzle_sessions VALUES (?,?,?)').run(session.id,session.puzzleId,JSON.stringify(session));}
  async answer(id,body){
    const lock=body.sessionId;
    if(lock&&this.sessionLocks.has(lock))return {error:'Your previous move is still being checked.',status:409};
    if(lock)this.sessionLocks.add(lock);
    try{return await this.answerSession(id,body);}finally{if(lock)this.sessionLocks.delete(lock);}
  }
  async answerSession(id,{move,action,sessionId,step}){
    const puzzle=this.get(id);if(!puzzle)return {error:'Puzzle not found.',status:404};
    if(puzzle.sequenceVersion!==2)return {error:'This puzzle has been upgraded. Load the next puzzle.',status:409};
    if(action==='start'){
      const session={id:randomUUID(),puzzleId:id,fen:puzzle.fen,step:0,played:[],sans:[],ideas:[],assisted:false,mistakes:0,complete:false};this.saveSession(session);
      return {sessionId:session.id,fen:session.fen,completedMoves:0,totalMoves:puzzle.steps.length};
    }
    const p=this.progress(id);
    if(p.last&&p.due<=Date.now()){p.attempts=0;p.solved=0;p.assisted=0;}
    if(action==='skip'){if(!p.solved){p.last=Date.now();p.due=p.last+10*60000;this.save(p);}return {skipped:true};}
    const record=this.db.prepare('SELECT body FROM puzzle_sessions WHERE id=? AND puzzleId=?').get(String(sessionId||''),id);
    if(!record)return {error:'Start this puzzle again to continue.',status:409};
    const session=JSON.parse(record.body);
    session.ideas??=session.played.map(()=>puzzle.steps[0].explanation);
    if(session.complete)return session.result;
    if(step!==session.step)return {error:'This move has already been processed. Restart the puzzle to continue.',status:409};
    let current=puzzle.steps[session.step];
    if(current?.fen!==session.fen)current=await engineStep(session.fen,this.engine);
    if(action==='hint'){
      p.assisted=1;session.assisted=true;this.save(p);this.saveSession(session);
      return {hint:`Try the piece on ${current.solution.slice(0,2)}.`,from:current.solution.slice(0,2)};
    }
    const reveal=action==='reveal';
    const board=new Chess(session.fen);let playedMove,afterEval;
    if(!reveal){try{playedMove=uciMove(board,String(move));}catch{return {error:'Choose a legal move.',status:400};}}
    let correct=!reveal&&move===current.solution;
    if(!reveal&&!correct){
      afterEval=board.isCheckmate()?{cp:-100000,mate:0}:board.isDraw()?{cp:0,mate:null}:await this.engine.evaluate(board.fen(),14);
      const cp=-afterEval.cp;
      // Keep equally strong continuations playable instead of demanding one PV.
      correct=(current.mate>0?afterEval.mate!==null&&afterEval.mate<=0:cp>=current.cp-60&&expectedScore(current.cp)-expectedScore(cp)<=.025);
    }
    p.attempts=Math.max(1,p.attempts);p.last=Date.now();p.due=p.last+10*60000;
    if(!correct&&!reveal){p.attempts++;session.mistakes++;this.save(p);this.saveSession(session);return {correct:false,complete:false,message:'Not quite. Try again.'};}
    if(reveal){
      p.assisted=1;session.assisted=true;
      for(let n=session.step;n<puzzle.steps.length;n++){
        let next=puzzle.steps[n];if(next.fen!==session.fen)next=await engineStep(session.fen,this.engine);
        session.played.push(next.solution);session.sans.push(next.san);session.ideas.push(next.explanation);session.fen=next.playerFen;
        if(n<puzzle.steps.length-1&&next.reply){session.played.push(next.reply);session.sans.push(next.replySan);session.ideas.push(`Your opponent replies ${next.replySan}.`);session.fen=next.nextFen;}
        if(new Chess(session.fen).isGameOver())break;
      }
      session.complete=true;
    }else{
      const playerFen=board.fen(),explanation=move===current.solution?current.explanation:explain(session.fen,{...playedMove,after:playerFen},{uci:move,bestUci:move,classification:'Best',beforeMate:current.mate,afterMate:null});session.played.push(move);session.sans.push(playedMove.san);session.ideas.push(explanation);session.step++;
      const complete=session.step>=puzzle.steps.length||board.isGameOver();
      let reply=null,replySan=null;
      if(!complete){reply=move===current.solution?current.reply:afterEval?.best;if(!reply)reply=(await this.engine.evaluate(playerFen,14)).best;replySan=uciMove(board,reply).san;session.played.push(reply);session.sans.push(replySan);session.ideas.push(`Your opponent replies ${replySan}.`);}
      session.fen=board.fen();session.complete=complete||board.isGameOver();
      if(!session.complete){this.save(p);this.saveSession(session);return {correct:true,complete:false,playerFen,playerMove:move,reply,replySan,fen:session.fen,completedMoves:session.step,totalMoves:puzzle.steps.length,explanation};}
      p.solved=1;p.assisted=Number(!!p.assisted||session.assisted);p.due=!p.assisted&&p.attempts===1?p.last+7*86400000:p.last+10*60000;
    }
    session.result={correct:!reveal,complete:true,assisted:!!p.assisted,fen:session.fen,completedMoves:session.step,totalMoves:puzzle.steps.length,pv:session.played,line:session.sans,ideas:session.ideas,explanation:puzzle.steps[0].explanation,originalSan:puzzle.originalSan,originalExplanation:puzzle.originalExplanation,gameId:puzzle.gameId,index:puzzle.index};
    this.save(p);this.saveSession(session);return session.result;
  }
}
