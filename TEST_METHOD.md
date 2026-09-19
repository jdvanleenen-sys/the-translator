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

---

## Hardening pass 2 — added 2026-09-18 (third cross-brain round)

A second round of independent review (Perplexity and ChatGPT again) confirmed the round-1 fixes and
converged on new items. All are now closed; original tests and pass bars unchanged.

- **amount, positive label (the convergent fatal item):** `amount` now requires a total-labeled line
  (`total`, `amount due`, `balance due`, `balance`, `amount payable`, `grand total`, `amount paid`,
  `total paid`) in addition to forbidding subtotal/tax lines. A fare or line-item number can no
  longer pose as the total; an unlabeled number becomes `not in source`. Pass bar: an amount not on a
  total-labeled line fails `[trace]`.
- **closed cells:** a field cell holds only `value` (and `cite` when filled); any extra key inside a
  cell fails `[shape]`. Pass bar: `{ "value": "6.50", "cite": [4], "approved_by": "x" }` fails.
- **no annotation escape hatch in production:** the underscore-key exemption is gone from output
  validation; the runner strips only the two harness keys (`_fixture`, `_expect_gate`) from a fixture
  before validating it strictly. Pass bar: any `_`-prefixed key in a real output fails `[shape]`.
- **evidence pinning:** `node verify/check.mjs --input <in> --output <out>` requires `out.source_file`
  to resolve to `<in>` and traces against `<in>`, so an output cannot choose its own evidence.

Fixtures grew 16 -> 19: `fail_lineitem-as-amount`, `fail_extra-cell-key`, `fail_annotation-key`.
Verified directly: both reviewers' new exploit outputs (a fare used as amount; an invented key inside
a cell plus an underscore top-level key) now fail, and `--input` rejects a source_file mismatch.

Disclosed limit (not fixed, by design): duplicate JSON keys are resolved last-wins by `JSON.parse`,
as by any standard reader; the checker validates the single saved artifact a judge runs, so there is
no reader-vs-checker discrepancy in the judging flow. Not rejected at the raw-text level. See `README.md`.

---

## Hardening pass 3 — added 2026-09-18 (fourth cross-brain round)

Two independent reviews of v3 converged on the trace primitive: `line.includes(value)` proved a value
appeared *somewhere* on the line, not that it was the line's complete token, so a truncation (`8` of
`8.25`, `14-03` of `14-03-2026`) or an empty string passed. One review also found that in the
non-`--input` mode the output's `source_file` was trusted and a `../` traversal path could point the
evidence outside the repo. Both fixed; originals unchanged.

- **complete-token trace:** numeric/date fields (`amount`, `tax`, `date`) now require the value to be
  a whole token - a match flanked by a digit, decimal, comma, or date separator is rejected. Text
  fields keep substring matching (so `$39.36` and multi-word names still trace). Pass bar: `8` cited
  to `Balance Due 8.25` fails `[trace]`.
- **numeric-shape + empty guard:** `amount`/`tax` must be a printed number (not a word like "Due");
  no filled field may be empty (closing `includes("")`). Pass bar: `""` or `"Due"` as amount fails `[trace]`.
- **path containment:** `source_file` (and any `--input`) must resolve inside the repo; a `../` or
  absolute path fails `[shape]`. Pass bar: `source_file: "../attacker-receipt.txt"` fails even without `--input`.
- **root-object guard:** a non-object top-level output fails `[shape]` explicitly.

Fixtures grew 19 -> 23: `fail_truncated-amount`, `fail_truncated-date`, `fail_empty-amount`,
`fail_traversal-source`. Verified directly: both reviewers' new exploits (amount `8` from
`Balance Due 8.25`; a `../` traversal source_file in unpinned mode) now fail, and the correct market
translation (`amount 8.25`) passes under `--input`.

---

## Self-red-team pass — added 2026-09-18 (three rounds, adversary + fixer)

Between external reviews, ran three rounds of internal adversarial testing: devise hard
(input, output) pairs with an expected verdict, run them, treat any mismatch as a bug, fix, re-test.
Six real bugs found and fixed; each is now a permanent kept-red fixture, and a passing refund receipt
(`inputs/receipts-refund.txt`) locks negative-total handling.

- **Round 1:** currency truncation (`US` of `USD`) and category truncation (`Lodg` of `Lodging`)
  passed - the complete-token rule was only on numeric/date fields. Fixed by extending exact-token to
  currency/category with an **alpha boundary** (so `$` glued to digits still traces). Also a
  legitimate refund total `-5.00` was wrongly rejected; the numeric guard now allows a leading minus.
- **Round 2:** a `Total Tax 5.00` line fed `amount` (forbid list lacked bare `tax`) - added `tax` to
  the amount forbid list. `currency` could capture the amount (`$5.00`) - added a no-digits rule to
  currency.
- **Round 3:** `category` could hold the label word `Category` itself - a require-label field now
  rejects a value equal to one of its own label words.

Fixtures grew 23 -> 28: `fail_truncated-currency`, `fail_truncated-category`, `fail_total-tax-as-amount`,
`fail_currency-has-digits`, `fail_category-is-label`. New disclosed limit: an ambiguous sole-total
label carrying a tax word (`Total incl. tax`) is read by eye; the common `Total Tax` confusion is caught.
Confirmed no regression: the real outputs (with `$`, `EUR`, `Lodging`, and a negative refund) all still pass.

---

## External red-team pass 3 — added 2026-09-18 (root cause: keyword-substring label detection)

A fresh external review submitted eight passing-but-wrong outputs. Root cause, correctly named:
`String.includes(keyword)` proves a keyword is *on the cited line*, not that the extracted value is
*what that keyword labels*. Five were cleanly fixed; three are inherent keyword-ambiguity cases now
disclosed as read-by-eye limits.

Fixed (each now a kept-red fixture, failing through its gate):
- **`Total Savings 40.00` as amount** - added decoy words (savings, discount, tip, gratuity, change,
  rounding, points, loyalty, tender, cash, item(s), qty, quantity, count, unit, coupon) to amount's forbid list.
- **`Auth Ref 12/05/2023` as date** - `date` now forbids auth/ref/reference/card/acct/account/phone/
  expiry/order-no/member/invoice-no lines (legitimate unlabeled and `Invoice` dates still pass).
- **payment-processor footer as vendor** - `vendor` must cite the receipt header (its block's first line).
- **dropped printed currency** - a `currency` marked `not in source` fails when a currency token
  ($/€/£/¥ or a known 3-letter code) sits on a line the record cites.
- **duplicate JSON keys** - rejected at the raw-text level (a repeated key in one object fails `[shape]`).

Disclosed as inherent keyword-ambiguity limits (read by eye): a line with both a grand-total word and a
tax word (`Total incl. tax`); two total-labeled lines (`Total` vs `Total Due`); two printed currencies.

Fixtures grew 28 -> 33. Verified directly: the reviewer's five fixable attacks now fail (each through
its gate) and the three disclosed cases pass as documented. No regression on the four real outputs.

---

## External red-team pass 4 — added 2026-09-18 (root cause: kind assembled across two lines)

A fourth external review (repo cloned, all files read) submitted five new bypasses. Root cause,
correctly named: the checker validated that a value sits on a right-kind line but not that it is the
right instance, and it checked "right kind" with independent existential quantifiers over the whole
citation set plus substring label matching - so kind-membership could be assembled from two different
lines (a subtotal supplying the word "total", a line item supplying cleanliness), and `subtotal`
matched `total`, `taxi` matched `tax`. All five fixed with one architectural change plus targeted rules.

- **Split-citation laundering (headline):** amount `50.00` cited to a line item AND a subtotal passed
  because require/forbid were satisfied on different lines. Fixed: a value's kind is now decided on a
  **single line** - one cited line must hold the value AND carry a require-word AND carry no
  forbid-word. Kills the split for every field.
- **Substring labels:** `"subtotal".includes("total")`, `"taxi".includes("tax")`. Fixed: label
  matching is now **word-boundary** (`total` is not `subtotal`, `tax` is not `taxi`).
- **Vendor by co-citing the header / vendor truncation:** the header guard checked cite membership,
  not source, and vendor had no token rule. Fixed: `vendor` must **equal the header line verbatim**.
- **Check-in date on a hotel folio:** the date denylist missed booking terms. Extended with
  check-in/check-out/valid/arrival/departure/delivery/statement/period/due.
- **Previous-balance-as-amount (torture):** `Previous Balance` carried the require-word `balance`.
  Fixed by removing bare `balance` from the require list (kept `balance due`) and forbidding
  previous/prior/opening/forward.

Fixtures grew 33 -> 39. Verified directly: all five bypasses and the previous-balance torture now fail
(each through its gate); no regression on the four real outputs. Remaining disclosed limits unchanged,
except that *assembling* a kind across two lines is now closed - only two lines that each genuinely
carry the same valid label (e.g. `Total` vs `Total Due`) remain read-by-eye.

---

## External red-team pass 5 — added 2026-09-18 (label present but governing a different number)

A fifth external review sharpened the root cause: the gate confirmed a require-word was on the line
and the value was a token on the line, but never that the value was the number the word *governs*. So
`Total Distance 12.40` (a distance), `Grand Total (order 5567) 40.00` (an order id), and
`TOTAL 59.99 was 89.99` (a pre-discount price) all passed; and currency/amount were validated in
isolation, so a currency could be paired with a different number's value (`27.00 USD` off a
`USD 20.00 (CAD 27.00)` line). All fixed by making the binding **positional**:

- **The required label must GOVERN the value** - sit immediately to its left (after stripping currency
  symbols/codes, punctuation, and a trailing parenthetical). `Total 41.90` binds; `Total Distance
  12.40` does not; `Grand Total (order 5567) 40.00` binds `40.00`, not `5567`. Kills the "Total
  <measure>" family (distance/weight/volume/time) without a denylist.
- **Label gates are allowlists, not denylists.** `date` is now a positional allowlist too: a date must
  be bare or governed by a date label (invoice/issued/sale/...), so a check-in/expiry/auth date is
  rejected regardless of whether its exact word was enumerated.
- **Currency is bound to the amount:** when both are filled and share a cited line, the currency must
  be adjacent to the amount value, so a second currency on the line can't be paired with it.

Fixtures grew 39 -> 43. Verified directly: `Total Distance`, order-id, `was`-price, and currency-mispair
attacks all fail through their gate; the legitimate `40.00` on the `(order 5567)` line still passes;
no regression on the four real outputs.
