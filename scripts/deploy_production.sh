#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/relationship-temperature}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-relationship-temperature.service}"

cd "$APP_DIR"

git fetch --prune origin
git reset --hard "origin/$BRANCH"

npm ci
npm run build

systemctl restart "$SERVICE"
systemctl is-active "$SERVICE"
