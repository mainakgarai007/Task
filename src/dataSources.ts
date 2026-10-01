import type {Task} from "./types";

export async function fetchWeather(location:string,coords?:{latitude?:number;longitude?:number}):Promise<string>{
 const q=location.trim();
 if(!q)throw new Error("Weather location is required.");
 let lat=coords?.latitude, lon=coords?.longitude, placeName=q, state="";
 if(lat==null||lon==null){
  const geo=await fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(q)+"&count=20&language=en&format=json&countryCode=IN");
  if(!geo.ok)throw new Error("Indian weather location lookup failed.");
  const gd=await geo.json();
  const place=(gd?.results||[]).find((p:any)=>p.country_code==="IN");
  if(!place)throw new Error("Could not find an Indian city or town: "+q);
  lat=place.latitude;lon=place.longitude;placeName=place.name;state=place.admin1||"";
 }
 const url="https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(String(lat))+"&longitude="+encodeURIComponent(String(lon))+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,cloud_cover,visibility,uv_index,is_day&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,sunrise,sunset,uv_index_max&forecast_days=3&timezone=auto";
 const r=await fetch(url);
 if(!r.ok)throw new Error("Weather API failed ("+r.status+").");
 const d=await r.json(), c=d.current, day=d.daily;
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

async function fetchAnime(topic:string,language="en",scope="all updates"):Promise<string>{
 const q=topic.trim();
 if(!q)throw new Error("Anime title/topic is required.");
 try{
  const response=await fetch("https://api.jikan.moe/v4/anime?q="+encodeURIComponent(q)+"&limit=5&sfw=true");
  if(response.ok){
   const data=await response.json();
   const list=(data?.data||[]).slice(0,5);
   if(list.length)return list.map((a:any,i:number)=>`${i+1}. ${a.title||q} — ${a.type||"Anime"} · ${a.status||"Unknown status"} · ${a.episodes??"?"} eps`).join("\n");
  }
 }catch{}
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
 if(a.type==="weather")return await fetchWeather(a.location||"",{latitude:a.latitude,longitude:a.longitude});
 if(a.type==="anime")return await fetchAnime(a.topic||task.prompt,a.language||"en",a.scope||"all updates");
 if(a.type==="news"||a.type==="movie"){const prefix=a.type==="movie"?"movie ":"";const scope=a.scope?" "+a.scope:"";return await fetchNews(prefix+(a.topic||task.prompt)+scope,a.language||"en");}
 if(a.type==="web")return await fetchWebUpdate(a.url||"");
 return task.prompt;
}
