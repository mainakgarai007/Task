export type Frequency="once"|"hourly"|"daily"|"weekly"|"monthly"|"custom";
export type TaskStatus="active"|"paused"|"completed"|"failed";
export type ExecutionState="idle"|"running"|"waiting";
export type ExecutionMode="direct"|"ai";
export type ActionType="reminder"|"weather"|"news"|"anime"|"movie"|"web"|"ai";
export type ConditionSource="result"|"previousResult"|"changed";
export type ConditionOperator="contains"|"not_contains"|"equals"|"not_equals"|"starts_with"|"ends_with"|"greater_than"|"less_than"|"greater_or_equal"|"less_or_equal";
export interface TaskCondition{source:ConditionSource;operator:ConditionOperator;value?:string}
export type ConditionSource="result"|"previousResult"|"changed";
export type ConditionOperator="contains"|"not_contains"|"equals"|"not_equals"|"starts_with"|"ends_with"|"greater_than"|"less_than"|"greater_or_equal"|"less_or_equal";
export interface TaskCondition{source:ConditionSource;operator:ConditionOperator;value?:string}

export interface TaskSchedule{
 time:string;
 startDate?:string;
 endDate?:string;
 weekday?:number;
 monthDay?:number;
 intervalMinutes?:number;
 maxRuns?:number;
 notifyOnChange?:boolean;
}

export interface TaskAction{
 type:ActionType;
 message?:string;
 location?:string;
 locationMode?:"manual"|"auto-once"|"auto-live";
 latitude?:number;
 longitude?:number;
 topic?:string;
 animeId?:number;
 animeSource?:"anilist"|"jikan";
 language?:string;
 url?:string;
 scope?:string;
 region?:string;
 condition?:string;
 stopCondition?:string;
 conditionRule?:TaskCondition;
 stopConditionRule?:TaskCondition;
 notifyOnChange?:boolean;
 category?:string;
}

export interface ExecutionRecord{
 id:string;startedAt:string;finishedAt:string;
 status:"success"|"failed";result?:string;error?:string;
}

export interface Task{
 id:string;title:string;prompt:string;frequency:Frequency;nextRun:string;enabled:boolean;status:TaskStatus;
 createdAt:string;lastRun?:string;runCount:number;history:string[];executions?:ExecutionRecord[];
 lastResult?:string;previousResult?:string;lastError?:string;
 executionMode:ExecutionMode;action:TaskAction;schedule?:TaskSchedule;executionState?:ExecutionState;waitingReason?:string;
}

export const frequencyLabels:Record<Frequency,string>={
 once:"Once",hourly:"Every hour",daily:"Every day",weekly:"Every week",monthly:"Every month",custom:"Custom interval"
};