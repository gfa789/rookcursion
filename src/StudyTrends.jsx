import React,{useId,useLayoutEffect,useRef,useState} from 'react';
import './study-trends.css';

const colours=['#a52a5b','#236985','#486e45'];
const phases=['Opening','Middlegame','Endgame'];
const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
const value=(point)=>point?.total?100*point.count/point.total:null;
const labelDate=date=>new Date(date+(date.length===7?'-01':'')+'T00:00:00Z').toLocaleDateString('en-GB',{
  month:'short',...(date.length===7?{year:'numeric'}:{day:'numeric',year:'numeric'}),timeZone:'UTC',
});
const plotHeight=180,plotTop=18,plotBottom=142,spacing=72;

function TrendChart({title,description,dates,series,unit,sample,details,fixedMaximum}){
  const id=useId();
  const [selected,setSelected]=useState(Math.max(0,dates.length-1));
  const scroller=useRef(null),drag=useRef(null),dragged=useRef(false);
  function startPan(event){
    dragged.current=false;
    if(event.pointerType==='mouse'&&event.button===0){
      drag.current={x:event.clientX,left:event.currentTarget.scrollLeft};
    }
  }
  function pan(event){
    if(!drag.current||!event.buttons)return;
    const delta=event.clientX-drag.current.x;
    if(!dragged.current&&Math.abs(delta)<5)return;
    dragged.current=true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.scrollLeft=drag.current.left-delta;
  }
  function stopPan(){drag.current=null;}
  const current=Math.max(0,Math.min(selected,dates.length-1));
  const width=Math.max(300,dates.length*spacing);
  const maximum=fixedMaximum??Math.max(2,Math.ceil(Math.max(0,...series.flatMap(line=>line.points.map(value)))/2)*2);
  const x=i=>spacing/2+i*spacing;
  const y=v=>plotBottom-v/maximum*(plotBottom-plotTop);
  const datesKey=dates.join(',');
  useLayoutEffect(()=>{
    if(scroller.current)scroller.current.scrollLeft=scroller.current.scrollWidth;
    setSelected(Math.max(0,dates.length-1));
  },[datesKey]);
  function choose(i,scroll=false){
    setSelected(i);
    if(scroll&&scroller.current)scroller.current.scrollLeft=x(i)-scroller.current.clientWidth/2;
  }
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
        <div className="trend-scroll" ref={scroller} onPointerDown={startPan} onPointerMove={pan} onPointerUp={stopPan} onPointerCancel={stopPan} onPointerLeave={stopPan} tabIndex={0} role="region" aria-label={title+' timeline. Scroll horizontally for earlier dates.'}>
          <svg width={width} height={plotHeight} aria-hidden="true" onClick={event=>{
            if(dragged.current)return;
            const offset=event.clientX-event.currentTarget.getBoundingClientRect().left;
            choose(Math.max(0,Math.min(dates.length-1,Math.floor(offset/spacing))));
          }}>
            {[maximum,maximum/2,0].map(v=><line key={v} x1="0" x2={width} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4"/>)}
            <rect x={current*spacing} y={plotTop} width={spacing} height={plotBottom-plotTop} fill="var(--hover)"/>
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
            {dates.map((date,i)=><text key={date} x={x(i)} y="168" textAnchor="middle">{labelDate(date).replace(/ (20)(\d\d)$/," '$2")}</text>)}
          </svg>
        </div>
      </div>
      <label className="trend-scrub">
        <span>Scrub timeline</span>
        <input aria-label={title+' timeline position'} type="range" min="0" max={dates.length-1} value={current}
          disabled={dates.length<2} onChange={event=>choose(Number(event.target.value),true)}/>
      </label>
      {details}
    </>}
  </section>;
}

export default function StudyTrends({data,onOpenGame,onRepertoire}){
  const buckets=data.trends??[];
  const dates=buckets.map(bucket=>bucket.date);
  const [themeChoice,setTheme]=useState(null);
  const [openingChoice,setOpening]=useState(null);
  const openings=data.openings.slice(0,12);
  const openingKey=o=>JSON.stringify([o.name,o.color]);
  const openingName=o=>o.name+(o.color==='w'?' as White':' as Black');
  const opening=openings.find(o=>openingKey(o)===openingChoice)??openings[0];
  const theme=data.patterns.find(p=>p.name===themeChoice)??data.patterns[0];
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
  return <div className="study-trends">
    <p className="trend-coverage">{resolution} samples · {coverage}. Gaps indicate no sample.</p>
    <div className="study-trend-grid">
      <TrendChart title="Mistakes by phase" description="Inaccuracies, mistakes, and blunders per 100 reviewed moves in each phase."
        dates={dates} series={phaseSeries} unit="" sample={p=>`${p.count} of ${p.total} moves`}/>
      <div className="trend-group">
        {theme&&<label className="trend-select">Mistake pattern
          <select value={theme.name} onChange={e=>setTheme(e.target.value)}>
            {data.patterns.map(p=><option key={p.name}>{p.name}</option>)}
          </select>
        </label>}
        <TrendChart title="Recurring mistakes" description="Occurrences per 100 reviewed moves. Choose a pattern to see how often it comes up."
          dates={dates} series={themeSeries} unit="" sample={p=>`${p.count} in ${p.total} moves`}
          details={theme?.examples.length>0&&<div className="trend-examples">
            <h3>Examples from this date range</h3>
            {theme.examples.map(e=><button key={e.id+':'+e.index} onClick={()=>onOpenGame(e.id,e.index)}>{e.san} vs {e.opponent} <span aria-hidden="true">↗</span></button>)}
          </div>}/>
      </div>
      <div className="trend-group">
        {opening&&<label className="trend-select">Opening family
          <select value={openingKey(opening)} onChange={e=>setOpening(e.target.value)}>
            {openings.map(o=><option key={openingKey(o)} value={openingKey(o)}>{openingName(o)}</option>)}
          </select>
        </label>}
        <TrendChart title="Opening results and errors" description="Compare game results with early-move errors for the selected opening. A win is one point and a draw is half."
          dates={dates} series={openingSeries} unit="%" fixedMaximum={100} sample={p=>`${p.count} points in ${p.total} games`}/>
      </div>
      <section className="insight-card trend-card repertoire-summary">
        <div className="trend-heading"><h2>Most played openings</h2><p>Result score across the selected date range.</p></div>
        {openings.length>0?<ul>{openings.slice(0,6).map(o=><li key={openingKey(o)}>
          <span><strong>{o.name}</strong><small>{o.color==='w'?'White':'Black'} · {o.games} games</small></span>
          <b>{number.format(o.score)}%</b>
        </li>)}</ul>:<p className="trend-empty">No openings in this date range.</p>}
        <button className="insight-action" onClick={onRepertoire}>Open the full repertoire</button>
      </section>
    </div>
  </div>;
}
