# Tasks Tool — Project Continuation Checkpoint

Last checked: 2026-10-09

## Repository and deployment
- Repository: https://github.com/mainakgarai007/Task
- Default branch: `main`
- Live app: https://mainakgarai007.github.io/Task/
- GitHub Actions workflow: Deploy Tasks Tool
- Previous checkpoint commit: `4835560cda21cc6b9b33a7e368ff93e9d0124247` (`docs: save RSS monitor continuation checkpoint`)
- Previous successful full build/deploy: run #220 for the checkpoint commit; install, Build, Upload Pages artifact, and Deploy all succeeded.
- This reliability update must be re-verified on its own latest Actions run before claiming it is deployed.
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
- Test valid/invalid RSS and Atom feeds.
- Test duplicate, reordered, deleted, and newly published items.
- Test AND/OR keyword filters, empty feeds, and network failures.
- Verify every code change with GitHub Actions Build and Deploy status.

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
