import {Task} from "./types";

export async function fetchWeather(location:string):Promise<string>{
 const q=location.trim();
 if(!q)throw new Error("Weather location is required.");
 const geo=await fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(q)+"&count=1&language=en&format=json");
 if(!geo.ok)throw new Error("Weather location lookup failed.");
 const gd=await geo.json();
 const place=gd?.results?.[0];
 if(!place)throw new Error("Could not find weather location: "+q);
 const url="https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(place.latitude)+"&longitude="+encodeURIComponent(place.longitude)+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto";
 const r=await fetch(url);
 if(!r.ok)throw new Error("Weather API failed ("+r.status+").");
 const d=await r.json(), c=d.current;
 const labels:Record<number,string>={0:"Clear sky",1:"Mainly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Rime fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Rain showers",81:"Rain showers",82:"Heavy rain showers",95:"Thunderstorm",96:"Thunderstorm with hail",99:"Thunderstorm with hail"};
 return `${place.name}${place.country ? ", "+place.country : ""}\n🌡 ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C)\n☁️ ${labels[c.weather_code]||"Weather update"}\n💧 Humidity ${c.relative_humidity_2m}% · 💨 Wind ${c.wind_speed_10m} km/h`;
}

async function fetchRss(query:string,language="en"):Promise<string>{
 const q=query.trim();
 if(!q)throw new Error("News topic is required.");
 const params=language==="hi"?"hl=hi&gl=IN&ceid=IN:hi":language==="bn"?"hl=bn&gl=IN&ceid=IN:bn":"hl=en&gl=US&ceid=US:en";
 const rss="https://news.google.com/rss/search?q="+encodeURIComponent(q)+"&"+params;
 const urls=[rss,"https://api.allorigins.win/raw?url="+encodeURIComponent(rss)];
 let text="";
 for(const u of urls){
  try{const r=await fetch(u);if(r.ok){text=await r.text();if(text.includes("<item"))break;}}catch{}
 }
 if(!text||!text.includes("<item"))throw new Error("Could not fetch the public news feed right now.");
 const doc=new DOMParser().parseFromString(text,"text/xml");
 const items=[...doc.querySelectorAll("item")].slice(0,6);
 if(!items.length)throw new Error("No matching updates found.");
 return items.map((item,i)=>{
  const title=item.querySelector("title")?.textContent?.trim()||"Untitled";
  const source=item.querySelector("source")?.textContent?.trim()||"News";
  return `${i+1}. ${title} — ${source}`;
 }).join("\n");
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
 if(a.type==="weather")return await fetchWeather(a.location||"");
 if(a.type==="news")return await fetchNews(a.topic||task.prompt,a.language||"en");
 if(a.type==="web")return await fetchWebUpdate(a.url||"");
 return task.prompt;
}
