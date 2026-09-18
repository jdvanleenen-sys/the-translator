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

## Hardening pass — added 2026-09-18 (after the original freeze above)

The original method (frozen earlier this day) stands. This section is a dated method change, not an
edit to it, prompted by two independent cross-brain reviews (Perplexity and ChatGPT) that both named
the same weakness: the trace gate proved a value sat on its cited line but not that it came from the
right KIND of line. The following gates and fixtures were added; the original tests and pass bars are
unchanged.

New gates (all still offline, in `node verify/check.mjs`):
- **trace, line-kind:** `category` must be sourced from a category-labeled line; `tax` from a
  tax-labeled line; `amount` must NOT be sourced from a subtotal or tax line; `date` must be
  date-shaped. Pass bar: a value on the wrong kind of line fails.
- **trace, single-line:** the value must sit in one cited line, not a synthetic join of several.
- **shape, closed envelope:** no stray keys at any level; `conversion` must equal the schema id;
  field order must match the schema; `unmapped_input_lines[].code` must be one of the controlled
  reason codes; a `note`, if present, must quote its line.
- **block:** one output line per `---` receipt block, and a line's citations must stay inside its block.

Fixtures grew from 8 to 16, and each now declares an `_expect_gate`; the runner asserts each fixture
fails **through its intended gate**, not merely for some reason. New fixtures: `fail_subtotal-as-amount`,
`fail_tax-from-non-tax-line`, `fail_item-as-category`, `fail_number-as-date`, `fail_cross-line-value`,
`fail_extra-field`, `fail_wrong-conversion`, `fail_cross-block-citation`, `fail_dropped-receipt`.

Also verified directly: the two exact exploit outputs the reviewers constructed (subtotal-as-amount
with `date: "Total"`; wrong-field mapping with extra keys and a bad conversion) now both fail.

New known limit (stated with the change): `vendor` is free text, so the checker cannot prove the
cited line is the merchant line rather than other text; that one field is verified by reading.
Disclosed in `README.md`.
