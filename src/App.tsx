import {useEffect,useMemo,useState} from "react";
import {Task,frequencyLabels,ExecutionRecord,Frequency,TaskAction,TaskSchedule} from "./types";
import {loadTasks,saveTasks,uid} from "./storage";
import {nextRun,notify} from "./scheduler";
import {createTaskWithAI,loadAISettings,parsedTaskToTask,saveAISettings,AISettings,AIProvider,providerLabels,providerEndpoint,getModelHints,searchModels,AIModel,executeTaskWithAI} from "./ai";
import {executeDirectTask} from "./dataSources";

function localISO(date:Date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function buildFirstRun(date:string,time:string,frequency:Frequency,weekday:string,monthDay:string,intervalMinutes=60){
 const now=new Date(), d=new Date(date+"T"+time+":00");
 if(frequency==="hourly")return new Date(Date.now()+60000).toISOString();
 if(frequency==="custom")return new Date(Date.now()+Math.max(1,intervalMinutes)*60000).toISOString();
 if(frequency==="daily"&&d<=now)d.setDate(d.getDate()+1);
 if(frequency==="weekly"){
  const target=Number(weekday);const day=d.getDay();let delta=(target-day+7)%7;if(delta===0&&d<=now)delta=7;d.setDate(d.getDate()+delta);
 }
 if(frequency==="monthly"){
  const wanted=Math.min(31,Math.max(1,Number(monthDay)||d.getDate()));
  d.setDate(wanted);
  if(d<=now)d.setMonth(d.getMonth()+1);
 }
 return d.toISOString();
}

function App(){
 const [tasks,setTasks]=useState<Task[]>(loadTasks);
 const [filter,setFilter]=useState<"all"|"active"|"paused">("all");
 const [creator,setCreator]=useState(false);
 const [creatorMode,setCreatorMode]=useState<"choose"|"manual"|"ai">("choose");
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [request,setRequest]=useState("");
 const [ai,setAi]=useState<AISettings>(loadAISettings);
 const [draftAi,setDraftAi]=useState<AISettings>(ai);
 const [busy,setBusy]=useState(false);
 const [processing,setProcessing]=useState("Preparing AI…");
 const [error,setError]=useState("");
 const [modelSearch,setModelSearch]=useState("");
 const [models,setModels]=useState<AIModel[]>([]);
 const [modelsBusy,setModelsBusy]=useState(false);
 const [running,setRunning]=useState<string|null>(null);
 const [manualTitle,setManualTitle]=useState("");
 const [manualDate,setManualDate]=useState(new Date().toISOString().slice(0,10));
 const [manualTime,setManualTime]=useState("19:00");
 const [manualFrequency,setManualFrequency]=useState<Frequency>("daily");
 const [manualWeekday,setManualWeekday]=useState("1");
 const [manualMonthDay,setManualMonthDay]=useState("1");
 const [manualType,setManualType]=useState<"reminder"|"weather"|"news"|"anime"|"movie"|"web">("reminder");
 const [manualMessage,setManualMessage]=useState("");
 const [manualLocation,setManualLocation]=useState("");
 const [manualNewsType,setManualNewsType]=useState("new anime Hindi dubbed release");
 const [manualLanguage,setManualLanguage]=useState("hi");
 const [manualTopic,setManualTopic]=useState("");
 const [manualUrl,setManualUrl]=useState("");
 const [manualScope,setManualScope]=useState("all updates");
 const [manualCategory,setManualCategory]=useState("AI & tech");
 const [manualRegion,setManualRegion]=useState("India");
 const [manualInterval,setManualInterval]=useState("120");
 const [manualEndDate,setManualEndDate]=useState("");
 const [manualMaxRuns,setManualMaxRuns]=useState("");
 const aiReady=Boolean(ai.apiKey.trim()&&ai.endpoint.trim()&&ai.model.trim());

 useEffect(()=>saveTasks(tasks),[tasks]);

 async function executeTask(id:string){
  if(running)return;
  const task=tasks.find(x=>x.id===id);if(!task||!task.enabled||task.status==="completed")return;
  const mode=task.executionMode||"ai";
  if(mode==="ai"&&!aiReady){setError("AI settings are required for this AI task.");setDraftAi(ai);setSettingsOpen(true);return;}
  setRunning(id);const started=new Date().toISOString();
  try{
   const result=mode==="direct"?await executeDirectTask(task):await executeTaskWithAI(task,ai);
   const finished=new Date().toISOString(),record:ExecutionRecord={id:uid(),startedAt:started,finishedAt:finished,status:"success",result};
   setTasks(ts=>ts.map(t=>{if(t.id!==id)return t;const completed=t.frequency==="once" || Boolean(t.schedule?.maxRuns && t.runCount+1>=t.schedule.maxRuns);return {...t,lastRun:finished,runCount:t.runCount+1,history:[finished,...t.history].slice(0,50),executions:[record,...(t.executions||[])].slice(0,50),previousResult:t.lastResult,lastResult:result,lastError:undefined,enabled:!completed,status:completed?"completed":"active",nextRun:completed?t.nextRun:nextRun(new Date(),t.frequency,t.schedule)};}));
   await notify("Task completed",task.title);
  }catch(e){
   const message=e instanceof Error?e.message:"Task execution failed.",finished=new Date().toISOString(),record:ExecutionRecord={id:uid(),startedAt:started,finishedAt:finished,status:"failed",error:message};
   setTasks(ts=>ts.map(t=>t.id===id?{...t,lastRun:finished,runCount:t.runCount+1,history:[finished,...t.history].slice(0,50),executions:[record,...(t.executions||[])].slice(0,50),lastError:message,status:t.frequency==="once"?"failed":"active",nextRun:t.frequency==="once"?t.nextRun:nextRun(new Date(),t.frequency,t.schedule)}:t));
   await notify("Task failed",task.title);
  }finally{setRunning(null);}
 }

 useEffect(()=>{
  const timer=setInterval(()=>{const now=Date.now();tasks.filter(t=>t.enabled&&t.status==="active"&&new Date(t.nextRun).getTime()<=now).forEach(t=>executeTask(t.id));},15000);
  return()=>clearInterval(timer);
 },[tasks,ai,aiReady,running]);

 const visible=useMemo(()=>tasks.filter(t=>filter==="all"||(filter==="active"&&t.enabled)||(filter==="paused"&&!t.enabled)),[tasks,filter]);

 function openCreator(mode:"choose"|"manual"|"ai"="choose"){
  setCreatorMode(mode);setCreator(true);setError("");
 }
 function resetManual(){
  setManualTitle("");setManualDate(new Date().toISOString().slice(0,10));setManualTime("19:00");setManualFrequency("daily");setManualType("reminder");setManualMessage("");setManualLocation("");setManualTopic("");setManualUrl("");setManualScope("all updates");setManualCategory("AI & tech");setManualRegion("India");setManualInterval("120");setManualEndDate("");setManualMaxRuns("");
 }
 function makeManualTask(){
  setError("");
  if(!manualTitle.trim())return setError("Give the task a title.");
  if(manualFrequency==="once"&&new Date(manualDate+"T"+manualTime+":00")<=new Date())return setError("Choose a future time.");
  if(manualFrequency==="custom"&&Number(manualInterval)<1)return setError("Custom interval must be at least 1 minute.");
  if(manualMaxRuns&&Number(manualMaxRuns)<1)return setError("Maximum runs must be at least 1.");
  let action:TaskAction;
  let prompt="";
  if(manualType==="reminder"){if(!manualMessage.trim())return setError("Enter your reminder.");action={type:"reminder",message:manualMessage.trim()};prompt=manualMessage.trim();}
  else if(manualType==="weather"){if(!manualLocation.trim())return setError("Enter a weather location.");action={type:"weather",location:manualLocation.trim()};prompt="Get the current weather for "+manualLocation.trim()+".";}
  else if(manualType==="news"){const topic=manualTopic.trim()||manualNewsType;action={type:"news",topic,language:manualLanguage,category:manualCategory,region:manualRegion,scope:manualScope};prompt="Get the latest "+manualScope+" about "+topic+" for "+manualRegion+".";}
  else if(manualType==="anime"){const topic=manualTopic.trim()||"anime";action={type:"anime",topic,language:manualLanguage,scope:manualScope};prompt="Get "+manualScope+" about "+topic+".";}
  else if(manualType==="movie"){const topic=manualTopic.trim()||"movies";action={type:"movie",topic,language:manualLanguage,scope:manualScope};prompt="Get "+manualScope+" about "+topic+".";}
  else {if(!manualUrl.trim())return setError("Enter a URL.");action={type:"web",url:manualUrl.trim(),scope:manualScope};prompt="Check this public URL for "+manualScope+": "+manualUrl.trim();}
  const schedule:TaskSchedule={time:manualTime,startDate:manualDate,endDate:manualEndDate||undefined,weekday:manualFrequency==="weekly"?Number(manualWeekday):undefined,monthDay:manualFrequency==="monthly"?Number(manualMonthDay):undefined,intervalMinutes:manualFrequency==="custom"?Number(manualInterval):undefined,maxRuns:manualMaxRuns?Number(manualMaxRuns):undefined};
  const firstRun=buildFirstRun(manualDate,manualTime,manualFrequency,manualWeekday,manualMonthDay,Number(manualInterval));
  const task:Task={id:uid(),title:manualTitle.trim(),prompt,frequency:manualFrequency,nextRun:firstRun,enabled:true,status:"active",createdAt:new Date().toISOString(),runCount:0,history:[],executionMode:"direct",action,schedule};
  setTasks(prev=>[task,...prev]);notify("Task created",task.title);setCreator(false);resetManual();
 }
 async function createWithAI(){
  if(!aiReady){setCreator(false);setDraftAi(ai);setSettingsOpen(true);return;}
  setBusy(true);setProcessing("Understanding your request…");setError("");
  try{setProcessing("Creating a smart task plan…");const parsed=await createTaskWithAI(request,ai);setProcessing(parsed.executionMode==="direct"?"Setting up direct API execution…":"Finalizing AI execution…");const task=parsedTaskToTask(parsed,uid);setTasks(prev=>[task,...prev]);setRequest("");setCreator(false);notify("Task created",task.title);}
  catch(e){setError(e instanceof Error?e.message:"AI could not create the task.");}finally{setBusy(false);}
 }
 function saveSettings(){if(!draftAi.model.trim()){setError("Choose a model first.");return;}saveAISettings(draftAi);setAi(draftAi);setSettingsOpen(false);setError("");}
 function changeProvider(provider:AIProvider){const next={...draftAi,provider,endpoint:provider==="custom"?draftAi.endpoint:providerEndpoint(provider),model:""};setDraftAi(next);setModels(getModelHints(provider));setModelSearch("");setError("");}
 async function refreshModels(){setModelsBusy(true);setError("");try{const found=await searchModels(draftAi);setModels(found);if(found.length&&!draftAi.model)setDraftAi(prev=>({...prev,model:found[0].id}));}catch(e){setError(e instanceof Error?e.message:"Could not load models.");}finally{setModelsBusy(false);}}

 return <div className="app">
  <header><div><div className="eyebrow">AI AUTOMATION</div><h1>Tasks</h1></div><div className="headerActions"><button className="settingsBtn" onClick={()=>{setDraftAi(ai);setSettingsOpen(true)}}>⚙ AI</button><button className="iconBtn" onClick={()=>openCreator()}>＋</button></div></header>

  <div className={"aiStatus "+(aiReady?"ready":"warning")}><span className="statusDot"></span>{aiReady?"AI task creation ready":"AI setup required for AI tasks"}<button onClick={()=>{setDraftAi(ai);setSettingsOpen(true)}}>{aiReady?"Settings":"Configure"}</button></div>
  <div className="tabs"><button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>All</button><button className={filter==="active"?"on":""} onClick={()=>setFilter("active")}>Active</button><button className={filter==="paused"?"on":""} onClick={()=>setFilter("paused")}>Paused</button></div>

  {visible.length===0?<section className="empty"><div className="orb">✦</div><h2>What should I schedule?</h2><p>Create a task manually with no AI at run time, or let AI build a smart task from your words.</p><div className="emptyButtons"><button className="secondary wide" onClick={()=>openCreator("manual")}>＋ Manual task</button><button className="primary wide" onClick={()=>openCreator("ai")}>✨ AI task</button></div></section>:
   <main>{visible.map(t=><article className="card" key={t.id}>
    <div className="cardTop"><span className={"dot "+(t.enabled?"live":"paused")}></span><span>{t.enabled?"ACTIVE":t.status.toUpperCase()}</span><span className="modeBadge">{t.executionMode==="direct"?"DIRECT":"AI"}</span><button className="more" onClick={()=>setTasks(ts=>ts.filter(x=>x.id!==t.id))}>Delete</button></div>
    <h2>{t.title}</h2><p>{t.prompt}</p><div className="meta"><span>{frequencyLabels[t.frequency]}</span><span>Next · {new Date(t.nextRun).toLocaleString()}</span><span>Runs · {t.runCount}</span></div>{t.lastError&&<div className="error">{t.lastError}</div>}{t.lastResult&&<div className="resultPreview"><strong>Latest result</strong><p>{t.lastResult}</p></div>}
    <div className="actions"><button onClick={()=>setTasks(ts=>ts.map(x=>x.id===t.id?{...x,enabled:!x.enabled,status:x.enabled?"paused":"active"}:x))}>{t.enabled?"Pause":"Resume"}</button><button disabled={running===t.id} onClick={()=>executeTask(t.id)}>{running===t.id?"Running…":"Run now"}</button></div>
   </article>)}</main>}

  <section className="starter"><h3>Quick create</h3><div className="starterGrid"><button onClick={()=>openCreator("manual")}>🛠️<b>Manual task</b><small>Choose time + action yourself</small></button><button onClick={()=>{openCreator("ai");setRequest("Every morning at 7 AM, give me today's weather details for my city.")}}>✨<b>AI task</b><small>Describe what you want</small></button></div></section>

  {creator&&<div className="modal"><div className="sheet creatorSheet">
   {creatorMode==="choose"&&<><div className="sheetHead"><div><div className="eyebrow">CREATE TASK</div><h2>How do you want to create it?</h2></div><button onClick={()=>setCreator(false)}>×</button></div><div className="modeCards"><button onClick={()=>setCreatorMode("manual")}><span>🛠️</span><b>Manual task</b><small>Pick the schedule and action yourself. Direct APIs run it without AI.</small></button><button onClick={()=>setCreatorMode("ai")}><span>✨</span><b>AI task</b><small>Describe it naturally. AI creates the task plan and chooses direct APIs when possible.</small></button></div></>}
   {creatorMode==="manual"&&<><div className="sheetHead"><div><div className="eyebrow">MANUAL TASK</div><h2>Build it yourself</h2></div><button onClick={()=>setCreator(false)}>×</button></div>
    <label>Task name<input value={manualTitle} onChange={e=>setManualTitle(e.target.value)} placeholder="e.g. Morning weather"/></label>
    <div className="sectionLabel">1 · Schedule</div>
    <div className="twoCols"><label>Time<input type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)}/></label><label>Frequency<select value={manualFrequency} onChange={e=>setManualFrequency(e.target.value as Frequency)}><option value="once">Once</option><option value="hourly">Every hour</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="custom">Custom interval</option></select></label></div>
    {manualFrequency!=="hourly"&&<label>{manualFrequency==="once"?"Date":"Start date"}<input type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)}/></label>}
    {manualFrequency==="weekly"&&<label>Day<select value={manualWeekday} onChange={e=>setManualWeekday(e.target.value)}><option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option></select></label>}
    {manualFrequency==="monthly"&&<label>Day of month<input type="number" min="1" max="31" value={manualMonthDay} onChange={e=>setManualMonthDay(e.target.value)}/></label>}
    {manualFrequency==="custom"&&<label>Run every (minutes)<input type="number" min="1" value={manualInterval} onChange={e=>setManualInterval(e.target.value)}/></label>}
    {manualFrequency!=="once"&&<div className="twoCols"><label>End date (optional)<input type="date" value={manualEndDate} onChange={e=>setManualEndDate(e.target.value)}/></label><label>Max runs (optional)<input type="number" min="1" value={manualMaxRuns} onChange={e=>setManualMaxRuns(e.target.value)} placeholder="Unlimited"/></label></div>
    <div className="sectionLabel">2 · Action</div>
    <label>Action<select value={manualType} onChange={e=>setManualType(e.target.value as any)}><option value="reminder">🔔 Reminder</option><option value="weather">🌤️ Weather</option><option value="news">📰 News</option><option value="anime">🍿 Anime</option><option value="movie">🎬 Movies</option><option value="web">🌐 Website / RSS</option></select></label>
    {manualType==="reminder"&&<label>Reminder text<textarea value={manualMessage} onChange={e=>setManualMessage(e.target.value)} placeholder="Remind me to pay money."/></label>}
    {manualType==="weather"&&<label>Location<input value={manualLocation} onChange={e=>setManualLocation(e.target.value)} placeholder="Berhampore, West Bengal"/></label>}
    {(manualType==="news"||manualType==="anime"||manualType==="movie"||manualType==="web")&&<label>What to monitor<select value={manualScope} onChange={e=>setManualScope(e.target.value)}><option>all updates</option><option>new episode</option><option>new season</option><option>Hindi dubbed release</option><option>release date</option><option>price change</option><option>major updates</option><option>only when changed</option></select></label>}
    {(manualType==="news"||manualType==="anime"||manualType==="movie")&&<><label>{manualType==="anime"?"Anime title / topic":manualType==="movie"?"Movie / topic":"Topic"}<input value={manualTopic} onChange={e=>setManualTopic(e.target.value)} placeholder={manualType==="anime"?"BLACK TORCH":manualType==="movie"?"Movie title or genre":"e.g. AI & tech"}/></label><div className="twoCols"><label>Language<select value={manualLanguage} onChange={e=>setManualLanguage(e.target.value)}><option value="hi">Hindi</option><option value="en">English</option><option value="bn">Bengali</option></select></label><label>Region<input value={manualRegion} onChange={e=>setManualRegion(e.target.value)}/></label></div>{manualType==="news"&&<label>Category<select value={manualCategory} onChange={e=>setManualCategory(e.target.value)}><option>AI & tech</option><option>Gaming</option><option>Science & space</option><option>India & world</option><option>Entertainment</option><option>Custom</option></select></label>}</>}
    {manualType==="web"&&<label>Public URL / RSS URL<input value={manualUrl} onChange={e=>setManualUrl(e.target.value)} placeholder="https://example.com/feed.xml"/></label>}
    {error&&<div className="error">{error}</div>}<button className="primary wide" onClick={makeManualTask}>＋ Create manual task</button>
   </>}
   {creatorMode==="ai"&&<><div className="sheetHead"><div><div className="eyebrow">AI TASK CREATOR</div><h2>Tell AI what to do</h2></div><button onClick={()=>setCreator(false)}>×</button></div><p className="hint">Example: “Every day at 7 AM, tell me the weather in Berhampore.” If direct data is available, the task will use the API at run time instead of AI.</p><textarea className="aiInput" autoFocus placeholder="Describe your task in natural language..." value={request} onChange={e=>setRequest(e.target.value)}/>{busy&&<div className="processing"><span className="spinner"></span><div><strong>{processing}</strong><small>AI is creating the task plan</small></div></div>}{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy} onClick={createWithAI}>{busy?"✨ Creating task…":"✨ Create with AI"}</button>{!aiReady&&<button className="textBtn" onClick={()=>{setCreator(false);setDraftAi(ai);setSettingsOpen(true)}}>Configure AI first →</button>}</>}
  </div></div>}

  {settingsOpen&&<div className="modal"><div className="sheet"><div className="sheetHead"><div><div className="eyebrow">AI SETTINGS</div><h2>AI provider</h2></div><button onClick={()=>setSettingsOpen(false)}>×</button></div><p className="hint">AI is used only where the task needs it. Your key stays in this browser.</p><label>AI provider<select value={draftAi.provider} onChange={e=>changeProvider(e.target.value as AIProvider)}>{Object.entries(providerLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{draftAi.provider==="custom"&&<label>OpenAI-compatible endpoint<input value={draftAi.endpoint} onChange={e=>setDraftAi({...draftAi,endpoint:e.target.value})}/></label>}<label>API key<input type="password" value={draftAi.apiKey} onChange={e=>setDraftAi({...draftAi,apiKey:e.target.value})} placeholder="Paste your own API key"/></label><div className="modelHeader"><label>Model</label><button className="refreshModels" disabled={modelsBusy} onClick={refreshModels}>{modelsBusy?"Loading…":"↻ Search models"}</button></div><input className="modelSearch" placeholder="Search model name…" value={modelSearch} onChange={e=>setModelSearch(e.target.value)}/><select value={draftAi.model} onChange={e=>setDraftAi({...draftAi,model:e.target.value})}><option value="">Select a model</option>{models.filter(m=>(m.name||m.id).toLowerCase().includes(modelSearch.toLowerCase())).slice(0,100).map(m=><option key={m.id} value={m.id}>{m.name||m.id} — {m.id}</option>)}</select><div className="modelHint">{models.length} models loaded · {providerLabels[draftAi.provider]}</div>{error&&<div className="error">{error}</div>}<button className="primary wide" onClick={saveSettings}>Save AI settings</button></div></div>}
 </div>;
}
export default App;
