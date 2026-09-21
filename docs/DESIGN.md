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

## Hardening

The design held through sustained adversarial hardening — self- and external cross-brain red-team, then
an independent cold-eyes entry audit. Four attack classes were found and closed at the root: currency
attribution, meaning-inverting label collisions, numeric-locale tokenization, and accept-vs-guard drift,
with two independent convergence confirmations. The full round-by-round record — root cause, fix, and the
fixture that locks each — is in `../RESULTS.md`.

## Done

One translator folder plus a forked, conversion-agnostic checker: the output shape holds across diverse
receipt inputs (including two real photographed receipts), every filled field traces to the specific
input line it cites, and every kept-red invention fixture fails through its declared gate — backed by a
frozen method file, a fresh-clone-green public repo, CI on every push, and a recorded human walk (Jeff's
action). Zero invented facts.
