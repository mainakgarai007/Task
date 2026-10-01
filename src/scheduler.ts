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
  const {minutes}=timeParts(schedule?.time);
  d.setHours(d.getHours()+1);
  d.setMinutes(minutes,0,0);
 }

 if(frequency==="daily"){
  d.setDate(d.getDate()+1);
  setLocalTime(d,schedule?.time);
 }

 if(frequency==="weekly"){
  const target=((Number(schedule?.weekday)||0)+7)%7;
  const current=d.getDay();
  let delta=(target-current+7)%7;
  if(delta===0)delta=7;
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
  d.setMinutes(d.getMinutes()+(Math.max(1,Number(schedule?.intervalMinutes)||60)));
 }

 return d.toISOString();
}

export async function notify(title:string,body:string){
 try{
  if("serviceWorker" in navigator){
   const reg=await navigator.serviceWorker.getRegistration();
   if(reg?.showNotification){await reg.showNotification(title,{body});return;}
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
