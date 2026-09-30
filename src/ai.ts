import {Frequency, Task} from "./types";

export interface AISettings {
  endpoint: string;
  apiKey: string;
  model: string;
}

const SETTINGS_KEY = "task-tool.ai.v1";

export const defaultAISettings: AISettings = {
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  apiKey: "",
  model: "",
};

export function loadAISettings(): AISettings {
  try {
    return {...defaultAISettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")};
  } catch {
    return defaultAISettings;
  }
}

export function saveAISettings(settings: AISettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface ParsedTask {
  title: string;
  prompt: string;
  frequency: Frequency;
  firstRun: string;
}

function extractJson(text: string): ParsedTask {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/{[sS]*}/);
  if (!match) throw new Error("AI did not return a valid task.");
  const data = JSON.parse(match[0]);
  const frequencies: Frequency[] = ["once", "hourly", "daily", "weekly", "monthly"];
  if (!data.title || !data.prompt || !frequencies.includes(data.frequency) || !data.firstRun) {
    throw new Error("AI returned an incomplete task.");
  }
  const date = new Date(data.firstRun);
  if (Number.isNaN(date.getTime())) throw new Error("AI returned an invalid first-run time.");
  return {
    title: String(data.title).trim(),
    prompt: String(data.prompt).trim(),
    frequency: data.frequency,
    firstRun: date.toISOString(),
  };
}

export async function createTaskWithAI(request: string, settings: AISettings): Promise<ParsedTask> {
  if (!request.trim()) throw new Error("Tell AI what you want to schedule.");
  if (!settings.apiKey.trim()) throw new Error("Add your AI API key in AI Settings first.");
  if (!settings.endpoint.trim() || !settings.model.trim()) {
    throw new Error("AI endpoint and model are required.");
  }

  const now = new Date();
  const system = `You are the task planner for a scheduling app.
Convert the user's request into exactly ONE scheduled task.
Current time: ${now.toISOString()}
User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}

Return ONLY valid JSON, with no markdown:
{
  "title": "short task title",
  "prompt": "the exact useful instruction that should run later",
  "frequency": "once|hourly|daily|weekly|monthly",
  "firstRun": "ISO-8601 date/time"
}

Rules:
- Resolve relative times using the current time and timezone.
- If the user says "tomorrow", use tomorrow in the user's local timezone.
- If no time is specified, choose a sensible local time for that request.
- "once" means one-time execution.
- Do not invent unsupported integrations or actions.
- Keep the prompt actionable and concise.`;

  const response = await fetch(settings.endpoint.trim(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: settings.model.trim(),
      temperature: 0.1,
      messages: [
        {role: "system", content: system},
        {role: "user", content: request.trim()},
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI request failed (${response.status}). ${body.slice(0, 180)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("AI returned no task data.");
  return extractJson(content);
}

export function parsedTaskToTask(parsed: ParsedTask, uid: () => string): Task {
  return {
    id: uid(),
    title: parsed.title,
    prompt: parsed.prompt,
    frequency: parsed.frequency,
    nextRun: parsed.firstRun,
    enabled: true,
    status: "active",
    createdAt: new Date().toISOString(),
    runCount: 0,
    history: [],
  };
}
