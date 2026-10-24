import React,{useEffect,useRef} from 'react';
import {MARKS} from './Board.jsx';

export default function MoveCarousel({moves,index,onMove}){
  const stripRef=useRef(null),current=useRef({index,onMove}),first=useRef(true),gesture=useRef(false);
  useEffect(()=>{current.current={index,onMove};},[index,onMove]);
  useEffect(()=>{
    const strip=stripRef.current;
    let frame=0,timer;
    const paint=()=>{const middle=strip.scrollLeft+strip.clientWidth/2;for(const button of strip.children){const distance=Math.min(1,Math.abs(button.offsetLeft+button.offsetWidth/2-middle)/Math.max(1,strip.clientWidth/2));button.style.setProperty('--carousel-scale',String(1.15-distance*.48));button.style.setProperty('--carousel-opacity',String(1-distance*.58));}};
    const selectNearest=()=>{if(!gesture.current)return;gesture.current=false;const middle=strip.scrollLeft+strip.clientWidth/2;const nearest=[...strip.children].reduce((a,b)=>Math.abs(a.offsetLeft+a.offsetWidth/2-middle)<Math.abs(b.offsetLeft+b.offsetWidth/2-middle)?a:b);strip.scrollTo({left:nearest.offsetLeft-(strip.clientWidth-nearest.clientWidth)/2,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});current.current.onMove(Number(nearest.dataset.index));};
    const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);clearTimeout(timer);timer=setTimeout(selectNearest,160);};
    const startGesture=()=>{gesture.current=true;};
    const resize=()=>{strip.style.setProperty('--carousel-edge',`${Math.max(0,strip.clientWidth/2-32)}px`);const selected=strip.querySelector('[aria-current="step"]');if(selected)strip.scrollLeft=selected.offsetLeft-(strip.clientWidth-selected.clientWidth)/2;paint();};
    const observer=new ResizeObserver(resize);observer.observe(strip);strip.addEventListener('scroll',scroll,{passive:true});strip.addEventListener('pointerdown',startGesture,{passive:true});strip.addEventListener('wheel',startGesture,{passive:true});paint();
    return()=>{observer.disconnect();strip.removeEventListener('scroll',scroll);strip.removeEventListener('pointerdown',startGesture);strip.removeEventListener('wheel',startGesture);cancelAnimationFrame(frame);clearTimeout(timer);};
  },[]);
  useEffect(()=>{const strip=stripRef.current,selected=strip?.querySelector('[aria-current="step"]');gesture.current=false;if(selected){const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;strip.scrollTo({left:selected.offsetLeft-(strip.clientWidth-selected.clientWidth)/2,behavior:first.current||reduced?'auto':'smooth'});first.current=false;}},[index]);
  return <div className="phone-moves move-carousel" ref={stripRef} aria-label="Move carousel"><button data-index="-1" className={index<0?'active':''} aria-current={index<0?'step':undefined} onClick={()=>onMove(-1)} aria-label="Starting position"><span className="carousel-label">Start</span></button>{moves.map((move,n)=><button data-index={n} key={n} className={index===n?'active':''} aria-current={index===n?'step':undefined} onClick={()=>onMove(n)} aria-label={`Move ${Math.ceil((n+1)/2)}${move.color==='w'?'.':'…'} ${move.san}`}><span className="carousel-label"><span className="carousel-number">{Math.ceil((n+1)/2)}{move.color==='w'?'.':'…'}</span><strong>{move.san}</strong><small className={move.classification?.toLowerCase()}>{MARKS[move.classification]}</small></span></button>)}</div>;
}
