# Tasks Tool — Project Continuation Checkpoint

Last checked: 2026-10-09

## Repository and deployment
- Repository: https://github.com/mainakgarai007/Task
- Default branch: `main`
- Live app: https://mainakgarai007.github.io/Task/
- GitHub Actions workflow: Deploy Tasks Tool
- Latest observed main HEAD before this checkpoint: `4493f7be57f3b5ca2dcdccd46e1aa751d150d02a` (`docs: document smart RSS monitor features`)
- Latest successful full build/deploy before this checkpoint: run #219, commit `3e4ba5759cdb0c49aed9fe9285bab233dc837a6a`; install, Build, Upload Pages artifact, and Deploy all succeeded.
- Run #218 for the README-only follow-up commit was cancelled by a newer run. Re-run verification on the checkpoint commit before claiming the newest HEAD has deployed.
- Run #217 (`e8782a1`) also passed all deployment steps.
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
- Ensure a failed execution does not mark undelivered items as permanently seen.
- Verify cache persistence and history across reloads.
- Test duplicate suppression and first-run seeding.
- Ensure sentinel messages such as “No new RSS/Atom items detected” and the first-run initialization message are never added as RSS history entries.

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
