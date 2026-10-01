import {Task,TaskAction,TaskSchedule,Frequency,TaskStatus,ExecutionMode} from "./types";

const KEY="task-tool.tasks.v1";
const frequencies:Frequency[]=["once","hourly","daily","weekly","monthly","custom"];
const statuses:TaskStatus[]=["active","paused","completed","failed"];
const modes:ExecutionMode[]=["direct","ai"];

function isRecord(value:unknown):value is Record<string,any>{
 return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
}

export function normalizeTasks(value:unknown):Task[]{
 if(!Array.isArray(value))return [];
 return value.map(item=>{
  if(!isRecord(item)||typeof item.id!=="string"||typeof item.title!=="string"||typeof item.nextRun!=="string")return null;
  if(!frequencies.includes(item.frequency)||!statuses.includes(item.status)||!modes.includes(item.executionMode))return null;
  const action=isRecord(item.action)?item.action as TaskAction:{type:"reminder" as const,message:typeof item.prompt==="string"?item.prompt:""};
  const safeAction:TaskAction={type:["reminder","weather","news","anime","movie","web","ai"].includes(action.type)?action.type:"reminder",...action};
  const schedule=isRecord(item.schedule)?item.schedule as TaskSchedule:undefined;
  return {
   ...item,
   prompt:typeof item.prompt==="string"?item.prompt:"",
   enabled:typeof item.enabled==="boolean"?item.enabled:item.status==="active",
   createdAt:typeof item.createdAt==="string"?item.createdAt:new Date().toISOString(),
   runCount:Number.isFinite(Number(item.runCount))?Math.max(0,Number(item.runCount)):0,
   history:Array.isArray(item.history)?item.history.filter((x:any)=>typeof x==="string"):[],
   executions:Array.isArray(item.executions)?item.executions:[],
   action:safeAction,
   schedule
  } as Task;
 }).filter((item):item is Task=>Boolean(item));
}

export function loadTasks():Task[]{
 try{return normalizeTasks(JSON.parse(localStorage.getItem(KEY)||"[]"));}catch{return[];}
}

export function saveTasks(tasks:Task[]){localStorage.setItem(KEY,JSON.stringify(tasks));}

export function uid(){return crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}
