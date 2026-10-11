# Tasks Tool — Verified Project Status

Last checked: 2026-10-11

## Source of truth
- Repository: https://github.com/mainakgarai007/Task
- Branch: `main`
- Live app: https://mainakgarai007.github.io/Task/
- Workflow: Deploy Tasks Tool
- Latest code fix: `9f649e61d69bb5e322b2a9198c0551dc89b3fd52` (`fix: release execution guard with supported API`).
- GitHub Actions run #233 passed regression tests, TypeScript/Vite build, Pages artifact upload and deployment: https://github.com/mainakgarai007/Task/actions/runs/38128659421
- Follow-up audit consolidated duplicate execution-reliability sections in README and USER_MANUAL; this documentation sync plus this status update must pass its own Actions run before it is considered fully verified.

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
- [x] Task storage normalization covers malformed entries and legacy action fallback.
- [x] Stale running state is reset to idle on reload; waiting state and its reason are retained.
- [x] RSS item history round-trip through localStorage is covered by tests.
- [x] Hourly, custom-minute, daily-weekday and monthly-end-date progression have focused tests.
- [x] Per-task execution guard rejects duplicate concurrent triggers.
- [x] Duplicate triggers create a Skipped execution-history record.
- [x] A running marker without an active in-memory execution can be recovered and retried.
- [x] Execution guard regression tests cover duplicate locks, independent tasks, release/retry and stale-state detection.

## Current verification gate
- Previous verified baseline: run #236 passed regression tests, production build, Pages artifact upload and deployment.
- Custom interval feature commits are newer than that baseline and are not considered verified until the newest Actions run passes tests, build and deployment.
- Check https://github.com/mainakgarai007/Task/actions for the current result.

## Explicit limits / remaining roadmap (not blockers for this audit)
- Browser-only GitHub Pages cannot guarantee scheduled execution while the browser/device is completely closed or offline.
- Browser popup blockers can block `window.open` during background scheduled runs.
- Native Android background scheduling/notification channels, server-side webhooks and richer file processing remain future work.
- Custom scheduling now supports minute, hour and day intervals, capped at 365 days; older tasks that store `intervalMinutes` remain compatible.
- CI tests core functions and the production bundle; it is not a physical Android-device UI test. Device-only behavior still needs confirmation on the target device. A direct interactive live-app smoke test was not available during this audit; use the live URL above for a device check.

## Workflow rule
Do not begin another feature upgrade until the latest audit commit has green regression tests, build and deployment. Keep README, USER_MANUAL and the in-app User Manual synchronized when workflows change.
