#!/usr/bin/env bash
# run-with-budget-warning.sh
#
# Owns the deadline for a long CI step so the step, not the job, decides
# when time has run out.
#
# `timeout-minutes` on a job is a backstop, never the deadline: GitHub
# reports a job killed by it as *cancelled*, not *failed*, so a genuine
# overrun can pass unnoticed on a pull request and cannot name the
# deadline it blew on the default branch. A step that owns its own budget
# exits non-zero instead, which GitHub reports as a failure with a title
# naming the budget and the overrun.
#
# Usage:
#   bash scripts/run-with-budget-warning.sh SECONDS LABEL COMMAND [ARG...]
#
# Environment:
#   BUDGET_WARN_PERCENT   emit a warning at this share of the budget (default 70)
#   BUDGET_GRACE_SECONDS  seconds between SIGTERM and SIGKILL (default 10)
#   BUDGET_KILL_SECONDS   seconds to wait for SIGKILL to take effect (default 5)
#   BUDGET_POLL_SECONDS   polling interval while the command runs (default 1)
#   BUDGET_SUDO_KILL      use passwordless sudo to signal survivors (default 1)
#   BUDGET_CAPTURE_OUTPUT relay output so survivors cannot hold the step open
#                         (default 1)
#   BUDGET_STATE_PARENT   parent for private state (default RUNNER_TEMP, then
#                         TMPDIR or /tmp)
#   BUDGET_VERBOSE        trace liveness and signalling decisions (default:
#                         RUNNER_DEBUG, so a GitHub "Re-run with debug logging"
#                         turns it on; otherwise 0)
#   BUDGET_ATTEMPTS       run the command up to this many times while it fails
#                         or overruns, each attempt with the full budget
#                         (default 1). For steps such as `npm ci` that can
#                         hang on one host and pass on the next attempt.
#   BUDGET_RETRY_DELAY_SECONDS
#                         pause between attempts (default 10)
#
# A retried step can spend BUDGET_ATTEMPTS * SECONDS plus the pauses between
# attempts; tests/ci-timeouts charges that much against the job's
# timeout-minutes.
#
# Exit codes: the command's own status, or 124 on timeout (matching timeout(1)).
set -uo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 SECONDS LABEL COMMAND [ARG...]" >&2
  exit 2
fi

budget_seconds="$1"
label="$2"
shift 2

case "$budget_seconds" in
  '' | *[!0-9]*)
    echo "Budget must be a whole number of seconds, got '${budget_seconds}'." >&2
    exit 2
    ;;
esac

if [ "$budget_seconds" -le 0 ]; then
  echo "Budget must be greater than zero seconds." >&2
  exit 2
fi

attempts="${BUDGET_ATTEMPTS:-1}"
retry_delay="${BUDGET_RETRY_DELAY_SECONDS:-10}"
case "${attempts}" in
  '' | *[!0-9]* | 0 | 00*)
    echo "BUDGET_ATTEMPTS must be a whole number of at least 1, got '${attempts}'." >&2
    exit 2
    ;;
esac
case "${retry_delay}" in
  '' | *[!0-9]*)
    echo "BUDGET_RETRY_DELAY_SECONDS must be a whole number of seconds, got '${retry_delay}'." >&2
    exit 2
    ;;
esac

# Each attempt is a fresh run of this script with one attempt. An overrun
# that a later attempt can still recover from is a warning, not an error, so
# a step that passes on its retry carries no error annotation.
if [ "${attempts}" -gt 1 ]; then
  attempt=1
  while :; do
    level=warning
    [ "${attempt}" -ge "${attempts}" ] && level=error
    BUDGET_ATTEMPTS=1 BUDGET_OVERRUN_LEVEL="${level}" \
      bash "${BASH_SOURCE[0]}" "${budget_seconds}" "${label}" "$@"
    status=$?
    if [ "${status}" -eq 0 ] || [ "${attempt}" -ge "${attempts}" ]; then
      exit "${status}"
    fi
    echo "::warning title=${label} retried::${label} attempt ${attempt} of ${attempts} exited ${status}; trying again in ${retry_delay}s."
    sleep "${retry_delay}"
    attempt=$((attempt + 1))
  done
fi
overrun_level="${BUDGET_OVERRUN_LEVEL:-error}"

warn_percent="${BUDGET_WARN_PERCENT:-70}"
grace_seconds="${BUDGET_GRACE_SECONDS:-10}"
kill_seconds="${BUDGET_KILL_SECONDS:-5}"
poll_seconds="${BUDGET_POLL_SECONDS:-1}"
capture_output="${BUDGET_CAPTURE_OUTPUT:-1}"
sudo_kill="${BUDGET_SUDO_KILL:-1}"
verbose="${BUDGET_VERBOSE:-${RUNNER_DEBUG:-0}}"
warn_seconds=$((budget_seconds * warn_percent / 100))

# A fractional value is legitimate, but it must be a number: the grace loop
# sleeps on it, and a typo would otherwise sit here undiscovered until the
# first overrun.
case "$poll_seconds" in
  '' | *[!0-9.]* | *.*.*)
    echo "BUDGET_POLL_SECONDS must be a positive number, got: ${poll_seconds}" >&2
    exit 2
    ;;
esac

trace() { [ "${verbose}" = "1" ] && echo "[budget] $*" >&2 || true; }

# The command owns TMPDIR and may legitimately clean it. Keep parent control
# state in GitHub's job-scoped runner directory, with an independent override
# for other CI systems and tests.
state_parent="${BUDGET_STATE_PARENT:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}}"
if ! status_dir="$(mktemp -d "${state_parent%/}/budget-status.XXXXXX")"; then
  echo "Could not create budget control state under ${state_parent}." >&2
  exit 2
fi
status_file="${status_dir}/status"
stdout_file="${status_dir}/stdout"
stderr_file="${status_dir}/stderr"
trap 'rm -rf "${status_dir}"' EXIT
trace "control state: ${status_dir}"

# Descendants inherit these files rather than the runner's streams. A process
# that outlives the command can therefore no longer keep a surrounding pipe
# (for example `... | tee log`) open after this wrapper exits.
if [ "${capture_output}" = "1" ]; then
  : >"${stdout_file}"
  : >"${stderr_file}"
fi

stdout_offset=0
stderr_offset=0
stdout_line_open=false

# GitHub reads a workflow command (::warning, ::error) only at the start of a
# line, so relayed output without a final newline would swallow the next one.
say() {
  if [ "${stdout_line_open}" = true ]; then
    echo
    stdout_line_open=false
  fi
  echo "$@"
}

stream_size() {
  local size
  size="$(wc -c <"$1" 2>/dev/null || echo 0)"
  size="${size//[![:digit:]]/}"
  echo "${size:-0}"
}

emit_range() {
  tail -c "+$(($2 + 1))" "$1" 2>/dev/null | head -c "$(($3 - $2))"
}

relay_output() {
  [ "${capture_output}" = "1" ] || return 0

  local size
  size="$(stream_size "${stdout_file}")"
  if [ "${size}" -gt "${stdout_offset}" ]; then
    emit_range "${stdout_file}" "${stdout_offset}" "${size}"
    stdout_offset="${size}"
    # Inspect the last relayed byte, not the file's current last byte, which
    # the command may already have extended. od, not $(...) alone: command
    # substitution drops NUL bytes.
    if [ "$(emit_range "${stdout_file}" "$((size - 1))" "${size}" | od -An -tx1 | tr -d ' \n')" = "0a" ]; then
      stdout_line_open=false
    else
      stdout_line_open=true
    fi
  fi

  size="$(stream_size "${stderr_file}")"
  if [ "${size}" -gt "${stderr_offset}" ]; then
    emit_range "${stderr_file}" "${stderr_offset}" "${size}" >&2
    stderr_offset="${size}"
  fi
}

# `set -m` puts the command in its own process group, so the signals below
# reach the whole tree. `npm test` and `bun test` spawn workers, and killing
# only the direct child leaves orphans holding the runner -- which is also
# why timeout(1) is not sufficient here.
#
# Completion is detected through the status file rather than process
# liveness: a finished child stays visible as a zombie until it is reaped,
# so `kill -0` alone would never report it as done.
set -m
if [ "${capture_output}" = "1" ]; then
  {
    "$@"
    command_status=$?
    printf '%s\n' "${command_status}" >"${status_file}.partial"
    mv "${status_file}.partial" "${status_file}"
  } >"${stdout_file}" 2>"${stderr_file}" &
else
  {
    "$@"
    command_status=$?
    printf '%s\n' "${command_status}" >"${status_file}.partial"
    mv "${status_file}.partial" "${status_file}"
  } &
fi
command_pid=$!
set +m

# Ask the process table about existence, rather than `kill -0`, which returns
# the same failure status for a missing process and a live process owned by a
# different user. Zombies are bookkeeping, not work still running.
have_ps=false
if ps -eo pgid=,pid=,stat= >/dev/null 2>&1; then
  have_ps=true
fi

group_members() {
  ps -eo pgid=,pid=,stat=,user=,args= 2>/dev/null \
    | awk -v group="${command_pid}" '$1 == group && $3 !~ /^Z/ {
        pid = $2; user = $4
        $1 = ""; $2 = ""; $3 = ""; $4 = ""
        sub(/^ +/, "")
        printf "%s %s %s\n", pid, user, $0
      }'
}

group_is_populated() {
  if [ "${have_ps}" = true ]; then
    [ -n "$(group_members)" ]
  else
    kill -0 -- "-${command_pid}" 2>/dev/null
  fi
}

sudo_kill_available=''
can_sudo_kill() {
  [ "${sudo_kill}" = "1" ] || return 1
  if [ -z "${sudo_kill_available}" ]; then
    if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
      sudo_kill_available=yes
    else
      sudo_kill_available=no
    fi
  fi
  [ "${sudo_kill_available}" = yes ]
}

# Signal the process group when possible, falling back to the direct child
# on platforms without usable process groups (notably Git Bash on Windows).
signal_command() {
  local signal="$1"
  kill "-${signal}" -- "-${command_pid}" 2>/dev/null \
    || kill "-${signal}" "${command_pid}" 2>/dev/null \
    || true

  if group_is_populated && can_sudo_kill; then
    trace "survivors after SIG${signal}; retrying as root"
    sudo -n kill "-${signal}" -- "-${command_pid}" 2>/dev/null \
      || sudo -n kill "-${signal}" "${command_pid}" 2>/dev/null \
      || true
  fi
}

# Liveness is tracked on the process group, never on command_pid alone: the
# pid belongs to the wrapper subshell, which dies on SIGTERM as soon as it
# is delivered even when the command itself ignores the signal -- a group
# that still has a live member is the only reliable "still running" answer.
command_is_running() {
  [ -f "${status_file}" ] && return 1
  group_is_populated
}

# SECONDS is integer-valued and may tick early relative to wall time.
# Only enforce a deadline after its entire second has elapsed.
deadline_elapsed() { [ "${SECONDS}" -gt "$1" ]; }

wait_while_running() {
  local deadline=$((SECONDS + $1))
  while command_is_running && ! deadline_elapsed "${deadline}"; do
    relay_output
    sleep "${poll_seconds}"
  done
}

report_survivors() {
  local survivors
  survivors="$(group_members)"
  [ -n "${survivors}" ] || return 0
  say "::error title=${label} left processes running::${label} could not be terminated. Still running: $(echo "${survivors}" | tr '\n' ';')"
  echo "${survivors}" >&2
}

# A stalled step leaves no other evidence of *what* it was waiting on (a hung
# install, for example, prints nothing until it finishes), so record the
# process group before signalling it.
report_running_at_deadline() {
  local running
  running="$(group_members)"
  [ -n "${running}" ] || return 0
  say "Processes still running when the ${budget_seconds}s budget expired (pid user command):"
  echo "${running}"
}

terminate_over_budget() {
  say "::${overrun_level} title=${label} exceeded its execution budget::${label} did not finish within its ${budget_seconds}s budget, so termination was requested. Shorten the step or raise its budget (keeping it below the job's timeout-minutes backstop)."
  relay_output
  report_running_at_deadline
  signal_command TERM

  # The step's own SECONDS clock, not an accumulation of the (possibly
  # fractional) poll interval: bash arithmetic is integer-only, so summing
  # poll_seconds would abort this function before the SIGKILL escalation.
  wait_while_running "${grace_seconds}"

  if command_is_running; then
    say "${label} ignored SIGTERM after ${grace_seconds}s; sending SIGKILL."
    signal_command KILL
    wait_while_running "${kill_seconds}"
  fi

  report_survivors
  wait "${command_pid}" 2>/dev/null || true
  relay_output
  exit 124
}

echo "Running ${label} with a ${budget_seconds}s budget (warning at ${warn_seconds}s)."

SECONDS=0
warned=false

while command_is_running; do
  if [ "${warned}" = false ] && [ "${SECONDS}" -ge "${warn_seconds}" ]; then
    warned=true
    say "::warning title=${label} is approaching its execution budget::${label} has run for ${SECONDS}s of its ${budget_seconds}s budget."
  fi

  if deadline_elapsed "${budget_seconds}"; then
    terminate_over_budget
  fi

  relay_output
  sleep "${poll_seconds}"
done

wait "${command_pid}" 2>/dev/null
wait_status=$?
relay_output

# The status file is authoritative: the wrapper subshell's own exit status is
# that of the bookkeeping it does after the command returns.
if [ -f "${status_file}" ]; then
  status="$(cat "${status_file}")"
else
  status="${wait_status}"
fi
say "${label} finished in ${SECONDS}s of its ${budget_seconds}s budget (exit ${status})."
exit "${status}"
