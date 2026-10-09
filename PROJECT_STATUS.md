# Tasks Tool — Verified Project Status

Last checked: 2026-10-09

## Source of truth
- Repository: https://github.com/mainakgarai007/Task
- Branch: `main`
- Live app: https://mainakgarai007.github.io/Task/
- Workflow: Deploy Tasks Tool
- Latest verified feature commit before this audit: `71f1dd010d878ab48d0f5dd75de0deff15892871` (`fix: make RSS alerts depend on new items`).
- Actions run #226 completed successfully: regression tests, production build, Pages artifact upload and deployment all passed.
- Verification link: https://github.com/mainakgarai007/Task/actions/runs/37962980545

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

### Task storage and schedules
- [x] Task storage normalization covers malformed entries and legacy action fallback.
- [x] Stale running state is reset to idle on reload; waiting state is retained.
- [x] RSS item history round-trip through localStorage is covered by tests.
- [x] Hourly, custom-minute, daily-weekday and monthly-end-date progression have focused tests.

## Current verification gate
- Regression suite: GitHub Actions run #226 — PASS.
- TypeScript/Vite production build: run #226 — PASS.
- GitHub Pages artifact and deployment: run #226 — PASS.
- New audit additions are not considered verified until their own Actions run passes.

## Explicit limits / remaining roadmap (not blockers for this audit)
- Browser-only GitHub Pages cannot guarantee scheduled execution while the browser/device is completely closed or offline.
- Browser popup blockers can block `window.open` during background scheduled runs.
- Native Android background scheduling/notification channels, server-side webhooks, richer file processing and additional interval units remain future work.
- Current CI tests core functions and the production bundle; it is not a physical Android-device UI test. Device-only behavior still needs confirmation on the target device.

## Workflow rule
Do not begin another feature upgrade until the latest audit commit has green regression tests, build and deployment. Keep README, USER_MANUAL and the in-app User Manual synchronized when workflows change.
