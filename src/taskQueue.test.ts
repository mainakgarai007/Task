import {describe,expect,it} from "vitest";
import {sortTasksForQueue} from "./taskQueue";
import type {Task} from "./types";

function task(id:string,nextRun:string,lastRun?:string):Task{
 return {id,title:id,prompt:id,frequency:"daily",nextRun,enabled:true,status:"active",createdAt:"2026-10-15T05:00:00.000Z",lastRun,runCount:lastRun?1:0,history:[],executionMode:"direct",action:{type:"reminder",message:id}};
}

describe("round-robin task queue",()=>{
 it("starts with the next scheduled task when none have run",()=>{
  const tasks=[task("C","2026-10-15T09:00:00.000Z"),task("A","2026-10-15T07:00:00.000Z"),task("B","2026-10-15T08:00:00.000Z")];
  expect(sortTasksForQueue(tasks).map(t=>t.id)).toEqual(["A","B","C"]);
 });
 it("moves a completed/run task behind not-yet-run tasks",()=>{
  const tasks=[task("A","2026-10-15T07:00:00.000Z","2026-10-15T07:01:00.000Z"),task("C","2026-10-15T09:00:00.000Z"),task("B","2026-10-15T08:00:00.000Z")];
  expect(sortTasksForQueue(tasks).map(t=>t.id)).toEqual(["B","C","A"]);
 });
 it("keeps completed tasks in their previous run order, producing C,A,B after B runs",()=>{
  const tasks=[task("B","2026-10-15T08:00:00.000Z","2026-10-15T08:01:00.000Z"),task("A","2026-10-15T07:00:00.000Z","2026-10-15T07:01:00.000Z"),task("C","2026-10-15T09:00:00.000Z")];
  expect(sortTasksForQueue(tasks).map(t=>t.id)).toEqual(["C","A","B"]);
 });
 it("does not mutate the original task array",()=>{
  const tasks=[task("B","2026-10-15T08:00:00.000Z"),task("A","2026-10-15T07:00:00.000Z")];
  const original=[...tasks];sortTasksForQueue(tasks);
  expect(tasks).toEqual(original);
 });
});
