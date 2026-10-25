import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {BackgroundService} from '../server/background.js';

const fixture=(id='g1',ended=100)=>({id,ended,pgn:'1. e4 e5 2. Nf3 Nc6',url:`https://www.chess.com/game/live/${id}`,white:{username:'georgeatki',rating:1000,result:'win'},black:{username:'rival',rating:1000,result:'resigned'},opponent:'rival',color:'w',result:'win',timeClass:'blitz',timeControl:'180+2',rated:true,opening:"King's Pawn Game"});
function database(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE games(id TEXT PRIMARY KEY,ended INTEGER,body TEXT);CREATE TABLE reviews(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);');return db;}
function add(db,game){db.prepare('INSERT INTO games VALUES(?,?,?)').run(game.id,game.ended,JSON.stringify(game));}
function service(db,extras={}){return new BackgroundService({db,jobs:new Map(),readReview:id=>{const row=db.prepare('SELECT body FROM reviews WHERE id=?').get(id);return row?JSON.parse(row.body):null;},runReview:async()=>{},...extras});}

test('queue survives restart and prioritises requested games over recent and historic games',async()=>{
  const db=database(),order=[];for(const [id,ended]of [['old',1],['recent',3],['manual',2]])add(db,fixture(id,ended));
  const app=service(db,{runReview:async(game,job,depth)=>{order.push([game.id,depth]);db.prepare('INSERT OR REPLACE INTO reviews VALUES(?,?)').run(game.id,JSON.stringify({rows:[],depth,accuracy:{w:90,b:90}}));job.status='complete';}});
  app.enqueue('old');app.enqueue('recent',{priority:60});app.enqueue('manual',{priority:100,depth:18});
  db.prepare("UPDATE analysis_queue SET state='running' WHERE id='old'").run();
  const recovered=service(db,{runReview:app.runReview});
  assert.equal(recovered.getJob('old').status,'queued');
  await recovered.work();await recovered.work();await recovered.work();
  assert.deepEqual(order,[['manual',18],['recent',12],['old',12]]);assert.equal(recovered.status().reviewed,3);
  db.close();
});
test('pause persists and concurrent worker ticks never analyze two games at once',async()=>{
  const db=database();add(db,fixture());let active=0,peak=0;
  const app=service(db,{runReview:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setImmediate(r));active--;}});app.enqueue('g1');app.setPaused(true);await app.work();assert.equal(peak,0);assert.equal(service(db).paused,true);
  app.setPaused(false);await Promise.all([app.work(),app.work(),app.work()]);assert.equal(peak,1);db.close();
});
test('failed analysis is retried with a delay and can be manually reprioritised',async()=>{
  const db=database();add(db,fixture());const app=service(db,{runReview:async()=>{throw new Error('engine unavailable');}});app.enqueue('g1');await app.work();
  const row=db.prepare('SELECT * FROM analysis_queue').get();assert.equal(row.state,'queued');assert.equal(row.attempts,1);assert.ok(row.available>Date.now());
  app.enqueue('g1',{priority:100,depth:15,force:true});const next=db.prepare('SELECT * FROM analysis_queue').get();assert.equal(next.available,0);assert.equal(next.priority,100);assert.equal(next.depth,15);db.close();
});
test('monthly archives deduplicate games, skip variants and enqueue valid history',async()=>{
  const db=database(),url='https://api.chess.com/pub/player/georgeatki/games/2026/10';let requests=0;
  const raw={...fixture(),uuid:'g1',end_time:100,rules:'chess',time_class:'blitz',time_control:'180+2'};
  const app=service(db,{fetcher:async()=>{requests++;return new Response(JSON.stringify({games:[raw,{...raw,uuid:'variant',rules:'chess960'}]}),{status:200,headers:{etag:'one'}});}});
  db.prepare('INSERT INTO archives(url)VALUES(?)').run(url);await app.importArchive(url);await app.importArchive(url);
  assert.equal(requests,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM games').get().n,1);assert.equal(app.status().queued,1);assert.equal(app.status().archives.completed,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM insight_facts').get().n,1);db.close();
});
test('starter samples promote under-reviewed time controls without overtaking new games',()=>{
  const db=database(),app=service(db);const rapid={...fixture('rapid'),timeClass:'rapid'},bullet={...fixture('bullet'),timeClass:'bullet'},recent=fixture('new');
  for(const game of [rapid,bullet,recent]){add(db,game);app.saveFact(game,null);app.enqueue(game.id,{priority:game.id==='new'?60:10});}
  app.seedScopeSamples();
  assert.equal(db.prepare("SELECT priority FROM analysis_queue WHERE id='rapid'").get().priority,45);assert.equal(db.prepare("SELECT priority FROM analysis_queue WHERE id='bullet'").get().priority,45);assert.equal(db.prepare("SELECT priority FROM analysis_queue WHERE id='new'").get().priority,60);db.close();
});
test('background and recent-game HTTP requests share one serial request queue',async()=>{
  const db=database();let active=0,peak=0;
  const app=service(db,{fetcher:async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setImmediate(r));active--;return new Response('{}',{status:200});}});
  await Promise.all([app.fetchJSON('https://api.chess.com/one'),app.fetchJSON('https://api.chess.com/two'),app.fetchJSON('https://api.chess.com/three')]);
  assert.equal(peak,1);db.close();
});
