import {normalizeTasks} from "./storage";
import type {Task} from "./types";
export const BACKUP_FORMAT="tasks-backup" as const;
export const BACKUP_VERSION=1 as const;
export const MAX_BACKUP_BYTES=5*1024*1024;
export interface TaskBackup{format:typeof BACKUP_FORMAT;version:typeof BACKUP_VERSION;exportedAt:string;tasks:Task[]}
export type BackupParseResult={ok:true;tasks:Task[];invalidCount:number;format:string}|{ok:false;error:string};
export function createBackup(tasks:Task[],exportedAt=new Date().toISOString()):TaskBackup{return{format:BACKUP_FORMAT,version:BACKUP_VERSION,exportedAt,tasks};}
export function parseBackup(raw:string):BackupParseResult{
 if(typeof raw!=="string"||!raw.trim())return{ok:false,error:"Backup file is empty."};
 if(new TextEncoder().encode(raw).byteLength>MAX_BACKUP_BYTES)return{ok:false,error:"Backup is too large (maximum 5 MB)."};
 let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return{ok:false,error:"Invalid JSON. Existing tasks were not changed."};}
 let source:unknown,format:string;
 if(Array.isArray(parsed)){source=parsed;format="Legacy array";}
 else if(parsed&&typeof parsed==="object") {const e=parsed as Record<string,unknown>;if(e.format!==BACKUP_FORMAT)return{ok:false,error:"Unsupported backup format. Existing tasks were not changed."};if(e.version!==BACKUP_VERSION)return{ok:false,error:"Unsupported backup version. Use a compatible app version."};if(!Array.isArray(e.tasks))return{ok:false,error:"Backup tasks must be an array. Existing tasks were not changed."};source=e.tasks;format="Version 1";}
 else return{ok:false,error:"Invalid backup structure. Expected a task array or versioned backup."};
 const records=source as unknown[],tasks=normalizeTasks(records),invalidCount=records.length-tasks.length;
 if(!tasks.length)return{ok:false,error:records.length?"No valid tasks found. Existing tasks were not changed.":"Backup contains no tasks. Existing tasks were not changed."};
 return{ok:true,tasks,invalidCount,format};
}
