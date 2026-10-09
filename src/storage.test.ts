// @vitest-environment happy-dom
import {beforeEach,describe,expect,it} from "vitest";
import {loadTasks,normalizeTasks,saveTasks} from "./storage";
import type {Task} from "./types";

const detectedAt="2026-10-09T10:00:00.000Z";
function sampleTask(overrides:Partial<Task>={}):Task{
 return {
  id:"task-1",title:"RSS monitor",prompt:"Monitor feed",frequency:"daily",
  nextRun:"2026-10-10T07:00:00.000Z",enabled:true,status:"active",
  createdAt:"2026-10-01T00:00:00.000Z",runCount:2,history:[],
  executionMode:"direct",executionState:"running",
  action:{type:"web",url:"https://example.test/feed.xml",rssMonitor:true,
   rssHistory:[{id:"episode-7",title:"Episode 7",link:"https://example.test/7",published:"2026-10-09",detectedAt}]},
  ...overrides
 };
}
beforeEach(()=>localStorage.clear());
describe("task storage and reload normalization",()=>{
 it("round-trips tasks and item-level RSS history through localStorage",()=>{
  saveTasks([sampleTask()]);
  const [loaded]=loadTasks();
  expect(loaded.id).toBe("task-1");
  expect(loaded.action.rssHistory).toEqual([{id:"episode-7",title:"Episode 7",link:"https://example.test/7",published:"2026-10-09",detectedAt}]);
  expect(loaded.executionState).toBe("idle");
  expect(loaded.runCount).toBe(2);
 });
 it("keeps waiting tasks waiting but resets stale running tasks to idle",()=>{
  const result=normalizeTasks([sampleTask(),sampleTask({id:"task-2",executionState:"waiting",waitingReason:"AI settings are required"})]);
  expect(result.map(t=>t.executionState)).toEqual(["idle","waiting"]);
  expect(result[1].waitingReason).toBe("AI settings are required");
 });
 it("drops malformed task records without discarding valid records",()=>{
  const result=normalizeTasks([null,{id:"bad",title:"Missing required fields"},sampleTask()]);
  expect(result).toHaveLength(1);
  expect(result[0].id).toBe("task-1");
 });
 it("recovers a legacy task with no action using a reminder fallback",()=>{
  const legacy={id:"legacy",title:"Old task",prompt:"Remember this",frequency:"once",nextRun:"2026-10-10T07:00:00.000Z",enabled:true,status:"active",createdAt:"2026-10-01T00:00:00.000Z",runCount:0,history:[],executionMode:"direct"};
  const [loaded]=normalizeTasks([legacy]);
  expect(loaded.action).toMatchObject({type:"reminder",message:"Remember this"});
 });
});
