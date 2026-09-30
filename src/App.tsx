import {useEffect,useMemo,useState} from "react";
import {Task,Frequency,frequencyLabels} from "./types";
import {loadTasks,saveTasks,uid} from "./storage";
import {nextRun,notify} from "./scheduler";
import {createTaskWithAI,defaultAISettings,loadAISettings,parsedTaskToTask,saveAISettings,AISettings,AIProvider,providerLabels,providerEndpoint,getModelHints,searchModels,AIModel} from "./ai";

function App(){
 const [tasks,setTasks]=useState<Task[]>(loadTasks);
 const [filter,setFilter]=useState<"all"|"active"|"paused">("all");
 const [composer,setComposer]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [request,setRequest]=useState("");
 const [ai,setAi]=useState<AISettings>(loadAISettings);
 const [draftAi,setDraftAi]=useState<AISettings>(ai);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [modelSearch,setModelSearch]=useState("");
 const [models,setModels]=useState<AIModel[]>(getModelHints(ai.provider));
 const [modelsBusy,setModelsBusy]=useState(false);

 useEffect(()=>saveTasks(tasks),[tasks]);

 useEffect(()=>{
  const timer=setInterval(()=>{
   setTasks(prev=>prev.map(t=>{
    if(!t.enabled||t.status==="completed")return t;
    if(new Date(t.nextRun)<=new Date()){
     notify("Task completed",t.title);
     const run=new Date().toISOString();
     const completed=t.frequency==="once";
     return {...t,lastRun:run,runCount:t.runCount+1,history:[run,...t.history].slice(0,50),enabled:!completed,status:completed?"completed":"active",nextRun:completed?t.nextRun:nextRun(new Date(),t.frequency)};
    }
    return t;
   }));
  },30000);
  return()=>clearInterval(timer);
 },[]);

 const visible=useMemo(()=>tasks.filter(t=>filter==="all"||(filter==="active"&&t.enabled)||(filter==="paused"&&!t.enabled)),[tasks,filter]);
 const aiReady=Boolean(ai.apiKey.trim()&&ai.endpoint.trim()&&ai.model.trim());

 function openComposer(text=""){
  setRequest(text);
  setError("");
  setComposer(true);
 }

 async function createWithAI(){
  if(!aiReady){setComposer(false);setDraftAi(ai);setSettingsOpen(true);return;}
  setBusy(true);setError("");
  try{
   const parsed=await createTaskWithAI(request,ai);
   const task=parsedTaskToTask(parsed,uid);
   setTasks(prev=>[task,...prev]);
   setRequest("");
   setComposer(false);
   notify("Task created",task.title);
  }catch(e){
   setError(e instanceof Error?e.message:"AI could not create the task.");
  }finally{setBusy(false);}
 }

 function saveSettings(){
  if(!draftAi.model.trim()){setError("Choose a model first.");return;}
  saveAISettings(draftAi);
  setAi(draftAi);
  setSettingsOpen(false);
  setError("");
 }
 function changeProvider(provider:AIProvider){
  const next={...draftAi,provider,endpoint:provider==="custom"?draftAi.endpoint:providerEndpoint(provider),model:""};
  setDraftAi(next);
  setModels(getModelHints(provider));
  setModelSearch("");
  setError("");
 }
 async function refreshModels(){
  setModelsBusy(true);setError("");
  try{setModels(await searchModels(draftAi));}
  catch(e){setError(e instanceof Error?e.message:"Could not load models.");}
  finally{setModelsBusy(false);}
 }

 function runNow(id:string){
  const run=new Date().toISOString();
  setTasks(ts=>ts.map(t=>t.id===id?{...t,lastRun:run,runCount:t.runCount+1,history:[run,...t.history].slice(0,50),nextRun:t.frequency==="once"?t.nextRun:nextRun(new Date(),t.frequency)}:t));
  const t=tasks.find(x=>x.id===id);
  if(t)notify("Task ran",t.title);
 }

 return <div className="app">
  <header>
   <div><div className="eyebrow">AI AUTOMATION</div><h1>Tasks</h1></div>
   <div className="headerActions">
    <button className="settingsBtn" onClick={()=>{setDraftAi(ai);setSettingsOpen(true)}}>⚙ AI</button>
    <button className="iconBtn" onClick={()=>openComposer()}>＋</button>
   </div>
  </header>

  <div className={"aiStatus "+(aiReady?"ready":"warning")}>
   <span className="statusDot"></span>
   {aiReady?"AI task creation ready":"AI setup required"}
   <button onClick={()=>{setDraftAi(ai);setSettingsOpen(true)}}>{aiReady?"Settings":"Configure"}</button>
  </div>

  <div className="tabs">
   <button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>All</button>
   <button className={filter==="active"?"on":""} onClick={()=>setFilter("active")}>Active</button>
   <button className={filter==="paused"?"on":""} onClick={()=>setFilter("paused")}>Paused</button>
  </div>

  {visible.length===0?
   <section className="empty">
    <div className="orb">✦</div>
    <h2>What should I schedule?</h2>
    <p>Describe the task naturally. AI will create the title, schedule, frequency and instruction.</p>
    <button className="primary" onClick={()=>openComposer()}>✨ Ask AI to create a task</button>
   </section>:
   <main>{visible.map(t=>
    <article className="card" key={t.id}>
     <div className="cardTop"><span className={"dot "+(t.enabled?"live":"paused")}></span><span>{t.enabled?"ACTIVE":t.status.toUpperCase()}</span><button className="more" onClick={()=>setTasks(ts=>ts.filter(x=>x.id!==t.id))}>Delete</button></div>
     <h2>{t.title}</h2>
     <p>{t.prompt}</p>
     <div className="meta"><span>{frequencyLabels[t.frequency]}</span><span>Next · {new Date(t.nextRun).toLocaleString()}</span><span>Runs · {t.runCount}</span></div>
     <div className="actions">
      <button onClick={()=>setTasks(ts=>ts.map(x=>x.id===t.id?{...x,enabled:!x.enabled,status:x.enabled?"paused":"active"}:x))}>{t.enabled?"Pause":"Resume"}</button>
      <button onClick={()=>runNow(t.id)}>Run now</button>
     </div>
    </article>
   )}</main>
  }

  <section className="starter">
   <h3>Try asking AI</h3>
   <div className="starterGrid">
    <button onClick={()=>openComposer("Every morning at 7 AM, give me a short daily briefing.")}>📰<b>Daily briefing</b><small>Every morning at 7 AM</small></button>
    <button onClick={()=>openComposer("Every day at 8 PM, remind me to check my tasks for tomorrow.")}>⏰<b>Daily reminder</b><small>Every evening</small></button>
   </div>
  </section>

  {composer&&<div className="modal"><div className="sheet aiSheet">
   <div className="sheetHead"><div><div className="eyebrow">AI TASK CREATOR</div><h2>Tell AI what to do</h2></div><button onClick={()=>setComposer(false)}>×</button></div>
   <p className="hint">Example: “Every Friday at 6 PM, remind me to review my weekly goals.”</p>
   <textarea className="aiInput" autoFocus placeholder="Describe your task in natural language..." value={request} onChange={e=>setRequest(e.target.value)}/>
   {error&&<div className="error">{error}</div>}
   <button className="primary wide" disabled={busy} onClick={createWithAI}>{busy?"✨ AI is creating...":"✨ Create with AI"}</button>
   {!aiReady&&<button className="textBtn" onClick={()=>{setComposer(false);setDraftAi(ai);setSettingsOpen(true)}}>Configure AI first →</button>}
  </div></div>}

  {settingsOpen&&<div className="modal"><div className="sheet">
   <div className="sheetHead"><div><div className="eyebrow">REQUIRED</div><h2>AI Settings</h2></div><button onClick={()=>setSettingsOpen(false)}>×</button></div>
   <p className="hint">This public tool uses your own AI API. Your key is stored only in this browser's local storage.</p>
   <label>OpenAI-compatible endpoint<input value={draftAi.endpoint} onChange={e=>setDraftAi({...draftAi,endpoint:e.target.value})} placeholder="https://openrouter.ai/api/v1/chat/completions"/></label>
   <label>Model<input value={draftAi.model} onChange={e=>setDraftAi({...draftAi,model:e.target.value})} placeholder="Enter your model ID"/></label>
   <label>API key<input type="password" value={draftAi.apiKey} onChange={e=>setDraftAi({...draftAi,apiKey:e.target.value})} placeholder="Paste your own API key"/></label>
   <button className="primary wide" onClick={saveSettings}>Save AI settings</button>
  </div></div>}
 </div>
}

export default App;
