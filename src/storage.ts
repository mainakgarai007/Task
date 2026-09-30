import {Task} from "./types";
const KEY="task-tool.tasks.v1";
export function loadTasks():Task[]{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
export function saveTasks(tasks:Task[]){localStorage.setItem(KEY,JSON.stringify(tasks))}
export function uid(){return crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)}