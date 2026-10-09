// @vitest-environment happy-dom
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {fetchFeedItems,fetchRssNewItems} from "./dataSources";
import type {Task} from "./types";

const rss=(items:string[])=>`<?xml version="1.0"?><rss version="2.0"><channel><title>Test feed</title>${items.join("")}</channel></rss>`;
const rssItem=(id:string,title:string,link:string,published="Thu, 09 Oct 2026 10:00:00 GMT")=>`<item><guid>${id}</guid><title>${title}</title><link>${link}</link><pubDate>${published}</pubDate><description>Episode release update</description></item>`;
const atom=(entries:string[])=>`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom test</title>${entries.join("")}</feed>`;
const atomEntry=(id:string,title:string,link:string)=>`<entry><id>${id}</id><title>${title}</title><link href="${link}" rel="alternate"/><updated>2026-10-09T10:00:00Z</updated><summary>New episode</summary></entry>`;
const feedUrl="https://example.test/feed.xml";
function task(overrides:Partial<Task["action"]>={}):Task{
 return {id:"rss-test-task",title:"RSS test",prompt:"monitor feed",frequency:"hourly",nextRun:new Date().toISOString(),enabled:true,status:"active",createdAt:new Date().toISOString(),runCount:0,history:[],executionMode:"direct",action:{type:"web",url:feedUrl,rssMonitor:true,rssMaxItems:20,rssSeenTtlDays:30,...overrides}};
}
function mockFeed(body:string){vi.stubGlobal("fetch",vi.fn(async()=>new Response(body,{status:200,headers:{"Content-Type":"application/xml"}})));}

beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe("RSS/Atom parser",()=>{
 it("parses RSS IDs, titles, links and publication dates",async()=>{
  mockFeed(rss([rssItem("guid-1","Black Torch episode","https://example.test/1")]));
  const items=await fetchFeedItems(feedUrl);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({id:"guid-1",title:"Black Torch episode",link:"https://example.test/1"});
  expect(items[0].published).toContain("2026");
 });
 it("parses Atom entry IDs and href links",async()=>{
  mockFeed(atom([atomEntry("urn:episode:1","New episode","https://example.test/atom/1")]));
  const items=await fetchFeedItems(feedUrl);
  expect(items[0]).toMatchObject({id:"urn:episode:1",title:"New episode",link:"https://example.test/atom/1"});
 });
 it("rejects malformed XML and non-feed responses",async()=>{
  mockFeed("<rss><channel><item>");
  await expect(fetchFeedItems(feedUrl)).rejects.toThrow();
  mockFeed("<html><body>Not a feed</body></html>");
  await expect(fetchFeedItems(feedUrl)).rejects.toThrow(/RSS\/Atom feed/);
 });
 it("accepts a valid empty RSS feed",async()=>{mockFeed(rss([]));await expect(fetchFeedItems(feedUrl)).resolves.toEqual([]);});
 it("rejects non-http feed URLs before fetching",async()=>{await expect(fetchFeedItems("file:///private/feed.xml")).rejects.toThrow(/http\/https/);});
});

describe("RSS monitor reliability",()=>{
 it("seeds existing items once, then reports only new items without duplicates",async()=>{
  const t=task();
  mockFeed(rss([rssItem("old","Old episode","https://example.test/old")]));
  expect((await fetchRssNewItems(t)).items).toHaveLength(0);
  expect((await fetchRssNewItems(t)).items).toHaveLength(0);
  mockFeed(rss([rssItem("old","Old episode","https://example.test/old"),rssItem("new","Black Torch episode","https://example.test/new")]));
  expect((await fetchRssNewItems(t)).items.map(x=>x.id)).toEqual(["new"]);
  expect((await fetchRssNewItems(t)).items).toHaveLength(0);
 });
 it("initializes an empty feed and detects its first later item",async()=>{
  const t=task();mockFeed(rss([]));
  expect((await fetchRssNewItems(t)).result).toMatch(/initialized/i);
  mockFeed(rss([rssItem("first","First episode","https://example.test/first")]));
  expect((await fetchRssNewItems(t)).items.map(x=>x.id)).toEqual(["first"]);
 });
 it("leaves items beyond the max-per-run limit unseen for the next run",async()=>{
  const t=task({rssMaxItems:2});
  mockFeed(rss([rssItem("seed","Seed","https://example.test/seed")]));await fetchRssNewItems(t);
  mockFeed(rss([rssItem("seed","Seed","https://example.test/seed"),rssItem("n1","New one","https://example.test/1"),rssItem("n2","New two","https://example.test/2"),rssItem("n3","New three","https://example.test/3")]));
  expect((await fetchRssNewItems(t)).items.map(x=>x.id)).toEqual(["n1","n2"]);
  expect((await fetchRssNewItems(t)).items.map(x=>x.id)).toEqual(["n3"]);
 });
 it("supports OR and AND keyword matching",async()=>{
  const seed=rss([rssItem("seed","Baseline","https://example.test/seed")]);
  const body=rss([rssItem("seed","Baseline","https://example.test/seed"),rssItem("both","Black Torch Hindi dub","https://example.test/both"),rssItem("one","Black Torch news","https://example.test/one"),rssItem("other","Hindi dub news","https://example.test/other")]);
  const orTask=task({rssKeywords:["Black Torch","Hindi dub"],rssKeywordMode:"or"});
  mockFeed(seed);await fetchRssNewItems(orTask);mockFeed(body);
  expect((await fetchRssNewItems(orTask)).items.map(x=>x.id)).toEqual(["both","one","other"]);
  const andTask=task({rssKeywords:["Black Torch","Hindi dub"],rssKeywordMode:"and"});
  andTask.id="rss-and-task";
  mockFeed(seed);await fetchRssNewItems(andTask);mockFeed(body);
  expect((await fetchRssNewItems(andTask)).items.map(x=>x.id)).toEqual(["both"]);
 });
 it("surfaces network failures",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>{throw new Error("offline");}));
  await expect(fetchRssNewItems(task())).rejects.toThrow(/fetch the feed/i);
 });
 it("surfaces cache storage failures",async()=>{
  mockFeed(rss([rssItem("seed","Seed","https://example.test/seed")]));
  vi.spyOn(localStorage,"setItem").mockImplementation(()=>{throw new Error("quota exceeded");});
  await expect(fetchRssNewItems(task())).rejects.toThrow(/quota exceeded/);
 });
});
