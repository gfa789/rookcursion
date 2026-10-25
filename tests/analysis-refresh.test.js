import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshAnalysis} from '../src/analysis-refresh.js';

test('completion waits for the saved review before publishing terminal state',async()=>{
  let release,requested;
  const reviewReady=new Promise(resolve=>{release=resolve;}),requestStarted=new Promise(resolve=>{requested=resolve;});
  const events=[];
  const operation=refreshAnalysis({readJob:async()=>({status:'complete'}),readGame:()=>{requested();return reviewReady;},isActive:()=>true,onProgress:j=>events.push(j.status),onComplete:(review,job)=>events.push([review.rows.length,job.status]),onError:assert.fail});
  await requestStarted;assert.deepEqual(events,[]);
  release({review:{rows:[{san:'e4'}]}});await operation;
  assert.deepEqual(events,[[1,'complete']]);
});
test('switching games while review data is loading discards the stale result',async()=>{
  let active=true;
  await refreshAnalysis({readJob:async()=>({status:'complete'}),readGame:async()=>{active=false;return {review:{rows:[]}};},isActive:()=>active,onProgress:assert.fail,onComplete:assert.fail,onError:assert.fail});
});
test('a temporarily missing review stays eligible for another poll',async()=>{
  await assert.rejects(refreshAnalysis({readJob:async()=>({status:'complete'}),readGame:async()=>({review:null}),isActive:()=>true,onProgress:assert.fail,onComplete:assert.fail,onError:assert.fail}),/Retrying/);
});
test('queued analysis continues polling without fetching a nonexistent review',async()=>{
  let progress;
  await refreshAnalysis({readJob:async()=>({status:'queued',id:'waiting'}),readGame:assert.fail,isActive:()=>true,onProgress:job=>{progress=job.status;},onComplete:assert.fail,onError:assert.fail});
  assert.equal(progress,'queued');
});
