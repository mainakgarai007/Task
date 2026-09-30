import {useEffect,useMemo,useState} from "react";
import {Task,Frequency,frequencyLabels} from "./types";
import {loadTasks,saveTasks,uid} from "./storage";
import {nextRun,notify} from "./scheduler";

function App(){
 const [tasks,setTasks]=useState<Task[]>(loadTasks);
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState<"all"|"active"|"paused">("all");
 const [form,setForm]=useState({title:"",prompt:"",frequency:"daily" as Frequency,time:""});
 useEffect(()=>saveTasks(tasks),[tasks]);
 useEffect(()=>{const timer=setInterval(()=>{setTasks(prev=>prev.map(t=>{
   if(!t.enabled||t.status==="completed")return t;
   if(new Date(t.nextRun)<=new Date()){
     notify("Task completed",t.title);
     const run=new Date().toISOString();
     const completed=t.frequency==="once";
     return {...t,lastRun:run,runCount:t.runCount+1,history:[run,...t.history].slice(0,50),enabled:!completed,status:completed?"completed":"active",nextRun:completed?t.nextRun:nextRun(new Date(),t.frequency)};
   } return t;
 }))},30000); return()=>clearInterval(timer)},[]);
 const visible=useMemo(()=>tasks.filter(t=>filter==="all"||filter==="active"&&t.enabled||filter==="paused"&&!t.enabled),[tasks,filter]);
 function create(){
  if(!form.title.trim())return;
  const start=form.time?new Date(form.time):new Date(Date.now()+60000);
  const t:Task={id:uid(),title:form.title.trim(),prompt:form.prompt.trim()||form.title.trim(),frequency:form.frequency,nextRun:start.toISOString(),enabled:true,createdAt:new Date().toISOString(),runCount:0,history:[],status:"active"} as Task;
  setTasks([t,...tasks]);setForm({title:"",prompt:"",frequency:"daily",time:""});setOpen(false);
 }
 function runNow(id:string){setTasks(ts=>ts.map(t=>t.id===id?{...t,lastRun:new Date().toISOString(),runCount:t.runCount+1,history:[new Date().toISOString(),...t.history].slice(0,50),nextRun:t.frequency==="once"?t.nextRun:nextRun(new Date(),t.frequency)}:t));const t=tasks.find(x=>x.id===id);if(t)notify("Task ran",t.title)}
 return <div className="app">
  <header><div><div className="eyebrow">AUTOMATION</div><h1>Tasks</h1></div><button className="iconBtn" onClick={()=>setOpen(true)}>＋</button></header>
  <div className="tabs"><button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>All</button><button className={filter==="active"?"on":""} onClick={()=>setFilter("active")}>Active</button><button className={filter==="paused"?"on":""} onClick={()=>setFilter("paused")}>Paused</button></div>
  {visible.length===0?<section className="empty"><div className="orb">✓</div><h2>No tasks yet</h2><p>Create a scheduled task. It will be stored locally on this device.</p><button className="primary" onClick={()=>setOpen(true)}>Create a task</button></section>:
   <main>{visible.map(t=><article className="card" key={t.id}><div className="cardTop"><span className={"dot "+(t.enabled?"live":"paused")}></span><span>{t.enabled?"ACTIVE":"PAUSED"}</span><button className="more" onClick={()=>setTasks(ts=>ts.filter(x=>x.id!==t.id))}>Delete</button></div><h2>{t.title}</h2><p>{t.prompt}</p><div className="meta"><span>{frequencyLabels[t.frequency]}</span><span>Next · {new Date(t.nextRun).toLocaleString()}</span></div><div className="actions"><button onClick={()=>setTasks(ts=>ts.map(x=>x.id===t.id?{...x,enabled:!x.enabled,status:x.enabled?"paused":"active"}:x))}>{t.enabled?"Pause":"Resume"}</button><button onClick={()=>runNow(t.id)}>Run now</button></div></article>)}</main>}
  <section className="starter"><h3>Get started</h3><div className="starterGrid"><button onClick={()=>{setForm({title:"Daily briefing",prompt:"Give me a short daily briefing.",frequency:"daily",time:""});setOpen(true)}}>📰<b>Daily briefing</b><small>Run every day</small></button><button onClick={()=>{setForm({title:"Web monitor",prompt:"Check a webpage for relevant changes.",frequency:"daily",time:""});setOpen(true)}}>🌐<b>Web monitor</b><small>Monitor for changes</small></button></div></section>
  {open&&<div className="modal"><div className="sheet"><div className="sheetHead"><h2>Create task</h2><button onClick={()=>setOpen(false)}>×</button></div><input placeholder="Task title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><textarea placeholder="What should this task do?" value={form.prompt} onChange={e=>setForm({...form,prompt:e.target.value})}/><select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value as Frequency})}>{Object.entries(frequencyLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><label>First run<input type="datetime-local" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></label><button className="primary wide" onClick={create}>Create task</button></div></div>}
 </div>
}
export default App;