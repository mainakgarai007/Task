# Tasks — Free AI Automation Tool

A standalone, mobile-first task automation app inspired by the workflow of ChatGPT Tasks.

Live app: https://mainakgarai007.github.io/Task/

## User manual

The live app includes an in-app **? User Manual** button in the header. It explains task creation, scheduling, Weather location modes, Anime monitoring, smart rules, AI, backups, notifications and current browser limitations. **Update rule: whenever a feature or workflow changes, the in-app manual, `USER_MANUAL.md` and this README should be updated together.**

## What it does

Create scheduled tasks manually or with AI. Tasks are stored locally in the browser and can run direct public-data actions without an AI call when possible.

### Task management
- Create, edit, pause, resume and safely delete tasks
- Run now
- Multiple tasks
- Active / paused / completed / failed states
- Running / waiting execution state with a clear waiting reason
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
- Weekly day or multiple selected weekdays (for example Sunday + Friday)
- Monthly day
- Maximum run count
- Automatic stop when a stop condition is reached
- Missed scheduled runs are detected when the browser scheduler wakes up
- Each task is execution-locked so the same task cannot start twice concurrently
- Tasks waiting for required AI configuration are not retried by the scheduler until the requirement is available; they return to idle automatically after AI settings are configured

### Smart automation
- Advanced universal IF/THEN condition builder
- Unlimited conditions inside a group
- AND / OR groups
- Nested condition groups
- NOT group inversion
- Current result, previous result, changed state, time and day conditions
- Weather-aware result fields: weather state, temperature, feels-like, rain probability, cloud cover, humidity, wind, UV and visibility
- Text operators: contains, not contains, equals, not equals, starts with, ends with
- Numeric operators: greater than, less than, greater/equal, less/equal
- THEN action chains that run top-to-bottom
- THEN actions: notify, reminder, wait, sound, open link, create task, run task, save result, stop and complete
- Direct execution for supported public-data tasks
- AI execution when reasoning/generation is actually required
- Meaningful change detection with normalized comparisons
- New-item detection (added lines/items)
- Removed-item detection
- Updated-content detection
- Mixed added/removed change summaries
- Previous/current change snapshots stored with execution history
- IF/THEN access to new-items and removed-items conditions
- Notify only when a meaningful result changes
- Optional legacy condition/stop-condition compatibility
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
- RSS/Atom feed parsing (item ID, title, link, publication date and description)
- Smart new-item monitoring with first-run seeding to avoid backlog spam
- Comma-separated keyword filters with OR/AND matching
- Configurable maximum new items per run (5–50)
- Per-task seen-item cache with 7–365 day retention and a 1,000-item cap
- Empty-feed seeding marker so a valid feed that starts empty can still detect its first item later
- Unreturned items above the per-run limit remain unseen for later runs
- Cache persistence failures surface as task errors instead of silently disabling duplicate suppression
- Per-item history and duplicate suppression
- New/removed/updated item conditions for IF/THEN automation

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

A normal GitHub Pages/browser deployment cannot guarantee execution while the browser/device is completely closed or offline. When the browser scheduler wakes after a missed run, the overdue task is handled on the next scheduler check rather than attempting to replay every missed interval. Each task also has an in-memory execution lock to prevent duplicate concurrent runs during scheduler overlap. A persisted running state is reset to idle after reload because browser memory is gone. Manual “Run now” executes immediately without permanently shifting the configured recurring cadence.

Native Android background scheduling is planned for the Capacitor version.

Event connectors such as Gmail, GitHub webhooks and Slack, multi-step action chains, file processing and richer monitoring are planned. Browser pages cannot directly read another app’s notifications; Android Notification Listener support is planned for notification-triggered tasks.

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
