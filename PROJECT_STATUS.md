# Tasks Tool — Verified Project Status

Last checked: 2026-10-11

## Source of truth
- Repository: https://github.com/mainakgarai007/Task
- Branch: `main`
- Live app: https://mainakgarai007.github.io/Task/
- Workflow: Deploy Tasks Tool
- Latest scheduling audit fix: legacy monthly tasks without a `months` selection now default to every month, consistent with the task editor and expected monthly cadence.
- Added a regression test reproducing the legacy monthly scheduling case.
- Custom interval scheduling (minutes/hours/days) and execution reliability work remain in place; the latest commit must pass Actions before this audit is considered verified.

## Verified completed
### RSS reliability and regression coverage
- [x] RSS/Atom parsing and invalid-feed rejection.
- [x] Valid empty-feed initialization and later first-item detection.
- [x] First-run seeding to avoid backlog notifications.
- [x] Duplicate suppression and cache TTL/size limits.
- [x] Max-items paging without prematurely marking extra items as seen.
- [x] Keyword AND/OR filtering.
- [x] Visible failures for network/cache write errors.
- [x] Sentinel messages excluded from per-item history.
- [x] Reordered/deleted existing feed entries do not become new-item alerts.
- [x] Automated RSS/Atom tests run before build/deploy in CI.

### Notification and IF/THEN correctness
- [x] RSS change state is based on newly detected feed items, not differences between result-summary strings.
- [x] Empty RSS checks do not create RSS-specific acknowledgement notifications or run RSS THEN chains.
- [x] New-item count operators and nested AND/OR/NOT conditions have automated tests.
- [x] RSS `open_link` uses an explicitly configured URL or falls back to the first detected item's link.
- [x] Item-level RSS history is stored with the task and shown in the task History view.
- [x] README, standalone manual and in-app manual describe the RSS history UI.

### Task storage, schedules and execution reliability
- [x] Legacy monthly schedules without explicit month selections default to every month (regression-tested).
- [x] Task storage normalization covers malformed entries and legacy action fallback.
- [x] Stale running state is reset to idle on reload; waiting state and its reason are retained.
- [x] RSS item history round-trip through localStorage is covered by tests.
- [x] Hourly, custom-minute, daily-weekday and monthly-end-date progression have focused tests.
- [x] Per-task execution guard rejects duplicate concurrent triggers.
- [x] Duplicate triggers create a Skipped execution-history record.
- [x] A running marker without an active in-memory execution can be recovered and retried.
- [x] Execution guard regression tests cover duplicate locks, independent tasks, release/retry and stale-state detection.

## Current verification gate
- Monthly scheduling compatibility fix and regression test passed in Actions run #250: https://github.com/mainakgarai007/Task/actions/runs/38130467869
- P4 History retry, regression coverage, and the paused-task UI guard passed Actions run #253: https://github.com/mainakgarai007/Task/actions/runs/38131369124.
- Full interactive browser/device testing remains a separate verification step after the build/deployment gate.

## P4 — History retry
- [x] Failed execution history entries expose a Retry now action when the task is not completed.
- [x] Manual retry re-enables a failed one-time task for that immediate execution; history remains preserved.
- [x] Added regression tests for failed one-time retry preparation and ensuring completed tasks remain unchanged.

### P5 — Backup import integrity
- [x] Duplicate task IDs in imported backups are skipped after the first valid record to avoid ambiguous task/history identity.
- [x] Duplicate records contribute to the skipped/invalid count shown in the import preview.
- [x] Regression test verifies the first record is retained and the duplicate is counted.

### P6 — Notification acknowledgement reliability
- [x] Show explicit acknowledgement actions in service-worker notifications.
- [x] Preserve the selected action when launching the app from a closed-window notification.
- [x] Validate action and IDs from the launch URL; add regression tests for valid, malformed, and encoded values.
- [ ] Confirm automated regression tests, production build, and Pages deployment before closing this update.

## Explicit limits / remaining roadmap (not blockers for this audit)
- Browser-only GitHub Pages cannot guarantee scheduled execution while the browser/device is completely closed or offline.
- Browser popup blockers can block `window.open` during background scheduled runs.
- Native Android background scheduling/notification channels, server-side webhooks and richer file processing remain future work.
- Custom scheduling now supports minute, hour and day intervals, capped at 365 days; older tasks that store `intervalMinutes` remain compatible.
- CI tests core functions and the production bundle; it is not a physical Android-device UI test. Device-only behavior still needs confirmation on the target device. A direct interactive live-app smoke test was not available during this audit; use the live URL above for a device check.

## Workflow rule
Do not begin another feature upgrade until the latest audit commit has green regression tests, build and deployment. Keep README, USER_MANUAL and the in-app User Manual synchronized when workflows change.


## P7 — Android APK build pipeline (preview)

- [x] Added Capacitor app configuration using app ID `com.mainakgarai.task`.
- [x] Vite now uses relative asset paths for Android builds and keeps `/Task/` for GitHub Pages.
- [x] Added an Android GitHub Actions workflow that runs regression tests, builds web assets, generates the Android project, assembles a debug APK, and uploads it for 14 days.
- [ ] Verify the first Android workflow run is green and that the APK artifact exists.
- [ ] Native notification integration and persistent Android background scheduling are still outstanding.
- [ ] Install and test on a physical Android phone before calling the APK daily-use ready.

Do not treat a successful website deployment as proof that the Android build or native background scheduling works. Keep the README, standalone manual and in-app manual synchronized.


## P8 — Native Android notification bridge

- [x] Added Capacitor Local Notifications dependency.
- [x] Routed notification requests through Android native local notifications when running as a native app; browser notifications remain the fallback path for web.
- [x] Kept task/acknowledgement metadata in notification extras for future native action handling.
- [ ] Verify regression tests, website build/deploy and APK build in CI.
- [ ] Confirm notification permission and delivery on a physical Android device.
- [ ] Persistent background scheduling, reboot recovery, and native acknowledgement action buttons remain separate tasks.


## P8 — Native notifications and app identity (in progress)

- [x] Added custom vector logo at `public/task-logo.svg`.
- [x] Displayed the logo in the app header and added it as the browser favicon/touch icon.
- [x] Corrected the native notification payload by removing a no-op sound property; task and acknowledgement IDs remain attached as extras.
- [ ] Run regression tests, web production build, Pages deployment, and Android APK build on the latest commit.
- [ ] Verify native notifications and logo presentation on a physical Android device.
- [ ] Native persistent scheduling, Android launcher icon replacement, custom notification channels/sounds, and notification action buttons remain follow-up work.


## Location permission + mobile sound follow-up (2026-10-11)

- [x] Added Capacitor Geolocation to the Android app's location lookup path so Android can request runtime location permission instead of relying on browser geolocation inside the WebView.
- [x] Added clearer recovery instructions for previously denied location permissions on Android and in browser site settings.
- [x] Kept task-level sound presets and added accurate user-facing notes about preview vs Android notification-channel behavior.
- [ ] Verify tests, website deployment and APK build for this commit.
- [ ] Confirm runtime location permission on the physical phone.
- [ ] Complete native per-preset notification-channel sound mapping and verify it on the physical phone; current Android channel sound may override preview presets.
