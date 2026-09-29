#!/usr/bin/env bash
set -euo pipefail

readonly HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-60}"
readonly HEALTH_INTERVAL_SECONDS=2
readonly DEPLOYED_SHA_FILE=.deployed-sha

if [[ $# -ne 2 ]]; then
  echo "usage: deploy.sh <sha> <base-path>" >&2
  exit 2
fi

readonly sha="$1"
readonly base_path="$2"
app_port="$(grep -E '^APP_PORT=' .env | cut -d= -f2)"
readonly app_port
readonly health_url="http://127.0.0.1:${app_port}${base_path}/api/health"

start() {
  IMAGE_TAG="$1" docker compose up -d --pull missing --no-build --remove-orphans
}

wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  until curl --fail --silent --output /dev/null --max-time 3 "$health_url"; do
    if ((SECONDS >= deadline)); then
      return 1
    fi
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
}

if start "$sha" && wait_healthy; then
  echo "$sha" > "$DEPLOYED_SHA_FILE"
  exit 0
fi

echo "deploy of $sha failed" >&2
if [[ -f "$DEPLOYED_SHA_FILE" ]]; then
  previous_sha="$(cat "$DEPLOYED_SHA_FILE")"
  echo "rolling back to $previous_sha" >&2
  if start "$previous_sha" && wait_healthy; then
    echo "rolled back to $previous_sha" >&2
  else
    echo "rollback to $previous_sha failed" >&2
  fi
fi
exit 1
