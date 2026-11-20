---
name: contract-check
description: Verify the game still satisfies Test Contract v1.1 (nights 1-3) after any change to src/sim, src/headless.js, or tuning. Use before tagging a phase or when a ticket changes rules.
---

# contract-check

Contract is v1.1 since Phase 2. Run every check for `--night 1`, `2` and `3`.

1. `npm test` — must be all green (do not edit tests to make them pass).
2. Confirm `game.contract.json` tuning == `TUNING` in `src/sim/sim.js` (test "tuning mirrors…").
3. Determinism: run the same command twice and `cmp` the outputs:
   `node src/headless.js --seed 7 --night 3 --ticks 21600 --out a.jsonl` (twice → a.jsonl, b.jsonl). Must finish in ≤ 30 s.
4. Malformed file → exit 2: `echo '{' > bad.json; node src/headless.js --seed 1 --night 1 --ticks 5 --inputs bad.json --out x.jsonl; echo $?`
5. Standard numbers: tuning must equal the ticket table (test "v1.1 and mirrors…"). Shade states must be exactly spawning/wander/chase/recoil/stunned.
6. For a new ticket rule: add a scenario in `tests/scenarios/` + an assertion in `tests/scenarios.test.js` first.
7. Regenerate evidence: `scripts/proof.sh phase-N` and commit `docs/proof/phase-N/`.
Report each step's actual output; never claim a step passed without running it.
