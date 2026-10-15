import type {Task} from "./types";

/**
 * Keep never-run tasks in scheduled-time order. Once a task has run,
 * rotate it behind tasks that have not run yet; previously-run tasks retain
 * their completion order (oldest run first). This creates a predictable
 * A → B → C → A round-robin queue without changing the actual schedules.
 */
export function sortTasksForQueue<T extends Task>(tasks:T[]):T[]{
 return tasks.map((task,index)=>({task,index})).sort((a,b)=>{
  const aRan=Boolean(a.task.lastRun),bRan=Boolean(b.task.lastRun);
  if(aRan!==bRan)return aRan?1:-1;
  if(aRan&&bRan){
   const runDiff=new Date(a.task.lastRun!).getTime()-new Date(b.task.lastRun!).getTime();
   if(Number.isFinite(runDiff)&&runDiff!==0)return runDiff;
  }
  const dueDiff=new Date(a.task.nextRun).getTime()-new Date(b.task.nextRun).getTime();
  if(Number.isFinite(dueDiff)&&dueDiff!==0)return dueDiff;
  const createdDiff=new Date(a.task.createdAt).getTime()-new Date(b.task.createdAt).getTime();
  return (Number.isFinite(createdDiff)?createdDiff:0)||(a.index-b.index);
 }).map(entry=>entry.task);
}
