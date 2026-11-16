#!/usr/bin/env bash
# Install a pinned lychee release with retries and a SHA-256 check.
#
# Only the download is retried; a broken link must still fail the checker.
# The archive must match both the repository-pinned digest and the digest
# published next to the release asset.
#
# Set LYCHEE_VERSION and the architecture-specific LYCHEE_SHA256_* pin
# from links.yml, then run scripts/install-lychee.sh [install-dir].
#
# Environment:
#   LYCHEE_VERSION               pinned release tag, e.g. v0.24.2 (required)
#   LYCHEE_SHA256_X86_64         SHA-256 of the x86_64 Linux GNU archive
#   LYCHEE_SHA256_AARCH64        SHA-256 of the aarch64 Linux GNU archive
#   LYCHEE_DOWNLOAD_BASE_URL     release download root (tests use loopback)
#   LYCHEE_DOWNLOAD_RETRIES      curl retries per download (default 5)
#   LYCHEE_DOWNLOAD_RETRY_DELAY  seconds between retries (default 5)
#   LYCHEE_INSTALL_DEBUG=1       print every command
set -euo pipefail
[ "${LYCHEE_INSTALL_DEBUG:-}" = 1 ] && set -x

version="${LYCHEE_VERSION:?LYCHEE_VERSION is required, e.g. v0.24.2}"
if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "::error title=lychee install::LYCHEE_VERSION must be a pinned release such as v0.24.2, got '$version'." >&2
  exit 1
fi
install_dir="${1:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}/lychee/bin}"
case "$(uname -m)" in
  x86_64 | amd64) arch=x86_64; pinned="${LYCHEE_SHA256_X86_64:-}" ;;
  aarch64 | arm64) arch=aarch64; pinned="${LYCHEE_SHA256_AARCH64:-}" ;;
  *)
    echo "::error title=lychee install::Unsupported architecture $(uname -m)." >&2
    exit 1
    ;;
esac
if ! [[ "$pinned" =~ ^[0-9a-f]{64}$ ]]; then
  echo "::error title=lychee install::A repository-pinned SHA-256 is required for $arch." >&2
  exit 1
fi
asset="lychee-${arch}-unknown-linux-gnu.tar.gz"
base_url="${LYCHEE_DOWNLOAD_BASE_URL:-https://github.com/lycheeverse/lychee/releases/download}/lychee-${version}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# --retry-all-errors also retries HTTP 5xx/429 and dropped connections; --fail
# keeps an error page from being saved as the archive. Each attempt and the
# whole retry loop are bounded so a stalled download cannot hold the job.
fetch() {
  curl --fail --silent --show-error --location \
    --retry "${LYCHEE_DOWNLOAD_RETRIES:-5}" --retry-all-errors --retry-delay "${LYCHEE_DOWNLOAD_RETRY_DELAY:-5}" \
    --connect-timeout 20 --max-time 60 --retry-max-time 180 \
    --output "$2" "$1"
}

echo "Downloading ${base_url}/${asset}"
if ! fetch "${base_url}/${asset}" "$work/$asset" || ! fetch "${base_url}/${asset}.sha256" "$work/$asset.sha256"; then
  echo "::error title=lychee install::Could not download lychee ${version} (${asset}) after retries. GitHub's release download service may be unavailable; re-run the job." >&2
  exit 1
fi

expected="$(awk '{print $1; exit}' "$work/$asset.sha256")"
actual="$(sha256sum "$work/$asset" | awk '{print $1}')"
if [ "$pinned" != "$actual" ] || [ "$expected" != "$pinned" ]; then
  echo "::error title=lychee install::Checksum mismatch for ${asset}: pinned '${pinned}', published '${expected}', got '${actual}'." >&2
  exit 1
fi

tar -xzf "$work/$asset" -C "$work"
binary="$(find "$work" -type f -name lychee -perm -u+x | head -n 1)"
if [ -z "$binary" ]; then
  echo "::error title=lychee install::No lychee binary in ${asset}; the archive layout changed." >&2
  exit 1
fi
install -D -m 0755 "$binary" "$install_dir/lychee"
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$install_dir" >> "$GITHUB_PATH"
fi
"$install_dir/lychee" --version
