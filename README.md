# Tasks — Free AI Automation Tool

A standalone, mobile-first task automation app inspired by the workflow of ChatGPT Tasks.

Live app: https://mainakgarai007.github.io/Task/

## User manual

The live app includes an in-app **? User Manual** button in the header. It explains task creation, scheduling, Weather location modes, Anime monitoring, smart rules, AI, backups, notifications and current browser limitations. **Update rule: whenever a feature or workflow changes, this manual and this README should be updated together.**

## What it does

Create scheduled tasks manually or with AI. Tasks are stored locally in the browser and can run direct public-data actions without an AI call when possible.

### Task management
- Create, edit, pause, resume and safely delete tasks
- Run now
- Multiple tasks
- Active / paused / completed / failed states
- Execution history and error logs
- Previous-result memory
- JSON backup export/import

### Scheduling
- One-time tasks
- Hourly
- Daily
- Weekly
- Monthly
- Custom minute intervals
- Start date
- End date
- Weekly day
- Monthly day
- Maximum run count
- Automatic stop when a stop condition is reached

### Smart automation
- Direct execution for supported public-data tasks
- AI execution when reasoning/generation is actually required
- Result comparison
- Notify only when a result changes
- Optional condition matching
- Optional stop condition
- Previous-run context for AI tasks

## Built-in actions

### 🌤 Weather
Uses free public weather services.

- India-only city/town search
- Selected location coordinates are stored
- Google Weather-style current/forecast information
- Temperature and feels-like
- High / low
- Rain probability
- Humidity
- Wind
- UV
- Cloud cover
- Visibility
- Sunrise / sunset
- **Use my location once** — capture and save the location with the task
- **Use my location automatically** — request the device's current location before each run

Location permission remains controlled by the browser/device.

### 🍿 Anime
Anime monitoring uses free public APIs with RSS fallback.

- Anime title/topic search
- New episode monitoring
- New season monitoring
- Release-date monitoring
- All updates
- Language selection
- Region
- Result-change notifications
- Stop/condition rules
- AniList data
- Jikan/MyAnimeList data
- Public news/RSS fallback

The app does not require a paid anime API key.

### 📰 News
- Topic/category monitoring
- Hindi / English / Bengali
- India/world region
- RSS/public feed sources
- Change detection

### 🎬 Movies
- Release/update monitoring
- Topic-based public news monitoring
- Language and region settings

### 🌐 Web / RSS
- Public URL monitoring
- RSS/public feed support
- Change detection
- Conditions and stop rules

### 🔔 Notifications
- Browser/service-worker notifications
- Completion notifications
- Failure notifications
- Condition/change-based notifications

## AI providers

AI is optional at runtime for direct tasks, but required when creating/executing tasks that need AI reasoning.

Users bring their own provider/API key.

Supported provider paths include:
- Google Gemini
- OpenAI-compatible APIs
- Claude-compatible provider
- Custom OpenAI-compatible endpoint
- Local AI endpoint

No owner API key is hardcoded into the public app.

## Free-first architecture

The project prefers free/public services wherever practical:
- Open-Meteo
- AniList
- Jikan
- Public RSS/news feeds
- Browser APIs
- Local browser storage

Public services can have rate limits, outages or CORS restrictions, so the app uses fallbacks where practical.

## Current limitations

A normal GitHub Pages/browser deployment cannot guarantee execution while the browser/device is completely closed or offline.

Native Android background scheduling is planned for the Capacitor version.

Event connectors such as Gmail, GitHub webhooks and Slack, advanced IF/THEN chains, file processing and richer monitoring are planned.

## Tech stack

- React
- TypeScript
- Vite
- GitHub Pages
- Local browser storage
- Service Worker notifications
- Capacitor planned for native Android

## Development

```bash
npm install
npm run dev
npm run build
```

## Project goal

Build a genuinely customizable, free-first task automation tool where a user can define:

**When → What → Where → Conditions → What happens next**

without requiring a paid backend.


### Public API runtime rule
API-backed tasks use public APIs at runtime for fresh data; search and execution are not limited to hardcoded lists. When a primary public source is unavailable, supported fallback sources are used.
