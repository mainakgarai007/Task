import {Task} from "./types";
import {Capacitor} from "@capacitor/core";
import {LocalNotifications} from "@capacitor/local-notifications";

function timeParts(time?:string){
 const match=/^(\d{1,2}):(\d{2})$/.exec(time||"");
 if(!match)return {hours:0,minutes:0};
 return {hours:Math.min(23,Math.max(0,Number(match[1]))),minutes:Math.min(59,Math.max(0,Number(match[2])))};
}

function setLocalTime(date:Date,time?:string){
 const {hours,minutes}=timeParts(time);
 date.setHours(hours,minutes,0,0);
 return date;
}

export type IntervalUnit="minutes"|"hours"|"days";

export function intervalToMinutes(value:number,unit:IntervalUnit):number{
 const multiplier=unit==="days"?1440:unit==="hours"?60:1;
 return Math.round(value*multiplier);
}

export function nextRun(from:Date,frequency:Task["frequency"],schedule?:Task["schedule"]):string{
 const d=new Date(from);

 if(frequency==="hourly"){
  // Hourly means one hour after the previous run. It never depends on a selected clock time.
  d.setTime(d.getTime()+60*60*1000);
  d.setSeconds(0,0);
 }

 if(frequency==="daily"){
  const days=schedule?.weekdays?.length
   ?schedule.weekdays.map(n=>((Number(n)||0)+7)%7).sort((a,b)=>a-b)
   :undefined;
  if(days?.length){
   const current=d.getDay();
   let delta=7;
   for(const target of days){
    const candidate=(target-current+7)%7;
    const step=candidate===0?7:candidate;
    if(step<delta)delta=step;
   }
   d.setDate(d.getDate()+delta);
  }else{
   d.setDate(d.getDate()+1);
  }
  setLocalTime(d,schedule?.time);
 }

 if(frequency==="weekly"){
  const days=(schedule?.weekdays?.length?schedule.weekdays:[Number(schedule?.weekday)||0]).map(n=>((Number(n)||0)+7)%7).sort((a,b)=>a-b);
  const current=d.getDay();
  let delta=7;
  for(const target of days){
   const candidate=(target-current+7)%7;
   const step=candidate===0?7:candidate;
   if(step<delta)delta=step;
  }
  d.setDate(d.getDate()+delta);
  setLocalTime(d,schedule?.time);
 }

 if(frequency==="monthly"){
  const months=(schedule?.months?.length?schedule.months:Array.from({length:12},(_,i)=>i)).map(n=>Math.min(11,Math.max(0,Number(n)))).sort((a,b)=>a-b);
  const days=(schedule?.monthDays?.length?schedule.monthDays:[Number(schedule?.monthDay)||d.getDate()]).map(n=>Math.min(31,Math.max(1,Number(n)))).sort((a,b)=>a-b);
  const baseYear=d.getFullYear();
  let found:Date|undefined;
  for(let offset=0;offset<24&&!found;offset++){
   const probeMonth=d.getMonth()+offset;
   const year=baseYear+Math.floor(probeMonth/12);
   const month=probeMonth%12;
   if(!months.includes(month))continue;
   const lastDay=new Date(year,month+1,0).getDate();
   for(const day of days){
    const candidate=new Date(year,month,Math.min(day,lastDay));
    setLocalTime(candidate,schedule?.time);
    if(candidate.getTime()>d.getTime()){found=candidate;break;}
   }
  }
  if(found)d.setTime(found.getTime());
 }

 if(frequency==="custom"){
  // Custom minute intervals are relative intervals; they never depend on a clock time.
  d.setTime(d.getTime()+Math.max(1,Number(schedule?.intervalMinutes)||60)*60000);
  d.setSeconds(0,0);
 }

 return d.toISOString();
}

export function playNotificationSound(sound:"none"|"default"|"soft"|"chime"|"alert"|"beep"="default"){
 if(sound==="none")return;
 try{
  const AC=window.AudioContext||(window as any).webkitAudioContext;
  if(!AC)return;
  const ac=new AC();
  const presets:Record<string,number[]>={default:[880],soft:[523.25],chime:[659.25,783.99,1046.5],alert:[880,660,880],beep:[1000]};
  const tones=presets[sound]||presets.default;
  tones.forEach((frequency,index)=>{
   const osc=ac.createOscillator(),gain=ac.createGain();
   osc.type=sound==="soft"?"sine":"sine";osc.frequency.value=frequency;
   gain.gain.setValueAtTime(0.0001,ac.currentTime+index*0.12);
   gain.gain.exponentialRampToValueAtTime(0.08,ac.currentTime+index*0.12+0.015);
   gain.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+index*0.12+0.18);
   osc.connect(gain);gain.connect(ac.destination);osc.start(ac.currentTime+index*0.12);osc.stop(ac.currentTime+index*0.12+0.2);
  });
  setTimeout(()=>{try{ac.close();}catch{}},Math.max(500,tones.length*140+350));
 }catch{}
}

export async function notify(title:string,body:string,options?:any){
 try{
  const sound=options?.sound||"default";
  if(Capacitor.isNativePlatform()){
   const permission=await LocalNotifications.checkPermissions();
   const granted=permission.display==="granted"||((await LocalNotifications.requestPermissions()).display==="granted");
   if(granted){
    const soundChannels:Record<string,{id:string;label:string;file?:string;silent?:boolean}>={default:{id:"tasks_sound_default",label:"Tasks · Default"},soft:{id:"tasks_sound_soft",label:"Tasks · Soft",file:"tasks_soft"},chime:{id:"tasks_sound_chime",label:"Tasks · Chime",file:"tasks_chime"},alert:{id:"tasks_sound_alert",label:"Tasks · Alert",file:"tasks_alert"},beep:{id:"tasks_sound_beep",label:"Tasks · Beep",file:"tasks_beep"},none:{id:"tasks_sound_none",label:"Tasks · Silent",silent:true}};
    const selected=soundChannels[sound]||soundChannels.default;
    try{await LocalNotifications.createChannel({id:selected.id,name:selected.label,description:"Sound preference for Tasks reminders",importance:5,visibility:1,sound:selected.file, ...(selected.silent?{sound:undefined,vibration:false,lights:false}: {})});}catch{}
    const notificationId=Number(String(Date.now()).slice(-8));
    await LocalNotifications.schedule({notifications:[{
     id:notificationId,
     title,
     body,
     channelId:selected.id,
     schedule:{at:new Date(Date.now()+1000)},
     extra:{taskId:options?.taskId,ackId:options?.ackId,ackMode:options?.ackMode},
    }]});
   }
   if(sound!=="none"&&sound!=="default")playNotificationSound(sound);
   return;
  }
  const customSound=sound!=="none"&&sound!=="default";
  const silent=sound==="none"||customSound;
  if("serviceWorker" in navigator){
   const reg=await navigator.serviceWorker.getRegistration();
   if(reg?.showNotification){const notificationOptions:any={body,data:{taskId:options?.taskId,ackId:options?.ackId,ackMode:options?.ackMode},silent};if(options?.ackId){notificationOptions.actions=options.ackMode==="completed"?[{action:"seen",title:"See it"},{action:"completed",title:"Completed"}]:[{action:"seen",title:"See it"}];}else if(options?.actions)notificationOptions.actions=options.actions;await reg.showNotification(title,notificationOptions);}
   else if("Notification" in window&&Notification.permission==="granted")new Notification(title,{body,silent});
  }else if("Notification" in window){
   if(Notification.permission==="granted")new Notification(title,{body,silent});
   else if(Notification.permission!=="denied"){
    const p=await Notification.requestPermission();
    if(p==="granted")new Notification(title,{body,silent});
   }
  }
  if(customSound)playNotificationSound(sound);
 }catch{}
}


/**
 * Keep Android reminder alarms in the OS notification scheduler.
 * These are due-time reminders only; they do not run the task's network/AI actions.
 */
export async function syncNativeTaskReminders(tasks:Task[]):Promise<void>{
 if(!Capacitor.isNativePlatform())return;
 try{
  const permission=await LocalNotifications.checkPermissions();
  const granted=permission.display==="granted"||((await LocalNotifications.requestPermissions()).display==="granted");
  if(!granted)return;
  const pending=await LocalNotifications.getPending();
  const owned=pending.notifications.filter(n=>n.id>=100000&&n.id<200000).map(n=>({id:n.id}));
  if(owned.length)await LocalNotifications.cancel({notifications:owned});
  const active=tasks.filter(t=>t.enabled&&t.status==="active"&&t.frequency!=="once"||t.enabled&&t.status==="active"&&t.frequency==="once");
  const now=Date.now();
  const notifications=active.map((task,index)=>{
   const at=new Date(task.nextRun);
   if(!Number.isFinite(at.getTime())||at.getTime()<=now)return null;
   const id=100000+(hashTaskId(task.id)%90000);
   const repeats=task.frequency!=="once";
   return {
    id,
    title:"Task due: "+task.title,
    body:"Open Tasks to run this automation.",
    schedule:{at,repeats,allowWhileIdle:true},
    channelId:"tasks_sound_default",
    extra:{taskId:task.id,kind:"task-due-reminder"},
   };
  }).filter((n):n is NonNullable<typeof n>=>Boolean(n));
  if(notifications.length)await LocalNotifications.schedule({notifications});
 }catch(error){
  console.warn("Could not sync native task reminders",error);
 }
}

function hashTaskId(value:string):number{
 let hash=0;
 for(let i=0;i<value.length;i++)hash=(Math.imul(hash,31)+value.charCodeAt(i))|0;
 return Math.abs(hash)%90000;
}
