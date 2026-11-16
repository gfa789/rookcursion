import InsightFocus from './InsightFocus.jsx';
import React,{useEffect,useRef,useState} from 'react';
import LoadingSkeleton from './LoadingSkeleton.jsx';
import './insights.css';
import StudyTrends from './StudyTrends.jsx';
const SCOPES=['all','rapid','blitz','bullet'];
const PERIODS=[['all','All time','All recorded games'],['ytd','YTD','Since 1 January'],['90d','90 days','The last 90 days'],['month','Last month','From the same date last month']];
const colours={rapid:'#a52a5b',blitz:'#8c4d14',bullet:'#236985',daily:'#486e45'};
const fmt=n=>n===null||n===undefined?'—':Number(n).toLocaleString('en-GB');
const date=n=>n?new Date(n*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/London'}):'—';
function RatingChart({ratings,period,focus,onFocus,onReset,onPoint}){
  const ref=useRef(null),[size,setSize]=useState({width:640,height:240});
  useEffect(()=>{const node=ref.current;if(!node)return;const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width>0&&height>0)setSize({width:Math.round(width),height:Math.round(height)});});observer.observe(node);return()=>observer.disconnect();},[]);
  const series=ratings.filter(r=>!focus||r.control===focus),points=series.flatMap(r=>r.points),values=points.map(p=>p.rating),times=points.map(p=>p.ended);
  const min=values.length?Math.floor((Math.min(...values)-50)/100)*100:0,max=values.length?Math.ceil((Math.max(...values)+50)/100)*100:100;
  const first=times.length?Math.min(...times):0,last=times.length?Math.max(...times):1,w=Math.max(1,size.width),h=Math.max(1,size.height),left=40,right=w-12,top=14,bottom=Math.max(top+1,h-29);
  const x=p=>first===last?(left+right)/2:left+(p.ended-first)/(last-first)*(right-left),y=p=>bottom-(p.rating-min)/Math.max(1,max-min)*(bottom-top);
  const axisDate=n=>new Date(n*1000).toLocaleDateString('en-GB',last-first>180*86400?{month:'short',year:'2-digit',timeZone:'Europe/London'}:{day:'numeric',month:'short',timeZone:'Europe/London'});
  const [cursor,setCursor]=useState(1),ratingGesture=useRef(null),consumed=useRef(false);
  function seekRating(event){
    const bounds=event.currentTarget.getBoundingClientRect();
    setCursor(Math.max(0,Math.min(1,((event.clientX-bounds.left)*w/bounds.width-left)/(right-left))));
    selectNearest(event);

  }
  const openPoint=(control,point)=>{if(first!==last)setCursor((point.ended-first)/(last-first));onPoint(control,point);};
  const selectNearest=event=>{const bounds=event.currentTarget.getBoundingClientRect(),px=(event.clientX-bounds.left)*w/bounds.width,py=(event.clientY-bounds.top)*h/bounds.height;const candidates=series.flatMap(r=>r.points.map(p=>({p,control:r.control,distance:(x(p)-px)**2+(y(p)-py)**2})));candidates.sort((a,b)=>a.distance-b.distance);if(candidates[0])openPoint(candidates[0].control,candidates[0].p);};
  return <section className="insight-card rating-card" aria-label="Rating trajectory">
    <div className="rating-plot" ref={ref}>{points.length?<svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Interactive rating history. Select a checkpoint to see its games" onClick={e=>{if(!consumed.current)selectNearest(e);}}
      onPointerDown={e=>{if(e.isPrimary&&e.button===0){consumed.current=false;ratingGesture.current={id:e.pointerId,x:e.clientX,y:e.clientY};}}}
      onPointerMove={e=>{
        const drag=ratingGesture.current;
        if(drag?.id!==e.pointerId||(!consumed.current&&Math.abs(e.clientX-drag.x)<Math.max(6,Math.abs(e.clientY-drag.y))))return;
        consumed.current=true;e.currentTarget.setPointerCapture(e.pointerId);seekRating(e);
      }}
      onPointerUp={e=>{if(consumed.current)seekRating(e);ratingGesture.current=null;}}
      onPointerLeave={()=>{ratingGesture.current=null;}}
      onPointerCancel={()=>{ratingGesture.current=null;}}>{[0,.5,1].map(t=><g key={t}><line x1={left} x2={right} y1={top+t*(bottom-top)} y2={top+t*(bottom-top)} stroke="var(--line)" strokeDasharray="3 5"/><text x="0" y={top+4+t*(bottom-top)}>{fmt(Math.round(max-(max-min)*t))}</text></g>)}{first!==last&&<line x1={left+cursor*(right-left)} x2={left+cursor*(right-left)} y1={top} y2={bottom} stroke="var(--accent)" opacity=".55"/>}{series.map(r=><g key={r.control}><polyline points={r.points.map(p=>`${x(p)},${y(p)}`).join(' ')} fill="none" stroke={colours[r.control]} strokeWidth="2.4" vectorEffect="non-scaling-stroke"/>{r.points.map((p,i)=><g key={p.ended+':'+i} role="button" tabIndex={0} aria-label={`${r.control}, ${date(p.ended)}, rating ${p.rating}, ${p.games?.length||0} ${(p.games?.length||0)===1?'game':'games'}. Open games`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPoint(r.control,p);}}}><circle className="rating-hit" cx={x(p)} cy={y(p)} r="12" fill="transparent"/><circle className="rating-dot" cx={x(p)} cy={y(p)} r="3" fill={colours[r.control]} pointerEvents="none"/></g>)}</g>)}{first===last?<text x={(left+right)/2} y={h-5} textAnchor="middle">{axisDate(first)}</text>:<><text x={left} y={h-5}>{axisDate(first)}</text><text x={right} y={h-5} textAnchor="end">{axisDate(last)}</text></>}</svg>:<div className="insight-empty"><strong>No rated games in this period</strong><button className="insight-action" onClick={onReset}>Show all time</button></div>}</div>
    {!!series.length&&<div className={`rating-legend ${focus?'focused':''}`}>{series.map(r=><button key={r.control} style={{'--series-colour':colours[r.control]}} onClick={()=>onFocus(r.control)} aria-label={`${r.control} rating ${fmt(r.current)}, change ${r.change>=0?'+':''}${r.change}. Filter rating series`}><span><i/>{r.control}</span><strong>{fmt(r.current)}</strong><small className={r.change<0?'negative':''}>{r.change>=0?'+':''}{fmt(r.change)}</small></button>)}</div>}
    {focus&&series[0]&&<div className="rating-details"><div><span>Period start</span><b>{fmt(series[0].start)}</b></div><div><span>Period peak</span><b>{fmt(series[0].peak)}</b></div><div><span>Rated games</span><b>{fmt(series[0].games)}</b></div></div>}
    {!!points.length&&<p className="chart-note">{period.bucket==='month'?'Monthly':period.bucket==='week'?'Weekly':'Daily'} checkpoints · tap to see games or swipe to seek</p>}
  </section>;
}
const SECTIONS=['Overall','Openings','Patterns'];
const openingKey=opening=>JSON.stringify([opening.name,opening.color]);

export default function Insights({active=true,onOpenGame,onDrill}){
  const [section,setSection]=useState('Overall'),[scope,setScope]=useState('all'),[range,setRange]=useState('all');
  const [data,setData]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const [openingChoice,setOpeningChoice]=useState(null),[patternChoice,setPatternChoice]=useState(null);
  const [ratingFocus,setRatingFocus]=useState(null),[ratingPoint,setRatingPoint]=useState(null);
  const [overview,setOverview]=useState('Ratings');
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();
    let pending=false;
    async function refresh(){
      if(pending)return;
      pending=true;
      try{
        const response=await fetch(`api/insights?${new URLSearchParams({scope,range})}`,{signal:controller.signal});
        if(!response.ok)throw new Error('Could not load your insights.');
        const result=await response.json();
        if(!controller.signal.aborted){setData(result);setError('');}
      }catch(error){
        if(!controller.signal.aborted)setError(error.message);
      }finally{pending=false;}
    }
    refresh();
    const timer=setInterval(refresh,15000);
    return()=>{controller.abort();clearInterval(timer);};
  },[scope,range,active,reload]);
  const fresh=data?.scope===scope&&data?.period.key===range?data:null;
  const openings=fresh?.openings??[];
  const patterns=fresh?.patterns??[];
  const allOpenings=openingChoice==='all',allPatterns=patternChoice==='all';
  const opening=openings.find(item=>openingKey(item)===openingChoice)??openings[0];
  const pattern=patterns.find(item=>item.name===patternChoice)??patterns[0];
  const focusedRatings=fresh?.ratings.filter(r=>!ratingFocus||r.control===ratingFocus)??[];
  const latest=focusedRatings.flatMap(r=>r.points.slice(-1).map(point=>({control:r.control,point})))
    .reduce((best,current)=>!best||current.point.ended>best.point.ended?current:best,null);
  const ratingSelection=ratingPoint??latest;
  function chooseFilter(setter,value){
    setter(value);setRatingPoint(null);setRatingFocus(null);setError('');
  }
  function chooseSection(next){
    setSection(next);
  }
  return <section className="insights-panel study-insights" aria-label="Chess insights dashboard">
    <aside className="study-sidebar" aria-label="Insights sidebar">
      <nav aria-label="Insights sections">
        {SECTIONS.map(name=><button key={name} aria-current={section===name?'page':undefined} onClick={()=>chooseSection(name)}>{name}</button>)}
      </nav>
      <div className="study-filter-fields">
        <label>Game type<select value={scope} onChange={e=>chooseFilter(setScope,e.target.value)}>
          {SCOPES.map(s=><option key={s} value={s}>{s==='all'?'All games':s[0].toUpperCase()+s.slice(1)}</option>)}
        </select></label>
        <label>Timeframe<select value={range} onChange={e=>chooseFilter(setRange,e.target.value)}>
          {PERIODS.map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <label className="insight-view-select">{section==='Overall'?'View':section==='Openings'?'Opening':'Pattern'}
        <select value={section==='Overall'?overview:section==='Openings'?(allOpenings?'all':opening?openingKey(opening):'all'):(allPatterns?'all':pattern?.name??'all')}
          onChange={e=>section==='Overall'?setOverview(e.target.value):section==='Openings'?setOpeningChoice(e.target.value):setPatternChoice(e.target.value)}>
          {section==='Overall'?['Ratings','Recovery','Conversion','Move timing','Clock pressure','Opponents'].map(name=><option key={name}>{name}</option>):<>
            <option value="all">{section==='Openings'?'Compare top six':'Compare all'}</option>
            {(section==='Openings'?openings:patterns).map(item=><option key={section==='Openings'?openingKey(item):item.name} value={section==='Openings'?openingKey(item):item.name}>{item.name}{section==='Openings'?' � '+(item.color==='w'?'White':'Black'):''}</option>)}
          </>}
        </select>
      </label>
    </aside>
    <div className="study-insights-content">
      <header className="insights-heading"><h1>{section==='Overall'?'Study insights':section}</h1>{fresh&&<span>{fmt(fresh.total)} games</span>}</header>
      {error&&<div className="insight-error" role="alert">{error} <button className="insight-action" onClick={()=>setReload(n=>n+1)}>Retry</button></div>}
      {!fresh&&!error&&<LoadingSkeleton view="insights" label="Loading insights"/>}
      {fresh&&<>
        {section==='Overall'&&overview==='Ratings'&&<section className="study-ratings">
          <h2>Rating trajectory</h2>
          <RatingChart ratings={fresh.ratings} period={fresh.period} focus={ratingFocus}
            onFocus={control=>{setRatingFocus(ratingFocus===control?null:control);setRatingPoint(null);}}
            onReset={()=>chooseFilter(setRange,'all')} onPoint={(control,point)=>setRatingPoint({control,point})}/>
          {ratingSelection&&<div className="trend-examples rating-sources">
            <h3>{ratingSelection.control} · {fmt(ratingSelection.point.rating)} · {date(ratingSelection.point.ended)}</h3>
            {[...(ratingSelection.point.games??[])].reverse().slice(0,1).map(game=><button key={game.id} onClick={()=>onOpenGame(game.id,-1)}>
              vs {game.opponent} <span aria-hidden="true">↗</span>
            </button>)}
          </div>}
        </section>}
        {section==='Overall'&&overview!=='Ratings'&&<InsightFocus key={overview+scope+range} data={fresh} view={overview} onOpenGame={onOpenGame}/>}
        {section!=='Overall'&&<StudyTrends key={`${scope}:${range}:${section}`} data={fresh} section={section} opening={opening}
          pattern={pattern} allOpenings={allOpenings} allPatterns={allPatterns} onOpenGame={onOpenGame} onDrill={name=>onDrill(scope,name)}/>}
      </>}
    </div>
  </section>;
}
