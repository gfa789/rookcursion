import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';

async function unusedPort() {
  const listener=net.createServer();
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  return port;
}

test('private listener rejects missing/wrong identity and retains POST token protection',async()=>{
  const data=await mkdtemp(path.join(tmpdir(),'rookcursion-access-'));
  const port=await unusedPort(), privatePort=await unusedPort();
  const child=spawn(process.execPath,['server/index.js'],{
    env:{...process.env,DATA_DIR:data,PORT:String(port),PRIVATE_PORT:String(privatePort),
      CHESS_USERNAME:'example',TAILSCALE_OWNER:'owner@example.com'},
    stdio:['ignore','pipe','pipe'],windowsHide:true
  });
  let errors='';child.stderr.on('data',chunk=>errors+=chunk);
  const exited=new Promise(resolve=>child.once('exit',resolve));
  try {
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Server did not start: '+errors)),10000);
      child.stdout.on('data',chunk=>{if(chunk.toString().includes('Private Tailscale listener')){clearTimeout(timer);resolve();}});
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited: '+errors));});
    });
    const url=`http://127.0.0.1:${privatePort}/api/status`;
    assert.equal((await fetch(url)).status,403);
    assert.equal((await fetch(url,{headers:{Host:`localhost:${privatePort}`}})).status,403);
    assert.equal((await fetch(url,{headers:{'Tailscale-User-Login':'other@example.com'}})).status,403);
    const headers={'Tailscale-User-Login':'owner@example.com'};
    const response=await fetch(url,{headers});assert.equal(response.status,200);
    const status=await response.json();assert.equal(status.username,'example');
    const endpoint=`http://127.0.0.1:${privatePort}/api/security-check-no-write`;
    assert.equal((await fetch(endpoint,{method:'POST',headers})).status,403);
    assert.equal((await fetch(endpoint,{method:'POST',headers:{...headers,'X-Review-Token':status.token}})).status,404);
  } finally {
    child.kill();await exited;await rm(data,{recursive:true,force:true});
  }
});
