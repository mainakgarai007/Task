import type {Task} from "./types";

type ApiCacheEntry={savedAt:number;data:any};
const API_CACHE_PREFIX="tasks-api-cache:";
const API_CACHE_VERSION=1;

function readApiCache<T>(key:string,ttlMs:number):T|null{
 try{
  const raw=localStorage.getItem(API_CACHE_PREFIX+API_CACHE_VERSION+":"+key);
  if(!raw)return null;
  const entry=JSON.parse(raw) as ApiCacheEntry;
  if(!entry||Date.now()-entry.savedAt>ttlMs)return null;
  return entry.data as T;
 }catch{return null;}
}

function writeApiCache(key:string,data:any){
 try{localStorage.setItem(API_CACHE_PREFIX+API_CACHE_VERSION+":"+key,JSON.stringify({savedAt:Date.now(),data}));}catch{}
}

async function publicJson(url:string,init?:RequestInit,ttlMs=300000,cacheKey=url):Promise<any>{
 const cached=readApiCache<any>(cacheKey,ttlMs);
 if(cached!==null)return cached;
 const response=await fetch(url,init);
 if(!response.ok)throw new Error("Public API request failed ("+response.status+").");
 const data=await response.json();
 writeApiCache(cacheKey,data);
 return data;
}



export async function fetchWeather(location:string,coords?:{latitude?:number;longitude?:number}):Promise<string>{
 const q=location.trim();
 if(!q)throw new Error("Weather location is required.");
 let lat=coords?.latitude, lon=coords?.longitude, placeName=q, state="";
 if(lat==null||lon==null){
  const geoUrl="https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(q)+"&count=20&language=en&format=json&countryCode=IN";
  let gd:any;
  try{gd=await publicJson(geoUrl,undefined,86400000,"weather-geo:"+q.toLowerCase());}catch{throw new Error("Indian weather location lookup failed.");}
  const place=(gd?.results||[]).find((p:any)=>p.country_code==="IN");
  if(!place)throw new Error("Could not find an Indian city or town: "+q);
  lat=place.latitude;lon=place.longitude;placeName=place.name;state=place.admin1||"";
 }
 const url="https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(String(lat))+"&longitude="+encodeURIComponent(String(lon))+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,cloud_cover,visibility,uv_index,is_day&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,sunrise,sunset,uv_index_max&forecast_days=3&timezone=auto";
 let d:any;
 try{d=await publicJson(url,undefined,300000,"weather:"+Number(lat).toFixed(3)+":"+Number(lon).toFixed(3));}catch(e){throw new Error(e instanceof Error?e.message:"Weather API failed.");}
 const c=d.current, day=d.daily;
 const labels:Record<number,string>={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Cloudy",45:"Fog",48:"Freezing fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",81:"Rain showers",82:"Heavy showers",95:"Thunderstorm",96:"Thunderstorm with hail",99:"Thunderstorm with hail"};
 const today=day?.time?.[0]||"";
 const hi=day?.temperature_2m_max?.[0], lo=day?.temperature_2m_min?.[0], rain=day?.precipitation_probability_max?.[0];
 const fmtTime=(v:string)=>v?v.split("T")[1]?.slice(0,5)||v:"—";
 return `${placeName}${state?", "+state:""}
🌡 ${c.temperature_2m}°C · Feels like ${c.apparent_temperature}°C
☁️ ${labels[c.weather_code]||"Weather update"}
📈 High ${hi}°C · Low ${lo}°C · 🌧 Rain ${rain}%
💧 Humidity ${c.relative_humidity_2m}% · 💨 Wind ${c.wind_speed_10m} km/h
☀️ UV ${c.uv_index} · ☁️ Clouds ${c.cloud_cover}% · 👁 Visibility ${Math.round((c.visibility||0)/1000)} km
🌅 Sunrise ${fmtTime(day?.sunrise?.[0])} · 🌇 Sunset ${fmtTime(day?.sunset?.[0])}`;
}

export function getCurrentLocation():Promise<{latitude:number;longitude:number}>{
 return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error("Location access is not supported by this browser."));return;}
  navigator.geolocation.getCurrentPosition(
   p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),
   e=>reject(new Error(e.code===1?"Location permission was denied. Allow location access for this site.":e.code===2?"Your location could not be determined right now.":"Location request timed out.")),
   {enableHighAccuracy:true,timeout:15000,maximumAge:0}
  );
 });
}

export async function reverseGeocodeIndia(coords:{latitude:number;longitude:number}):Promise<{label:string;countryCode:string}>{
 const url="https://api.bigdatacloud.net/data/reverse-geocode-client?latitude="+encodeURIComponent(String(coords.latitude))+"&longitude="+encodeURIComponent(String(coords.longitude))+"&localityLanguage=en";
 let d:any;
 try{d=await publicJson(url,undefined,86400000,"reverse:"+Number(coords.latitude).toFixed(3)+":"+Number(coords.longitude).toFixed(3));}catch{throw new Error("Could not identify your current location.");}
 const countryCode=String(d?.countryCode||"").toUpperCase();
 if(countryCode!=="IN")throw new Error("Your current location is outside India. Weather location must be in India.");
 const place=d?.city||d?.locality||d?.principalSubdivision||"Current location";
 const state=d?.principalSubdivision||"";
 return {label:state&&place!==state?place+", "+state:place,countryCode};
}

export async function resolveAutoWeatherLocation(mode:"auto-once"|"auto-live",saved?:{latitude?:number;longitude?:number;location?:string}){
 if(mode==="auto-once"&&saved?.latitude!=null&&saved?.longitude!=null&&saved.location)return {latitude:saved.latitude,longitude:saved.longitude,label:saved.location};
 const coords=await getCurrentLocation();
 const place=await reverseGeocodeIndia(coords);
 return {latitude:coords.latitude,longitude:coords.longitude,label:place.label};
}

async function fetchRss(query:string,language="en"):Promise<string>{
 const q=query.trim();
 if(!q)throw new Error("News topic is required.");
 const params=language==="hi"?"hl=hi&gl=IN&ceid=IN:hi":language==="bn"?"hl=bn&gl=IN&ceid=IN:bn":"hl=en&gl=US&ceid=US:en";
 const rss="https://news.google.com/rss/search?q="+encodeURIComponent(q)+"&"+params;
 const encoded=encodeURIComponent(rss);
 const candidates=[
  "https://api.rss2json.com/v1/api.json?rss_url="+encoded,
  "https://api.allorigins.win/raw?url="+encoded,
  "https://r.jina.ai/"+rss
 ];
 let items:{title:string;source?:string}[]=[];
 for(const url of candidates){
  try{
   const response=await fetch(url);
   const data=await response.json().catch(()=>null);
   if(data?.items?.length){items=data.items.slice(0,6).map((x:any)=>({title:String(x.title||"Untitled"),source:String(x.author||x.source||"News")}));break;}
   if(data?.contents){
    const doc=new DOMParser().parseFromString(String(data.contents),"text/xml");
    items=[...doc.querySelectorAll("item")].slice(0,6).map(item=>({title:item.querySelector("title")?.textContent?.trim()||"Untitled",source:item.querySelector("source")?.textContent?.trim()||"News"}));
    if(items.length)break;
   }
  }catch{}
 }
 if(!items.length)throw new Error("Public news sources are temporarily unavailable. Try again later.");
 return items.map((x,i)=>`${i+1}. ${x.title} — ${x.source}`).join("\n");
}

export async function searchAnime(topic:string):Promise<{id:number;source:"anilist"|"jikan";title:string;type?:string;status?:string;episodes?:number|null;season?:string|null;seasonYear?:number|null}[]>{
 const q=topic.trim();
 if(!q)return [];
 const out:{id:number;source:"anilist"|"jikan";title:string;type?:string;status?:string;episodes?:number|null;season?:string|null;seasonYear?:number|null}[]=[];
 try{
  const query='query($search:String){Page(page:1,perPage:8){media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{romaji english native},type,status,episodes,season,seasonYear}}}';
  const cacheKey="anime-search:"+q.toLowerCase();
  const cached=readApiCache<any>(cacheKey,600000);
  const d=cached||await (async()=>{const r=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables:{search:q}})});if(!r.ok)throw new Error();const data=await r.json();writeApiCache(cacheKey,data);return data;})();
  if(d){
   for(const a of (d?.data?.Page?.media||[]))out.push({id:Number(a.id),source:"anilist",title:String(a.title?.english||a.title?.romaji||a.title?.native||q),type:a.type,status:a.status,episodes:a.episodes,season:a.season,seasonYear:a.seasonYear});
  }
 }catch{}
 if(out.length)return out;
 try{
  const jurl="https://api.jikan.moe/v4/anime?q="+encodeURIComponent(q)+"&limit=8&sfw=true";
  try{const d=await publicJson(jurl,undefined,600000,"anime-jikan-search:"+q.toLowerCase());
   for(const a of (d?.data||[]))out.push({id:Number(a.mal_id),source:"jikan",title:String(a.title||q),type:a.type,status:a.status,episodes:a.episodes,season:a.season,seasonYear:a.year});
  }catch{} 
 }catch{}
 return out;
}

async function fetchAnime(topic:string,language="en",scope="all updates",animeId?:number,animeSource?:"anilist"|"jikan"):Promise<string>{
 const q=topic.trim();
 if(!q)throw new Error("Anime title/topic is required.");
 const selected=animeId?{id:animeId,source:animeSource||"anilist"}:((await searchAnime(q))[0]);
 const lines:string[]=[];
 if(selected?.id){
  try{
   if(selected.source==="anilist"){
    const query='query($id:Int){Media(id:$id,type:ANIME){title{romaji english native},type,status,episodes,season,seasonYear,startDate{year month day},nextAiringEpisode{episode airingAt}}}';
    const cacheKey="anime-anilist:"+String(selected.id);
    const payload=readApiCache<any>(cacheKey,300000)||await (async()=>{const r=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query,variables:{id:selected.id}})});if(!r.ok)throw new Error();const data=await r.json();writeApiCache(cacheKey,data);return data;})();
    const a=payload?.data?.Media;
    if(a){
     const title=a.title?.english||a.title?.romaji||a.title?.native||q;
     const next=a.nextAiringEpisode?.episode?` · Next ep ${a.nextAiringEpisode.episode}`:"";
     const date=a.nextAiringEpisode?.airingAt?` · ${new Date(a.nextAiringEpisode.airingAt*1000).toLocaleString("en-IN")}`:"";
     const season=a.seasonYear?` · ${a.season||""} ${a.seasonYear}`:"";
     const status=a.status?` · ${String(a.status).split("_").join(" ")}`:"";
     const ep=a.episodes!=null?` · ${a.episodes} eps`:"";
     const startDate=a.startDate?.year?` · Start ${a.startDate.year}-${String(a.startDate.month||1).padStart(2,"0")}-${String(a.startDate.day||1).padStart(2,"0")}`:"";
     lines.push(`• ${title} — ${a.type||"TV"}${status}${ep}${season}${startDate}${next}${date}`);
    }
   }else{
    const jurl="https://api.jikan.moe/v4/anime/"+encodeURIComponent(String(selected.id))+"/full";
    const payload=readApiCache<any>("anime-jikan:"+String(selected.id),300000)||await publicJson(jurl,undefined,300000,"anime-jikan:"+String(selected.id));
    const a=payload?.data;
    if(a){
     const startDate=a.aired?.from?` · Start ${new Date(a.aired.from).toLocaleDateString("en-IN")}`:"";
     lines.push(`• ${a.title||q} — ${a.type||"Anime"} · ${a.status||"Unknown status"} · ${a.episodes??"?"} eps${a.season?` · ${a.season}`:""}${a.year?` ${a.year}`:""}${startDate}`);
    }
   }
  }catch{}
 }
 const unique=[...new Set(lines)];
 let filtered=unique;
 if(scope==="new episode")filtered=unique.filter(x=>/Next ep|airing/i.test(x));
 if(scope==="new season")filtered=unique.filter(x=>/season|winter|spring|summer|fall/i.test(x));
 if(scope==="release date")filtered=unique.filter(x=>/Start|Next ep|season/i.test(x));
 if(filtered.length)return filtered.slice(0,8).join("\n");
 return fetchRss("anime "+q+" "+scope,language);
}
export async function fetchNews(topic:string,language="en"):Promise<string>{
 return fetchRss(topic,language);
}

export async function fetchWebUpdate(url:string):Promise<string>{
 const target=url.trim();
 if(!/^https?:\/\//i.test(target))throw new Error("Enter a valid http/https URL.");
 const urls=[target,"https://api.allorigins.win/raw?url="+encodeURIComponent(target)];
 let body="";
 for(const u of urls){
  try{const r=await fetch(u);if(r.ok){body=await r.text();if(body)break;}}catch{}
 }
 if(!body)throw new Error("Could not fetch the URL right now.");
 const doc=new DOMParser().parseFromString(body,"text/html");
 const title=doc.querySelector("title")?.textContent?.trim();
 const text=(doc.body?.textContent||body).replace(/\s+/g," ").trim().slice(0,1200);
 return (title?title+"\n":"")+text;
}

export async function executeDirectTask(task:Task):Promise<string>{
 const a=task.action;
 if(!a)return task.prompt;
 if(a.type==="reminder")return a.message||task.prompt;
 if(a.type==="weather"){if(a.locationMode==="auto-live"){const live=await resolveAutoWeatherLocation("auto-live");return await fetchWeather(live.label,{latitude:live.latitude,longitude:live.longitude});}return await fetchWeather(a.location||"Current location",{latitude:a.latitude,longitude:a.longitude});}
 if(a.type==="anime")return await fetchAnime(a.topic||task.prompt,a.language||"en",a.scope||"all updates",a.animeId,a.animeSource);
 if(a.type==="news"||a.type==="movie"){const prefix=a.type==="movie"?"movie ":"";const scope=a.scope?" "+a.scope:"";return await fetchNews(prefix+(a.topic||task.prompt)+scope,a.language||"en");}
 if(a.type==="web")return await fetchWebUpdate(a.url||"");
 return task.prompt;
}
