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
  const months=(schedule?.months?.length?schedule.months:[d.getMonth()]).map(n=>Math.min(11,Math.max(0,Number(n)))).sort((a,b)=>a-b);
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
  const customSound=sound!=="none"&&sound!=="default";
  const silent=sound==="none"||customSound;
  if("serviceWorker" in navigator){
   const reg=await navigator.serviceWorker.getRegistration();
   if(reg?.showNotification){const notificationOptions:any={body,data:{taskId:options?.taskId,ackId:options?.ackId},silent};if(options?.actions)notificationOptions.actions=options.actions;await reg.showNotification(title,notificationOptions);}
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
