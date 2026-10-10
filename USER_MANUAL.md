# Tasks — User Manual

## Create a task
Tap **＋** and choose Manual or AI. Manual mode lets you choose the schedule, action, notification mode, sequence and IF/THEN rules. AI mode creates a plan from natural language using your configured provider.

## Scheduling
Supported schedules: once, hourly, daily, weekly, monthly and custom minute intervals. Start date, end date, multiple weekdays, multiple months, month-days and maximum run count are supported.


### Notification sounds
Each task can now choose its notification sound:
- 🔔 Default
- 🌙 Soft
- 🎵 Chime
- 🚨 Alert
- 📟 Beep
- 🔕 No sound

Use **Preview sound** while creating/editing a task. The selected sound ID is saved with the task and is also designed to be mapped to native Android/APK notification sounds later. The browser version uses lightweight audio presets; Android notification-channel sound behavior will be handled by the native APK layer.

## Actions
Weather supports Indian city/town search and saved or automatic device location. Anime supports title/topic monitoring and update scopes. News and Movies support topic, language and region. Web/RSS tasks accept a public URL or feed.

### RSS / Atom monitoring
For a Web task, enter a public RSS or Atom feed URL. You can choose either ordinary URL-change monitoring or **Smart RSS/Atom new-item monitor**.

Smart monitor options:
- **Keywords:** comma-separated terms; leave blank to accept all items.
- **Keyword mode:** OR matches any keyword; AND requires all keywords (up to 8 for AND mode).
- **Max new items:** limit the number returned per run (5–50).
- **Seen cache retention:** keep per-item IDs for 7–365 days to suppress duplicates.

Each feed check parses item IDs, titles, links, publication dates and available descriptions. The first successful check seeds existing matching items without notifying about the entire backlog. A valid feed that is initially empty is still marked as initialized, so items published later can be detected. Later checks return only unseen matching items, save a per-task item history, and cap/expire the seen cache to limit storage. If the configured per-run limit is reached, extra new items remain unseen and can be returned on later runs. Cache storage errors fail the run visibly rather than silently disabling duplicate suppression. This works with public RSS/Atom feeds; a feed that blocks browser requests may need a CORS-friendly public feed URL. Open the task's **History** view to review recorded new items, their detected time, publication date and link.

Example:

```
Every hour
→ Web / RSS
→ https://example.com/feed.xml
→ Notify only when the result changes
```

## Advanced IF / THEN
Enable advanced automation to build a condition tree.

- Unlimited conditions
- AND groups: every child must match
- OR groups: any child may match
- Nested groups
- NOT group: invert the whole group
- Current result
- Previous result
- Changed state
- Current time
- Day of week

Example:

```
Temperature > 30
AND
(
  Rain probability > 50
  OR
  Cloud cover > 80
)
```

Weather result fields include weather state, temperature, feels-like temperature, rain probability, cloud cover, humidity, wind, UV and visibility.

Operators include contains, not contains, equals, not equals, starts with, ends with, greater than, less than, greater/equal and less/equal.

## THEN action chain
THEN actions run from top to bottom. Available actions:

- Notify
- Reminder
- Wait
- Play sound
- Open link
- Create follow-up task
- Run another task
- Save result
- Stop task
- Complete task

Actions can be added, removed, duplicated, moved up/down and dragged to reorder.

Example:

```
IF 7:00 AM
THEN
1. Reminder
2. Wait 1 second
3. Play sound
4. Wait 5 seconds
5. Open link
```

## Notifications
**Disable** does not wait for acknowledgement. **See it** records that the update was seen. **Completed** records that the task/action was completed and can repeat reminders until completion.

## Sequence
A sequence works with any task. Example: start 6, end 12, step 1. With Completed mode, the sequence advances only after the user presses Completed.

## Change detection
Change detection now compares the previous saved result with the current result using normalized text.

It can identify:
- **New items** — lines/items present now but not before
- **Removed items** — lines/items that disappeared
- **Updated content** — content changed without a clean added/removed item
- **Mixed changes** — additions and removals together

The change kind and summary are saved with the execution history.

Enable **Notify only when the result changes** to suppress unchanged runs. IF/THEN rules can also test **New items** or **Removed items** directly.

Example:

```
Previous:
Episode 5
Episode 6

Current:
Episode 5
Episode 6
Episode 7

Detected:
New item → Episode 7
```

## History and controls
Task history records executions and acknowledgements. Tasks can be edited, paused, resumed, run immediately or deleted.

## AI
Open **⚙ AI** to configure the provider, API key and model. Direct public-data tasks can run without AI at execution time.

## Backup
Export creates a versioned JSON backup. Import validates the format, supports legacy array backups, previews valid/invalid task counts, and asks for confirmation before replacing your current task list. Invalid files and backups with zero valid tasks are rejected without changing existing tasks.

## Browser limitations
The GitHub Pages/browser version cannot guarantee execution while the browser/device is completely closed or offline. Browser notification permission and browser security can also affect notifications and actions. Native Android background scheduling is planned.

## Example: weather automation

```
Every day — 7:00 AM

IF
Temperature > 30
AND
(
  Rain probability > 50
  OR
  Cloud cover > 80
)

THEN
Notify
Play sound
```

## Example: Sunday chain

```
IF
Day = Sunday
AND
Time = 07:00

THEN
Reminder
Wait 1 second
Play sound
Wait 5 seconds
Open link
```

Whenever a workflow changes, update this file, the in-app manual and README together.


## Developer regression checks

For contributors working on the source repository:
- `npm run build` checks TypeScript and produces the production bundle.
- `npm test` runs the automated RSS/Atom regression suite.
- RSS changes should pass both checks and the GitHub Pages deployment workflow before being considered verified.


## RSS notification and IF/THEN reliability

Smart RSS monitors treat each successful check as newly detected items, not as a replacement of the whole feed snapshot. When no new matching items are found:
- No RSS-specific acknowledgement notification is created.
- RSS THEN-action chains do not run.
- `new_items > 0` evaluates to false.
- Removed feed entries are not treated as new-item alerts.

When new items are detected, item counts and item titles/links are supplied to the IF/THEN condition evaluator. An `open_link` THEN action uses its configured URL; if no URL is configured for an RSS monitor, it falls back to the first detected item's link. Browser popup restrictions may still block automatic opening during background scheduled runs.


## Backup format and safe restore

New exports use a versioned `tasks-backup` JSON envelope. Older plain-array backups are supported and normalized. Import previews the valid/invalid record counts and requires confirmation before replacement. Invalid JSON, unsupported versions, wrong structures, and backups with no valid tasks are rejected; current tasks remain unchanged. If a backup contains mixed valid and invalid records, the app reports skipped records and only restores after confirmation. Restore replaces the current list rather than merging it.


## Execution reliability and recovery

The scheduler uses a per-task lock to prevent overlapping executions of the same task in one open app session. If a duplicate trigger arrives while the task is already running, the duplicate is recorded as **Skipped** in **History**. This does not cancel the execution already in progress.

If the page reloads, a saved `running` state is recovered to `idle` because the in-memory execution cannot survive a reload. Tasks waiting for a known prerequisite keep their waiting reason. Check **History** for successful, failed, and skipped execution entries. The browser app cannot run scheduled work while the browser is fully closed or the device is offline.
