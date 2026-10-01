export type Frequency="once"|"hourly"|"daily"|"weekly"|"monthly";
export type TaskStatus="active"|"paused"|"completed"|"failed";
export interface ExecutionRecord{id:string;startedAt:string;finishedAt:string;status:"success"|"failed";result?:string;error?:string;}
export interface Task{
 id:string; title:string; prompt:string; frequency:Frequency; nextRun:string; enabled:boolean; status:TaskStatus;
 createdAt:string; lastRun?:string; runCount:number; history:string[]; executions?:ExecutionRecord[];
 lastResult?:string; previousResult?:string; lastError?:string;
}
export const frequencyLabels:Record<Frequency,string>={once:"Once",hourly:"Every hour",daily:"Every day",weekly:"Every week",monthly:"Every month"};