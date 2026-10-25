import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Chess } from 'chess.js';
import { Engine } from './engine.js';
import { VERSION, classify, expectedScore, isSacrifice, sanLine, explain } from './grading.js';
import {BOOK_VERSION,applyOpeningBook,gameOpeningMoves} from './openings.js';
import {BackgroundService} from './background.js';
import {aggregateInsights} from './insights.js';
import {PuzzleService} from './puzzles.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(path.join(dataDir,'chess.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, ended INTEGER NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
const app=express(),engine=new Engine(), jobs=new Map();
const username=process.env.CHESS_USERNAME||'', owner=process.env.TAILSCALE_OWNER||'',port=Number(process.env.PORT||8890),privatePort=Number(process.env.PRIVATE_PORT||8891);
if(!/^[a-zA-Z0-9_-]{1,100}$/.test(username)||!owner)throw new Error('Set CHESS_USERNAME and TAILSCALE_OWNER before starting.');
const token=randomBytes(32).toString('hex');
const insert=db.prepare('INSERT OR REPLACE INTO games VALUES (?,?,?)');
const storeReview=db.prepare('INSERT OR REPLACE INTO reviews VALUES (?,?)');
const getGame=id=>{const row=db.prepare('SELECT body FROM games WHERE id=?').get(id);return row?JSON.parse(row.body):null;};
const getReview=id=>{const row=db.prepare('SELECT body FROM reviews WHERE id=?').get(id);if(!row)return null;const review=JSON.parse(row.body);if(review.bookVersion!==BOOK_VERSION){applyOpeningBook(review);storeReview.run(id,JSON.stringify(review));}return review;};
const lastSync=()=>db.prepare("SELECT value FROM settings WHERE key='lastSync'").get()?.value||null;
const background=new BackgroundService({db,readReview:getReview,runReview:reviewGame,jobs,username});
const insightCache=new Map();
const puzzles=new PuzzleService({db,engine});
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  const host=req.headers.host||'';
  const isLocal=/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);
  // A dedicated Tailscale listener always requires identity, even if a caller
  // supplies a localhost Host header. Local preview uses a separate port.
  if((req.socket.localPort===privatePort||!isLocal)&&req.headers['tailscale-user-login']!==owner) return res.status(403).json({error:'Connect to Tailscale using your owner account to open this site.'});
  next();
});
// Tailscale forwards /chess/ unchanged. Relative client assets and API work at either URL.
app.use((req,res,next)=>{if(req.url==='/chess')return res.redirect(308,'/chess/');if(req.url.startsWith('/chess/'))req.url=req.url.slice(6);next();});
app.use(express.json({limit:'32kb'}));
app.use('/api', (req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method==='POST') {
    const supplied=Buffer.from(String(req.headers['x-review-token']||'')), expected=Buffer.from(token);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return res.status(403).json({error:'Please refresh the page and try again.'});
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({error:'Cross-origin requests are not allowed.'});
  }
  next();
});
app.get('/api/status',(req,res)=>res.json({username,token,lastSync:lastSync(),engine:'Stockfish 19 · local engine',explanations:'Free, engine-based',activeJob:background.active,background:background.status()}));
app.get('/api/games',(req,res)=>{
  const games=db.prepare('SELECT g.body,f.body fact FROM games g LEFT JOIN insight_facts f ON f.id=g.id ORDER BY g.ended DESC').all().map(row=>{const g=JSON.parse(row.body),fact=row.fact?JSON.parse(row.fact):null;return {...g,pgn:undefined,reviewed:!!fact?.reviewed,accuracy:fact?.quality!==null&&fact?.quality!==undefined?{[g.color]:fact.quality}:null};});
  res.json({games,lastSync:lastSync()});
});
app.post('/api/sync',async(req,res,next)=>{try{res.json(await background.pollRecent());}catch(error){next(error);}});
app.get('/api/insights',(req,res)=>{
  const scope=['all','rapid','blitz','bullet'].includes(req.query.scope)?req.query.scope:'all',pipeline=background.status();
  const cacheKey=scope+':'+pipeline.revision;let data=insightCache.get(cacheKey);
  if(!data){const facts=db.prepare('SELECT body FROM insight_facts').all().map(row=>JSON.parse(row.body));data=aggregateInsights(facts,scope);if(insightCache.size>8)insightCache.clear();insightCache.set(cacheKey,data);}
  res.json({...data,pipeline,generatedAt:new Date().toISOString()});
});
app.post('/api/background',(req,res)=>{
  if(typeof req.body.paused==='boolean')background.setPaused(req.body.paused);
  if(req.body.retryFailed===true)background.retryFailed();
  res.json(background.status());
});
app.get('/api/puzzles',(req,res)=>{
  const scope=['all','rapid','blitz','bullet'].includes(req.query.scope)?req.query.scope:'all';
  res.json(puzzles.next({scope,theme:String(req.query.theme||'all'),exclude:String(req.query.exclude||''),mode:req.query.mode==='learn'?'learn':'puzzles'}));
});
app.post('/api/puzzles/:id/answer',async(req,res,next)=>{try{
  const result=await puzzles.answer(req.params.id,req.body);
  res.status(result.status||200).json(result);
}catch(error){next(error);}});
app.get('/api/games/:id',(req,res)=>{const game=getGame(req.params.id);if(!game)return res.status(404).json({error:'Game not found.'});game.openingMoves=gameOpeningMoves(game.pgn);res.json({game,review:getReview(game.id),job:background.getJob(game.id)});});
app.get('/api/jobs/:id',(req,res)=>res.json(background.getJob(req.params.id)||{status:'idle'}));
async function reviewGame(game,job,depth) {
  const board=new Chess();board.loadPgn(game.pgn);
  const history=board.history({verbose:true});
  if(!history.length)throw new Error('This game has no moves to analyze.');
  const rows=[],counts={w:{},b:{}},scores={w:[],b:[]};
  const terminal=fen=>{
    const b=new Chess(fen);if(b.isCheckmate())return {cp:-100000,mate:0,pv:[],depth};
    if(b.isDraw())return {cp:0,mate:null,pv:[],depth};return null;
  };
  // One analysis of each position serves as both the preceding move's result and
  // the next move's baseline, keeping engine strength consistent on both sides.
  let before=terminal(history[0].before)||await engine.evaluate(history[0].before,depth);
  for(let i=0;i<history.length;i++) {
    const move=history[i], uci=move.from+move.to+(move.promotion||'');
    const after=terminal(move.after)||await engine.evaluate(move.after,depth);
    const bestUci=before.best&&before.best!=='(none)'?before.best:uci;
    const afterCp=-after.cp, afterMate=after.mate===null?null:-(after.mate||1);
    const bestLine=sanLine(move.before,before.pv),replyLine=sanLine(move.after,after.pv);
    const sacrifice=isSacrifice(move.before,uci,after.pv,before.cp,afterCp);
    const classification=classify({best:bestUci,played:uci,before:before.cp,after:afterCp,sacrifice});
    const row={index:i,ply:i+1,color:move.color,san:move.san,uci,fenBefore:move.before,fenAfter:move.after,bestUci,bestSan:sanLine(move.before,[bestUci])[0]||move.san,bestLine,bestPv:before.pv.slice(0,10),replyLine,classification,beforeCp:before.cp,afterCp,whiteCp:move.color==='w'?afterCp:-afterCp,lossCp:bestUci===uci?0:Math.max(0,before.cp-afterCp),beforeMate:before.mate,afterMate,depth:Math.min(before.depth,after.depth)};
    row.explanation=explain(move.before,move,row);
    rows.push(row);counts[move.color][classification]=(counts[move.color][classification]||0)+1;
    scores[move.color].push(bestUci===uci?1:Math.max(0,1-(expectedScore(before.cp)-expectedScore(afterCp))*2));
    job.completed=i+1;job.total=history.length;job.percent=Math.round((i+1)/history.length*100);job.move=move.san;
    before=after;
    await new Promise(r=>setImmediate(r));
  }
  const accuracy=Object.fromEntries(['w','b'].map(c=>[c,scores[c].length?Math.round(scores[c].reduce((a,b)=>a+b,0)/scores[c].length*100):null]));
  const review={version:VERSION,engine:'Stockfish 19 lite',depth,createdAt:new Date().toISOString(),initialFen:history[0].before,rows,counts,accuracy};
  applyOpeningBook(review);storeReview.run(game.id,JSON.stringify(review));job.status='complete';job.percent=100;
}
app.post('/api/games/:id/analyze',(req,res)=>{
  const game=getGame(req.params.id);if(!game)return res.status(404).json({error:'Game not found.'});
  const depth=[12,15,18].includes(req.body.depth)?req.body.depth:15;
  background.enqueue(game.id,{priority:100,depth,force:true});background.work().catch(error=>console.error(error.message));
  res.status(202).json(background.getJob(game.id));
});
app.get('/api/games/:id/pgn',(req,res)=>{const game=getGame(req.params.id);if(!game)return res.sendStatus(404);res.setHeader('Content-Disposition',`attachment; filename="game-${game.id.replace(/[^a-zA-Z0-9-]/g,'')}.pgn"`);res.type('text/plain').send(game.pgn);});
// Serve strips its /chess mount before forwarding, so both public /chess and
// /chess/ arrive as /. An explicit document base keeps assets and relative API
// requests under /chess/ even when the browser URL has no trailing slash.
app.get(['/', '/index.html'],(req,res,next)=>{
  const privateMount=req.socket.localPort===privatePort||/^\/chess(?:\/|$)/.test(req.originalUrl);
  try {
    const html=readFileSync(path.join(root,'dist/index.html'),'utf8');
    res.setHeader('Cache-Control','no-cache');
    res.type('html').send(html.replace('<head>',`<head><base href="${privateMount?'/chess/':'/'}">`));
  } catch(error) {if(error.code==='ENOENT')return next();next(error);}
});
app.use(express.static(path.join(root,'dist'),{index:'index.html'}));
app.use('/api',(req,res)=>res.status(404).json({error:'API route not found.'}));
app.use((error,req,res,next)=>{console.error(error.message);res.status(500).json({error:error.message||'Something went wrong. Please retry.'});});
const server=app.listen(port,'127.0.0.1',()=>console.log(`Afterboard listening on http://127.0.0.1:${port}`));
const privateServer=app.listen(privatePort,'127.0.0.1',()=>console.log(`Private Tailscale listener on 127.0.0.1:${privatePort}`));
background.start();
process.on('SIGTERM',()=>{background.stop();engine.close();server.close();privateServer.close();});
