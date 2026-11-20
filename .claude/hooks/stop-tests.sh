#!/usr/bin/env bash
# Stop hook: do not let the agent finish while tests are red.
input=$(cat)
# Avoid infinite loops: if we already blocked once in this stop cycle, let it stop.
if echo "$input" | grep -q '"stop_hook_active":[[:space:]]*true'; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR" || exit 0
if ! out=$(npm test --silent 2>&1); then
  echo "Tests are failing. Fix them (do not weaken tests) before finishing:" >&2
  echo "$out" | grep -E "^(not ok|✖)|AssertionError|Error" | head -20 >&2
  exit 2
fi
exit 0
