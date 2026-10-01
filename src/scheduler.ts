import {Task} from "./types";
export function nextRun(from:Date,frequency:Task["frequency"]):string{
 const d=new Date(from);
 if(frequency==="hourly")d.setHours(d.getHours()+1);
 if(frequency==="daily")d.setDate(d.getDate()+1);
 if(frequency==="weekly")d.setDate(d.getDate()+7);
 if(frequency==="monthly")d.setMonth(d.getMonth()+1);
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