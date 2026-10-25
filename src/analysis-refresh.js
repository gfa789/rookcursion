// Publish completion only after the corresponding saved review has arrived.
// Publishing the terminal job first tears down the React polling effect and
// cancels its own in-flight review request.
export async function refreshAnalysis({readJob,readGame,isActive,onProgress,onComplete,onError}){
  const job=await readJob();
  if(!isActive())return;
  if(job.status==='complete'){
    const data=await readGame();
    if(!isActive())return;
    if(!data.review)throw new Error('Analysis finished but the review is not available yet. Retrying…');
    onComplete(data.review,job);
  }else{
    onProgress(job);
    if(job.status==='error')onError(job.error||'Analysis failed. Please retry.');
  }
}
