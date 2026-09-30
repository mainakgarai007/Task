export type Frequency="once"|"hourly"|"daily"|"weekly"|"monthly";
export type TaskStatus="active"|"paused"|"completed";
export interface Task{
 id:string; title:string; prompt:string; frequency:Frequency; nextRun:string;
 enabled:boolean; createdAt:string; lastRun?:string; runCount:number; history:string[];
}
export const frequencyLabels:Record<Frequency,string>={once:"Once",hourly:"Every hour",daily:"Every day",weekly:"Every week",monthly:"Every month"};