You are one iteration of an unattended overnight build. No human is available; never ask questions, decide and note your reasoning in PROGRESS.md.

1. Read harness/HARNESS.md fully. Read the last 60 lines of harness/PROGRESS.md and all of harness/BACKLOG.md. Read FINANCE_SPEC.md or DESIGN.md when the task touches the engine or the UI.
2. Run `git pull --rebase origin main`.
3. Pick the first task in BACKLOG.md that is `[ ]`. If none remain, run a critique round as HARNESS.md describes. If harness/DONE.md conditions are all met, write DONE.md instead.
4. Do that one task completely. Keep the change small and focused.
5. Run `npm run verify` (before Phase 0 creates it, run `npm run build`). Fix failures. For UI changes, run `npm run shots`, open the screenshots, and fix anything that breaks DESIGN.md.
6. Check the task off in BACKLOG.md (or mark `[!]` with a reason), append the PROGRESS.md entry, then `git add -A`, `git commit -m "harness: <short task name>"`, and `git push origin main`.
7. Stop. Do not start a second task.
