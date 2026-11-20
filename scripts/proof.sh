#!/usr/bin/env bash
# Re-generates the evidence in docs/proof/<phase>/ from the current code.
# Usage: scripts/proof.sh phase-1
set -euo pipefail
cd "$(dirname "$0")/.."
P="${1:-phase-1}"; OUT="docs/proof/$P"; mkdir -p "$OUT"
npm test --silent 2>&1 | tee "$OUT/test-output.txt"
for s in light-L1 pulse-shade; do
  node src/headless.js --seed 1 --night 1 --scenario tests/scenarios/$s.scenario.json \
    --inputs tests/scenarios/$s.inputs.json --ticks 180 --out "$OUT/$s.jsonl"
done
node src/headless.js --seed 2026 --night 1 --ticks 18000 --out "$OUT/idle-seed2026.jsonl"
node src/headless.js --seed 2026 --night 1 --ticks 18000 --out "$OUT/idle-seed2026.run2.jsonl"
cmp "$OUT/idle-seed2026.jsonl" "$OUT/idle-seed2026.run2.jsonl" && echo "determinism: identical" | tee "$OUT/determinism.txt"
rm "$OUT/idle-seed2026.run2.jsonl"
echo '{"player":{"flames":999}}' > /tmp/ddl-long.json
: > "$OUT/timing.txt"
for n in 1 2 3; do
  s=$(node -e 'console.log(Date.now())')
  node src/headless.js --seed 1 --night $n --ticks 21600 --scenario /tmp/ddl-long.json --out /tmp/ddl-long.jsonl
  e=$(node -e 'console.log(Date.now())')
  echo "night $n full length: $((e - s)) ms ($(tail -1 /tmp/ddl-long.jsonl))" | tee -a "$OUT/timing.txt"
done
echo "proof written to $OUT"
