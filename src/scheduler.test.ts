import {describe,expect,it} from "vitest";
import {buildNativeTaskReminders,intervalToMinutes,nextRun} from "./scheduler";
import type {Task} from "./types";
describe("schedule progression",()=>{
 it("advances hourly schedules by one hour and clears seconds",()=>{
  const from=new Date(2026,9,9,12,30,45),next=new Date(nextRun(from,"hourly"));
  expect(next.getTime()-from.getTime()).toBe(60*60*1000-45*1000);
  expect(next.getSeconds()).toBe(0);
 });
 it("advances custom schedules by their configured minute interval",()=>{
  const from=new Date(2026,9,9,12,0,0),next=new Date(nextRun(from,"custom",{time:"",intervalMinutes:90} as Task["schedule"]));
  expect(next.getTime()-from.getTime()).toBe(90*60*1000);
 });
 it("selects the next matching weekday for daily schedules",()=>{
  const from=new Date(2026,9,9,8,0,0),next=new Date(nextRun(from,"daily",{time:"07:00",weekdays:[1]} as Task["schedule"]));
  expect(next.getDay()).toBe(1);expect(next.getHours()).toBe(7);expect(next.getDate()).toBe(12);
 });
 it("defaults legacy monthly schedules without selected months to every month",()=>{
  const from=new Date(2026,9,20,8,0,0),next=new Date(nextRun(from,"monthly",{time:"09:00",monthDay:15} as Task["schedule"]));
  expect(next.getFullYear()).toBe(2026);expect(next.getMonth()).toBe(10);expect(next.getDate()).toBe(15);expect(next.getHours()).toBe(9);
 });
 it("clamps an impossible monthly day to the last day of the month",()=>{
  const from=new Date(2026,9,1,8,0,0),next=new Date(nextRun(from,"monthly",{time:"09:00",months:[9],monthDays:[31]} as Task["schedule"]));
  expect(next.getMonth()).toBe(9);expect(next.getDate()).toBe(31);expect(next.getHours()).toBe(9);
 });
});

describe("custom interval units",()=>{
 it("converts minutes, hours and days to stored minutes",()=>{
  expect(intervalToMinutes(30,"minutes")).toBe(30);
  expect(intervalToMinutes(2,"hours")).toBe(120);
  expect(intervalToMinutes(3,"days")).toBe(4320);
 });
 it("rounds fractional intervals to whole minutes",()=>{
  expect(intervalToMinutes(1.5,"hours")).toBe(90);
 });
 it("schedules custom day intervals without changing the relative interval semantics",()=>{
  const from=new Date(2026,9,9,12,0,0);
  const next=new Date(nextRun(from,"custom",{time:"",intervalMinutes:intervalToMinutes(2,"days")} as Task["schedule"]));
  expect(next.getTime()-from.getTime()).toBe(2*24*60*60*1000);
 });
});

describe("native due-reminder reconciliation",()=>{
 const base=(overrides:Partial<Task>={}):Task=>({id:"a",title:"A",prompt:"A",frequency:"daily",nextRun:"2026-10-16T07:00:00.000Z",enabled:true,status:"active",createdAt:"2026-10-15T05:00:00.000Z",runCount:0,history:[],executionMode:"direct",action:{type:"reminder",message:"A"},...overrides});
 it("excludes disabled and inactive tasks",()=>{expect(buildNativeTaskReminders([base({enabled:false}),base({status:"paused"})],Date.parse("2026-10-15T00:00:00.000Z"))).toEqual([]);});
 it("assigns unique IDs and correct recurrence metadata",()=>{const r=buildNativeTaskReminders([base({id:"a"}),base({id:"b",frequency:"once"})],Date.parse("2026-10-15T00:00:00.000Z"));expect(r.map(x=>x.id)).toEqual([100000,100001]);expect(r.map(x=>x.extra.taskId)).toEqual(["a","b"]);expect(r[0].schedule.repeats).toBe(true);expect(r[1].schedule.repeats).toBe(false);});
 it("skips invalid and already-due reminders",()=>{expect(buildNativeTaskReminders([base({nextRun:"2026-10-14T07:00:00.000Z"}),base({id:"invalid",nextRun:"not-a-date"})],Date.parse("2026-10-15T00:00:00.000Z"))).toEqual([]);});
});
