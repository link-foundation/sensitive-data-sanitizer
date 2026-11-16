## Summary

`scripts/run-with-budget-warning.sh` relays the command's captured stderr (`emit_range "$stderr_file" ... >&2`, around line 105) and then prints its own workflow commands to stderr with `echo ... >&2`:

- `::warning title=… is approaching its timeout::` (around line 247)
- `::error title=… exceeded its execution budget::` (around line 218)
- `::error title=… left processes running::` (around line 212)

GitHub reads a workflow command only at the **start of a line**, and the runner splits stdout and stderr into lines separately. If the relayed stderr chunk does not end with a newline (a progress bar using `\r`, `printf` without `\n`, or a process killed in mid-write), the `::warning`/`::error` text is appended to that partial line and no annotation is produced. The over-budget `::error` is the one that explains a red step, so it is the worst one to lose.

This is the same defect as link-foundation/js-ai-driven-development-pipeline-template#304, on stderr instead of stdout. I found it by reading the code at template head `c532c17`. Following this repository's rules, I did not run the template's script; the JS form of the bug was reproduced and fixed downstream.

## Reproduction

```sh
BUDGET_WARN_PERCENT=10 bash scripts/run-with-budget-warning.sh 10 "open line" \
  bash -c "printf 'progress 42%%' >&2; sleep 2" 2>&1 | cat -A | grep -n '::warning'
```

Expected: a line that starts with `::warning title=open line is approaching its timeout::`. With the current script I expect `progress 42%::warning title=...` on one line, because nothing ends the open line first.

## Workaround

Make sure the wrapped command ends its output with a newline, for example `cmd; echo >&2`. This does not help when the command is killed mid-line.

## Suggested fix

Record whether each relayed stream ended mid-line, and end that line before printing a workflow command on the same stream. This mirrors the downstream fix in link-foundation/sensitive-data-sanitizer#209, which uses stdout because its annotations go there:

```bash
stderr_line_open=false
# GitHub reads ::warning/::error only at the start of a line.
say_err() {
  if [ "$stderr_line_open" = true ]; then
    echo >&2
    stderr_line_open=false
  fi
  echo "$@" >&2
}

# in relay_output(), after emitting stderr:
# od, not $(tail -c 1): command substitution drops NUL bytes and newlines.
if [ "$(tail -c 1 "$stderr_file" | od -An -tx1 | tr -d ' \n')" = "0a" ]; then
  stderr_line_open=false
else
  stderr_line_open=true
fi
```

Then use `say_err` in place of `echo ... >&2` for every `::warning`, `::error` and status line that comes after `relay_output`. Add a regression test that checks a line *starts with* `::warning` after output with no trailing newline.
