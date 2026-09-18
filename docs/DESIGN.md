# Design — The Translator (Comp #13)

The approved design, recorded for the build. Written 2026-09-18.

## Conversion

Receipt(s) described in plain text -> a fixed-shape expense-report record, one line per receipt.
Chosen because it is the most bulletproof conversion against the one disqualifying rule (invented
content): every field is a literal token in the input, so "nothing invented" is provable rather
than argued, and a stranger inhabits the domain instantly.

## Why this wins, not just passes

The comp's named disqualifier is inventing content ("out, not docked"). The retro from the Comp #12
win says: engineer the round's named failure out with a mechanical, offline, stranger-runnable
check that prints its diagnostic, and back it with a recorded human walk. This design does both.

- **Telegraphed bar (table stakes):** #12's shared miss was the half-verified citation - a value
  proven to exist *somewhere* rather than *inside the cited span*. Ported: the trace gate checks
  each value against the specific cited line only, never the whole input.
- **New discriminator:** the derivation trap. Most entrants will treat "computable from the input"
  as grounded (a summed total, a computed tax, a normalized year, an inferred category). The brief
  says every number must *exist* in the input. The three laws (never derive, never assume, never
  drop) plus the trace gate fail all of those loud.

## The category decision (the identity fork)

`category` is filled only when the receipt literally prints one; otherwise `not in source`. A
lookup table (vendor -> category) was considered and rejected: even a published, deterministic
remap adds a label not in the source, and against a binary disqualifier you do not gamble the
entry on a judge accepting "derived" as "not invented." The refusal to categorize by guessing is
turned into the entry's headline demo of the brief's thesis.

## Architecture (forked from the-auditor)

- **Schema-driven checker.** `verify/check.mjs` reads the fields, order, and roles from
  `reference/<id>/schema.json`. Point it at a different `reference/<id>/` and it translates a
  different conversion with no code change - the auditor's cartridge pattern, repointed. One
  conversion ships, to keep the entry tight and avoid README accretion (the named #12 debt).
- **Four gates:** shape, trace (span-scoped), coverage (nothing dropped), kept-red fixtures.
- **`line_no` is structural**, exempt from the trace gate, defined as the record's own row index
  so a judge cannot read it as an invented number.
- **Coverage** exempts blank lines and bare `---` separators; every other input line must be cited
  or explicitly unmapped.

## Playbook receipts

Frozen `TEST_METHOD.md` before `RESULTS.md` (commit order proves it); `.gitattributes eol=lf` and
a fresh-clone run; a PII guard in CI on `inputs/`; and a recorded human walk (Jeff's action, with
honest disclosure of the walker's relationship to the author).

## Honest limit

A `not in source` field whose value sits on a line another field already cites is not caught
mechanically. Disclosed in `README.md` and `TEST_METHOD.md` rather than hidden.

## Hardening pass (2026-09-18, after two cross-brain reviews)

Perplexity and ChatGPT, run independently, converged on one weakness: the checker proved lexical
provenance (the value is on the cited line) but not semantic mapping (it is the right value, from
the right kind of line, in the right field). Both reproduced the correct rideshare output and
confirmed the shipped outputs were clean, so the instructions held; the gap was in the checker's
strength claim. Response: line-kind trace (category/tax label-scoped, amount not from a subtotal/tax
line, date must be date-shaped), single-line containment, a closed envelope (no stray keys,
conversion pinned to the schema id, field order enforced), block-scoped citations, controlled
`unmapped_input_lines` reason codes, and per-fixture intended-gate assertion. Fixtures grew 8 -> 16.
The reviewers' own exploit outputs now fail. This deepens the #12-winning move: the mechanical gate
now engineers out semantic mis-mapping, not just invention. `vendor` semantic correctness remains a
disclosed reading-only limit (a vendor name is free text).

## Hardening pass 2 (2026-09-18, third cross-brain round)

A second review round confirmed round-1 and converged on: `amount` was a blacklist (forbid
subtotal/tax) without a positive total-label requirement, so a fare could pose as the total; a cell
object could carry invented keys; underscore keys leaked past validation; and `source_file` was not
externally pinned. Fixes: `amount` now requires a total-labeled line (unlabeled -> `not in source`);
cells are closed to `value`/`cite`; the annotation exemption is removed from production (only the two
harness keys are stripped from fixtures); and `--input` binds the evidence file so an output cannot
choose its own input. Fixtures 16 -> 19. Both reviewers' new exploits now fail. Disclosed limit:
duplicate JSON keys resolve last-wins as in any reader, so the single judged artifact has no
reader-vs-checker gap; not rejected at raw-text level.

## Hardening pass 3 (2026-09-18, fourth cross-brain round)

Two independent v3 reviews converged on the last structural class: the trace primitive was substring
containment, so a truncated numeric/date value (`8` of `8.25`) or an empty string passed; and in the
unpinned mode an output's `source_file` could use a `../` traversal to prove claims from outside the
repo. Fixes: complete-token matching for numeric/date fields (flank-char boundary), a numeric-shape
and empty-value guard, repo-containment for `source_file`, and an explicit root-object-type guard.
Fixtures 19 -> 23. Both reviewers' exploits now fail; one reviewer stated it saw no remaining
structural escape hatch. The residual limits are `vendor` (free text, read-verified), a `not in
source` sharing a cited line, and duplicate JSON keys (last-wins, no reader-vs-checker gap).

## Self-red-team pass (2026-09-18, three internal rounds)

Between external reviews, three rounds of internal adversarial testing (devise hard pairs -> run ->
fix -> re-test) found and fixed six bugs: currency/category truncation (extended complete-token to
text fields with an alpha boundary), a wrongly-rejected refund total (numeric allows a leading minus),
a `Total Tax` line feeding amount (added `tax` to amount forbid), currency capturing the amount
(no-digits on currency), and category holding its own label word (require-label value may not be a
label word). Fixtures 23 -> 28; a passing refund receipt locks negative handling. No regression.

## External red-team pass 3 (2026-09-18, keyword-substring root cause)

A fresh external review submitted eight passing-but-wrong outputs, correctly diagnosing the root:
`String.includes(keyword)` proves a keyword is on the cited line, not that the value is what the
keyword labels. Five fixed - amount decoy-forbid (`Total Savings`), date forbid (`Auth Ref`), vendor
must be the block header (processor footer), currency-drop detection (dropped `CAD`), and raw-text
duplicate-key rejection. Three disclosed as inherent keyword ambiguity (read by eye): a line with both
a total and a tax word (`Total incl. tax`), two total-labeled lines, and two printed currencies.
Fixtures 28 -> 33; no regression.

## External red-team pass 4 (2026-09-18, kind-assembly root cause)

A fourth external review submitted five bypasses whose root cause was that the checker quantified
require/forbid independently over the citation set (so a kind could be assembled from two lines) and
matched labels as substrings (`subtotal`⊃`total`, `taxi`⊃`tax`). Fixed with one architectural change -
a value's kind is decided on a **single cited line** that must hold the value, carry a require-word,
and carry no forbid-word - plus **word-boundary** label matching, **vendor = header line verbatim**, an
extended date denylist (check-in/check-out/valid/...), and dropping bare `balance` from amount's
require list. Fixtures 33 -> 39; all five bypasses and the previous-balance torture now fail; no
regression. Only genuinely-ambiguous same-label multiples (`Total` vs `Total Due`) remain read-by-eye.

## Done (one sentence)

One translator folder plus a forked checker that proves the output shape holds across three
different receipt-text inputs, every filled field traces to the specific input line it cites, and
eight invention fixtures fail as required - with a frozen method file, a recorded human walk, and a
fresh-clone-green public repo. Zero invented facts.
