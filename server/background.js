import {buildGameFact,FACT_VERSION} from './insights.js';

const pause=ms=>new Promise(r=>setTimeout(r,ms));
export class BackgroundService{
  constructor({db,readReview,runReview,jobs,username='georgeatki',fetcher=fetch}){
    Object.assign(this,{db,readReview,runReview,jobs,username,fetcher});
    this.stopped=false;this.busy=false;this.importing=false;this.polling=null;this.http=Promise.resolve();this.active=null;this.initialising=true;this.error=null;this.nextPoll=null;
    db.exec(`CREATE TABLE IF NOT EXISTS analysis_queue(id TEXT PRIMARY KEY, state TEXT NOT NULL, priority INTEGER NOT NULL, depth INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 0, error TEXT, updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS archives(url TEXT PRIMARY KEY, fetched TEXT, etag TEXT, error TEXT, retry INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS insight_facts(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE INDEX IF NOT EXISTS queue_selection ON analysis_queue(state,priority,available);`);
    db.prepare("UPDATE analysis_queue SET state='queued',available=0 WHERE state='running'").run();
  }
  getSetting(key){return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;}
  setting(key,value){this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key,String(value));}
  touch(){this.setting('dataRevision',Number(this.getSetting('dataRevision')||0)+1);}
  get paused(){return this.getSetting('analysisPaused')==='true';}
  saveFact(game,review){const fact=buildGameFact(game,review);this.db.prepare('INSERT OR REPLACE INTO insight_facts VALUES (?,?)').run(game.id,JSON.stringify(fact));return fact;}
  enqueue(id,{priority=10,depth=12,force=false}={}){
    if(!force&&this.db.prepare('SELECT id FROM reviews WHERE id=?').get(id))return;
    const old=this.db.prepare('SELECT * FROM analysis_queue WHERE id=?').get(id);
    if(old?.state==='running')return;
    if(old?.state==='queued'){this.db.prepare('UPDATE analysis_queue SET priority=MAX(priority,?),depth=CASE WHEN ? THEN ? ELSE depth END,available=CASE WHEN ? THEN 0 ELSE available END WHERE id=?').run(priority,force?1:0,depth,force?1:0,id);return;}
    if(old?.state==='failed'&&!force)return;
    this.db.prepare("INSERT OR REPLACE INTO analysis_queue VALUES (?,'queued',?,?,0,0,NULL,?)").run(id,priority,depth,Date.now());
  }
  getJob(id){
    const memory=this.jobs.get(id);if(memory?.status==='running')return memory;
    const row=this.db.prepare('SELECT * FROM analysis_queue WHERE id=?').get(id);
    if(!row)return memory||null;
    return {id,status:row.state==='failed'?'error':row.state==='done'?'complete':row.state,error:row.error,depth:row.depth,percent:row.state==='done'?100:0,completed:0,total:0};
  }
  status(){
    const count=state=>this.db.prepare('SELECT COUNT(*) n FROM analysis_queue WHERE state=?').get(state).n;
    const archives=this.db.prepare('SELECT COUNT(*) total,SUM(CASE WHEN fetched IS NOT NULL THEN 1 ELSE 0 END) completed,SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) failed FROM archives').get();
    const total=this.db.prepare('SELECT COUNT(*) n FROM games').get().n,reviewed=this.db.prepare('SELECT COUNT(*) n FROM reviews').get().n;
    return {enabled:true,paused:this.paused,initialising:this.initialising,pollMinutes:5,depth:12,total,reviewed,queued:count('queued'),failed:count('failed'),active:this.active?{...this.active,opponent:this.active.opponent}:null,archives:{total:archives.total,completed:archives.completed||0,failed:archives.failed||0},importing:this.importing,lastSync:this.getSetting('lastSync')||null,nextPoll:this.nextPoll,error:this.error,revision:Number(this.getSetting('dataRevision')||0),backgroundCompleted:Number(this.getSetting('backgroundCompleted')||0)};
  }
  async fetchJSON(url,etag){
    const operation=this.http.then(async()=>{
      for(let attempt=0;attempt<3;attempt++){
        const headers={'User-Agent':`Afterboard/2.0 (personal chess study; Chess.com user ${this.username})`,Accept:'application/json'};if(etag)headers['If-None-Match']=etag;
        const response=await this.fetcher(url,{headers,signal:AbortSignal.timeout(25000)});
        if(response.status===304)return {unchanged:true,etag};
        if(response.ok)return {data:await response.json(),etag:response.headers.get('etag')};
        if((response.status===429||response.status>=500)&&attempt<2){const delay=Math.min(60000,Math.max(2000,Number(response.headers.get('retry-after')||0)*1000));await pause(delay*(attempt+1));continue;}
        throw new Error(`Chess.com returned ${response.status}; the next background check will retry.`);
      }
    });this.http=operation.catch(()=>{});return operation;
  }
  async discover(){
    const result=await this.fetchJSON(`https://api.chess.com/pub/player/${this.username}/games/archives`);
    if(!Array.isArray(result.data?.archives))throw new Error('Chess.com did not return a valid archive list.');
    const matcher=new RegExp(`^https://api\\.chess\\.com/pub/player/${this.username}/games/\\d{4}/\\d{2}$`),archives=result.data.archives.filter(url=>matcher.test(url));
    const add=this.db.prepare('INSERT OR IGNORE INTO archives(url) VALUES (?)');for(const url of archives)add.run(url);
    return archives;
  }
  async importArchive(url,priority=10){
    const old=this.db.prepare('SELECT * FROM archives WHERE url=?').get(url);let imported=0,seen=0,skipped=0;
    try{
      const response=await this.fetchJSON(url,old?.etag);
      if(!response.unchanged){
        if(!Array.isArray(response.data?.games))throw new Error('Invalid game archive response.');
        for(const game of response.data.games){
          seen++;if(game.rules!=='chess'||!game.pgn){skipped++;continue;}
          const id=game.uuid||game.url.split('/').at(-1);if(this.db.prepare('SELECT id FROM games WHERE id=?').get(id))continue;
          const white=game.white.username.toLowerCase()===this.username,me=white?game.white:game.black,opponent=white?game.black:game.white;
          const record={id,url:game.url,pgn:game.pgn,ended:game.end_time,white:game.white,black:game.black,color:white?'w':'b',opponent:opponent.username,result:me.result==='win'?'win':opponent.result==='win'?'loss':'draw',timeClass:game.time_class,timeControl:game.time_control,rated:game.rated,opening:game.eco?.split('/').at(-1)?.replaceAll('-',' ')||'Unclassified opening'};
          this.db.prepare('INSERT OR IGNORE INTO games VALUES (?,?,?)').run(id,game.end_time,JSON.stringify(record));this.saveFact(record,null);this.enqueue(id,{priority});imported++;this.touch();
          await new Promise(r=>setImmediate(r));
        }
      }
      this.db.prepare('UPDATE archives SET fetched=?,etag=?,error=NULL,retry=0 WHERE url=?').run(new Date().toISOString(),response.etag||old?.etag||null,url);
      this.setting('skippedVariants',Number(this.getSetting('skippedVariants')||0)+skipped);this.seedScopeSamples();return {imported,seen,skipped};
    }catch(error){this.db.prepare('UPDATE archives SET error=?,retry=? WHERE url=?').run(error.message,Date.now()+300000,url);throw error;}
  }
  pollRecent(){
    if(this.polling)return this.polling;
    this.polling=(async()=>{
      const archives=await this.discover();let imported=0;
      for(const url of archives.slice(-2).reverse())imported+=(await this.importArchive(url,60)).imported;
      this.setting('lastSync',new Date().toISOString());this.error=null;return {imported,lastSync:this.getSetting('lastSync')};
    })().catch(error=>{this.error=error.message;throw error;}).finally(()=>{this.polling=null;this.nextPoll=new Date(Date.now()+300000).toISOString();});return this.polling;
  }
  async prepare(){
    for(const row of this.db.prepare('SELECT g.body,f.body fact FROM games g LEFT JOIN insight_facts f ON f.id=g.id ORDER BY g.ended DESC').all()){
      const game=JSON.parse(row.body),review=this.readReview(game.id);
      if(!row.fact||JSON.parse(row.fact).version!==FACT_VERSION)this.saveFact(game,review);
      if(!review)this.enqueue(game.id,{priority:30});
      await new Promise(r=>setImmediate(r));
    }
    this.seedScopeSamples();this.initialising=false;this.touch();
  }
  seedScopeSamples(){
    // Give each dashboard scope an initial reviewed sample before working
    // through years of a single time control. Newly arrived games still win.
    for(const control of ['rapid','blitz','bullet']){
      const reviewed=this.db.prepare("SELECT COUNT(*) n FROM insight_facts WHERE json_extract(body,'$.timeClass')=? AND json_extract(body,'$.reviewed')=1").get(control).n;
      if(reviewed>=5)continue;
      const candidates=this.db.prepare("SELECT f.id FROM insight_facts f JOIN games g ON g.id=f.id WHERE json_extract(f.body,'$.timeClass')=? AND json_extract(f.body,'$.reviewed')=0 ORDER BY g.ended DESC LIMIT ?").all(control,5-reviewed);
      for(const row of candidates)this.enqueue(row.id,{priority:45});
    }
  }
  async work(){
    if(this.busy||this.paused||this.stopped)return;this.busy=true;
    try{
      const row=this.db.prepare("SELECT q.*,g.body FROM analysis_queue q JOIN games g ON g.id=q.id WHERE q.state='queued' AND q.available<=? ORDER BY q.priority DESC,g.ended DESC LIMIT 1").get(Date.now());
      if(!row)return;
      const game=JSON.parse(row.body),job={id:game.id,opponent:game.opponent,status:'running',completed:0,total:0,percent:0,depth:row.depth};this.active=job;this.jobs.set(game.id,job);
      this.db.prepare("UPDATE analysis_queue SET state='running',attempts=attempts+1,updated=? WHERE id=?").run(Date.now(),game.id);
      try{
        await this.runReview(game,job,row.depth);const review=this.readReview(game.id);this.saveFact(game,review);
        this.db.prepare("UPDATE analysis_queue SET state='done',error=NULL,updated=? WHERE id=?").run(Date.now(),game.id);this.setting('backgroundCompleted',Number(this.getSetting('backgroundCompleted')||0)+1);this.touch();
      }catch(error){
        const failed=row.attempts+1>=3;this.db.prepare('UPDATE analysis_queue SET state=?,error=?,available=?,updated=? WHERE id=?').run(failed?'failed':'queued',error.message,Date.now()+60000*(row.attempts+1),Date.now(),game.id);job.status=failed?'error':'queued';job.error=error.message;this.error=error.message;
      }finally{this.active=null;}
    }finally{this.busy=false;}
  }
  setPaused(paused){this.setting('analysisPaused',!!paused);}
  retryFailed(){this.db.prepare("UPDATE analysis_queue SET state='queued',attempts=0,available=0,error=NULL WHERE state='failed'").run();this.error=null;}
  start(){
    this.prepare().then(()=>{if(this.stopped)return;this.pollRecent().catch(()=>{});this.workerTimer=setInterval(()=>this.work().catch(e=>{this.error=e.message;}),1000);this.work();
      this.pollTimer=setInterval(()=>this.pollRecent().catch(()=>{}),300000);
      this.historyTimer=setInterval(async()=>{if(this.importing||this.polling||this.stopped)return;const next=this.db.prepare('SELECT url FROM archives WHERE fetched IS NULL AND retry<=? ORDER BY url DESC LIMIT 1').get(Date.now());if(!next)return;this.importing=true;try{await this.importArchive(next.url);}catch(e){this.error=e.message;}finally{this.importing=false;}},1200);
    }).catch(error=>{this.error=error.message;this.initialising=false;});
  }
  stop(){this.stopped=true;for(const timer of [this.workerTimer,this.pollTimer,this.historyTimer])clearInterval(timer);}
}
