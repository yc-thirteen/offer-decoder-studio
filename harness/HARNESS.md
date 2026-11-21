# Harness: build Offer Decoder unattended

You are running unattended, overnight. No human will answer questions. Each run of you is one iteration: you do one task from `harness/BACKLOG.md`, verify it, commit it to `main`, push, log it, and exit. A shell loop (`harness/run.sh`) starts the next iteration with fresh context. Your memory between iterations is only what is in git: this folder, `PROGRESS.md`, and the code.

## The product

Offer Decoder compares two job offers on an after-tax, after-benefits basis and tells a new hire exactly what to elect on day one. It is a final project for a personal finance course. Every rule comes from three lectures (Taxes 4B, Insurance 7A, Retirement 7B), condensed in `harness/FINANCE_SPEC.md`.

## Files you must respect

| File | Role | You may edit? |
|---|---|---|
| `harness/HARNESS.md` | these rules | no |
| `harness/FINANCE_SPEC.md` | finance rules | no |
| `harness/reference/engine.py` | test oracle | no |
| `harness/fixtures/*` | sample cases, expected outputs, letters | no |
| `harness/DESIGN.md` | locked design decisions | append to "Harness notes" only |
| `harness/BACKLOG.md` | ordered task list | yes: check off, mark blocked, add tasks |
| `harness/PROGRESS.md` | iteration log | yes: append only |
| everything in `src/`, `public/`, `supabase/functions/`, `scripts/`, `docs/`, root docs | the product | yes |

## Definition of done

The site is done when all of these are true:

1. **Engine:** `npm run verify` passes, and the fixture tests match `expected.json` within $1 for all 6 cases and all 12 offers. Lecture checks pass.
2. **Decoder page:** every section in DESIGN.md exists:
   - header and controls
   - About you
   - two stubs with editing
   - the correction interaction
   - memo line
   - checklist
   - all four "Why these elections" panels
   - Method page
   - empty and error states
3. **Samples:** all 6 sample cases load from the picker and display the fixture numbers.
4. **AI features:** both work end-to-end on the mock client.
   - The mock reader correctly extracts the three sample letters, which is tested.
   - A real-API path exists behind an environment switch.
   - `docs/AI_SETUP_LOVABLE.md` explains the only remaining human step: adding the API key.
5. **Images:** `IMAGE_PROMPTS.md` exists, and every image slot has a working fallback.
6. **Critique:** a critique round scores 2 on every rubric item, with screenshots at 375, 768, and 1280 px, and axe shows zero serious violations.
7. **README:** `README.md` explains the project, the lecture mapping, how to run it, and what is mocked.

When all of these are true, write `harness/DONE.md` (a summary plus what the human must do next), commit, push, and exit. The loop stops when that file exists.

## Hard rules

- Work on `main`. Commit small and often. Push after every commit with `git push origin main`.
- Never force-push, rewrite history, delete branches, or change remotes.
- Never commit unless `npm run verify` passes. If it fails and you can't fix it within this iteration, restore the files you changed in this iteration (`git restore` on those specific paths, never a blanket reset). Then mark the task `[!]` blocked with the reason, and add a smaller follow-up task.
- Do not change the build tooling Lovable relies on: the Vite config, the package manager and its lockfile type, `index.html` structure (the title and meta tags are fine to change), `src/main.tsx` bootstrapping, and anything under `src/integrations/` or `supabase/config.toml`. You may add dev dependencies and npm scripts.
- Allowed new dependencies: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`. Anything else needs a one-line reason in PROGRESS.md and must be small. Don't add a chart library; charts are hand-built SVG.
- Never commit secrets. No real API keys anywhere. `.env.example` with placeholder names is fine.
- Never read or copy files outside this repository.
- Don't weaken a test to make it pass. If the TypeScript engine disagrees with the fixtures, the engine is wrong.
- Follow `DESIGN.md` exactly. Its banned list is absolute.
- One task per iteration. If a task is too big, split it into checklist items in BACKLOG.md, do the first one, and commit.
- If the same task has failed in two iterations (check PROGRESS.md), mark it blocked and move on.
- Keep `harness/logs/` and `harness/shots/` out of git (they belong in `.gitignore`).

## How to check UI work without a human

After any change that affects what the user sees:

1. Run `npm run shots`. It builds, serves the production build, and saves screenshots of `/` (defaults on, recommended on, and the first sample's checklist tab), `/method`, and an empty state, at 375, 768, and 1280 px, into `harness/shots/latest/`.
2. Open the screenshots with your file-reading tool and look at them.
3. Compare them against the DESIGN.md rubric and banned list.
4. Fix what is clearly wrong before committing. Note anything you defer as a new BACKLOG task.

Also run `npm run a11y` (axe via Playwright) once that script exists.

## Self-improvement

When every BACKLOG task is checked or blocked, run a **critique round**:

1. Take fresh screenshots and run a11y.
2. Score all 10 rubric items 0–2, writing the scores in PROGRESS.md.
3. For every item under 2, add one concrete, small task to BACKLOG under "Critique round N". Name the file, the issue, and the fix.
4. Also re-try each blocked task once, if its blocker may have changed.

You may run at most 6 critique rounds. If round 6 still has items under 2, finish anyway: list them in DONE.md as known issues.

## Logging (end of every iteration, in the same commit)

Append to `harness/PROGRESS.md`:

```
## <ISO timestamp> | iteration <n>
Task: <task text>
Result: done | blocked | partial
What changed: <2-4 lines>
Verify: pass | fail (<why>)
Screens checked: yes/no; issues found: <short>
Next: <next task>
```
