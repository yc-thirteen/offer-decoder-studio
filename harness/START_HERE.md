# Start here

## One-time setup (about 15 minutes)

1. **Install the tools.**
   - **Mac:** `xcode-select --install`, `brew install gh`, Node.js from nodejs.org, then `curl -fsSL https://claude.ai/install.sh | bash`.
   - **Windows:** install WSL (`wsl --install`), then do everything inside the Ubuntu terminal using the Mac/Linux commands.
2. **Log in to GitHub.** Run `gh auth login` and choose GitHub.com → HTTPS → Yes → Login with a web browser.
3. **Clone the repo and check that it builds.**
   ```bash
   cd ~/Desktop
   gh repo clone yc-thirteen/offer-decoder-studio
   cd offer-decoder-studio
   npm install && npm run build
   ```
4. **Log in to Claude Code once, interactively.** Run `claude`, finish the browser login, then type `/exit`. The overnight loop reuses this login.
5. **Add the harness to the repo.** Copy this whole `harness/` folder into the repo root, so the path is `offer-decoder-studio/harness/HARNESS.md`. Then:
   ```bash
   chmod +x harness/run.sh
   git add harness && git commit -m "Add overnight harness" && git push origin main
   ```

## Test one iteration (about 10–20 minutes)

```bash
ONCE=1 ./harness/run.sh
```

When it finishes, three things should be true:

- `harness/logs/run.log` says "committed: harness: …".
- GitHub shows that commit on main.
- `harness/PROGRESS.md` has an entry describing your repo's stack.

If the iteration log shows permission prompts being denied, auto mode isn't available for your account. In that case, don't switch to `--dangerously-skip-permissions` on your own machine; Anthropic's docs say that mode belongs in a container or VM. Check `claude --help` and the [permission modes docs](https://code.claude.com/docs/en/permission-modes.md) for what your plan supports.

## Run overnight

Plug in the laptop and keep the lid open, then run:

```bash
caffeinate -dimsu ./harness/run.sh     # Mac
HOURS=12 ./harness/run.sh              # Linux / WSL
```

To watch progress from another terminal: `tail -f harness/logs/run.log`.

Your Claude plan has usage limits. When a limit hits, the loop sleeps 15 minutes and retries, so a long night has pauses. If it isn't finished after 12 hours, run it again: it picks up where it left off, because all its state lives in git.

## In the morning

1. Read `harness/DONE.md` (or the end of `PROGRESS.md` if it hasn't finished).
2. **Images:** open `IMAGE_PROMPTS.md`, generate each image in ChatGPT, save it with the exact filename into `public/`, then run `git add public && git commit -m "Add images" && git push`.
3. **AI:** follow `docs/AI_SETUP_LOVABLE.md` in Lovable. The only thing you type in is the API key.
4. In Lovable, the site appears automatically because Lovable syncs from main.
