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
/usr/bin/time -p node src/headless.js --seed 1 --night 1 --ticks 18000 --scenario tests/scenarios/pulse-shade.scenario.json \
  --out /dev/null 2> "$OUT/timing.txt" || true
echo "proof written to $OUT"
