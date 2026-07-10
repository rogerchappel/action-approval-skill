#!/usr/bin/env bash
set -euo pipefail
npm run check
npm test
npm run build
node dist/cli.js --version >/dev/null
npm run smoke
npm run package:smoke
