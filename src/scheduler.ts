import {Task} from "./types";

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
  const wanted=Math.min(31,Math.max(1,Number(schedule?.monthDay)||d.getDate()));
  const nextMonth=new Date(d.getFullYear(),d.getMonth()+1,1);
  const lastDay=new Date(nextMonth.getFullYear(),nextMonth.getMonth()+1,0).getDate();
  d.setFullYear(nextMonth.getFullYear(),nextMonth.getMonth(),Math.min(wanted,lastDay));
  setLocalTime(d,schedule?.time);
 }

 if(frequency==="custom"){
  // Custom minute intervals are relative intervals; they never depend on a clock time.
  d.setTime(d.getTime()+Math.max(1,Number(schedule?.intervalMinutes)||60)*60000);
  d.setSeconds(0,0);
 }

 return d.toISOString();
}

export async function notify(title:string,body:string,options?:any){
 try{
  if("serviceWorker" in navigator){
   const reg=await navigator.serviceWorker.getRegistration();
   if(reg?.showNotification){const notificationOptions:any={body,data:{taskId:options?.taskId,ackId:options?.ackId}};if(options?.actions)notificationOptions.actions=options.actions;await reg.showNotification(title,notificationOptions);return;}
  }
  if("Notification" in window){
   if(Notification.permission==="granted")new Notification(title,{body});
   else if(Notification.permission!=="denied"){
    const p=await Notification.requestPermission();
    if(p==="granted")new Notification(title,{body});
   }
  }
 }catch{}
}
