#!/usr/bin/env bash
# Overnight loop for Offer Decoder.
# Usage (from the repo root):
#   ONCE=1 ./harness/run.sh          one iteration, to test the setup
#   HOURS=12 ./harness/run.sh        run for 12 hours or until harness/DONE.md exists
# On a Mac, keep the machine awake:  caffeinate -dimsu ./harness/run.sh
set -u
cd "$(dirname "$0")/.."

HOURS="${HOURS:-12}"
MAX_TURNS="${MAX_TURNS:-150}"
END=$(( $(date +%s) + HOURS * 3600 ))
LOGDIR="harness/logs"; mkdir -p "$LOGDIR"
RUNLOG="$LOGDIR/run.log"
i=0; idle=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$RUNLOG"; }

while [ "$(date +%s)" -lt "$END" ]; do
  if [ -f harness/DONE.md ]; then log "harness/DONE.md exists. Finished."; break; fi
  i=$((i + 1))
  before=$(git rev-parse HEAD 2>/dev/null)
  git pull --rebase --autostash origin main >>"$RUNLOG" 2>&1 || log "git pull failed (continuing)"
  log "iteration $i starting"

  claude -p "$(cat harness/ITERATE.md)" \
    --permission-mode auto \
    --max-turns "$MAX_TURNS" \
    --output-format text >"$LOGDIR/iter-$i.log" 2>&1
  code=$?
  after=$(git rev-parse HEAD 2>/dev/null)

  if [ $code -ne 0 ]; then
    log "iteration $i exited with code $code (often a usage limit). Last lines:"
    tail -n 5 "$LOGDIR/iter-$i.log" | tee -a "$RUNLOG"
    log "sleeping 15 minutes before retrying"
    sleep 900
    continue
  fi

  if [ "$before" = "$after" ]; then
    idle=$((idle + 1))
    log "iteration $i made no commit ($idle in a row)"
    if [ $idle -ge 3 ]; then log "3 idle iterations; sleeping 10 minutes"; sleep 600; idle=0; fi
  else
    idle=0
    log "iteration $i committed: $(git log -1 --pretty=%s)"
  fi

  if [ "${ONCE:-0}" = "1" ]; then log "ONCE=1, stopping after one iteration"; break; fi
  sleep 15
done
log "loop ended after $i iterations"
