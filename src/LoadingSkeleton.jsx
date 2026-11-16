import React from 'react';

export default function LoadingSkeleton({view,label}){
  const blocks={
    desk:['title','board','line','line-short','actions'],
    games:['row','row','row','row','row','row'],
    review:['line-short','board','actions','panel'],
    puzzles:['line','board','actions'],
    learn:['line','board','actions'],
    insights:['title','chart','line-short','panel'],
  };
  return <div className={`loading-skeleton loading-${view}`} role="status" aria-label={label} aria-busy="true">
    {(blocks[view]??blocks.review).map((block,index)=><div className={`skeleton-block skeleton-${block}`} key={index} aria-hidden="true"/>)}
  </div>;
}
