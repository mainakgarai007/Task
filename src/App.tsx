import {useEffect,useMemo,useRef,useState} from "react";
import {Task,frequencyLabels,ExecutionRecord,Frequency,TaskAction,TaskSchedule,NotificationMode,TaskAcknowledgement,TaskThenAction,TaskCondition,TaskConditionGroup,TaskConditionNode,ConditionField} from "./types";
import {loadTasks,saveTasks,uid,normalizeTasks} from "./storage";
import {nextRun,notify} from "./scheduler";
import {evaluateCondition,evaluateConditionTree} from "./conditions";
import {createTaskWithAI,loadAISettings,parsedTaskToTask,saveAISettings,AISettings,AIProvider,providerLabels,providerEndpoint,getModelHints,searchModels,AIModel,executeTaskWithAI} from "./ai";
import {executeDirectTask,getCurrentLocation,reverseGeocodeIndia,searchAnime} from "./dataSources";

function localISO(date:Date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function formatDateDMY(value:string){if(!value)return "";const m=value.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+"/"+m[2]+"/"+m[1]:value;}
function parseDateDMY(value:string){const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return "";const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]);const d=new Date(year,month-1,day);if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return "";return year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0");}
function localDateISO(date:Date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");}
function formatDateTime(value:string){const d=new Date(value);if(Number.isNaN(d.getTime()))return value;return formatDateDMY(localDateISO(d))+", "+d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});}
function DateField({value,onChange,placeholder="DD/MM/YYYY"}:{value:string;onChange:(value:string)=>void;placeholder?:string}){const [draft,setDraft]=useState(()=>formatDateDMY(value));useEffect(()=>setDraft(formatDateDMY(value)),[value]);function change(raw:string){const digits=raw.replace(/\D/g,"").slice(0,8);let next=digits;if(digits.length>4)next=digits.slice(0,2)+"/"+digits.slice(2,4)+"/"+digits.slice(4);else if(digits.length>2)next=digits.slice(0,2)+"/"+digits.slice(2);setDraft(next);if(next==="")onChange("");else if(next.length===10){const iso=parseDateDMY(next);if(iso)onChange(iso);}}return <input type="text" inputMode="numeric" autoComplete="off" maxLength={10} value={draft} onChange={e=>change(e.target.value)} onBlur={()=>{if(draft&&draft.length===10&&!parseDateDMY(draft))setDraft(formatDateDMY(value));}} placeholder={placeholder} aria-label={placeholder}/>}
function buildFirstRun(date:string,time:string,frequency:Frequency,weekday:string,monthDay:string,intervalMinutes=60,weekdays:number[]=[Number(weekday)],months:number[]=Array.from({length:12},(_,i)=>i),monthDays:number[]=[Number(monthDay)||1]){
 const now=new Date();
 if(frequency==="hourly"){const start=new Date(date+"T00:00:00");return start>now?start.toISOString():new Date(now.getTime()+60*60*1000).toISOString();}
 if(frequency==="custom"){const start=new Date(date+"T00:00:00"),interval=Math.max(1,intervalMinutes)*60000;return start>now?new Date(start.getTime()+interval).toISOString():new Date(now.getTime()+interval).toISOString();}
 const d=new Date(date+"T"+(time||"00:00")+":00");
 if(frequency==="daily"||frequency==="weekly"){const days=weekdays.length?weekdays:[Number(weekday)];const cursor=d>now?new Date(d):new Date(now);cursor.setSeconds(0,0);for(let offset=0;offset<8;offset++){const candidate=new Date(cursor);candidate.setDate(cursor.getDate()+offset);candidate.setSeconds(0,0);if(days.includes(candidate.getDay())){if(offset===0&&candidate.getTime()<=now.getTime()){continue;}return candidate.toISOString();}}cursor.setDate(cursor.getDate()+7);return cursor.toISOString();}
 if(frequency==="monthly"){const ms=months.length?months:Array.from({length:12},(_,i)=>i),ds=(monthDays.length?monthDays:[Number(monthDay)||1]).sort((x,y)=>x-y);for(let offset=0;offset<24;offset++){const probe=d.getMonth()+offset,year=d.getFullYear()+Math.floor(probe/12),month=probe%12;if(!ms.includes(month))continue;const last=new Date(year,month+1,0).getDate();for(const day of ds){const candidate=new Date(year,month,Math.min(day,last));candidate.setHours(d.getHours(),d.getMinutes(),0,0);if(candidate>now)return candidate.toISOString();}}}
 return d.toISOString();
}

const conditionFieldOptions:{value:ConditionField;label:string}[]=[
 {value:"result",label:"Any result text"},{value:"weather",label:"Weather state"},{value:"temperature",label:"Temperature (°C)"},{value:"feels_like",label:"Feels like (°C)"},{value:"rain_probability",label:"Rain probability (%)"},{value:"cloud_cover",label:"Cloud cover (%)"},{value:"humidity",label:"Humidity (%)"},{value:"wind",label:"Wind (km/h)"},{value:"uv",label:"UV index"},{value:"visibility",label:"Visibility (km)"},{value:"time",label:"Time"},{value:"day",label:"Day"},{value:"changed",label:"Changed state"}
];
function newCondition():TaskCondition{return {type:"condition",source:"result",field:"result",operator:"contains",value:""}}
function newConditionGroup():TaskConditionGroup{return {type:"group",join:"all",children:[newCondition()]}}
function conditionTreeHasLeaves(node:TaskConditionNode):boolean{return node.type==="group"?node.children.some(conditionTreeHasLeaves):true}
function legacyToConditionTree(task:Task):TaskConditionGroup{const rules=task.action?.conditionRules?.length?task.action.conditionRules:(task.action?.conditionRule?[task.action.conditionRule]:[]);return {type:"group",join:task.action?.conditionJoin==="any"?"any":"all",children:rules.map(r=>({...r,type:"condition"}))}}
function ConditionBuilder({node,onChange,onRemove,depth=0}:{node:TaskConditionNode;onChange:(node:TaskConditionNode)=>void;onRemove?:()=>void;depth?:number}){
 if(node.type!=="group"){
  const leaf=node as TaskCondition;
  const sourceChanged=(source:TaskCondition["source"])=>{const nextField:ConditionField=source==="changed"?"changed":source==="time"?"time":source==="day"?"day":(leaf.field||"result");onChange({...leaf,source,field:nextField})};
  return <div className="ruleBox" style={{marginLeft:Math.min(depth,5)*10}}>
   <div className="threeCols"><select value={leaf.source} onChange={e=>sourceChanged(e.target.value as TaskCondition["source"])}><option value="result">Current result</option><option value="previousResult">Previous result</option><option value="changed">Changed state</option><option value="time">Current time</option><option value="day">Day of week</option></select>
   <select value={leaf.field||"result"} disabled={leaf.source==="changed"||leaf.source==="time"||leaf.source==="day"} onChange={e=>onChange({...leaf,field:e.target.value as ConditionField})}>{conditionFieldOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
   <select value={leaf.operator} onChange={e=>onChange({...leaf,operator:e.target.value as TaskCondition["operator"]})}><option value="contains">contains</option><option value="not_contains">does not contain</option><option value="equals">equals</option><option value="not_equals">does not equal</option><option value="starts_with">starts with</option><option value="ends_with">ends with</option><option value="greater_than">greater than</option><option value="less_than">less than</option><option value="greater_or_equal">greater/equal</option><option value="less_or_equal">less/equal</option></select></div>
   <div className="thenActionRow" style={{marginTop:8}}><input value={leaf.value||""} onChange={e=>onChange({...leaf,value:e.target.value})} placeholder={leaf.field==="weather"?"e.g. Rain":leaf.field==="day"?"e.g. Sunday":leaf.field==="time"?"e.g. 07:00":"value, e.g. 30"}/>{onRemove&&<button type="button" className="dangerBtn" onClick={onRemove}>Remove</button>}</div>
  </div>;
 }
 const group=node; const updateChild=(index:number,next:TaskConditionNode)=>onChange({...group,children:group.children.map((child,i)=>i===index?next:child)});
 const removeChild=(index:number)=>onChange({...group,children:group.children.filter((_,i)=>i!==index)});
 return <div className="ruleBox" style={{marginLeft:Math.min(depth,5)*10}}><div className="fieldLabel">IF GROUP</div>
  <div className="threeCols"><select value={group.join} onChange={e=>onChange({...group,join:e.target.value as "all"|"any"})}><option value="all">AND — all conditions</option><option value="any">OR — any condition</option></select><label className="checkRow"><input type="checkbox" checked={Boolean(group.negated)} onChange={e=>onChange({...group,negated:e.target.checked})}/><span>NOT group</span></label>{onRemove&&<button type="button" className="dangerBtn" onClick={onRemove}>Remove group</button>}</div>
  <div style={{display:"grid",gap:8,marginTop:8}}>{group.children.map((child,index)=><div key={index}>{index>0&&<div className="hint" style={{padding:"2px 0"}}>{group.join==="all"?"AND":"OR"}</div>}<ConditionBuilder node={child} depth={depth+1} onChange={next=>updateChild(index,next)} onRemove={()=>removeChild(index)}/></div>)}</div>
  <div className="thenRowButtons" style={{marginTop:8}}><button type="button" className="secondary" onClick={()=>onChange({...group,children:[...group.children,newCondition()]})}>＋ Condition</button><button type="button" className="secondary" onClick={()=>onChange({...group,children:[...group.children,newConditionGroup()]})}>＋ Nested group</button></div>
 </div>;
}
function App(){
 const [tasks,setTasks]=useState<Task[]>(loadTasks);
 const [filter,setFilter]=useState<"all"|"active"|"paused">("all");
 const [creator,setCreator]=useState(false);
 const [creatorMode,setCreatorMode]=useState<"choose"|"manual"|"ai">("choose");
 const [editingId,setEditingId]=useState<string|null>(null);
 const [deleteTarget,setDeleteTarget]=useState<Task|null>(null);
 const [historyTarget,setHistoryTarget]=useState<Task|null>(null);
 const [manualOpen,setManualOpen]=useState(false);
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
 const executionLocks=useRef<Set<string>>(new Set());
 const tasksRef=useRef<Task[]>(tasks);
 const executeTaskRef=useRef<(id:string,manual?:boolean)=>void>(()=>{});
 const [manualTitle,setManualTitle]=useState("");
 const [manualDate,setManualDate]=useState(new Date().toISOString().slice(0,10));
 const [manualTime,setManualTime]=useState("19:00");
 const [manualFrequency,setManualFrequency]=useState<Frequency>("daily");
 const [manualWeekday,setManualWeekday]=useState("1");
 const [manualWeekdays,setManualWeekdays]=useState<number[]>([1]);
 const [manualMonthDay,setManualMonthDay]=useState("1");
  const [manualMonths,setManualMonths]=useState<number[]>([0,1,2,3,4,5,6,7,8,9,10,11]);
  const [manualMonthDays,setManualMonthDays]=useState<number[]>([1]);
 const [manualType,setManualType]=useState<"reminder"|"weather"|"news"|"anime"|"movie"|"web">("reminder");
 const [manualMessage,setManualMessage]=useState("");
 const [manualLocation,setManualLocation]=useState("");
 const [weatherSearch,setWeatherSearch]=useState("");
 const [weatherPlaces,setWeatherPlaces]=useState<{name:string;state?:string;country:string;latitude:number;longitude:number}[]>([]);
 const [weatherBusy,setWeatherBusy]=useState(false);
 const [manualWeatherCoords,setManualWeatherCoords]=useState<{latitude:number;longitude:number}|null>(null);
 const [manualWeatherLocationMode,setManualWeatherLocationMode]=useState<"manual"|"auto-once"|"auto-live">("manual");
 const [locationBusy,setLocationBusy]=useState(false);
 const [manualNewsType,setManualNewsType]=useState("new anime Hindi dubbed release");
 const [manualLanguage,setManualLanguage]=useState("hi");
 const [manualTopic,setManualTopic]=useState("");
 const [animeSearchResults,setAnimeSearchResults]=useState<{id:number;source:"anilist"|"jikan";title:string;type?:string;status?:string;episodes?:number|null;season?:string|null;seasonYear?:number|null}[]>([]);
 const [animeSearchBusy,setAnimeSearchBusy]=useState(false);
 const [selectedAnimeId,setSelectedAnimeId]=useState<number|undefined>(undefined);
 const [selectedAnimeSource,setSelectedAnimeSource]=useState<"anilist"|"jikan"|undefined>(undefined);
 const [manualTopicPreset,setManualTopicPreset]=useState("Custom");
 const [manualUrl,setManualUrl]=useState("");
 const [manualScope,setManualScope]=useState("all updates");
 const [manualCategory,setManualCategory]=useState("AI & tech");
 const [manualRegion,setManualRegion]=useState("India");
 const [manualInterval,setManualInterval]=useState("120");
 const [manualEndDate,setManualEndDate]=useState("");
 const [manualMaxRuns,setManualMaxRuns]=useState("");
 const [manualNotifyChange,setManualNotifyChange]=useState(false);
 const [manualCondition,setManualCondition]=useState("");
 const [manualStopCondition,setManualStopCondition]=useState("");
 const [manualConditionSource,setManualConditionSource]=useState<"result"|"previousResult"|"changed"|"time"|"day">("result");
 const [manualConditionOperator,setManualConditionOperator]=useState<"contains"|"not_contains"|"equals"|"not_equals"|"starts_with"|"ends_with"|"greater_than"|"less_than"|"greater_or_equal"|"less_or_equal">("contains");
 const [manualConditionValue,setManualConditionValue]=useState("");
 const [manualStopSource,setManualStopSource]=useState<"result"|"previousResult"|"changed"|"time"|"day">("result");
 const [manualStopOperator,setManualStopOperator]=useState<"contains"|"not_contains"|"equals"|"not_equals"|"starts_with"|"ends_with"|"greater_than"|"less_than"|"greater_or_equal"|"less_or_equal">("contains");
 const [manualStopValue,setManualStopValue]=useState("");
 const [manualIfEnabled,setManualIfEnabled]=useState(false);
const [manualConditionTree,setManualConditionTree]=useState<TaskConditionGroup>(newConditionGroup());
 const [manualSecondIfEnabled,setManualSecondIfEnabled]=useState(false);
 const [manualSecondSource,setManualSecondSource]=useState<"result"|"previousResult"|"changed"|"time"|"day">("day");
 const [manualSecondOperator,setManualSecondOperator]=useState<"contains"|"not_contains"|"equals"|"not_equals"|"starts_with"|"ends_with"|"greater_than"|"less_than"|"greater_or_equal"|"less_or_equal">("equals");
 const [manualSecondValue,setManualSecondValue]=useState("");
 const [manualThen,setManualThen]=useState<"notify"|"stop"|"notify_and_stop"|"sound"|"create_task"|"wait">("notify");
 const [manualWaitMinutes,setManualWaitMinutes]=useState("5");
 const [manualThenActions,setManualThenActions]=useState<TaskThenAction[]>([{type:"notify"}]);
 const [manualThenDragIndex,setManualThenDragIndex]=useState<number|null>(null);
 const [manualNotificationMode,setManualNotificationMode]=useState<NotificationMode>("disable");
 const [manualRemindMinutes,setManualRemindMinutes]=useState("5");
 const [manualSequenceEnabled,setManualSequenceEnabled]=useState(false);
 const [manualSequenceCurrent,setManualSequenceCurrent]=useState("1");
 const [manualSequenceEnd,setManualSequenceEnd]=useState("1");
 const [manualSequenceStep,setManualSequenceStep]=useState("1");
 const aiReady=Boolean(ai.apiKey.trim()&&ai.endpoint.trim()&&ai.model.trim());

 useEffect(()=>{tasksRef.current=tasks;},[tasks]);
 useEffect(()=>{saveTasks(tasks);},[tasks]);
 useEffect(()=>{if(!aiReady)return;setTasks(ts=>ts.map(t=>t.executionState==="waiting"&&t.waitingReason==="AI settings are required"?{...t,executionState:"idle",waitingReason:undefined}:t));},[aiReady]);
 useEffect(()=>{if(manualType!=="weather"){setWeatherPlaces([]);return;}const q=weatherSearch.trim();if(!q){setWeatherPlaces([]);return;}const timer=setTimeout(async()=>{setWeatherBusy(true);try{const r=await fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(q)+"&count=100&language=en&format=json&countryCode=IN");if(!r.ok)throw new Error();const d=await r.json();setWeatherPlaces((d?.results||[]).filter((p:any)=>p.country_code==="IN").map((p:any)=>({name:p.name,state:p.admin1,country:p.country,latitude:p.latitude,longitude:p.longitude})));}catch{setWeatherPlaces([]);}finally{setWeatherBusy(false);}},280);return()=>clearTimeout(timer);},[weatherSearch,manualType]);
 useEffect(()=>{if(manualType!=="anime"){setAnimeSearchResults([]);return;}const q=manualTopic.trim();if(!q){setAnimeSearchResults([]);return;}const timer=setTimeout(async()=>{setAnimeSearchBusy(true);try{setAnimeSearchResults(await searchAnime(q));}catch{setAnimeSearchResults([]);}finally{setAnimeSearchBusy(false);}},350);return()=>clearTimeout(timer);},[manualTopic,manualType]);


 async function acknowledgeTask(taskId:string,ackId:string,mode:"seen"|"completed"){
  const task=tasksRef.current.find(t=>t.id===taskId);
  if(!task?.pendingAcknowledgement||task.pendingAcknowledgement.id!==ackId)return;
  const now=new Date().toISOString();
  setTasks(ts=>ts.map(t=>{
   if(t.id!==taskId||t.pendingAcknowledgement?.id!==ackId)return t;
   const pending=t.pendingAcknowledgement;
   const ack:TaskAcknowledgement={...pending,status:mode==="completed"?"completed":"seen",updatedAt:now,nextReminderAt:undefined};
   let sequence=t.sequence;
   let completed=t.status==="completed";
   let enabled=t.enabled;
   if(mode==="completed"){
    if(pending.terminalAfterAcknowledgement){completed=true;enabled=false;}
    else if(sequence?.enabled){
     const next=sequence.current+sequence.step;
     if(next>sequence.end){completed=true;enabled=false;sequence={...sequence,current:sequence.end};}
     else sequence={...sequence,current:next};
    }else if(t.frequency==="once"){completed=true;enabled=false;}
   }
   return {...t,pendingAcknowledgement:undefined,acknowledgements:[ack,...(t.acknowledgements||[])].slice(0,50),sequence,status:completed?"completed":t.status,enabled};
  }));
 }
 useEffect(()=>{
  const timer=setInterval(()=>{
   const now=Date.now();
   tasksRef.current.forEach(t=>{
    const p=t.pendingAcknowledgement;
    if(p?.mode==="completed"&&p.status==="pending"&&p.nextReminderAt&&new Date(p.nextReminderAt).getTime()<=now){
     const mins=Math.max(1,t.remindIfNotCompletedMinutes||5);
     notify("Task reminder",t.title+"\nStill waiting for completion.");
     setTasks(ts=>ts.map(x=>x.id===t.id&&x.pendingAcknowledgement?.id===p.id?{...x,pendingAcknowledgement:{...p,nextReminderAt:new Date(now+mins*60000).toISOString()}}:x));
    }
   });
  },15000);
  return()=>clearInterval(timer);
 },[]);
 async function executeTask(id:string,manual=false){
  if(executionLocks.current.has(id))return;
  const task=tasks.find(x=>x.id===id);if(!task||!task.enabled||task.status==="completed"||task.executionState==="running")return;
  executionLocks.current.add(id);
  const mode=task.executionMode||"ai";
  if(mode==="ai"&&!aiReady){
   executionLocks.current.delete(id);
   setTasks(ts=>ts.map(t=>t.id===id?{...t,executionState:"waiting",waitingReason:"AI settings are required"}:t));
   setError("AI settings are required for this AI task.");setDraftAi(ai);setSettingsOpen(true);return;
  }
  setTasks(ts=>ts.map(t=>t.id===id?{...t,executionState:"running",waitingReason:undefined}:t));
  const started=new Date().toISOString();
  try{
   const result=mode==="direct"?await executeDirectTask(task):await executeTaskWithAI(task,ai);
   const finished=new Date().toISOString(),record:ExecutionRecord={id:uid(),startedAt:started,finishedAt:finished,status:"success",result};
   const normalize=(value:string)=>value.toLowerCase().replace(/\s+/g," ").trim();
   const previous=task.lastResult||"";
   const changed=normalize(previous)!==normalize(result);
   const scope=(task.action?.scope||"").toLowerCase();
   const trackedUpdate=["new episode","new season","release date","only when changed"].includes(scope);
   const nowForCondition=new Date(finished);
   const conditionValues={result,previousResult:previous,changed,time:nowForCondition.toTimeString().slice(0,5),day:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][nowForCondition.getDay()]};
   const rules=task.action?.conditionRules?.length?task.action.conditionRules:(task.action?.conditionRule?[task.action.conditionRule]:[]);
   const conditionMatched=task.action?.conditionTree?evaluateConditionTree(task.action.conditionTree,conditionValues):rules.length?(task.action?.conditionJoin==="any"?rules.some(rule=>evaluateCondition(rule,conditionValues)):rules.every(rule=>evaluateCondition(rule,conditionValues))):(!task.action?.condition||normalize(result).includes(normalize(task.action.condition)));
   const conditionThen=task.action?.conditionThen||"notify";
   const conditionWaitMinutes=Math.max(1,task.action?.waitMinutes||5);
   const conditionOk=conditionMatched&&(conditionThen==="notify"||conditionThen==="notify_and_stop"||conditionThen==="sound"||conditionThen==="create_task"||conditionThen==="wait");
   const stopHit=(conditionMatched&&(conditionThen==="stop"||conditionThen==="notify_and_stop"))||(task.action?.stopConditionRule?evaluateCondition(task.action.stopConditionRule,conditionValues):Boolean(task.action?.stopCondition&&normalize(result).includes(normalize(task.action.stopCondition))));
   const terminalAfterExecution=task.frequency==="once" || stopHit || Boolean(task.schedule?.maxRuns && task.runCount+1>=task.schedule.maxRuns) || Boolean(task.schedule?.endDate && new Date(finished).toISOString().slice(0,10)>task.schedule.endDate);
   const requiresAcknowledgement=task.notificationMode==="see"||task.notificationMode==="completed";
   const completed=terminalAfterExecution&&!requiresAcknowledgement;
   const executionEnded=completed||(requiresAcknowledgement&&terminalAfterExecution&&task.notificationMode==="see");
   const recurringNext=manual&&task.frequency!=="once"?(()=>{let candidate=new Date(task.nextRun),guard=0;while(candidate.getTime()<=Date.now()&&guard++<1000)candidate=new Date(nextRun(candidate,task.frequency,task.schedule));return candidate.toISOString();})():nextRun(new Date(),task.frequency,task.schedule);
   const sequenceValue=task.sequence?.enabled?task.sequence.current:undefined;
   const acknowledgement:TaskAcknowledgement|undefined=requiresAcknowledgement?{id:uid(),executionId:record.id,mode:task.notificationMode==="completed"?"completed":"see",status:"pending",createdAt:finished,remindEveryMinutes:task.notificationMode==="completed"?Math.max(1,task.remindIfNotCompletedMinutes||5):undefined,nextReminderAt:task.notificationMode==="completed"?new Date(Date.now()+Math.max(1,task.remindIfNotCompletedMinutes||5)*60000).toISOString():undefined,sequenceValue,terminalAfterAcknowledgement:terminalAfterExecution}:undefined;
   setTasks(ts=>ts.map(t=>t.id===id?{...t,lastRun:finished,runCount:t.runCount+1,history:[finished,...t.history].slice(0,50),executions:[record,...(t.executions||[])].slice(0,50),previousResult:t.lastResult,lastResult:result,lastError:undefined,executionState:"idle",waitingReason:undefined,enabled:!executionEnded,status:executionEnded?"completed":"active",nextRun:executionEnded?t.nextRun:recurringNext,pendingAcknowledgement:acknowledgement}:t));
   if(acknowledgement)await notify(task.notificationMode==="completed"?"Task reminder":"Task update",task.title+"\n"+(sequenceValue!=null?"Step "+sequenceValue+" · ":"")+result.slice(0,300));
   // A plain direct task must still notify when acknowledgement mode is disabled.
   // IF/THEN chains own their notifications, so avoid duplicate alerts there.
   const ruleConfigured=Boolean(rules.length||task.action?.condition||task.action?.thenActions?.length);
   const changeAllowed=!task.action?.notifyOnChange||changed;
   const trackedAllowed=!trackedUpdate||(task.runCount===0||changed);
   if(!acknowledgement&&task.notificationMode==="disable"&&!ruleConfigured&&changeAllowed&&trackedAllowed){
    await notify("Task update",task.title+"\n"+(sequenceValue!=null?"Step "+sequenceValue+" · ":"")+result.slice(0,300));
   }
   if(conditionOk && (!trackedUpdate ? (!task.action?.notifyOnChange || changed) : (task.runCount===0 || changed))){
    let chain:TaskThenAction[]=task.action?.thenActions?.length?task.action.thenActions:[];
    if(!chain.length){if(conditionThen==="notify_and_stop")chain=[{type:"notify"},{type:"stop"}];else if(conditionThen==="wait")chain=[{type:"wait",minutes:conditionWaitMinutes}];else if(conditionThen==="notify"||conditionThen==="sound"||conditionThen==="create_task")chain=[{type:conditionThen}];}
    for(const rawStep of chain){
     const step:TaskThenAction=rawStep;
     if(step.type==="notify"||step.type==="reminder") await notify(step.type==="reminder"?"Reminder":"Task completed",step.message?.trim()||task.title+"\n"+result.slice(0,300));
     else if(step.type==="sound"){
      try{const AC=window.AudioContext||(window as any).webkitAudioContext;if(AC){const ac=new AC();const osc=ac.createOscillator(),gain=ac.createGain();osc.frequency.value=step.seconds&&step.seconds<1?660:880;gain.gain.value=0.08;osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+0.35);}}catch{}
     } else if(step.type==="wait"){
      const ms=Math.max(100,Number(step.seconds||0)*1000+Number(step.minutes||0)*60000);
      await new Promise(resolve=>setTimeout(resolve,ms));
     } else if(step.type==="open_link"){
      if(step.url?.trim()) window.open(step.url.trim(),"_blank","noopener,noreferrer");
     } else if(step.type==="create_task"){
      if(aiReady){try{const follow=await createTaskWithAI("Create the next relevant follow-up task based on this completed automation. Use this result as context and schedule it appropriately. Result: "+result,ai);const next=parsedTaskToTask(follow,uid);setTasks(ts=>[next,...ts]);await notify("Follow-up task created",next.title);}catch(e){await notify("Follow-up task failed",e instanceof Error?e.message:"Could not create follow-up task.");}}else await notify("AI required","Add AI settings to create follow-up tasks automatically.");
     } else if(step.type==="save_result"){
      setTasks(ts=>ts.map(x=>x.id===id?{...x,lastResult:result}:x));
     } else if(step.type==="run_task"){
      if(step.taskId&&step.taskId!==id) await executeTaskRef.current(step.taskId,true);
     } else if(step.type==="stop"||step.type==="complete"){
      setTasks(ts=>ts.map(x=>x.id===id?{...x,enabled:false,status:"completed"}:x));
      break;
     }
    }
   }
  }catch(e){
   const message=e instanceof Error?e.message:"Task execution failed.",finished=new Date().toISOString(),record:ExecutionRecord={id:uid(),startedAt:started,finishedAt:finished,status:"failed",error:message};
   setTasks(ts=>ts.map(t=>t.id===id?{...t,lastRun:finished,runCount:t.runCount+1,history:[finished,...t.history].slice(0,50),executions:[record,...(t.executions||[])].slice(0,50),lastError:message,executionState:"idle",waitingReason:undefined,enabled:t.frequency==="once"?false:t.enabled,status:t.frequency==="once"?"failed":"active",nextRun:t.frequency==="once"?t.nextRun:nextRun(new Date(),t.frequency,t.schedule)}:t));
   await notify("Task failed",task.title);
  }finally{executionLocks.current.delete(id);}
 }
 executeTaskRef.current=executeTask;

 useEffect(()=>{
  const timer=setInterval(()=>{
   const now=Date.now();
   tasksRef.current.filter(t=>{
    if(t.executionState==="waiting"&&t.waitingReason==="AI settings are required")return false;
    if(!t.enabled||t.status!=="active"||t.pendingAcknowledgement?.status==="pending"||new Date(t.nextRun).getTime()>now)return false;
    if(t.schedule?.endDate&&new Date(t.schedule.endDate+"T23:59:59").getTime()<now){
     setTasks(ts=>ts.map(x=>x.id===t.id?{...x,enabled:false,status:"completed",executionState:"idle"}:x));
     return false;
    }
    return true;
   }).forEach(t=>executeTaskRef.current(t.id,false));
  },15000);
  return()=>clearInterval(timer);
 },[]);

 const visible=useMemo(()=>tasks.filter(t=>filter==="all"||(filter==="active"&&t.enabled)||(filter==="paused"&&!t.enabled)),[tasks,filter]);

 function fillManualFromTask(task:Task){
  const s:TaskSchedule=task.schedule||{time:""};
  setManualTitle(task.title);
  setManualTime(s.time||new Date(task.nextRun).toTimeString().slice(0,5));
  setManualDate(s.startDate||localDateISO(new Date(task.nextRun)));
  setManualFrequency(task.frequency);
  setManualWeekday(String(s.weekday??1));
  setManualWeekdays(task.frequency==="daily"?(s.weekdays?.length?s.weekdays:[0,1,2,3,4,5,6]):(s.weekdays?.length?s.weekdays:[s.weekday??1]));
  setManualMonthDay(String(s.monthDay??1));
  setManualInterval(String(s.intervalMinutes??60));
  setManualEndDate(s.endDate||"");
  setManualMaxRuns(s.maxRuns?String(s.maxRuns):"");
  setManualIfEnabled(Boolean(task.action?.conditionRule||task.action?.conditionRules?.length||task.action?.stopConditionRule));
  setManualConditionTree(task.action?.conditionTree||legacyToConditionTree(task));
  setManualSecondIfEnabled(Boolean(task.action?.conditionRules&&task.action.conditionRules.length>1));
  setManualSecondSource(task.action?.conditionRules?.[1]?.source||"day");
  setManualSecondOperator(task.action?.conditionRules?.[1]?.operator||"equals");
  setManualSecondValue(task.action?.conditionRules?.[1]?.value||"");
  setManualThen(task.action?.conditionThen|| (task.action?.stopConditionRule?"stop":"notify"));
  setManualThenActions(task.action?.thenActions?.length?task.action.thenActions:[{type:(task.action?.conditionThen||"notify") as any}]);
  setManualNotificationMode(task.notificationMode||"disable");
  setManualRemindMinutes(String(task.remindIfNotCompletedMinutes||5));
  setManualSequenceEnabled(Boolean(task.sequence?.enabled));
  setManualSequenceCurrent(String(task.sequence?.current||1));
  setManualSequenceEnd(String(task.sequence?.end||1));
  setManualSequenceStep(String(task.sequence?.step||1));
  const type=task.action?.type;
  setManualType(type==="anime"||type==="movie"||type==="weather"||type==="news"||type==="web"?(type as "weather"|"news"|"anime"|"movie"|"web"):"reminder");
  setManualMessage(task.action?.message||"");
  setManualLocation(task.action?.location||"");
  setManualWeatherLocationMode(task.action?.locationMode||"manual");
  setManualWeatherCoords(task.action?.latitude!=null&&task.action?.longitude!=null?{latitude:task.action.latitude,longitude:task.action.longitude}:null);
  setWeatherSearch(task.action?.location||"");
  setWeatherPlaces([]);
  setManualTopic(task.action?.topic||"");
  setSelectedAnimeId(task.action?.animeId);
  setSelectedAnimeSource(task.action?.animeSource);
  setManualTopicPreset(task.action?.topic&&["BLACK TORCH","Solo Leveling","Chainsaw Man","Mashle","One Piece","Demon Slayer","Jujutsu Kaisen","More Than a Married Couple, but Not Lovers"].includes(task.action.topic)?task.action.topic:"Custom");
  setManualLanguage(task.action?.language||"hi");
  setManualScope(task.action?.scope||"all updates");
  setManualCategory(task.action?.category||"AI & tech");
  setManualRegion(task.action?.region||"India");
  setManualUrl(task.action?.url||"");
  setManualNotifyChange(Boolean(task.action?.notifyOnChange||s.notifyOnChange));
  setManualCondition(task.action?.condition||"");
  setManualStopCondition(task.action?.stopCondition||"");
  setManualConditionSource(task.action?.conditionRule?.source||"result");
  setManualConditionOperator(task.action?.conditionRule?.operator||"contains");
  setManualConditionValue((task.action?.conditionRule?.value??task.action?.condition)||"");
  setManualStopSource(task.action?.stopConditionRule?.source||"result");
  setManualStopOperator(task.action?.stopConditionRule?.operator||"contains");
  setManualStopValue((task.action?.stopConditionRule?.value??task.action?.stopCondition)||"");
 }
 function openEdit(task:Task){
  setError("");
  setEditingId(task.id);
  fillManualFromTask(task);
  setCreatorMode("manual");
  setCreator(true);
 }
 function confirmDelete(){
  if(!deleteTarget)return;
  setTasks(ts=>ts.filter(x=>x.id!==deleteTarget.id));
  if(editingId===deleteTarget.id){setEditingId(null);setCreator(false);}
  setDeleteTarget(null);
 }
 function openCreator(mode:"choose"|"manual"|"ai"="choose"){
  if(mode==="manual"){setEditingId(null);resetManual();}
  setCreatorMode(mode);setCreator(true);setError("");
 }
 function resetManual(){
  setManualTitle("");setManualDate(localDateISO(new Date()));setManualTime("19:00");setManualFrequency("daily");setManualWeekday("1");setManualWeekdays([1]);setManualMonthDay("1");setManualMonths([0,1,2,3,4,5,6,7,8,9,10,11]);setManualMonthDays([1]);setManualType("reminder");setManualMessage("");setManualLocation("");setWeatherSearch("");setWeatherPlaces([]);setManualWeatherCoords(null);setManualWeatherLocationMode("manual");setManualTopic("");setAnimeSearchResults([]);setSelectedAnimeId(undefined);setSelectedAnimeSource(undefined);setManualTopicPreset("Custom");setManualUrl("");setManualScope("all updates");setManualCategory("AI & tech");setManualRegion("India");setManualInterval("120");setManualEndDate("");setManualMaxRuns("");setManualNotifyChange(false);setManualCondition("");setManualStopCondition("");setManualConditionSource("result");setManualConditionOperator("contains");setManualConditionValue("");setManualConditionTree(newConditionGroup());setManualStopSource("result");setManualStopOperator("contains");setManualStopValue("");setManualIfEnabled(false);setManualSecondIfEnabled(false);setManualSecondSource("day");setManualSecondOperator("equals");setManualSecondValue("");setManualThen("notify");setManualWaitMinutes("5");setManualThenActions([{type:"notify"}]);setManualThenDragIndex(null);setManualNotificationMode("disable");setManualRemindMinutes("5");setManualSequenceEnabled(false);setManualSequenceCurrent("1");setManualSequenceEnd("1");setManualSequenceStep("1");
 }
 function makeManualTask(){
  setError("");
  if(!manualTitle.trim())return setError("Give the task a title.");
  if(manualFrequency==="once"&&new Date(manualDate+"T"+manualTime+":00")<=new Date())return setError("Choose a future time.");
  if(manualFrequency==="custom"&&Number(manualInterval)<1)return setError("Custom interval must be at least 1 minute.");
  if(manualMaxRuns&&Number(manualMaxRuns)<1)return setError("Maximum runs must be at least 1.");
  if(manualSequenceEnabled){
   const start=Math.max(1,Number(manualSequenceCurrent)||1);
   const end=Math.max(1,Number(manualSequenceEnd)||1);
   const step=Math.max(1,Number(manualSequenceStep)||1);
   if(end<start)return setError("Sequence end must be greater than or equal to the starting number.");
   if(manualNotificationMode!=="completed")return setError("Sequence requires the Completed notification mode so each step advances only after you mark it completed.");
   if(!Number.isFinite(step)||step<1)return setError("Sequence step must be at least 1.");
  }
  let action:TaskAction;
  let prompt="";
  const treeEnabled=manualIfEnabled&&conditionTreeHasLeaves(manualConditionTree);
  const tree=treeEnabled?manualConditionTree:undefined;
  const firstLeaf=tree?.children.find(x=>x.type!=="group") as TaskCondition|undefined;
  const ifRule=manualIfEnabled&&manualConditionValue.trim()?{source:manualConditionSource,operator:manualConditionOperator,value:manualConditionValue.trim()}:firstLeaf;
  const secondRule=manualIfEnabled&&manualSecondIfEnabled&&manualSecondValue.trim()?{source:manualSecondSource,operator:manualSecondOperator,value:manualSecondValue.trim()}:undefined;
  const conditionRules=[...(ifRule?[ifRule]:[]),...(secondRule?[secondRule]:[])];
  const ifThen=conditionRules.length?manualThen:undefined;
  const thenActions=conditionRules.length?manualThenActions.filter(a=>a.type):[];
  if(manualType==="reminder"){if(!manualMessage.trim())return setError("Enter your reminder.");action={type:"reminder",message:manualMessage.trim(),conditionRule:ifRule,conditionRules:conditionRules.length>1?conditionRules:undefined,conditionJoin:conditionRules.length>1?"all":undefined,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),notifyOnChange:manualNotifyChange};prompt=manualMessage.trim();}
  else if(manualType==="weather"){if(manualWeatherLocationMode==="manual"&&!manualLocation.trim())return setError("Search and select an Indian weather location.");if(manualWeatherLocationMode==="auto-once"&&(!manualLocation.trim()||!manualWeatherCoords))return setError("Use your location once before saving this task.");action={type:"weather",location:manualLocation.trim()||"Current location",locationMode:manualWeatherLocationMode,latitude:manualWeatherCoords?.latitude,longitude:manualWeatherCoords?.longitude,conditionRule:ifRule,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),notifyOnChange:manualNotifyChange};prompt=manualWeatherLocationMode==="auto-live"?"Get the current weather for my current location.":"Get the current weather for "+(manualLocation.trim()||"my saved location")+".";}
  else if(manualType==="news"){const topic=manualTopicPreset!=="Custom"?manualTopicPreset:manualTopic.trim();if(!topic)return setError("Choose or enter a topic.");action={type:"news",topic,language:manualLanguage,category:manualCategory,region:manualRegion,scope:manualScope,conditionRule:ifRule,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),notifyOnChange:manualNotifyChange};prompt="Get the latest "+manualScope+" about "+topic+" for "+manualRegion+".";}
  else if(manualType==="anime"){const topic=manualTopicPreset!=="Custom"?manualTopicPreset:manualTopic.trim();if(!topic)return setError("Choose or enter an anime title/topic.");action={type:"anime",topic,animeId:selectedAnimeId,animeSource:selectedAnimeSource,language:manualLanguage,scope:manualScope,conditionRule:ifRule,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),notifyOnChange:manualNotifyChange};prompt="Get "+manualScope+" about "+topic+".";}
  else if(manualType==="movie"){const topic=manualTopicPreset!=="Custom"?manualTopicPreset:manualTopic.trim();if(!topic)return setError("Choose or enter a movie/topic.");action={type:"movie",topic,language:manualLanguage,scope:manualScope,conditionRule:ifRule,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),notifyOnChange:manualNotifyChange};prompt="Get "+manualScope+" about "+topic+".";}
  else {if(!manualUrl.trim())return setError("Enter a URL.");action={type:"web",url:manualUrl.trim(),scope:manualScope,conditionRule:ifRule,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),notifyOnChange:manualNotifyChange};prompt="Check this public URL for "+manualScope+": "+manualUrl.trim();}
  action={...action,conditionRule:ifRule,conditionRules:conditionRules.length?conditionRules:undefined,conditionJoin:conditionRules.length>1?"all":undefined,conditionTree:tree,conditionThen:ifThen,waitMinutes:Math.max(1,Number(manualWaitMinutes)||5),thenActions:thenActions.length?thenActions:undefined,notifyOnChange:manualNotifyChange};
  const schedule:TaskSchedule={time:(manualFrequency==="hourly"||manualFrequency==="custom")?"":manualTime,startDate:manualDate,endDate:manualEndDate||undefined,weekday:(manualFrequency==="daily"||manualFrequency==="weekly")?Number(manualWeekdays[0]??manualWeekday):undefined,weekdays:(manualFrequency==="daily"||manualFrequency==="weekly")?manualWeekdays:undefined,months:manualFrequency==="monthly"?manualMonths:undefined,monthDay:manualFrequency==="monthly"?Number(manualMonthDays[0]??manualMonthDay):undefined,monthDays:manualFrequency==="monthly"?manualMonthDays:undefined,intervalMinutes:manualFrequency==="custom"?Number(manualInterval):undefined,maxRuns:manualMaxRuns?Number(manualMaxRuns):undefined,notifyOnChange:manualNotifyChange};
  const firstRun=buildFirstRun(manualDate,manualTime,manualFrequency,manualWeekday,manualMonthDay,Number(manualInterval),manualWeekdays,manualMonths,manualMonthDays);
  const sequence=manualSequenceEnabled?{enabled:true,current:Math.max(1,Number(manualSequenceCurrent)||1),end:Math.max(1,Number(manualSequenceEnd)||1),step:Math.max(1,Number(manualSequenceStep)||1)}:undefined;
  const ackConfig={notificationMode:manualNotificationMode,remindIfNotCompletedMinutes:manualNotificationMode==="completed"?Math.max(1,Number(manualRemindMinutes)||5):undefined,sequence};
  const existing=editingId?tasks.find(t=>t.id===editingId):undefined;
  if(existing){
   const updated:Task={...existing,...ackConfig,title:manualTitle.trim(),prompt,frequency:manualFrequency,nextRun:firstRun,enabled:true,status:"active",executionState:"idle",waitingReason:undefined,action,schedule,lastError:undefined,pendingAcknowledgement:undefined};
   setTasks(prev=>prev.map(t=>t.id===existing.id?updated:t));
   notify("Task updated",updated.title);
  }else{
   const task:Task={id:uid(),title:manualTitle.trim(),prompt,frequency:manualFrequency,nextRun:firstRun,enabled:true,status:"active",executionState:"idle",createdAt:new Date().toISOString(),runCount:0,history:[],executionMode:"direct",action,schedule,...ackConfig};
   setTasks(prev=>[task,...prev]);
   notify("Task created",task.title);
  }
  setCreator(false);setEditingId(null);resetManual();
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

 return <div className="app" lang="en-IN">
 {manualOpen&&<div className="modal"><div className="sheet manualSheet"><div className="sheetHead"><div><div className="eyebrow">USER MANUAL</div><h2>How Tasks works</h2></div><button onClick={()=>setManualOpen(false)}>×</button></div><div className="manualContent"><section><h3>🚀 Getting started</h3><p><b>Manual task</b> gives you full control. <b>AI task</b> lets you describe the task naturally.</p><ol><li>Tap ＋ and choose Manual or AI.</li><li>Set when it should run.</li><li>Choose the action and its details.</li><li>Save it. Edit it later whenever needed.</li></ol></section><section><h3>⏰ Scheduling</h3><p>Once, hourly, daily, weekly, monthly or a custom minute interval. You can also set start/end dates and maximum runs.</p></section><section><h3>🌤 Weather</h3><ul><li><b>Select Indian location:</b> search and select a city/town.</li><li><b>Use my location once:</b> allow location access once and save that location with the task.</li><li><b>Use my location automatically:</b> request current location before every run.</li></ul></section><section><h3>🍿 Anime</h3><p>Select an anime/topic and monitor all updates, new episodes, new seasons or release dates. Free public anime sources are used with fallbacks.</p></section><section><h3>📰 News · 🎬 Movies · 🌐 Web</h3><p>Choose topic, language and region for News/Movies. Web/RSS tasks use a public URL/feed.</p></section><section><h3>🧠 Smart rules</h3><p><b>IF / THEN</b> now supports unlimited conditions, AND/OR groups, nested groups and NOT.</p><ul><li>Add a condition such as <b>Temperature &gt; 30</b>, <b>Rain probability &gt; 50</b>, <b>Sunday</b> or <b>result changed</b>.</li><li>Use <b>AND</b> when every condition in a group must match; use <b>OR</b> when any condition may match.</li><li>Add a nested group to build rules like <b>Temperature &gt; 30 AND (Rain &gt; 50 OR Clouds &gt; 80)</b>.</li><li>Use <b>NOT group</b> to invert a whole group.</li><li><b>THEN</b> runs the action chain from top to bottom: notify, reminder, wait, sound, open link, run/create task, save result, stop or complete.</li><li><b>Notify only when changed</b> compares the new result with the previous result.</li></ul></section><section><h3>✏️ Edit · 🗑 Delete · 📜 History</h3><p>Edit updates the existing task. Delete requires confirmation. History shows previous executions and errors.</p></section><section><h3>🤖 AI</h3><p>AI tasks use your configured provider, key and model. Supported direct tasks can run from public data without AI at execution time.</p></section><section><h3>💾 Backup & 🔔 Notifications</h3><p>Export/import tasks as JSON for backup. Allow browser notifications to receive task results and errors.</p></section><section><h3>⚠️ Browser limitation</h3><p>The GitHub Pages version cannot guarantee execution when the browser/device is completely closed or offline. Native Android background scheduling is planned.</p></section></div></div></div>}
  <header><div><div className="eyebrow">AI AUTOMATION</div><h1>Tasks</h1></div><div className="headerActions"><button className="manualBtn" onClick={()=>setManualOpen(true)} title="User manual">?</button><button className="settingsBtn" onClick={()=>{setDraftAi(ai);setSettingsOpen(true)}}>⚙ AI</button><button className="iconBtn" onClick={()=>openCreator()}>＋</button></div></header>

  <div className={"aiStatus "+(aiReady?"ready":"warning")}><span className="statusDot"></span>{aiReady?"AI task creation ready":"AI setup required for AI tasks"}<button onClick={()=>{setDraftAi(ai);setSettingsOpen(true)}}>{aiReady?"Settings":"Configure"}</button></div>
  <div className="tabs"><button className={filter==="all"?"on":""} onClick={()=>setFilter("all")}>All</button><button className={filter==="active"?"on":""} onClick={()=>setFilter("active")}>Active</button><button className={filter==="paused"?"on":""} onClick={()=>setFilter("paused")}>Paused</button></div>

  {visible.length===0?<section className="empty"><div className="orb">✦</div><h2>What should I schedule?</h2><p>Create a task manually with no AI at run time, or let AI build a smart task from your words.</p><div className="emptyButtons"><button className="secondary wide" onClick={()=>openCreator("manual")}>＋ Manual task</button><button className="primary wide" onClick={()=>openCreator("ai")}>✨ AI task</button></div></section>:
   <main>{visible.map(t=><article className="card" key={t.id}>
    <div className="cardTop"><span className={"dot "+(t.executionState==="running"?"live":t.enabled?"live":"paused")}></span><span>{t.executionState==="running"?"RUNNING":t.executionState==="waiting"?"WAITING":t.enabled?"ACTIVE":t.status.toUpperCase()}</span><span className="modeBadge">{t.executionMode==="direct"?"DIRECT":"AI"}</span><button className="more editBtn" onClick={()=>openEdit(t)}>Edit</button><button className="more deleteBtn" onClick={()=>setDeleteTarget(t)}>Delete</button></div>
    <h2>{t.title}</h2><p>{t.prompt}</p><div className="meta"><span>{frequencyLabels[t.frequency]}</span>{t.notificationMode&&t.notificationMode!=="disable"&&<span>{t.notificationMode==="see"?"👀 SEE":"✅ COMPLETION"}{t.pendingAcknowledgement?" · PENDING":""}</span>}{t.sequence?.enabled&&<span>Sequence · {t.sequence.current} → {t.sequence.end}</span>}<span>Next · {formatDateTime(t.nextRun)}</span><span>Runs · {t.runCount}</span>{t.executionState==="waiting"&&<span>Waiting · {t.waitingReason||"Waiting"}</span>}</div>{t.pendingAcknowledgement?.status==="pending"&&<div className="ackPanel"><strong>{t.pendingAcknowledgement.mode==="completed"?"⏳ Waiting for completion":"👀 Waiting to be seen"}</strong><div className="actions"><button onClick={()=>acknowledgeTask(t.id,t.pendingAcknowledgement!.id,"seen")}>See it</button>{t.pendingAcknowledgement.mode==="completed"&&<button onClick={()=>acknowledgeTask(t.id,t.pendingAcknowledgement!.id,"completed")}>Completed</button>}</div></div>}{t.lastError&&<div className="error">{t.lastError}</div>}{t.lastResult&&<div className="resultPreview"><strong>Latest result</strong><p>{t.lastResult}</p></div>}
    <div className="actions"><button onClick={()=>setHistoryTarget(t)}>History</button><button disabled={t.status==="failed"||t.status==="completed"} onClick={()=>setTasks(ts=>ts.map(x=>x.id===t.id?{...x,enabled:!x.enabled,status:x.enabled?"paused":"active",executionState:"idle"}:x))}>{t.status==="failed"?"Failed":t.status==="completed"?"Completed":t.enabled?"Pause":"Resume"}</button><button disabled={t.status==="failed"||t.status==="completed"||t.executionState==="running"||t.executionState==="waiting"} onClick={()=>executeTask(t.id,true)}>{t.executionState==="running"?"Running…":t.executionState==="waiting"?"Waiting…":t.status==="failed"?"Failed":"Run now"}</button></div>
   </article>)}</main>}

  <section className="starter"><h3>Quick create</h3><div className="backupBar"><button onClick={()=>{const blob=new Blob([JSON.stringify(tasks,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tasks-backup.json";a.click();URL.revokeObjectURL(a.href)}}>Export backup</button><button onClick={()=>{const input=document.createElement("input");input.type="file";input.accept="application/json";input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data))throw new Error("Invalid backup file.");const valid=normalizeTasks(data);setTasks(valid);setError(valid.length===data.length?"Backup restored.":`Restored ${valid.length} valid tasks.`);}catch(e){setError(e instanceof Error?e.message:"Could not restore backup.");}};input.click()}}>Import backup</button></div><div className="starterGrid"><button onClick={()=>openCreator("manual")}>🛠️<b>Manual task</b><small>Choose time + action yourself</small></button><button onClick={()=>{openCreator("ai");setRequest("Every morning at 7 AM, give me today's weather details for my city.")}}>✨<b>AI task</b><small>Describe what you want</small></button></div></section>

  {creator&&<div className="modal"><div className="sheet creatorSheet">
   {creatorMode==="choose"&&<><div className="sheetHead"><div><div className="eyebrow">CREATE TASK</div><h2>How do you want to create it?</h2></div><button onClick={()=>setCreator(false)}>×</button></div><div className="modeCards"><button onClick={()=>openCreator("manual")}><span>🛠️</span><b>Manual task</b><small>Pick the schedule and action yourself. Direct APIs run it without AI.</small></button><button onClick={()=>setCreatorMode("ai")}><span>✨</span><b>AI task</b><small>Describe it naturally. AI creates the task plan and chooses direct APIs when possible.</small></button></div></>}
   {creatorMode==="manual"&&<><div className="sheetHead"><div><div className="eyebrow">{editingId?"EDIT TASK":"MANUAL TASK"}</div><h2>{editingId?"Edit task":"Build it yourself"}</h2></div><button onClick={()=>{setCreator(false);setEditingId(null)}}>×</button></div>
    <label>Task name<input value={manualTitle} onChange={e=>setManualTitle(e.target.value)} placeholder="e.g. Morning weather"/></label>
    <div className="sectionLabel">1 · Schedule</div>
    <div className="twoCols">{manualFrequency!=="hourly"&&manualFrequency!=="custom"&&<label>Time<input type="time" step="60" inputMode="numeric" value={manualTime} onChange={e=>setManualTime(e.target.value)} onInput={e=>setManualTime((e.target as HTMLInputElement).value)} /></label>}<label>Frequency<select value={manualFrequency} onChange={e=>{const f=e.target.value as Frequency;setManualFrequency(f);if(f==="daily"&&manualFrequency!=="daily"&&manualWeekdays.length===1&&manualWeekdays[0]===1)setManualWeekdays([0,1,2,3,4,5,6]);if(f==="weekly"&&manualFrequency!=="weekly"&&manualWeekdays.length===7)setManualWeekdays([1]);}}><option value="once">Once</option><option value="hourly">Every hour</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="custom">Every X minutes</option></select></label></div>
    <label>{manualFrequency==="once"?"Date":"Start date"}<DateField value={manualDate} onChange={setManualDate}/></label>
    {(manualFrequency==="daily"||manualFrequency==="weekly")&&<div className="weekdayPicker"><span className="fieldLabel">Days</span><div className="weekdayGrid">{[["0","Sun"],["1","Mon"],["2","Tue"],["3","Wed"],["4","Thu"],["5","Fri"],["6","Sat"]].map(([value,label])=>{const n=Number(value),selected=manualWeekdays.includes(n);return <button type="button" className={"dayChip"+(selected?" selected":"")} key={value} onClick={()=>setManualWeekdays(prev=>{const next=prev.includes(n)?prev.filter(x=>x!==n):[...prev,n].sort((x,y)=>x-y);const safe=next.length?next:[n];setManualWeekday(String(safe[0]));return safe;})}>{label}</button>})}</div><div className="dayPresets"><button type="button" onClick={()=>{setManualWeekdays([1,2,3,4,5]);setManualWeekday("1")}}>Mon–Fri</button><button type="button" onClick={()=>{setManualWeekdays([0,1,2,3,4,5,6]);setManualWeekday("0")}}>All days</button><button type="button" onClick={()=>{setManualWeekdays([0,6]);setManualWeekday("0")}}>Weekend</button><button type="button" onClick={()=>{setManualWeekdays([1]);setManualWeekday("1")}}>Mon only</button></div><small className="hint">{manualFrequency==="daily"?"Choose exactly which days should run.":"Choose one or more days each week."}</small></div>}
     {manualFrequency==="monthly"&&<><div className="monthSelector"><span className="fieldLabel">Months</span><div className="monthGrid">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((label,n)=><button type="button" className={"monthChip"+(manualMonths.includes(n)?" selected":"")} key={label} onClick={()=>setManualMonths(prev=>{const next=prev.includes(n)?prev.filter(x=>x!==n):[...prev,n].sort((x,y)=>x-y);return next.length?next:[n];})}>{label}</button>)}</div><div className="dayPresets"><button type="button" onClick={()=>setManualMonths([0,1,2,3,4,5,6,7,8,9,10,11])}>All months</button><button type="button" onClick={()=>setManualMonths([0,1,2,3,4,5])}>Jan–Jun</button><button type="button" onClick={()=>setManualMonths([6,7,8,9,10,11])}>Jul–Dec</button></div></div><div className="monthDaySelector"><span className="fieldLabel">Days of month</span><div className="monthDayGrid">{Array.from({length:31},(_,i)=>{const n=i+1;return <button type="button" className={"monthDayChip"+(manualMonthDays.includes(n)?" selected":"")} key={n} onClick={()=>setManualMonthDays(prev=>{const next=prev.includes(n)?prev.filter(x=>x!==n):[...prev,n].sort((x,y)=>x-y);return next.length?next:[n];})}>{n}</button>})}</div><small className="hint">Select one or more dates. Missing dates (like 31 in February) use that month's last day.</small></div></>}{manualFrequency==="custom"&&<label>Every (minutes)<input type="number" min="1" value={manualInterval} onChange={e=>setManualInterval(e.target.value)} placeholder="e.g. 30"/></label>}
    {manualFrequency!=="once"&&<div className="twoCols"><label>End date (optional)<DateField value={manualEndDate} onChange={setManualEndDate}/></label><label>Max runs (optional)<input type="number" min="1" value={manualMaxRuns} onChange={e=>setManualMaxRuns(e.target.value)} placeholder="Unlimited"/></label></div>}
    <div className="sectionLabel">2 · Action</div>
    <label>Action<select value={manualType} onChange={e=>setManualType(e.target.value as any)}><option value="reminder">🔔 Reminder</option><option value="weather">🌤️ Weather</option><option value="news">📰 News</option><option value="anime">🍿 Anime</option><option value="movie">🎬 Movies</option><option value="web">🌐 Website / RSS</option></select></label>
    {manualType==="reminder"&&<label>Reminder text<textarea value={manualMessage} onChange={e=>setManualMessage(e.target.value)} placeholder="Remind me to pay money."/></label>}
    {manualType==="weather"&&<div className="weatherLocationBox"><label>Location mode<select value={manualWeatherLocationMode} onChange={e=>{const mode=e.target.value as "manual"|"auto-once"|"auto-live";setManualWeatherLocationMode(mode);if(mode!=="manual"){setWeatherPlaces([]);setWeatherSearch("");}if(mode==="auto-live"){setManualLocation("");setManualWeatherCoords(null);}}}><option value="manual">📍 Select Indian location</option><option value="auto-once">📌 Use my location once</option><option value="auto-live">🔄 Use my location automatically</option></select></label>{manualWeatherLocationMode==="manual"&&<><label>Location <span className="fieldHint">India only</span><input value={weatherSearch||manualLocation} onChange={e=>{setWeatherSearch(e.target.value);setManualLocation(e.target.value);setManualWeatherCoords(null)}} placeholder="Search Indian city / town…"/></label>{weatherBusy&&<div className="searchHint">Searching Indian locations…</div>}{weatherPlaces.length>0&&<div className="locationOptions">{weatherPlaces.map((p,i)=><button type="button" key={p.name+"-"+p.latitude+"-"+i} onClick={()=>{const label=p.state?p.name+", "+p.state:p.name;setManualLocation(label);setWeatherSearch(label);setWeatherPlaces([]);setManualWeatherCoords({latitude:p.latitude,longitude:p.longitude});}}><span>{p.name}</span><small>{p.state?p.state+", ":""}India</small></button>)}</div>}<div className="locationSelected">{manualLocation?"Selected: "+manualLocation:"Search and select an Indian location"}</div></>}{manualWeatherLocationMode==="auto-once"&&<div className="autoLocationBox"><button type="button" className="secondary wide" disabled={locationBusy} onClick={async()=>{setLocationBusy(true);setError("");try{const coords=await getCurrentLocation();const place=await reverseGeocodeIndia(coords);setManualWeatherCoords(coords);setManualLocation(place.label);setWeatherSearch(place.label);}catch(e){setError(e instanceof Error?e.message:"Could not get your location.");}finally{setLocationBusy(false);}}}>{locationBusy?"📍 Getting your location…":"📍 Use my current location"}</button><div className="locationSelected">{manualLocation?"Saved once: "+manualLocation:"Your location will be saved with this task after you allow access."}</div></div>}{manualWeatherLocationMode==="auto-live"&&<div className="autoLocationBox"><div className="locationSelected">🔄 At every run, the app will request your current location first, then fetch weather for it. Location access is controlled by your browser permission.</div></div>}</div>}
    {(manualType==="news"||manualType==="anime"||manualType==="movie"||manualType==="web")&&<label>What to monitor<select value={manualScope} onChange={e=>setManualScope(e.target.value)}><option>all updates</option><option>new episode</option><option>new season</option><option>Hindi dubbed release</option><option>release date</option><option>price change</option><option>major updates</option><option>only when changed</option></select></label>}
    {manualType==="anime"&&<div className="apiSearchBox"><label>Anime title / topic <span className="fieldHint">Public API search</span><input value={manualTopic} onChange={e=>{setManualTopic(e.target.value);setManualTopicPreset("Custom")}} placeholder="Search anime title…"/></label>{animeSearchBusy&&<div className="searchHint">Searching AniList / Jikan…</div>}{animeSearchResults.length>0&&<div className="locationOptions">{animeSearchResults.map((a,i)=><button type="button" key={a.title+"-"+i} onClick={()=>{setManualTopic(a.title);setManualTopicPreset("Custom");setSelectedAnimeId(a.id);setSelectedAnimeSource(a.source);setAnimeSearchResults([])}}><span>{a.title}</span><small>{a.type||"Anime"}{a.seasonYear?" · "+a.seasonYear:""}</small></button>)}</div>}</div>}
    {(manualType==="news"||manualType==="movie")&&<label>{manualType==="movie"?"Movie / topic":"Topic"}<select value={manualTopicPreset} onChange={e=>{setManualTopicPreset(e.target.value);if(e.target.value!=="Custom")setManualTopic(e.target.value)}}><option value="Custom">Custom topic…</option>{manualType==="movie"&&<><option>Upcoming movie releases</option><option>New movie releases</option><option>Movie release dates</option><option>Hindi dubbed movies</option></>}{manualType==="news"&&<><option>AI & tech</option><option>Gaming</option><option>Science & space</option><option>India & world</option><option>Anime & entertainment</option></>}</select>{manualTopicPreset==="Custom"&&<input value={manualTopic} onChange={e=>setManualTopic(e.target.value)} placeholder={manualType==="movie"?"Movie title or genre":"e.g. AI & tech"}/>}</label>}
    {(manualType==="news"||manualType==="anime"||manualType==="movie")&&<div className="twoCols"><label>Language<select value={manualLanguage} onChange={e=>setManualLanguage(e.target.value)}><option value="hi">Hindi</option><option value="en">English</option><option value="bn">Bengali</option></select></label><label>Region<input value={manualRegion} onChange={e=>setManualRegion(e.target.value)}/></label></div>}
    {manualType==="news"&&<label>Category<select value={manualCategory} onChange={e=>setManualCategory(e.target.value)}><option>AI & tech</option><option>Gaming</option><option>Science & space</option><option>India & world</option><option>Entertainment</option><option>Custom</option></select></label>}
    {manualType==="web"&&<label>Public URL / RSS URL<input value={manualUrl} onChange={e=>setManualUrl(e.target.value)} placeholder="https://example.com/feed.xml"/></label>}
    <div className="sectionLabel">3 · Notification acknowledgement</div>
    <label>Notification mode<select value={manualNotificationMode} onChange={e=>{const mode=e.target.value as NotificationMode;if(manualSequenceEnabled&&mode!=="completed"){setError("Sequence needs Completed mode.");return;}setManualNotificationMode(mode);}}><option value="disable">🔕 Disable</option><option value="see">👀 See it</option><option value="completed">✅ Completed</option></select></label>
    {manualNotificationMode==="completed"&&<label>Remind me if not completed<select value={manualRemindMinutes} onChange={e=>setManualRemindMinutes(e.target.value)}><option value="1">1 minute</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option></select></label>}
    <div className="sectionLabel">4 · Sequence / chain</div>
    <label className="checkRow"><input type="checkbox" checked={manualSequenceEnabled} onChange={e=>{const on=e.target.checked;setManualSequenceEnabled(on);if(on)setManualNotificationMode("completed");}}/><span>Enable universal sequence</span></label>
    {manualSequenceEnabled&&<p className="hint sequenceHint">Sequence advances only after you press <b>Completed</b>. Notification mode is locked to Completed while sequence is enabled.</p>}
    {manualSequenceEnabled&&<div className="twoCols"><label>Starting number<input type="number" min="1" value={manualSequenceCurrent} onChange={e=>setManualSequenceCurrent(e.target.value)}/></label><label>End number<input type="number" min="1" value={manualSequenceEnd} onChange={e=>setManualSequenceEnd(e.target.value)}/></label><label>Step<input type="number" min="1" value={manualSequenceStep} onChange={e=>setManualSequenceStep(e.target.value)}/></label></div>}
    <div className="automationRules"><div className="sectionLabel">5 · IF / THEN</div>
    <label className="checkRow"><input type="checkbox" checked={manualIfEnabled} onChange={e=>setManualIfEnabled(e.target.checked)}/><span>Enable advanced IF / THEN automation</span></label>
    {manualIfEnabled&&<><div className="ruleBox"><strong>IF</strong><p className="hint">Build unlimited conditions with AND / OR, nested groups, and NOT. Weather fields can compare temperature, rain probability, cloud cover and more.</p><ConditionBuilder node={manualConditionTree} onChange={next=>setManualConditionTree(next as TaskConditionGroup)}/></div>
    <div className="ruleBox thenChain"><div className="fieldLabel">THEN · Action chain</div><p className="hint">Actions run top-to-bottom. You can mix waits, sound, reminders, notifications, links and task controls.</p>{manualThenActions.map((step,index)=><div className="thenActionRow" key={index} draggable onDragStart={()=>setManualThenDragIndex(index)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(manualThenDragIndex==null||manualThenDragIndex===index)return;setManualThenActions(prev=>{const next=[...prev],moved=next.splice(manualThenDragIndex,1)[0];next.splice(index,0,moved);return next;});setManualThenDragIndex(null);}}><div className="thenStepNumber">{index+1}</div><select value={step.type} onChange={e=>setManualThenActions(prev=>prev.map((x,i)=>i===index?{...x,type:e.target.value as any}:x))}><option value="notify">🔔 Notify me</option><option value="reminder">⏰ Reminder</option><option value="wait">⏳ Wait</option><option value="sound">🔊 Play sound</option><option value="open_link">🌐 Open link</option><option value="create_task">🤖 Create follow-up task</option><option value="run_task">▶️ Run another task</option><option value="save_result">💾 Save result</option><option value="stop">⏹️ Stop task</option><option value="complete">✅ Complete task</option></select>{step.type==="wait"&&<div className="twoCols"><label>Seconds<input type="number" min="0.1" step="0.1" value={step.seconds??1} onChange={e=>setManualThenActions(prev=>prev.map((x,i)=>i===index?{...x,seconds:Number(e.target.value)}:x))}/></label><label>Minutes<input type="number" min="0" value={step.minutes??0} onChange={e=>setManualThenActions(prev=>prev.map((x,i)=>i===index?{...x,minutes:Number(e.target.value)}:x))}/></label></div>}{(step.type==="notify"||step.type==="reminder")&&<input value={step.message||""} onChange={e=>setManualThenActions(prev=>prev.map((x,i)=>i===index?{...x,message:e.target.value}:x))} placeholder={step.type==="reminder"?"Reminder text (optional)":"Notification text (optional)"}/>} {step.type==="open_link"&&<input type="url" value={step.url||""} onChange={e=>setManualThenActions(prev=>prev.map((x,i)=>i===index?{...x,url:e.target.value}:x))} placeholder="https://example.com"/>}{step.type==="run_task"&&<select value={step.taskId||""} onChange={e=>setManualThenActions(prev=>prev.map((x,i)=>i===index?{...x,taskId:e.target.value}:x))}><option value="">Choose task…</option>{tasks.filter(x=>x.id!==editingId).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select>}<div className="thenRowButtons"><button type="button" onClick={()=>setManualThenActions(prev=>{if(index===0)return prev;const n=[...prev];[n[index-1],n[index]]=[n[index],n[index-1]];return n;})} disabled={index===0}>↑</button><button type="button" onClick={()=>setManualThenActions(prev=>{if(index===prev.length-1)return prev;const n=[...prev];[n[index+1],n[index]]=[n[index],n[index+1]];return n;})} disabled={index===manualThenActions.length-1}>↓</button><button type="button" onClick={()=>setManualThenActions(prev=>[...prev.slice(0,index+1),{...step},...prev.slice(index+1)])}>Duplicate</button><button type="button" onClick={()=>setManualThenActions(prev=>prev.length===1?prev:prev.filter((_,i)=>i!==index))}>Remove</button></div></div>)}<button type="button" className="secondary" onClick={()=>setManualThenActions(prev=>[...prev,{type:"notify"}])}>＋ Add THEN action</button></div>
    <label className="checkRow"><input type="checkbox" checked={manualNotifyChange} onChange={e=>setManualNotifyChange(e.target.checked)}/><span>Notify only when the result changes</span></label></>}
    </div>
    {error&&<div className="error">{error}</div>}<button className="primary wide" onClick={makeManualTask}>{editingId?"✓ Save changes":"＋ Create manual task"}</button>
   </>}
   {creatorMode==="ai"&&<><div className="sheetHead"><div><div className="eyebrow">AI TASK CREATOR</div><h2>Tell AI what to do</h2></div><button onClick={()=>setCreator(false)}>×</button></div><p className="hint">Example: “Every day at 7 AM, tell me the weather in Berhampore.” If direct data is available, the task will use the API at run time instead of AI.</p><textarea className="aiInput" autoFocus placeholder="Describe your task in natural language..." value={request} onChange={e=>setRequest(e.target.value)}/>{busy&&<div className="processing"><span className="spinner"></span><div><strong>{processing}</strong><small>AI is creating the task plan</small></div></div>}{error&&<div className="error">{error}</div>}<button className="primary wide" disabled={busy} onClick={createWithAI}>{busy?"✨ Creating task…":"✨ Create with AI"}</button>{!aiReady&&<button className="textBtn" onClick={()=>{setCreator(false);setDraftAi(ai);setSettingsOpen(true)}}>Configure AI first →</button>}</>}
  </div></div>}

  {historyTarget&&<div className="modal"><div className="sheet historySheet"><div className="sheetHead"><div><div className="eyebrow">EXECUTION HISTORY</div><h2>{historyTarget.title}</h2></div><button onClick={()=>setHistoryTarget(null)}>×</button></div>{(historyTarget.executions||[]).length===0?<p className="hint">No executions yet.</p>:<div className="historyList">{(historyTarget.executions||[]).map(x=><div className="historyItem" key={x.id}><strong>{x.status==="success"?"✓ Success":"✕ Failed"}</strong><small>{formatDateTime(x.finishedAt)}</small><p>{x.result||x.error||"No result"}</p></div>)}{(historyTarget.acknowledgements||[]).map(x=><div className="historyItem" key={"ack-"+x.id}><strong>{x.status==="completed"?"✓ Completed by user":"👀 Seen by user"}</strong><small>{formatDateTime(x.updatedAt||x.createdAt)}</small><p>{x.sequenceValue!=null?"Sequence step "+x.sequenceValue:"Notification acknowledgement"}</p></div>)}</div>}</div></div>}

  {deleteTarget&&<div className="modal"><div className="sheet confirmSheet"><div className="sheetHead"><div><div className="eyebrow">DELETE TASK</div><h2>Delete “{deleteTarget.title}”?</h2></div><button onClick={()=>setDeleteTarget(null)}>×</button></div><p className="hint">This task and its saved execution history will be removed from this browser. This cannot be undone.</p><div className="confirmActions"><button className="secondary" onClick={()=>setDeleteTarget(null)}>Cancel</button><button className="dangerBtn" onClick={confirmDelete}>Delete task</button></div></div></div>}

  {settingsOpen&&<div className="modal"><div className="sheet"><div className="sheetHead"><div><div className="eyebrow">AI SETTINGS</div><h2>AI provider</h2></div><button onClick={()=>setSettingsOpen(false)}>×</button></div><p className="hint">AI is used only where the task needs it. Your key stays in this browser.</p><label>AI provider<select value={draftAi.provider} onChange={e=>changeProvider(e.target.value as AIProvider)}>{Object.entries(providerLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>{draftAi.provider==="custom"&&<label>OpenAI-compatible endpoint<input value={draftAi.endpoint} onChange={e=>setDraftAi({...draftAi,endpoint:e.target.value})}/></label>}<label>API key<input type="password" value={draftAi.apiKey} onChange={e=>setDraftAi({...draftAi,apiKey:e.target.value})} placeholder="Paste your own API key"/></label><div className="modelHeader"><label>Model</label><button className="refreshModels" disabled={modelsBusy} onClick={refreshModels}>{modelsBusy?"Loading…":"↻ Search models"}</button></div><input className="modelSearch" placeholder="Search model name…" value={modelSearch} onChange={e=>setModelSearch(e.target.value)}/><select value={draftAi.model} onChange={e=>setDraftAi({...draftAi,model:e.target.value})}><option value="">Select a model</option>{models.filter(m=>(m.name||m.id).toLowerCase().includes(modelSearch.toLowerCase())).slice(0,100).map(m=><option key={m.id} value={m.id}>{m.name||m.id} — {m.id}</option>)}</select><div className="modelHint">{models.length} models loaded · {providerLabels[draftAi.provider]}</div>{error&&<div className="error">{error}</div>}<button className="primary wide" onClick={saveSettings}>Save AI settings</button></div></div>}
 </div>;
}
export default App;
