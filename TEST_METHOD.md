# TEST_METHOD — frozen 2026-09-18

This file is frozen. It states what is tested and the pass bar for each test, written before the
results were recorded. The method does not change to fit the outcome. Results are logged in
`RESULTS.md`; if a test later needs to change, the change is a new dated commit, not an edit here.
Commit order (this file before `RESULTS.md`) is the proof the receipts were not shaped backward.

## What is being tested

The claim: this translator converts receipt text to a fixed-shape expense-report record, and every
value in every output either sits on the input line it cites or is marked `not in source`. Nothing
is invented, nothing is dropped silently.

## The tests

All run offline by `node verify/check.mjs`, no dependencies beyond Node.

1. **Shape holds across different inputs.** Three different real inputs (`inputs/receipts-coffee`,
   `-hardware`, `-hotel`) produce outputs in `verify/outputs/`. Pass bar: every output line has all
   seven schema fields, in schema order, and every empty field is the exact string `not in source`.

2. **Trace (span-scoped citation).** Pass bar: for every filled field in every output, the value
   (after light normalization) is a substring of the specific cited input line(s) - not merely
   present somewhere in the input. A value not on its cited line fails.

3. **Coverage (nothing dropped).** Pass bar: every non-blank, non-`---` input line is either cited
   by some field or listed in `unmapped_input_lines` with a reason. An unaccounted line fails.

4. **Kept-red fixtures.** Eight outputs in `verify/fixtures/fail_*.json` each plant exactly one
   invention. Pass bar: every one MUST fail the checker, each for its intended gate. If any passes,
   the gate it tests is dead. The eight:
   - `fail_computed-total` (trace) - a total not printed on its cited line
   - `fail_inferred-category` (trace) - a category inferred from the vendor
   - `fail_assumed-currency` (trace) - a currency assumed from locale
   - `fail_invented-year` (trace) - a year added to a bare month/day
   - `fail_phantom-vendor` (trace) - a vendor expanded to its usual spelling
   - `fail_dropped-line` (coverage) - a line neither cited nor unmapped
   - `fail_missing-field` (shape) - a field absent from the line object
   - `fail_false-not-in-source` (coverage) - a hollow `not in source` skipping an own-line value

5. **Fresh-clone green.** Pass bar: a clean `git clone` of the repo, with no local state, runs
   `node verify/check.mjs` to exit 0. Line endings are pinned to LF (`.gitattributes`) so a
   Windows clone cannot introduce a CRLF discrepancy.

## Known limit (stated before results, not after)

A field marked `not in source` whose value sits on a line another field already cites is not caught
mechanically (coverage still sees the line as accounted for). It is caught by reading. Disclosed in
`README.md`.

## Not covered by the mechanical checker

The recorded human walk (a non-technical person tracing an output field back to the input by hand,
on tape) is a separate receipt, added when recorded. Any relationship between the walker and the
author is disclosed up front.

---

## Evolution since the freeze

The frozen method above held. Later hardening added gates (field-kind and positional/label binding,
currency-on-the-total, the meaning-inverting label-collision class, numeric-locale tokenization, and
graceful decline on malformed output) and grew the kept-red fixtures from the original 8 to 92 — each via
a dated commit, never an edit to the frozen section above, so commit order still shows the method was not
shaped to the outcome. The full round-by-round record — every root cause, the fix, the fixture that locks
it, and the convergence check — is in `RESULTS.md`. Current state: 23 outputs (including two real
photographed receipts) and 92 fixtures, all green; a fresh `git clone` runs `node verify/check.mjs` to
exit 0, and CI runs it on every push.
