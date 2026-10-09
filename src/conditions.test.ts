import {describe,expect,it} from "vitest";
import {evaluateCondition,evaluateConditionTree} from "./conditions";
import type {TaskCondition,TaskConditionGroup} from "./types";

const values={result:"No new RSS/Atom items detected.",previousResult:"1. Previous episode",changed:false,newItems:"",removedItems:"",updatedItems:""};
function condition(field:TaskCondition["field"],operator:TaskCondition["operator"],value:string):TaskCondition{return {source:"result",field,operator,value};}
describe("RSS item-count IF/THEN conditions",()=>{
 it("matches new_items > 0 only when new item lines exist",()=>{
  expect(evaluateCondition(condition("new_items","greater_than","0"),{...values,newItems:"Black Torch · https://example.test/1"})).toBe(true);
  expect(evaluateCondition(condition("new_items","greater_than","0"),values)).toBe(false);
 });
 it("supports all numeric item-count operators",()=>{
  const v={...values,newItems:"one\ntwo"};
  expect(evaluateCondition(condition("new_items","greater_than","1"),v)).toBe(true);
  expect(evaluateCondition(condition("new_items","greater_or_equal","2"),v)).toBe(true);
  expect(evaluateCondition(condition("new_items","less_than","3"),v)).toBe(true);
  expect(evaluateCondition(condition("new_items","less_or_equal","2"),v)).toBe(true);
  expect(evaluateCondition(condition("new_items","equals","2"),v)).toBe(false);
 });
 it("does not count empty lines as items",()=>{expect(evaluateCondition(condition("new_items","greater_than","0"),{...values,newItems:"\n  \n"})).toBe(false);});
 it("supports item keyword checks",()=>{
  expect(evaluateCondition(condition("new_items","contains","Black Torch"),{...values,newItems:"Black Torch episode"})).toBe(true);
  expect(evaluateCondition(condition("new_items","contains","Black Torch"),values)).toBe(false);
 });
 it("works inside nested AND/OR/NOT condition groups",()=>{
  const tree:TaskConditionGroup={type:"group",join:"all",children:[condition("new_items","greater_than","0"),{type:"group",join:"any",negated:true,children:[condition("removed_items","greater_than","0")]}]};
  expect(evaluateConditionTree(tree,{...values,newItems:"New episode"})).toBe(true);
  expect(evaluateConditionTree(tree,values)).toBe(false);
 });
});
