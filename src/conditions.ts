import {TaskCondition,TaskConditionGroup,TaskConditionNode} from "./types";

function normalize(value:string){return value.toLowerCase().replace(/\s+/g," ").trim();}
function numeric(value:string){const match=value.replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):null;}

function fieldValue(rule:TaskCondition,source:string){
 if(!rule.field||rule.field==="result"||rule.field==="changed"||rule.field==="time"||rule.field==="day")return source;
 const patterns:Record<string,RegExp>={
  weather:/☁️\s*([^\n]+)/i,
  temperature:/🌡\s*(-?\d+(?:\.\d+)?)/i,
  feels_like:/feels like\s*(-?\d+(?:\.\d+)?)/i,
  rain_probability:/rain\s*(-?\d+(?:\.\d+)?)%/i,
  cloud_cover:/clouds\s*(-?\d+(?:\.\d+)?)%/i,
  humidity:/humidity\s*(-?\d+(?:\.\d+)?)%/i,
  wind:/wind\s*(-?\d+(?:\.\d+)?)\s*km\/h/i,
  uv:/uv\s*(-?\d+(?:\.\d+)?)/i,
  visibility:/visibility\s*(-?\d+(?:\.\d+)?)\s*km/i
 };
 const match=patterns[rule.field]?.exec(source);
 return match?match[1]:source;
}

export function evaluateCondition(
 rule:TaskCondition,
 values:{result:string;previousResult:string;changed:boolean;time?:string;day?:string}
):boolean{
 const source=rule.source==="previousResult"?values.previousResult:rule.source==="changed"?String(values.changed):rule.source==="time"?String(values.time||""):rule.source==="day"?String(values.day||""):values.result;
 if(rule.source==="changed"){
  const expected=normalize(rule.value||"true");
  const actual=values.changed?"true":"false";
  if(rule.operator==="equals")return actual===expected;
  if(rule.operator==="not_equals")return actual!==expected;
  return false;
 }
 const extracted=fieldValue(rule,source);
 const actual=normalize(extracted),expected=normalize(rule.value||"");
 switch(rule.operator){
  case "contains":return actual.includes(expected);
  case "not_contains":return !actual.includes(expected);
  case "equals":return actual===expected;
  case "not_equals":return actual!==expected;
  case "starts_with":return actual.startsWith(expected);
  case "ends_with":return actual.endsWith(expected);
  case "greater_than":{const a=numeric(extracted),b=numeric(rule.value||"");return a!==null&&b!==null&&a>b;}
  case "less_than":{const a=numeric(extracted),b=numeric(rule.value||"");return a!==null&&b!==null&&a<b;}
  case "greater_or_equal":{const a=numeric(extracted),b=numeric(rule.value||"");return a!==null&&b!==null&&a>=b;}
  case "less_or_equal":{const a=numeric(extracted),b=numeric(rule.value||"");return a!==null&&b!==null&&a<=b;}
  default:return false;
 }
}

export function evaluateConditionTree(
 node:TaskConditionNode,
 values:{result:string;previousResult:string;changed:boolean;time?:string;day?:string}
):boolean{
 if(node.type!=="group")return evaluateCondition(node,values);
 if(node.children.length===0)return false;
 const results=node.children.map(child=>evaluateConditionTree(child,values));
 const matched=node.join==="any"?results.some(Boolean):results.every(Boolean);
 return node.negated?!matched:matched;
}
