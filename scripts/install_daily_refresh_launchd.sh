#!/usr/bin/env zsh
set -euo pipefail

PROJECT_DIR="/Users/tianhaoran/Documents/国际关系趋势"
LABEL="com.relationship-temperature.daily-refresh"
SOURCE_PLIST="$PROJECT_DIR/scripts/$LABEL.plist"
TARGET_PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$PROJECT_DIR/logs"

cp "$SOURCE_PLIST" "$TARGET_PLIST"

launchctl bootout "gui/$(id -u)" "$TARGET_PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$TARGET_PLIST"
launchctl enable "gui/$(id -u)/$LABEL"

echo "Installed $LABEL. It will run daily at 10:00."
echo "Logs:"
echo "  $PROJECT_DIR/logs/daily-refresh.out.log"
echo "  $PROJECT_DIR/logs/daily-refresh.err.log"
