# Tasks — User Manual

## Create a task
Tap **＋** and choose Manual or AI. Manual mode lets you choose the schedule, action, notification mode, sequence and IF/THEN rules. AI mode creates a plan from natural language using your configured provider.

## Scheduling
Supported schedules: once, hourly, daily, weekly, monthly and custom minute intervals. Start date, end date, multiple weekdays, multiple months, month-days and maximum run count are supported.

## Actions
Weather supports Indian city/town search and saved or automatic device location. Anime supports title/topic monitoring and update scopes. News and Movies support topic, language and region. Web/RSS tasks accept a public URL or feed.

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
Use JSON export/import to back up and restore task data.

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
