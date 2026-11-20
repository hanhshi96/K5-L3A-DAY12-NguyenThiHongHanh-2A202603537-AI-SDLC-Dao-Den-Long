// Do not download browsers during `npm install` (a failed download would abort the whole install and break the game).
// scripts/bench.js downloads Chrome on first use, or falls back to a system Chrome.
module.exports = { skipDownload: true };
