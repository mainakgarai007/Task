import {describe,expect,it} from "vitest";
import {ExecutionGuard,shouldRecoverRunningExecution,reenableFailedTask} from "./executionGuard";
describe("execution reliability guard",()=>{
 it("rejects duplicate triggers for the same task",()=>{const g=new ExecutionGuard();expect(g.acquire("task-1")).toBe(true);expect(g.acquire("task-1")).toBe(false);expect(g.has("task-1")).toBe(true);});
 it("allows different tasks to execute independently",()=>{const g=new ExecutionGuard();expect(g.acquire("task-1")).toBe(true);expect(g.acquire("task-2")).toBe(true);});
 it("allows retry after the lock is released",()=>{const g=new ExecutionGuard();g.acquire("task-1");g.release("task-1");expect(g.acquire("task-1")).toBe(true);});
 it("re-enables a failed one-time task for manual retry without changing other fields",()=>{const task={id:"once-1",frequency:"once",status:"failed",enabled:false,runCount:1};expect(reenableFailedTask(task)).toEqual({...task,status:"active",enabled:true});});
 it("does not change a completed task when preparing a retry",()=>{const task={status:"completed",enabled:false};expect(reenableFailedTask(task)).toBe(task);});
 it("recovers running state only when no lock exists",()=>{expect(shouldRecoverRunningExecution(false,"running")).toBe(true);expect(shouldRecoverRunningExecution(true,"running")).toBe(false);expect(shouldRecoverRunningExecution(false,"waiting")).toBe(false);expect(shouldRecoverRunningExecution(false,"idle")).toBe(false);});
});
