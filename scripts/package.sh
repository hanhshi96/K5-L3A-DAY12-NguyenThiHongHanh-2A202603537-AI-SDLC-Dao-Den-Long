#!/usr/bin/env bash
# Builds the runnable release archive: dist/dao-den-long-v1.0.0.zip (run with `node server.js`, no npm install needed).
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:-v1.0.0}"; NAME="dao-den-long-$V"; OUT="dist/$NAME"
rm -rf "$OUT" "dist/$NAME.zip"; mkdir -p "$OUT/node_modules/three/build"
cp -R src server.js package.json game.contract.json README.md LICENSE CREDITS.md CHANGELOG.md "$OUT/"
cp node_modules/three/build/three.module.js node_modules/three/package.json node_modules/three/LICENSE "$OUT/node_modules/three/" 2>/dev/null || true
mv "$OUT/node_modules/three/three.module.js" "$OUT/node_modules/three/build/"
cat > "$OUT/HOW-TO-RUN.txt" <<'TXT'
Đảo Đèn Lồng v1.0.0
1. Cài Node.js >= 18.
2. Trong thư mục này chạy:  node server.js
3. Mở http://localhost:5173 (Chrome, Edge, Firefox hoặc Safari có WebGL 2).
Headless: node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl
TXT
(cd dist && zip -qr "$NAME.zip" "$NAME")
echo "built dist/$NAME.zip ($(du -h "dist/$NAME.zip" | cut -f1))"
