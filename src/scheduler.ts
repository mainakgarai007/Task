import {Task} from "./types";
export function nextRun(from:Date,frequency:Task["frequency"]):string{
 const d=new Date(from);
 if(frequency==="hourly")d.setHours(d.getHours()+1);
 if(frequency==="daily")d.setDate(d.getDate()+1);
 if(frequency==="weekly")d.setDate(d.getDate()+7);
 if(frequency==="monthly")d.setMonth(d.getMonth()+1);
 return d.toISOString();
}
export function notify(title:string,body:string){
 if("Notification" in window){
  if(Notification.permission==="granted")new Notification(title,{body});
  else if(Notification.permission!=="denied")Notification.requestPermission().then(p=>{if(p==="granted")new Notification(title,{body})});
 }
}