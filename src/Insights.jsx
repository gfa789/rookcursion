import React,{useEffect,useRef,useState} from 'react';
import LoadingSkeleton from './LoadingSkeleton.jsx';
import './study-report.css';

const scopes=['all','rapid','blitz','bullet'];
const periods=[['all','All time'],['ytd','This year'],['90d','Last 90 days'],['month','Last month']];
const number=new Intl.NumberFormat('en-GB',{maximumFractionDigits:1});
const date=new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'});
const count=value=>number.format(value);
const rate=value=>value==null?'—':count(value);
const sign=value=>value>0?'+'+count(value):count(value);

function RatingHistory({ratings}){
  const [control,setControl]=useState(null),[selected,setSelected]=useState(null);
  const series=ratings.find(item=>item.control===control)??ratings[0];
  if(!series)return <p className="report-empty">No rated games in this period.</p>;
  const points=series.points;
  const index=Math.min(selected??points.length-1,points.length-1);
  const point=points[index];
  const minimum=Math.min(...points.map(p=>p.rating),series.peak)-25;
  const maximum=series.peak+25;
  const x=p=>series.games===1?300:12+(p.game-1)/(series.games-1)*576;
  const y=p=>154-(p.rating-minimum)/(maximum-minimum)*132;
  function selectPoint(event){
    const bounds=event.currentTarget.getBoundingClientRect();
    const cursor=(event.clientX-bounds.left)/bounds.width*600;
    const nearest=points.reduce((best,p,i)=>Math.abs(x(p)-cursor)<Math.abs(x(points[best])-cursor)?i:best,0);
    setSelected(nearest);
  }
  return <section className="report-panel rating-report">
    <div className="report-switch" aria-label="Rating time control">{ratings.map(item=><button key={item.control}
      aria-pressed={item===series} onClick={()=>{setControl(item.control);setSelected(null);}}>{item.control}</button>)}</div>
    <div className="report-rating-value"><strong>{count(point.rating)}</strong>
      <span>{date.format(point.ended*1000)} · Game {count(point.game)} of {count(series.games)}</span></div>
    <div className="report-rating-chart">
    <div className="report-rating-axis" aria-hidden="true">{[30,90,150].map(gy=><span key={gy} style={{top:100*gy/170+'%'}}>{count(Math.round(minimum+(154-gy)*(maximum-minimum)/132))}</span>)}</div>
    <svg viewBox="0 0 600 170" preserveAspectRatio="none" role="group" aria-label="Rating by games played. Tap or use the arrow keys to explore."
      tabIndex={0} onClick={selectPoint} onKeyDown={event=>{
        const offset={ArrowLeft:-1,ArrowRight:1}[event.key];
        if(offset){event.preventDefault();setSelected(Math.max(0,Math.min(points.length-1,index+offset)));}
      }}>
      {[30,90,150].map(gy=><line key={gy} x1="12" x2="588" y1={gy} y2={gy} stroke="var(--line)"/>)}
      <polyline points={points.map(p=>x(p)+','+y(p)).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
      <line x1={x(point)} x2={x(point)} y1="12" y2="154" stroke="var(--muted)" strokeDasharray="4 4"/>
      <path d={`M${x(point)} ${y(point)}h.01`} stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </svg></div>
    <div className="report-rating-footer"><span>{series.change===null?'One rated game':sign(series.change)+' points in this period'}</span><span>Peak {count(series.peak)}</span></div>
  </section>;
}

function OpeningRecord({openings}){
  const [color,setColor]=useState('w'),[selection,setSelection]=useState(null);
  const groups=openings.filter(row=>row.color===color);
  const established=groups.filter(row=>row.games>=10);
  const selected=groups.find(row=>row.key===selection);
  const rows=selected?[selected]:established.slice(0,6);
  return <section className="report-panel">
    <div className="report-controls">
      <div className="report-switch" aria-label="Side played">{[['w','White'],['b','Black']].map(([side,label])=><button key={side}
        aria-pressed={side===color} onClick={()=>{setColor(side);setSelection(null);}}>{label}</button>)}</div>
      <label>Opening<select value={selected?.key??''} onChange={event=>setSelection(event.target.value)}>
        <option value="">Most played</option>{groups.map(row=><option key={row.key} value={row.key}>{row.name} ({count(row.games)})</option>)}
      </select></label>
    </div>
    {!rows.length&&<p className="report-empty">{groups.length?'No openings reached 10 games. Choose an opening to see its record.':'No games with this side in the selected period.'}</p>}
    {rows.map(row=><div className="report-opening-row" key={row.key}>
      <div><strong>{row.name}</strong><span>{count(row.games)} games{row.games<10?' · small sample':''}</span></div>
      <div className="report-stack" aria-hidden="true">{['win','draw','loss'].map(result=><span key={result} className={result} style={{flexGrow:row[result]}}/>)}</div>
      <div className="report-opening-detail"><span>{count(row.win)} won · {count(row.draw)} drawn · {count(row.loss)} lost</span>
        {row.moves>=100&&<span>{rate(100*row.errors/row.moves)} errors / 100 opening moves</span>}</div>
    </div>)}
  </section>;
}

function MistakeReport({data,scope,onDrill}){
  const [control,setControl]=useState(null);
  const comparison=data.comparisons.find(item=>item.control===control)??data.comparisons[0];
  const {timing}=data;
  return <div className="report-study-grid">
    <section className="report-panel report-patterns">
      <h3>Recurring mistakes</h3>
      <p>Ranked by the number of reviewed games where each pattern appeared.</p>
      {!data.patterns.length&&<p className="report-empty">No patterns found in this period.</p>}
      {data.patterns.slice(0,6).map(pattern=><div className="report-pattern" key={pattern.name}>
        <div><strong>{pattern.name}</strong><small>{count(pattern.games)} games · {count(pattern.count)} occurrences</small></div>
        <button type="button" onClick={()=>onDrill(scope,pattern.name)} aria-label={'Practice '+pattern.name}>Practice</button>
        <span className="report-track" aria-hidden="true"><i style={{width:100*pattern.games/data.reviewed+'%'}}/></span>
      </div>)}
    </section>
    <section className="report-panel">
      <h3>Where games first go wrong</h3>
      <p>One first mistake or blunder per game. Based on {count(timing.games)} reviews.</p>
      {!timing.games&&<p className="report-empty">No move timing data in this period.</p>}
      {!!timing.games&&<>
        <div className="report-distribution" aria-hidden="true">
          {timing.rows.map((row,index)=><span key={row.name} className={`timing-${index}`} style={{flexGrow:row.count}}/>)}
        </div>
        <dl className="report-timing-list">{timing.rows.map((row,index)=><div key={row.name}>
          <dt><i className={`timing-${index}`} aria-hidden="true"/>{row.name}</dt>
          <dd>{rate(100*row.count/timing.games)}% <small>({count(row.count)})</small></dd>
        </div>)}</dl>
      </>}
    </section>
    <section className="report-panel report-comparison">
      <h3>Are mistakes becoming less frequent?</h3>
      <p>Mistakes and blunders per 100 reviewed moves, using up to 50 recent games from one time control.</p>
      {data.comparisons.length>1&&<label>Time control<select value={comparison.control} onChange={event=>setControl(event.target.value)}>
        {data.comparisons.map(item=><option key={item.control}>{item.control}</option>)}
      </select></label>}
      {comparison?.recent.moves>0&&<dl>
        {comparison.previous?.moves>0&&<div><dt>Previous 50 games</dt><dd>{rate(comparison.previous.rate)}</dd><small>{count(comparison.previous.moves)} moves</small></div>}
        <div><dt>Latest {comparison.recent.games} games</dt><dd>{rate(comparison.recent.rate)}</dd><small>{count(comparison.recent.moves)} moves</small></div>
      </dl>}
      {!comparison?.previous&&<p>100 reviewed games in the selected period are needed to compare two equal groups.</p>}
    </section>
  </div>;
}

const headings={
  Ratings:['Rating history','Track rating by games played. Select a point to see its date.'],
  Openings:['Opening results','See how each opening has scored as White or Black.'],
  Mistakes:['What to practice','Find recurring mistakes and see when they first appear in your games.'],
};

export default function Insights({active=true,section,filters,onCloseFilters,onDrill}){
  const [scope,setScope]=useState('all'),[range,setRange]=useState('all');
  const [data,setData]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const drawer=useRef(null),page=useRef(null);
  useEffect(()=>{page.current.scrollTop=0;},[section,scope,range]);
  useEffect(()=>{
    const dialog=drawer.current;
    if(filters&&active&&!dialog.open)dialog.showModal();
    if((!filters||!active)&&dialog.open)dialog.close();
  },[filters,active]);
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();
    async function refresh(){
      try{
        const response=await fetch('api/insights?'+new URLSearchParams({scope,range,layout:'study'}),{signal:controller.signal});
        if(!response.ok)throw new Error('Could not load Insights.');
        const result=await response.json();
        if(!controller.signal.aborted){setData(result);setError('');}
      }catch(error){
        if(!controller.signal.aborted)setError(error.message);
      }
    }
    refresh();
    return()=>controller.abort();
  },[scope,range,active,reload]);
  const report=data?.scope===scope&&data?.period.key===range?data:null;
  const [title,description]=headings[section];
  return <section ref={page} className="insights-panel study-insights study-report" aria-label="Insights" data-section={section}>
    <dialog ref={drawer} className="insight-drawer" data-keyboard={filters?.keyboard} aria-labelledby="report-filters"
      onClose={onCloseFilters} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close();}}>
      <div className="insight-drawer-body">
        <header><h2 id="report-filters">Insights filters</h2><button type="button" onClick={()=>drawer.current.close()} autoFocus>Done</button></header>
        <div className="study-filter-fields">
          <label>Game type<select value={scope} onChange={event=>{setError('');setScope(event.target.value);}}>
            {scopes.map(item=><option key={item} value={item}>{item==='all'?'All games':item[0].toUpperCase()+item.slice(1)}</option>)}
          </select></label>
          <label>Timeframe<select value={range} onChange={event=>{setError('');setRange(event.target.value);}}>
            {periods.map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select></label>
        </div>
      </div>
    </dialog>
    <div className="report-content">
      <header className="report-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        {report&&<span>{count(report.reviewed)} of {count(report.total)} games reviewed</span>}
      </header>
      {error&&<div role="alert">{error} <button onClick={()=>{setError('');setReload(n=>n+1);}}>Retry</button></div>}
      {!report&&!error&&<LoadingSkeleton view="insights" label="Loading insights"/>}
      {report&&section==='Ratings'&&<RatingHistory key={scope+range} ratings={report.ratings}/>}
      {report&&section==='Openings'&&<OpeningRecord key={scope+range} openings={report.openings}/>}
      {report&&section==='Mistakes'&&<MistakeReport key={scope+range} data={report} scope={scope} onDrill={onDrill}/>}
    </div>
  </section>;
}
