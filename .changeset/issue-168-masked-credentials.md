---
'@link-foundation/sensitive-data-sanitizer': patch
---

Re-sanitizing text that already holds masked credentials (`ghp…b4N`, `Bearer 012…567`) costs close to plain text again (#168). The detection view keeps the `hive-mask` ellipsis instead of turning it into `...`, so a masked log no longer scans the original and the normalized text separately; plain ASCII runs are copied into the view in bulk; a clean result is not inspected a second time; and open-ended credential spans are bounded by findings at the same start instead of by every other finding. 6000 lines with a masked GitHub token went from about 300 KB/s to 1.5–2.9 MB/s, and masked bearer headers from about 46 KB/s to 0.6–0.9 MB/s.
