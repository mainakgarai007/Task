import {Frequency,Task,ExecutionMode,ActionType,TaskAction} from "./types";

export type AIProvider="openai"|"gemini"|"claude"|"openrouter"|"custom";
export interface AISettings{enabled:boolean;provider:AIProvider;endpoint:string;apiKey:string;model:string;}
export interface AIModel{id:string;name?:string;provider?:AIProvider;}
const SETTINGS_KEY="task-tool.ai.v2";
export const providerLabels:Record<AIProvider,string>={openai:"OpenAI",gemini:"Google Gemini",claude:"Claude",openrouter:"OpenRouter",custom:"Other / Custom"};
export const defaultAISettings:AISettings={enabled:false,provider:"openrouter",endpoint:"https://openrouter.ai/api/v1/chat/completions",apiKey:"",model:""};
const modelHints:Record<AIProvider,AIModel[]>={openai:[],gemini:[],claude:[],openrouter:[],custom:[]};

export function loadAISettings():AISettings{try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");return {...defaultAISettings,...saved,enabled:saved?.enabled===true};}catch{return defaultAISettings;}}
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
  const r=await fetch("https://openrouter.ai/api/v1/models");if(!r.ok)throw new Error("OpenRouter model search failed ("+r.status+").");
  const d=await r.json();return (d.data||[]).filter((m:any)=>m?.id).map((m:any)=>({id:String(m.id),name:m.name||m.id}));
 }
 if(!key&&settings.provider!=="custom")throw new Error("Add your API key first.");
 if(settings.provider==="gemini"){
  const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",{headers:{"x-goog-api-key":key}});
  if(!r.ok)throw new Error("Gemini model search failed ("+r.status+"). "+(await r.text().catch(()=>"")).slice(0,160));
  const d=await r.json();
  const live=(d.models||[]).filter((m:any)=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes("generateContent")).map((m:any)=>({id:String(m.name||"").replace(/^models\//,""),name:m.displayName||m.name}));
  const featured:AIModel[]=[{id:"gemini-3.8-flash",name:"Gemini 3.8 Flash — Free tier"},{id:"gemini-3.5-flash-lite",name:"Gemini 3.5 Flash-Lite — Free tier"}];
  const merged=[...featured,...live];return merged.filter((m,index)=>merged.findIndex(x=>x.id===m.id)===index);
 }
 if(settings.provider==="openai"){
  const r=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:"Bearer "+key}});if(!r.ok)throw new Error("OpenAI model search failed ("+r.status+").");
  const d=await r.json();return (d.data||[]).filter((m:any)=>typeof m.id==="string").map((m:any)=>({id:m.id,name:m.id}));
 }
 if(settings.provider==="claude"){
  const r=await fetch("https://api.anthropic.com/v1/models",{headers:{"x-api-key":key,"anthropic-version":"2023-06-01"}});if(!r.ok)throw new Error("Claude model search failed ("+r.status+").");
  const d=await r.json();return (d.data||[]).map((m:any)=>({id:String(m.id),name:m.display_name||m.id}));
 }
 return getModelHints(settings.provider);
}

export interface ParsedTask{
 title:string;prompt:string;frequency:Frequency;firstRun:string;
 executionMode:ExecutionMode;action:TaskAction;
}

function extractJson(text:string):ParsedTask{
 const cleaned=text.replace(/\`\`\`json/gi,"").replace(/\`\`\`/g,"").trim();
 const match=cleaned.match(/\{[\s\S]*\}/);if(!match)throw new Error("AI did not return a valid task.");
 const data=JSON.parse(match[0]);
 const frequencies:Frequency[]=["once","hourly","daily","weekly","monthly","custom"];
 const modes:ExecutionMode[]=["direct","ai"];
 const actionTypes:ActionType[]=["reminder","weather","news","anime","movie","web","ai"];
 if(!data.title||!data.prompt||!frequencies.includes(data.frequency)||!data.firstRun)throw new Error("AI returned an incomplete task.");
 if(!modes.includes(data.executionMode))throw new Error("AI did not specify an execution mode.");
 const action=data.action||{type:data.executionMode==="ai"?"ai":"reminder"};
 if(!actionTypes.includes(action.type))throw new Error("AI returned an unsupported action.");
 const date=new Date(data.firstRun);if(Number.isNaN(date.getTime()))throw new Error("AI returned an invalid first-run time.");
 return {title:String(data.title).trim(),prompt:String(data.prompt).trim(),frequency:data.frequency,firstRun:date.toISOString(),executionMode:data.executionMode,action:{...action,type:action.type}};
}

const systemPrompt=(now:Date)=>`You are the task planner for a scheduling app.
Current time: ${now.toISOString()}
User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

Convert the request into ONE task. Prefer executionMode "direct" when the result can be obtained without AI at run time.
Direct actions:
- reminder: local reminder text only; action.message
- weather: use public Open-Meteo; action.location
- news: use a public news/RSS search; action.topic and optional action.language ("en","hi","bn")
- anime: monitor public news/RSS for an anime; action.topic, action.scope, action.language
- movie: monitor public news/RSS for a movie/release; action.topic, action.scope, action.language
- web: fetch a public URL/RSS; action.url, action.scope
Use executionMode "ai" only when the task genuinely needs AI reasoning/generation at run time.

Return ONLY JSON:
{"title":"short title","prompt":"useful instruction","frequency":"once|hourly|daily|weekly|monthly|custom","firstRun":"ISO-8601","executionMode":"direct|ai","action":{"type":"reminder|weather|news|anime|movie|web|ai","message":"","location":"","topic":"","language":"en","scope":"","url":""}}

For weather/news/web, do not put made-up data in the prompt. Resolve relative dates/times using current time and timezone.`;

export async function createTaskWithAI(request:string,settings:AISettings):Promise<ParsedTask>{
 if(!request.trim())throw new Error("Tell AI what you want to schedule.");
 if(!settings.apiKey.trim())throw new Error("Add your AI API key first.");
 if(!settings.model.trim())throw new Error("Choose an AI model first.");
 const now=new Date(),system=systemPrompt(now);
 if(settings.provider==="gemini"){
  const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(settings.model)+":generateContent";
  let last="";
  for(let attempt=0;attempt<3;attempt++){
   const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":settings.apiKey.trim()},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:request.trim()}]}],generationConfig:{temperature:0.1,responseMimeType:"application/json"}})});
   if(r.ok){const d=await r.json(),content=d?.candidates?.[0]?.content?.parts?.[0]?.text;if(typeof content!=="string")throw new Error("Gemini returned no task data.");return extractJson(content);}
   last=await r.text().catch(()=>"");if(r.status!==429&&r.status!==500&&r.status!==502&&r.status!==503)break;await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
  }
  throw new Error("Gemini model '"+settings.model+"' is temporarily unavailable. Search models and choose another available model, then try again. "+last.slice(0,120));
 }
 if(settings.provider==="claude"){
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":settings.apiKey.trim(),"anthropic-version":"2023-06-01"},body:JSON.stringify({model:settings.model,max_tokens:700,system,messages:[{role:"user",content:request.trim()}]})});
  if(!r.ok)throw new Error("Claude request failed ("+r.status+").");
  const d=await r.json(),content=d?.content?.find((x:any)=>x.type==="text")?.text;if(typeof content!=="string")throw new Error("Claude returned no task data.");return extractJson(content);
 }
 const endpoint=settings.provider==="custom"?settings.endpoint.trim():providerEndpoint(settings.provider);if(!endpoint)throw new Error("Set a custom OpenAI-compatible endpoint.");
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+settings.apiKey.trim()},body:JSON.stringify({model:settings.model.trim(),temperature:0.1,messages:[{role:"system",content:system},{role:"user",content:request.trim()}]})});
 if(!r.ok)throw new Error("AI request failed ("+r.status+"). "+(await r.text().catch(()=>"")).slice(0,180));
 const d=await r.json(),content=d?.choices?.[0]?.message?.content;if(typeof content!=="string")throw new Error("AI returned no task result.");return extractJson(content);
}

export async function executeTaskWithAI(task:Task,settings:AISettings):Promise<string>{
 if(!settings.apiKey.trim())throw new Error("Add your AI API key first.");if(!settings.model.trim())throw new Error("Choose an AI model first.");
 const previous=task.lastResult||"(No previous result — first run.)";
 const system="You are the execution engine for a scheduled automation. Current time: "+new Date().toISOString()+"\nTask: "+task.title+"\nPrevious result:\n"+previous+"\nReturn a concise useful result. Preserve important context. Never invent live data.";
 if(settings.provider==="gemini"){
  const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(settings.model)+":generateContent";
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":settings.apiKey.trim()},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:task.prompt}]}],generationConfig:{temperature:0.2}})});
  if(!r.ok)throw new Error("Gemini execution failed ("+r.status+"). "+(await r.text().catch(()=>"")).slice(0,160));
  const d=await r.json(),content=d?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text||"").join("").trim();if(content)return content;throw new Error("Gemini returned no task result.");
 }
 if(settings.provider==="claude"){
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":settings.apiKey.trim(),"anthropic-version":"2023-06-01"},body:JSON.stringify({model:settings.model,max_tokens:1200,system,messages:[{role:"user",content:task.prompt}]})});
  if(!r.ok)throw new Error("Claude execution failed ("+r.status+").");const d=await r.json(),content=d?.content?.filter((x:any)=>x.type==="text").map((x:any)=>x.text).join("\n").trim();if(content)return content;throw new Error("Claude returned no task result.");
 }
 const endpoint=settings.provider==="custom"?settings.endpoint.trim():providerEndpoint(settings.provider);if(!endpoint)throw new Error("Set a custom OpenAI-compatible endpoint.");
 const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+settings.apiKey.trim()},body:JSON.stringify({model:settings.model.trim(),temperature:0.2,messages:[{role:"system",content:system},{role:"user",content:task.prompt}]})});
 if(!r.ok)throw new Error("AI execution failed ("+r.status+"). "+(await r.text().catch(()=>"")).slice(0,160));
 const d=await r.json(),content=d?.choices?.[0]?.message?.content;if(typeof content!=="string"||!content.trim())throw new Error("AI returned no task result.");return content.trim();
}

export function parsedTaskToTask(parsed:ParsedTask,uid:()=>string):Task{
 return {id:uid(),title:parsed.title,prompt:parsed.prompt,frequency:parsed.frequency,nextRun:parsed.firstRun,enabled:true,status:"active",createdAt:new Date().toISOString(),runCount:0,history:[],executionMode:parsed.executionMode,action:parsed.action};
}
