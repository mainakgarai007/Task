export class ExecutionGuard {
 private active = new Set<string>();
 acquire(taskId: string): boolean { if (this.active.has(taskId)) return false; this.active.add(taskId); return true; }
 release(taskId: string): void { this.active.delete(taskId); }
 has(taskId: string): boolean { return this.active.has(taskId); }
}
export function shouldRecoverRunningExecution(hasLock: boolean, state: string | undefined): boolean { return state === "running" && !hasLock; }

export function reenableFailedTask<T extends {status:string;enabled:boolean}>(task:T):T {
 if(task.status!=="failed")return task;
 return {...task,enabled:true,status:"active"} as T;
}
