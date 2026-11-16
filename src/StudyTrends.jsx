import React,{useEffect,useId,useRef,useState} from 'react';
import './study-trends.css';

const colours=['#a52a5b','#236985','#486e45'];
const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
const value=(point)=>point?.total?100*point.count/point.total:null;
const labelDate=date=>new Date(date+(date.length===7?'-01':'')+'T00:00:00Z').toLocaleDateString('en-GB',{
  month:'short',...(date.length===7?{year:'numeric'}:{day:'numeric',year:'numeric'}),timeZone:'UTC',
});
const plotHeight=180,plotTop=18,plotBottom=142;

function TrendChart({title,description,dates,series,unit,sample,fixedMaximum,onHighlight}){
  const id=useId();
  const latest=Math.max(0,dates.length-1);
  const lastSample=dates.findLastIndex((_,i)=>series.some(line=>line.points[i]?.total));
  const initial=Math.max(0,lastSample);
  const [selected,setSelected]=useState(initial);
  const [highlight,setHighlight]=useState(null);
  const drag=useRef(null);
  function chooseSeries(name){setHighlight(name);onHighlight?.(name);}
  const datesKey=dates.join(',');
  useEffect(()=>{setSelected(initial);},[datesKey,initial]);
  function seek(index){setSelected(Math.max(0,Math.min(latest,index)));}
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
  const width=600;
  const maximum=fixedMaximum??Math.max(2,Math.ceil(Math.max(0,...series.flatMap(line=>line.points.map(value)))/2)*2);
  const x=i=>latest?15+i/latest*570:300;
  const y=v=>plotBottom-v/maximum*(plotBottom-plotTop);
  const ticks=[...new Set([0,Math.floor(latest/2),latest])];
  const seriesColour=i=>series.length<=3?colours[i]:`hsl(${(i*137.508+330)%360} 62% ${34+(i%3)*5}%)`;
  const noSamples=!series.some(line=>line.points.some(point=>point?.total));
  return <section className="insight-card trend-card" aria-labelledby={id}>
    <div className="trend-heading"><h2 id={id}>{title}</h2><p>{description}</p></div>
    {noSamples?<p className="trend-empty">No data for these filters yet.</p>:<>
      <div className={`trend-values ${series.length>3?'trend-many-values':''}`} aria-live="polite">
        <strong>{labelDate(dates[current])}</strong>
        {series.length>3?<label className="series-picker">Series
          <select value={highlight??''} onChange={e=>chooseSeries(e.target.value||null)}>
            <option value="">All {series.length} series</option>
            {series.map((line,i)=><option key={line.name} value={line.name}>{line.name} � {value(line.points[current])===null?'�':number.format(value(line.points[current]))+unit}</option>)}
          </select>
        </label>:series.map((line,i)=>{
          const point=line.points[current],v=value(point);
          return <div key={line.name}><button className="trend-series" aria-pressed={highlight===line.name} onClick={()=>chooseSeries(highlight===line.name?null:line.name)}>
            <i style={{background:seriesColour(i)}}/>{line.name}
          </button><b>{v===null?'�':number.format(v)+unit}</b><small>{point?.total?(line.sample??sample)(point):'No sample'}</small></div>;
        })}
      </div>
      <div className="trend-chart">
        <div className="trend-axis" aria-hidden="true">{[maximum,maximum/2,0].map(v=><span key={v}>{number.format(v)}{unit}</span>)}</div>
        <div className="trend-plot" onPointerDown={start} onPointerMove={move}
          onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)}
          onKeyDown={keyboard} tabIndex={0} role="region"
          aria-label={title+' timeline. Swipe or use left and right arrow keys to inspect a date.'}>
          <svg viewBox={`0 0 ${width} ${plotHeight}`} preserveAspectRatio="none" aria-hidden="true">
            {[maximum,maximum/2,0].map(v=><line key={v} x1="0" x2={width} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4"/>)}
            <line x1={x(current)} x2={x(current)} y1={plotTop} y2={plotBottom} stroke="var(--quiet)" strokeDasharray="4 4"/>
            {series.map((line,lineIndex)=>{
              const parts=[];
              let part=[];
              line.points.forEach((point,i)=>{
                const v=value(point);
                if(v===null){if(part.length)parts.push(part);part=[];}
                else part.push([x(i),y(v),i]);
              });
              if(part.length)parts.push(part);
              return <g key={line.name} stroke={seriesColour(lineIndex)} fill={seriesColour(lineIndex)} opacity={highlight?(highlight===line.name?1:.14):series.length>12?0.64:1}>
                {parts.map(segment=><g key={segment[0][2]}>
                  <polyline vectorEffect="non-scaling-stroke" fill="none" strokeWidth={series.length>12&&highlight!==line.name?1.4:2.5} strokeLinecap="round" strokeLinejoin="round" points={segment.map(([px,py])=>px+','+py).join(' ')}/>
                  {segment.map(([px,py,i])=><path key={i} d={`M${px} ${py}h.01`} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeWidth={i===current?7:4}/>)}
                </g>)}
              </g>;
            })}
          </svg>
          <div className="trend-ticks" aria-hidden="true">{ticks.map(i=><span key={i}>{labelDate(dates[i])}</span>)}</div>
        </div>
      </div>
      <p className="trend-gesture">Swipe or drag to inspect a date</p>
    </>}
  </section>;
}

export default function StudyTrends({data,section,opening,allOpenings,onDrill}){
  const [metric,setMetric]=useState('score');
  const [practiceTheme,setPracticeTheme]=useState(null);
  const buckets=data.trends??[];
  const dates=buckets.map(bucket=>bucket.date);
  const openingKey=o=>JSON.stringify([o.name,o.color]);
  const openingName=o=>o.name+(o.color==='w'?' as White':' as Black');
  const openingSamples=opening?buckets.map(bucket=>bucket.openings[openingKey(opening)]):[];
  const openingSeries=opening?[
    {name:'Result score',points:openingSamples.map(item=>item?{count:item.score,total:item.games}:null),
      sample:p=>`${p.count} points in ${p.total} games`},
    {name:'Opening error rate',points:openingSamples.map(item=>item?.moves?{count:item.errors,total:item.moves}:null),
      sample:p=>`${p.count} of ${p.total} reviewed opening moves`},
  ]:[];
  const combinedPatterns=section==='Patterns'?data.patterns.map(item=>({
    name:item.name,
    points:buckets.map(b=>({count:b.themes[item.name]||0,total:b.moves})),
    sources:buckets.map(b=>b.sources?.themes[item.name]??[]),
  })):[];
  const combinedOpenings=allOpenings?data.openings.slice(0,6).map(item=>{
    const key=openingKey(item);
    return {name:openingName(item),
      points:buckets.map(b=>{
        const sample=b.openings[key];
        return sample?metric==='score'?{count:sample.score,total:sample.games}:{count:sample.errors,total:sample.moves}:null;
      })};
  }):[];

  return <div className="study-trends">
    {section==='Patterns'&&<TrendChart dates={dates} title="Recurring mistakes" description="How often each mistake shows up per 100 reviewed moves."
      series={combinedPatterns} unit="" sample={p=>`${p.count} in ${p.total} moves`} onHighlight={setPracticeTheme}/>}
    {section==='Openings'&&allOpenings&&<div className="opening-metrics" aria-label="Opening comparison metric">
      <button aria-pressed={metric==='score'} onClick={()=>setMetric('score')}>Result score</button>
      <button aria-pressed={metric==='errors'} onClick={()=>setMetric('errors')}>Opening error rate</button>
    </div>}
    {section==='Openings'&&<TrendChart key={allOpenings?metric:opening&&openingKey(opening)} dates={dates} title={allOpenings?'Six most-played openings':opening?openingName(opening):'Opening results and errors'}
      description={allOpenings?(metric==='score'?'Result score and draws count as half a point.':'Errors per 100 reviewed opening moves.'):'Result score counts draws as half a point. Opening errors are per 100 reviewed opening moves.'}
      series={allOpenings?combinedOpenings:openingSeries} unit="%" fixedMaximum={100}
      sample={p=>metric==='score'?`${number.format(p.count)} points in ${p.total} games`:`${p.count} of ${p.total} reviewed opening moves`}
      />}
    {section==='Patterns'&&<button className="compact-practice" onClick={()=>onDrill(practiceTheme??'all')}>
      <span><strong>{practiceTheme?'Practice this pattern':'Practice your patterns'}</strong>
      <small>{practiceTheme??'Puzzles from your games'}</small></span>
      <span aria-hidden="true">→</span>
    </button>}
  </div>;
}
