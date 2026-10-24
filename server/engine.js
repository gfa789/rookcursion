import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export class Engine {
  constructor() { this.child=null; this.waiting=null; this.buffer=''; this.error=null; this.chain=Promise.resolve(); }
  async start() {
    if(this.child) return;
    const dir=path.join(root,'node_modules/stockfish/bin');
    const files=readdirSync(dir);
    const name=files.find(n=>/lite-single.*\.js$/.test(n)) || files.find(n=>/single.*\.js$/.test(n));
    if(!name) throw new Error('Stockfish single-thread engine was not found. Reinstall dependencies.');
    this.child=spawn(process.execPath,[path.join(dir,name)],{cwd:dir,stdio:['pipe','pipe','pipe'],windowsHide:true});
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data',data=>{
      this.buffer+=data;
      let index;
      while((index=this.buffer.indexOf('\n'))!==-1) {
        const line=this.buffer.slice(0,index).trim(); this.buffer=this.buffer.slice(index+1);
        const wait=this.waiting;
        if(wait) { wait.lines.push(line); if(wait.until(line)) {clearTimeout(wait.timer);this.waiting=null;wait.resolve(wait.lines);} }
      }
    });
    this.child.stderr.on('data',()=>{});
    this.child.on('error',error=>this.fail(error));
    this.child.on('exit',()=>{this.child=null; this.fail(new Error('The chess engine stopped. Please retry analysis.'));});
    await this.command('uci',line=>line==='uciok',60000);
    this.child.stdin.write('setoption name Hash value 64\n');
    await this.command('isready',line=>line==='readyok');
    this.error=null;
  }
  fail(error) {this.error=error.message;if(this.waiting){clearTimeout(this.waiting.timer);this.waiting.reject(error);this.waiting=null;}}
  command(command,until,timeout=30000) {
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.waiting=null;this.child?.kill();reject(new Error('Engine search timed out; please retry.'));},timeout);
      this.waiting={resolve,reject,timer,until,lines:[]};
      this.child.stdin.write(command+'\n');
    });
  }
  evaluate(fen,depth=15) {
    const task=this.chain.then(async()=>{
      await this.start();
      this.child.stdin.write('position fen '+fen+'\n');
      const lines=await this.command('go depth '+depth,line=>line.startsWith('bestmove'),90000);
      const best=lines.at(-1).split(' ')[1];
      let result={cp:0,mate:null,pv:[],best,depth:0};
      for(const line of lines) {
        const score=line.match(/score (cp|mate) (-?\d+)/), pv=line.match(/ pv (.+)$/), d=line.match(/depth (\d+)/);
        if(score&&pv&&!line.includes('upperbound')&&!line.includes('lowerbound')) {
          const mate=score[1]==='mate'?Number(score[2]):null;
          result={cp:mate===null?Number(score[2]):Math.sign(mate||-1)*(100000-Math.min(999,Math.abs(mate))*100),mate,pv:pv[1].split(' '),best,depth:d?Number(d[1]):0};
        }
      }
      return result;
    });
    this.chain=task.catch(()=>{});return task;
  }
  close() {this.child?.kill();}
}
