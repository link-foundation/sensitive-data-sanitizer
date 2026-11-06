#!/usr/bin/env bash
# Exercise the actual upstream action's retry and mirror orchestration in CI.
# All commands except the deliberately failing image pulls use the real daemon.
set -eu
if [[ "${1:-}" == pull ]]; then
  printf '%s\n' "$2" >> "$BUILDX_PULL_LOG"
  case "$2" in
    moby/buildkit:*)
      echo '500 Internal Server Error: simulated canonical registry outage' >&2
      exit 1
      ;;
    mirror.gcr.io/moby/buildkit:*)
      if [[ "$BUILDX_MOCK_MODE" == exhausted ]]; then
        echo '502 Bad Gateway: simulated mirror outage' >&2
        exit 1
      fi
      # Resolve the mirror fixture through a healthy real source, then give
      # the daemon the exact reference upstream bootstrap will request.
      "$BUILDX_REAL_DOCKER" pull "${2#mirror.gcr.io/}"
      "$BUILDX_REAL_DOCKER" tag "${2#mirror.gcr.io/}" "$2"
      exit 0
      ;;
  esac
fi
exec "$BUILDX_REAL_DOCKER" "$@"
