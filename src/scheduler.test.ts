import {describe,expect,it} from "vitest";
import {nextRun} from "./scheduler";
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
 it("clamps an impossible monthly day to the last day of the month",()=>{
  const from=new Date(2026,9,1,8,0,0),next=new Date(nextRun(from,"monthly",{time:"09:00",months:[9],monthDays:[31]} as Task["schedule"]));
  expect(next.getMonth()).toBe(9);expect(next.getDate()).toBe(31);expect(next.getHours()).toBe(9);
 });
});
