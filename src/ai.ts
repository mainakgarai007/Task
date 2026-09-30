import {Frequency, Task} from "./types";

export type AIProvider="openai"|"gemini"|"claude"|"openrouter"|"custom";

export interface AISettings {
  provider: AIProvider;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface AIModel {
  id:string;
  name?:string;
  provider?:AIProvider;
}

const SETTINGS_KEY="task-tool.ai.v2";

export const providerLabels:Record<AIProvider,string>={
  openai:"OpenAI",
  gemini:"Google Gemini",
  claude:"Claude",
  openrouter:"OpenRouter",
  custom:"Other / Custom",
};

export const defaultAISettings:AISettings={
  provider:"openrouter",
  endpoint:"https://openrouter.ai/api/v1/chat/completions",
  apiKey:"",
  model:"",
};

const modelHints:Record<AIProvider,AIModel[]>={
 openai:[
  {id:"gpt-5.6",name:"GPT-5.6"},
  {id:"gpt-5.6-luna",name:"GPT-5.6 Luna"},
  {id:"gpt-5.6-terra",name:"GPT-5.6 Terra"},
  {id:"gpt-5.6-sol",name:"GPT-5.6 Sol"},
 ],
 gemini:[
  {id:"gemini-3.8-flash",name:"Gemini 3.8 Flash"},
  {id:"gemini-3.7-flash",name:"Gemini 3.7 Flash"},
  {id:"gemini-3.1-pro-preview",name:"Gemini 3.1 Pro"},
  {id:"gemini-2.5-flash",name:"Gemini 2.5 Flash"},
  {id:"gemini-2.5-pro",name:"Gemini 2.5 Pro"},
 ],
 claude:[
  {id:"claude-opus-4-8",name:"Claude Opus 4.8"},
  {id:"claude-opus-4-6",name:"Claude Opus 4.6"},
  {id:"claude-sonnet-5",name:"Claude Sonnet 5"},
  {id:"claude-sonnet-4-6",name:"Claude Sonnet 4.6"},
  {id:"claude-haiku-4-5-20251001",name:"Claude Haiku 4.5"},
 ],
 openrouter:[],
 custom:[],
};

export function loadAISettings():AISettings{
 try{return {...defaultAISettings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")};}
 catch{return defaultAISettings;}
}
export function saveAISettings(settings:AISettings){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}

export function providerEndpoint(provider:AIProvider){
 if(provider==="openai")return "https://api.openai.com/v1/chat/completions";
 if(provider==="gemini")return "https://generativelanguage.googleapis.com/v1beta";
 if(provider==="claude")return "https://api.anthropic.com/v1/messages";
 if(provider==="openrouter")return "https://openrouter.ai/api/v1/chat/completions";
 return "";
}

export function getModelHints(provider:AIProvider){return modelHints[provider]||[];}

export async function searchModels(settings:AISettings):Promise<AIModel[]>{
 const key=settings.apiKey.trim();
 if(settings.provider==="openrouter"){
  const r=await fetch("https://openrouter.ai/api/v1/models");
  if(!r.ok)throw new Error("OpenRouter model search failed ("+r.status+").");
  const d=await r.json();
  return (d.data||[]).filter((m:any)=>m?.id).map((m:any)=>({id:String(m.id),name:m.name||m.id}));
 }
 if(!key && settings.provider!=="custom")throw new Error("Add your API key first.");
 if(settings.provider==="gemini"){
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",{headers:{"x-goog-api-key":key}});
  if(!r.ok){const body=await r.text().catch(()=>""),detail=body.slice(0,160);throw new Error("Gemini model search failed ("+r.status+"). "+detail);}
  const d=await r.json();
  return (d.models||[]).filter((m:any)=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes("generateContent"))
   .map((m:any)=>({id:String(m.name||"").replace(/^models\//,""),name:m.displayName||m.name}));
 }
 if(settings.provider==="openai"){
  const r=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:"Bearer "+key}});
  if(!r.ok)throw new Error("OpenAI model search failed ("+r.status+").");
  const d=await r.json();
  return (d.data||[]).filter((m:any)=>typeof m.id==="string").map((m:any)=>({id:m.id,name:m.id}));
 }
 if(settings.provider==="claude"){
  const r=await fetch("https://api.anthropic.com/v1/models",{headers:{"x-api-key":key,"anthropic-version":"2023-06-01"}});
  if(!r.ok)throw new Error("Claude model search failed ("+r.status+").");
  const d=await r.json();
  return (d.data||[]).map((m:any)=>({id:String(m.id),name:m.display_name||m.id}));
 }
 return getModelHints(settings.provider);
}
export interface ParsedTask{title:string;prompt:string;frequency:Frequency;firstRun:string;}

function extractJson(text:string):ParsedTask{
 const cleaned=text.replace(/\`\`\`json/gi,"").replace(/\`\`\`/g,"").trim();
 const match=cleaned.match(/\{[\s\S]*\}/);
 if(!match)throw new Error("AI did not return a valid task.");
 const data=JSON.parse(match[0]);
 const frequencies:Frequency[]=["once","hourly","daily","weekly","monthly"];
 if(!data.title||!data.prompt||!frequencies.includes(data.frequency)||!data.firstRun)throw new Error("AI returned an incomplete task.");
 const date=new Date(data.firstRun);
 if(Number.isNaN(date.getTime()))throw new Error("AI returned an invalid first-run time.");
 return {title:String(data.title).trim(),prompt:String(data.prompt).trim(),frequency:data.frequency,firstRun:date.toISOString()};
}

const systemPrompt=(now:Date)=>`You are the task planner for a scheduling app.
Convert the user's request into exactly ONE scheduled task.
Current time: ${now.toISOString()}
User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

Return ONLY valid JSON:
{"title":"short task title","prompt":"exact useful instruction","frequency":"once|hourly|daily|weekly|monthly","firstRun":"ISO-8601 date/time"}

Resolve relative dates/times using the current time and timezone. If no time is specified, choose a sensible local time. Do not invent unsupported integrations.`;

export async function createTaskWithAI(request:string,settings:AISettings):Promise<ParsedTask>{
 if(!request.trim())throw new Error("Tell AI what you want to schedule.");
 if(!settings.apiKey.trim())throw new Error("Add your AI API key first.");
 if(!settings.model.trim())throw new Error("Choose an AI model first.");
 const now=new Date(), system=systemPrompt(now);

 if(settings.provider==="gemini"){
  const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(settings.model)+":generateContent";
  let last="";
  for(let attempt=0;attempt<3;attempt++){
   const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":settings.apiKey.trim()},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:request.trim()}]}],generationConfig:{temperature:0.1,responseMimeType:"application/json"}})});
   if(r.ok){
    const d=await r.json(),content=d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(typeof content!=="string")throw new Error("Gemini returned no task data.");
    return extractJson(content);
   }
   last=await r.text().catch(()=> "");
   if(r.status!==429&&r.status!==500&&r.status!==502&&r.status!==503)break;
   await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
  }
  throw new Error("Gemini request failed after retries ("+(last.slice(0,140)||"temporary service error")+")");
 }
 if(settings.provider==="claude"){
  const r=await fetch("https://api.anthropic.com/v1/messages",{
   method:"POST",headers:{"Content-Type":"application/json","x-api-key":settings.apiKey.trim(),"anthropic-version":"2023-06-01"},
   body:JSON.stringify({model:settings.model,max_tokens:500,system,messages:[{role:"user",content:request.trim()}]})
  });
  if(!r.ok)throw new Error("Claude request failed ("+r.status+").");
  const d=await r.json(),content=d?.content?.find((x:any)=>x.type==="text")?.text;
  if(typeof content!=="string")throw new Error("Claude returned no task data.");
  return extractJson(content);
 }

 const endpoint=settings.provider==="custom"?settings.endpoint.trim():providerEndpoint(settings.provider);
 if(!endpoint)throw new Error("Set a custom OpenAI-compatible endpoint.");
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+settings.apiKey.trim()},body:JSON.stringify({
  model:settings.model.trim(),temperature:0.1,messages:[{role:"system",content:system},{role:"user",content:request.trim()}]
 })});
 if(!r.ok){const body=await r.text().catch(()=>""),msg=body.slice(0,180);throw new Error(`AI request failed (${r.status}). ${msg}`);}
 const d=await r.json(),content=d?.choices?.[0]?.message?.content;
 if(typeof content!=="string")throw new Error("AI returned no task data.");
 return extractJson(content);
}

export function parsedTaskToTask(parsed:ParsedTask,uid:()=>string):Task{
 return {id:uid(),title:parsed.title,prompt:parsed.prompt,frequency:parsed.frequency,nextRun:parsed.firstRun,enabled:true,status:"active",createdAt:new Date().toISOString(),runCount:0,history:[]};
}
