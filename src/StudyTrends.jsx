import React,{useEffect,useId,useRef,useState} from 'react';
import './study-trends.css';

const colours=['#a52a5b','#236985','#486e45'];
const phases=['Opening','Middlegame','Endgame'];
const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
const value=(point)=>point?.total?100*point.count/point.total:null;
const labelDate=date=>new Date(date+(date.length===7?'-01':'')+'T00:00:00Z').toLocaleDateString('en-GB',{
  month:'short',...(date.length===7?{year:'numeric'}:{day:'numeric',year:'numeric'}),timeZone:'UTC',
});
const plotHeight=180,plotTop=18,plotBottom=142;

function TrendChart({title,description,dates,series,unit,sample,details,fixedMaximum,active,sources,onOpenGame}){
  const id=useId();
  const latest=Math.max(0,dates.length-1);
  const [playhead,setPlayhead]=useState(latest),[selected,setSelected]=useState(latest);
  const chart=useRef(null),drag=useRef(null),resumeAt=useRef(0);
  const datesKey=dates.join(',');
  useEffect(()=>{
    setPlayhead(latest);setSelected(latest);resumeAt.current=0;
  },[datesKey,latest]);
  useEffect(()=>{
    const node=chart.current;
    if(!node||!active||latest<1)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let visible=false;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});
    observer.observe(node);
    const timer=setInterval(()=>{
      if(visible&&!document.hidden&&!reduced.matches&&!drag.current&&Date.now()>=resumeAt.current){
        setPlayhead(position=>(position+1)%(latest+1));
      }
    },Math.max(85,Math.min(420,5200/(latest+1))));
    return()=>{observer.disconnect();clearInterval(timer);};
  },[active,latest,datesKey]);
  function seek(index){
    const next=Math.max(0,Math.min(latest,index));
    setPlayhead(next);
    setSelected(next);
    resumeAt.current=Date.now()+750;
  }
  function pointerIndex(event){
    const bounds=event.currentTarget.getBoundingClientRect();
    return Math.round(((event.clientX-bounds.left)/bounds.width*600-15)/570*latest);
  }
  function start(event){
    if(!event.isPrimary||event.button!==0)return;
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,locked:false};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event){
    const gesture=drag.current;
    if(gesture?.id!==event.pointerId)return;
    const distance=Math.abs(event.clientX-gesture.x);
    if(!gesture.locked&&distance<Math.max(6,Math.abs(event.clientY-gesture.y)))return;
    gesture.locked=true;
    seek(pointerIndex(event));
  }
  function finish(event,cancel=false){
    if(drag.current?.id!==event.pointerId)return;
    if(!cancel)seek(pointerIndex(event));
    drag.current=null;
  }
  function keyboard(event){
    const next={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:latest}[event.key];
    if(next===undefined)return;
    event.preventDefault();seek(next);
  }
  const current=Math.min(selected,latest);
  const moving=Math.min(playhead,latest);
  const width=600;
  const maximum=fixedMaximum??Math.max(2,Math.ceil(Math.max(0,...series.flatMap(line=>line.points.map(value)))/2)*2);
  const x=i=>latest?15+i/latest*570:300;
  const y=v=>plotBottom-v/maximum*(plotBottom-plotTop);
  const ticks=[...new Set([0,Math.floor(latest/2),latest])];
  const sourceGames=sources?.[current]??[];
  const noSamples=!series.some(line=>line.points.some(point=>point?.total));
  return <section className="insight-card trend-card" aria-labelledby={id}>
    <div className="trend-heading"><h2 id={id}>{title}</h2><p>{description}</p></div>
    {noSamples?<p className="trend-empty">No data for these filters yet.</p>:<>
      <div className="trend-values" aria-live="polite">
        <strong>{labelDate(dates[current])}</strong>
        {series.map((line,i)=>{
          const point=line.points[current],v=value(point);
          return <div key={line.name}>
            <span><i style={{background:colours[i]}}/>{line.name}</span>
            <b>{v===null?'—':number.format(v)+unit}</b>
            <small>{point?.total?(line.sample??sample)(point):'No sample'}</small>
          </div>;
        })}
      </div>
      <div className="trend-chart">
        <div className="trend-axis" aria-hidden="true">{[maximum,maximum/2,0].map(v=><span key={v}>{number.format(v)}{unit}</span>)}</div>
        <div className="trend-plot" ref={chart} onPointerDown={start} onPointerMove={move}
          onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)}
          onKeyDown={keyboard} tabIndex={0} role="region"
          aria-label={title+' timeline. Swipe or use left and right arrow keys to inspect a date.'}>
          <svg viewBox={`0 0 ${width} ${plotHeight}`} preserveAspectRatio="none" aria-hidden="true">
            {[maximum,maximum/2,0].map(v=><line key={v} x1="0" x2={width} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4"/>)}
            <line x1={x(current)} x2={x(current)} y1={plotTop} y2={plotBottom} stroke="var(--quiet)" strokeDasharray="4 4"/>
            <line x1={x(moving)} x2={x(moving)} y1={plotTop} y2={plotBottom} stroke="var(--accent)" opacity=".65"/>
            {series.map((line,lineIndex)=>{
              const parts=[];
              let part=[];
              line.points.forEach((point,i)=>{
                const v=value(point);
                if(v===null){if(part.length)parts.push(part);part=[];}
                else part.push([x(i),y(v),i]);
              });
              if(part.length)parts.push(part);
              return <g key={line.name} stroke={colours[lineIndex]} fill={colours[lineIndex]}>
                {parts.map(segment=><g key={segment[0][2]}>
                  <polyline fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={segment.map(([px,py])=>px+','+py).join(' ')}/>
                  {segment.map(([px,py,i])=><circle key={i} cx={px} cy={py} r={i===current?5:2.5}/>)}
                </g>)}
              </g>;
            })}
          </svg>
          <div className="trend-ticks" aria-hidden="true">{ticks.map(i=><span key={i}>{labelDate(dates[i])}</span>)}</div>
        </div>
      </div>
      <p className="trend-gesture">Swipe or drag to inspect a date</p>
      {sources&&<div className="trend-examples">
        <h3>Source games · {labelDate(dates[current])}</h3>
        {sourceGames.length?sourceGames.map(game=><button key={game.id} onClick={()=>onOpenGame(game.id,game.index??-1)}>
          {game.san?`${game.san} vs ${game.opponent}`:`vs ${game.opponent}`} <span aria-hidden="true">↗</span>
        </button>):<p>No saved examples for this date.</p>}
      </div>}
      {details}
    </>}
  </section>;
}

export default function StudyTrends({data,section,opening,pattern:theme,onOpenGame,onDrill,active}){
  const buckets=data.trends??[];
  const dates=buckets.map(bucket=>bucket.date);
  const openingKey=o=>JSON.stringify([o.name,o.color]);
  const openingName=o=>o.name+(o.color==='w'?' as White':' as Black');
  const phaseSeries=phases.map(name=>({name,points:buckets.map(bucket=>{
    const phase=bucket.phases[name];
    return phase?{count:phase.errors,total:phase.moves}:null;
  })}));
  const themeSeries=theme?[{name:theme.name,points:buckets.map(bucket=>({count:bucket.themes[theme.name]||0,total:bucket.moves}))}]:[];
  const openingSamples=opening?buckets.map(bucket=>bucket.openings[openingKey(opening)]):[];
  const openingSeries=opening?[
    {name:'Result score',points:openingSamples.map(item=>item?{count:item.score,total:item.games}:null),
      sample:p=>`${p.count} points in ${p.total} games`},
    {name:'Opening error rate',points:openingSamples.map(item=>item?.moves?{count:item.errors,total:item.moves}:null),
      sample:p=>`${p.count} of ${p.total} reviewed opening moves`},
  ]:[];
  const coverage=`${number.format(data.reviewed)} of ${number.format(data.total)} games reviewed`;
  const resolution={month:'Monthly',week:'Weekly',day:'Daily'}[data.period.bucket];
  const common={dates,active,onOpenGame};
  return <div className="study-trends">
    {section==='Overall'&&<PracticeProgress stats={data.practice?.total} onDrill={()=>onDrill('all')}/>}
    {section==='Patterns'&&<PracticeProgress name={theme?.name} stats={theme&&data.practice?.byTheme[theme.name]} onDrill={theme&&(()=>onDrill(theme.name))}/>}
    <p className="trend-coverage">{resolution} samples · {coverage}. Gaps indicate no sample.</p>
    {section==='Overall'&&<TrendChart {...common} title="Mistakes by phase" description="Inaccuracies, mistakes, and blunders per 100 reviewed moves in each phase."
      series={phaseSeries} unit="" sample={p=>`${p.count} of ${p.total} moves`}
      sources={buckets.map(bucket=>bucket.sources?.reviewed)}/>}
    {section==='Patterns'&&<TrendChart key={theme?.name} {...common} title={theme?.name??'Recurring mistakes'} description="Occurrences per 100 reviewed moves."
      series={themeSeries} unit="" sample={p=>`${p.count} in ${p.total} moves`}
      sources={buckets.map(bucket=>bucket.sources?.themes[theme?.name])}/>}
    {section==='Openings'&&<TrendChart key={opening&&openingKey(opening)} {...common} title={opening?openingName(opening):'Opening results and errors'}
      description="Game score and errors per 100 reviewed opening moves."
      series={openingSeries} unit="%" fixedMaximum={100} sources={buckets.map(bucket=>opening&&bucket.sources?.openings[openingKey(opening)])}/>}
    <Comparison comparison={data.comparison} section={section} themes={theme?[theme]:[]} opening={section==='Openings'?opening:null}/>
  </div>;
}

function PracticeProgress({stats,name,onDrill}){
  const {tracked=0,due=0,repeat=0,steady=0,cleanReviews=0,nextDue}=stats??{};
  return <section className="insight-card practice-progress">
    <h2>{name?'Practice progress':'Spaced practice'}</h2>
    {tracked>0?<><dl>
      <div><dt>Due now</dt><dd>{due}</dd></div>
      <div><dt>Repeated misses</dt><dd>{repeat}</dd></div>
      <div><dt>Two clean solves in a row</dt><dd>{steady}</dd></div>
      <div><dt>Clean solves</dt><dd>{cleanReviews}</dd></div>
    </dl><p>{tracked} positions tracked.{nextDue&&!due?` Next review ${new Date(nextDue).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}.`:''}</p></>
    :<p>Practice a mistake to start tracking it here.</p>}
    {onDrill&&<button className="insight-action" onClick={onDrill}>{due?'Review due positions':name?'Drill this mistake':'Practice mistakes'}</button>}
  </section>;
}

function Comparison({comparison,section,themes,opening}){
  if(!comparison||(section==='Openings'&&!opening)||(section==='Patterns'&&!themes.length))return null;
  const {recent,previous}=comparison;
  const measure=(count,total)=>total?100*count/total:null;
  const rows=(section==='Overall'?phases:[]).map(name=>({
    label:name,...Object.fromEntries([['recent',recent],['previous',previous]].map(([key,w])=>{
      const phase=w.phases[name];return [key,phase?measure(phase.errors,phase.moves):null];
    })),
  }));
  for(const theme of themes.slice(0,3)){
    rows.push({label:theme.name,theme:theme.name,recent:measure(recent.themes[theme.name]||0,recent.moves),previous:measure(previous.themes[theme.name]||0,previous.moves)});
  }
  const key=opening&&JSON.stringify([opening.name,opening.color]);
  const openingWindows=key&&[previous.openings[key],recent.openings[key]];
  const sampleEnough=openingWindows&&openingWindows.every(w=>w&&w.games>=5);
  const print=rate=>rate===null?'—':number.format(rate);
  const windowDates=w=>w.first?labelDate(new Date(w.first*1000).toISOString().slice(0,10))+' to '+labelDate(new Date(w.last*1000).toISOString().slice(0,10)):'No reviewed games';
  return <section className="insight-card windows-card">
    <h2>Last 100 vs previous 100</h2>
    <p>Reviewed games for the selected time control across all dates. Rates are pooled per 100 reviewed moves.</p>
    {rows.length>0&&<table><thead><tr><th scope="col">Mistake rate</th><th scope="col">Previous<br/><small>{windowDates(previous)}<br/>{previous.games} games · {number.format(previous.moves)} moves</small></th><th scope="col">Latest<br/><small>{windowDates(recent)}<br/>{recent.games} games · {number.format(recent.moves)} moves</small></th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{print(row.previous)}</td><td>{print(row.recent)}</td></tr>)}</tbody>
    </table>}
    {(recent.games<100||previous.games<100)&&<p>Fewer than 200 reviewed games. Treat the comparison as provisional.</p>}
    {opening&&<p><strong>{opening.name} as {opening.color==='w'?'White':'Black'}</strong> · {sampleEnough?
      `Result score ${print(measure(openingWindows[0].score,openingWindows[0].games))}% → ${print(measure(openingWindows[1].score,openingWindows[1].games))}% and opening errors per 100 moves ${print(measure(openingWindows[0].errors,openingWindows[0].moves))} → ${print(measure(openingWindows[1].errors,openingWindows[1].moves))} (${openingWindows[0].games} → ${openingWindows[1].games} games).`:
      `Not enough games in both windows (previous ${openingWindows[0]?.games||0}, latest ${openingWindows[1]?.games||0}; need five each).`}</p>}
  </section>;
}
