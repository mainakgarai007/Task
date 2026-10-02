import {TaskCondition} from "./types";

function normalize(value:string){return value.toLowerCase().replace(/\s+/g," ").trim();}
function numeric(value:string){const match=value.replace(/,/g,"").match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):null;}

export function evaluateCondition(
 rule:TaskCondition,
 values:{result:string;previousResult:string;changed:boolean}
):boolean{
 const source=rule.source==="previousResult"?values.previousResult:rule.source==="changed"?String(values.changed):values.result;
 if(rule.source==="changed"){
  const expected=normalize(rule.value||"true");
  const actual=values.changed?"true":"false";
  if(rule.operator==="equals")return actual===expected;
  if(rule.operator==="not_equals")return actual!==expected;
  return false;
 }
 const actual=normalize(source),expected=normalize(rule.value||"");
 switch(rule.operator){
  case "contains":return actual.includes(expected);
  case "not_contains":return !actual.includes(expected);
  case "equals":return actual===expected;
  case "not_equals":return actual!==expected;
  case "starts_with":return actual.startsWith(expected);
  case "ends_with":return actual.endsWith(expected);
  case "greater_than":{const a=numeric(source),b=numeric(rule.value||"");return a!==null&&b!==null&&a>b;}
  case "less_than":{const a=numeric(source),b=numeric(rule.value||"");return a!==null&&b!==null&&a<b;}
  case "greater_or_equal":{const a=numeric(source),b=numeric(rule.value||"");return a!==null&&b!==null&&a>=b;}
  case "less_or_equal":{const a=numeric(source),b=numeric(rule.value||"");return a!==null&&b!==null&&a<=b;}
  default:return false;
 }
}