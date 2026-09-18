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

## Done (one sentence)

One translator folder plus a forked checker that proves the output shape holds across three
different receipt-text inputs, every filled field traces to the specific input line it cites, and
eight invention fixtures fail as required - with a frozen method file, a recorded human walk, and a
fresh-clone-green public repo. Zero invented facts.
