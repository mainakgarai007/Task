# Tasks Tool — Project Continuation Checkpoint

Last checked: 2026-10-09

## Repository and deployment
- Repository: https://github.com/mainakgarai007/Task
- Default branch: `main`
- Live app: https://mainakgarai007.github.io/Task/
- GitHub Actions workflow: Deploy Tasks Tool
- Latest verified code commit: `4f4a9fb6eb25bf9e50a20f17b6c522a24d0e662e` (`test: fix RSS regression test isolation`).
- Latest confirmed successful test/build/deploy: run #224.
- Run #224 verified Install dependencies, Run regression tests, Build, Upload Pages artifact, and Deploy as successful.
- RSS regression suite: 11 tests passed. Run #223 initially caught two test-fixture issues; those were corrected and #224 passed.
- Several earlier RSS parser fixes failed during iteration (#211–#216); do not use those as the current status.

## Implemented Smart RSS/Atom Monitor
- Parses RSS/Atom item ID, title, link, publication date, and available description.
- Per-task seen-item cache with retention cleanup and a 1,000-item cap.
- First successful run seeds existing matching items to avoid backlog notifications.
- New-item detection and duplicate suppression.
- Comma-separated keyword filtering with OR/AND matching.
- Configurable max items per run (UI range 5–50).
- Per-task RSS history storage (capped at 200).
- IF/THEN condition fields for new, removed, and updated items.
- Existing THEN action chain supports notification, open link, save result, and creating a follow-up task.
- README.md and USER_MANUAL.md include Smart RSS documentation.

## Known follow-up priorities (not yet confirmed complete)
### P0 — RSS reliability
- [x] Only items actually returned are marked seen; excess fresh items remain eligible for later runs.
- [x] Valid empty RSS/Atom feeds are accepted and an independent seed marker is persisted, so later first items can be detected.
- [x] Cache storage failures surface as task errors instead of being swallowed.
- [x] No-new and first-run sentinel messages are excluded from per-item history.
- [ ] Verify failed THEN-action behavior and cache/history persistence across reloads.
- [ ] Test duplicate suppression and first-run seeding with real feeds.

### P1 — Regression coverage
- [x] Added Vitest + happy-dom tests for RSS/Atom parsing, empty-feed seeding, duplicate suppression, max-item paging, AND/OR keywords, network failures and cache-write failures.
- [x] Added `npm test` and `npm run test:watch` scripts.
- [x] Added a GitHub Actions regression-test step before the production build.
- [ ] Confirm the new test suite and production build pass in GitHub Actions.
- [ ] Expand coverage for reordered/deleted feed items and verify notification/THEN behavior.
- [ ] Verify each code change with GitHub Actions test, build and deploy status.

### P2 — Notification correctness
- No unnecessary notification when there are no new items.
- Verify IF/THEN conditions such as `new_items > 0`.
- Show useful item-level RSS history details in the UI.

### P3 — Android background execution
- Investigate Capacitor/native scheduling so tasks can run more reliably when the browser is closed.
- Add native notification actions later.
- GitHub Pages/browser scheduling cannot guarantee execution while the browser/device is fully closed or offline.

## Working agreement
- Keep README.md, USER_MANUAL.md, and the in-app User Manual synchronized when workflows change.
- Do not claim a build or deployment passed until the latest relevant GitHub Actions run confirms it.
- Prefer fixing RSS reliability and adding regression tests before starting unrelated feature upgrades.
- Continue from the current repository state; do not assume the follow-up priorities above have already been implemented.


## Latest reliability update (2026-10-09)
- Hardened RSS cache persistence and made storage failures visible.
- Added independent first-run seed marker, including for valid empty feeds.
- Only items actually returned are marked seen; extra fresh items remain available to later runs.
- Filtered first-run/no-new sentinel messages from per-item history.
- Corrected change-item separator matching.
- Next: add automated regression tests for parser, cache, first-run, max-items, and keyword modes; then verify notification/THEN behavior.


## Earlier roadmap captured from project notes/screenshots

### Existing foundations (implemented; continue auditing)
- [x] V1 base app: task creation/management, browser notifications, GitHub Pages deployment.
- [x] V2 foundations: conditions, stop conditions, previous-run state, state comparison/change detection, recurring schedules, task editing and execution history.
- [x] Full IF/THEN condition builder foundations: multiple conditions, AND/OR groups, nested groups, NOT, and THEN action chains.
- [x] V3 foundations: public API tasks, URL monitoring, RSS monitoring, web change detection.
- [x] V4 optional AI foundations: user-supplied API key/provider settings, OpenAI-compatible endpoint, Gemini-compatible provider path, OpenRouter-compatible endpoint, natural-language task creation and AI result processing.
- [x] History and JSON backup/import controls exist; robustness and migration validation still need more tests.
- [x] Smart RSS/Atom item-level monitor exists; reliability hardening has just been deployed.

### Remaining roadmap (not yet complete)
1. **P1 — Automated regression tests:** RSS/Atom parsing, empty feed, malformed feed, cache persistence, first-run seeding, duplicate suppression, max-items paging, keyword AND/OR, and network/storage failure cases. Add a dedicated test command/CI step.
2. **P2 — Notification correctness:** verify no-new runs do not notify, new_items > 0 conditions behave correctly, and THEN action chains handle errors and item links predictably.
3. **P2 — Real change-diff/history UI:** show item-level additions/removals/updates and readable RSS history instead of only a result summary.
4. **P2 — Import validation/migration:** validate imported JSON shape, preserve valid older task data, and provide safe migration/error reporting.
5. **P2 — File/CSV/JSON task processing:** parsing, validation, transformation, and saved output.
6. **P3 — More schedule intervals:** support seconds/hours/days/months as distinct interval units where practical; current custom interval is minute-based.
7. **P3 — Webhook/event triggers:** generic webhook trigger plus GitHub and Gmail event integrations. These require an appropriate receiving/backend or native architecture; a static GitHub Pages browser alone cannot reliably receive server-side events.
8. **P3 — Offline queue and retry:** bounded retry/backoff, idempotency, and visible queued/failed state.
9. **P3 — Android app layer:** Capacitor/native notifications, background scheduling, and APK/PWA install experience. Browser-only GitHub Pages execution cannot be guaranteed while the browser/device is fully closed.
10. **P4 — Further provider polish:** verify Gemini/OpenRouter/OpenAI-compatible providers and AI result handling through regression tests; do not assume every provider/model is compatible merely because a settings option exists.

### Recommended order
RSS reliability (deployed) → regression tests → notification/THEN correctness → history/diff UI → import validation → file processing → offline retries/webhooks → broader intervals → Capacitor Android scheduler.

Do not start a large unrelated feature until the reliability and test gates above are satisfied. Treat the checklist as a roadmap, not a claim that unchecked work is implemented.


## P1 regression test implementation (2026-10-09)
- Added a dedicated automated RSS/Atom test suite using Vitest and happy-dom.
- CI runs tests before the production build/deploy gate; a test failure fails the workflow.
- Coverage includes RSS/Atom parsing, malformed XML, valid empty feeds, later first-item detection, duplicate suppression, max-items paging, keyword AND/OR, network failure, and cache-write failure.


## P1 outcome — automated RSS regression tests
- Latest passing test/build/deploy run: #224, commit `4f4a9fb6eb25bf9e50a20f17b6c522a24d0e662e`.
- Test command: `npm test` (Vitest + happy-dom).
- CI order: Install dependencies → Run regression tests → Build → Upload Pages artifact → Deploy.
- Confirmed cases: RSS item parsing, Atom entry parsing, malformed XML/non-feed rejection, valid empty feed, URL validation, first-run seeding, duplicate suppression, later first-item detection, max-items paging, AND/OR keyword matching, network failure, cache write failure.
- Remaining test expansion: reordered/deleted feed items, cache/history across reloads, and notification/THEN-action behavior.
