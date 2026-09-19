# RESULTS — recorded 2026-09-18

The run of the method frozen in `TEST_METHOD.md`. Method was committed first; this log follows.

- Frozen method commit: `8bfb3bf` (Freeze TEST_METHOD.md before recording any results)
- Build under test:      `29423cf` (checker, three inputs, outputs, eight fixtures)
- Command:               `node verify/check.mjs`
- Node:                  v24 (CI also runs Node 20; see `.github/workflows/verify.yml`)
- Exit code:             0

## Output

```
--- schema: expense-report (Expense report line items) ---
ok: verify/outputs/receipts-coffee.json (1 line(s))
ok: verify/outputs/receipts-hardware.json (2 line(s))
ok: verify/outputs/receipts-hotel.json (1 line(s))
ok (failed as required): verify/fixtures/fail_assumed-currency.json
ok (failed as required): verify/fixtures/fail_computed-total.json
ok (failed as required): verify/fixtures/fail_dropped-line.json
ok (failed as required): verify/fixtures/fail_false-not-in-source.json
ok (failed as required): verify/fixtures/fail_inferred-category.json
ok (failed as required): verify/fixtures/fail_invented-year.json
ok (failed as required): verify/fixtures/fail_missing-field.json
ok (failed as required): verify/fixtures/fail_phantom-vendor.json

RESULT: all outputs traced clean, all fixtures failed as required.
```

## Against the pass bars

1. **Shape holds across different inputs** — PASS. All three outputs (1, 2, and 1 lines) have all
   seven fields in order; empties are `not in source`.
2. **Trace (span-scoped)** — PASS. Every filled value sits on its cited line.
3. **Coverage (nothing dropped)** — PASS. Every non-blank input line is cited or listed unmapped.
4. **Kept-red fixtures** — PASS. All eight failed, each for its intended gate (verified per-fixture
   with `--output`: five trace, two coverage, one shape).
5. **Fresh-clone green** — recorded separately in this file's fresh-clone section once run.

## Per-fixture gate confirmation

Each fixture was run alone to confirm it fails for the gate it targets, not incidentally:

| fixture | gate | diagnostic |
|---|---|---|
| fail_computed-total | trace | `amount` value 12.00 not on cited line "Total 6.50" |
| fail_inferred-category | trace | `category` "Meals" not on cited line "Blue Ridge Coffee Co" |
| fail_assumed-currency | trace | `currency` "USD" not on cited line "Total 6.50" |
| fail_invented-year | trace | `date` "2026-01-03" not on cited line "Jan 3" |
| fail_phantom-vendor | trace | `vendor` "...Company" not on cited line "...Co" |
| fail_dropped-line | coverage | input line 3 neither cited nor unmapped |
| fail_missing-field | shape | field "tax" absent from the line object |
| fail_false-not-in-source | coverage | input line 2 ("Jan 3") unaccounted behind a hollow `not in source` |

## Fresh-clone verification

Recorded 2026-09-18. A clean `git clone` of the repo into a fresh directory (no local state) was
run with `node verify/check.mjs`.

- `file` on the checked-out files reports LF text (ASCII / UTF-8), no CRLF - `.gitattributes
  eol=lf` held on checkout.
- `node verify/check.mjs` on the fresh clone exited `0`: all three outputs traced clean, all eight
  fixtures failed as required.

This is the standing gate that catches a verify command which only works with local state (it cost
an entrant a tier in Comp #12, and caught a CRLF bug in ours the same cycle).

---

## Hardening run — 2026-09-18 (v2, after the TEST_METHOD hardening addendum)

Ran `node verify/check.mjs` after the semantic-mapping hardening. Exit 0.

- 3 outputs traced clean.
- 16 fixtures each failed **through the gate it declares** (`_expect_gate`): 9 via `[trace]`, 3 via
  `[shape]`, 2 via `[coverage]`, 2 via `[block]`.
- Fresh clone (no local state) of the hardened repo: `node verify/check.mjs` exited 0.

### The two reviewer exploits, run directly against the hardened checker

Both were constructed by the reviewers as outputs that passed the old checker. Both now fail:

- **ChatGPT Break-A** (subtotal `20.00` used as `amount` while `Total 21.00` exists; `date: "Total"`):
  fails with `[shape]` conversion, `[trace]` date-not-date-shaped, `[trace]` amount-from-forbidden-line,
  and `[coverage]` dropped lines.
- **Perplexity Bypass-1** (line item into `category`, loyalty points into `tax`, extra keys, bad
  conversion): fails with `[trace]` category-not-labeled, `[trace]` tax-not-labeled, and three
  `[shape]` errors (conversion, extra top-level key, extra line key).

Both reviewers also ran the live cross-brain test (translate the unseen rideshare receipt using only
the contract) and independently produced the correct, invention-free output.

---

## Hardening run — 2026-09-18 (v3, after the second cross-brain round)

A second review round confirmed the round-1 fixes and found new items (amount blacklist-not-whitelist,
invented key inside a cell, underscore-key leak, source_file not externally pinned). All closed. Ran
`node verify/check.mjs` after the fixes. Exit 0.

- 3 outputs traced clean.
- 19 fixtures each failed through its declared gate (10 `[trace]`, 5 `[shape]`, 2 `[coverage]`, 2 `[block]`).
- Fresh clone of the hardened repo: exit 0.

### The new reviewer exploits, run directly against the v3 checker

- **Perplexity fare-as-amount** (`amount: 18.40` from `Fare 18.40` while `Total CAD 16.42` exists):
  fails `[trace]` - amount not on a total-labeled line.
- **ChatGPT cell-key + underscore injection** (`amount: {value, cite, approved_by_manager}` plus a
  top-level `_invented` key): fails `[shape]` on both the nested cell key and the underscore key.
- **Evidence pinning:** `--input inputs/receipts-coffee.txt --output <hotel output>` fails `[shape]`
  (source_file mismatch); `--input` matching the output passes. An output cannot choose its own input.

Both reviewers again produced the correct rideshare translation from the contract alone.

---

## Hardening run — 2026-09-18 (v4, after the third cross-brain round)

Two independent v3 reviews converged on the trace primitive (substring, not complete-token, so a
truncated amount/date or empty string passed) and one added an evidence-authority gap (a `../`
traversal `source_file` in the unpinned mode). Both closed. Ran `node verify/check.mjs` after the fix.
Exit 0.

- 3 outputs traced clean.
- 23 fixtures each failed through its declared gate (14 `[trace]`, 5 `[shape]`, 2 `[coverage]`, 2 `[block]`).
- Fresh clone: exit 0.

### The new reviewer exploits, run directly against the v4 checker

- **Truncated amount** (`amount: "8"` cited to `Balance Due 8.25`): fails `[trace]` - not a complete
  token. Empty-string and `"Due"` amounts fail the same gate.
- **`../` traversal source_file** (unpinned mode, output names `../attacker-receipt.txt`): fails
  `[shape]` - evidence must resolve inside the repo.
- **Correct market translation** (`amount: "8.25"` from `Balance Due 8.25`, bare `7.30` left unmapped,
  no inferred category/currency): passes under `--input`.

Both reviewers also produced the correct market translation from the contract alone (`amount 8.25`,
not the bare `7.30`; date kept as `14-03-2026`).

---

## Self-red-team run - 2026-09-18 (v5, three internal adversarial rounds)

Three rounds of internal attack (hard input/output pairs with expected verdicts) surfaced six real
bugs, all fixed and locked as fixtures; a passing refund receipt locks negative-total handling.

- Round 1: currency/category truncation passed (fixed: alpha-boundary exact-token); refund `-5.00`
  wrongly failed (fixed: numeric allows leading minus).
- Round 2: `Total Tax` fed amount (fixed: `tax` added to amount forbid); currency captured the amount
  (fixed: no-digits on currency).
- Round 3: category held its own label word `Category` (fixed: require-label value may not be a label word).

Final: 4 outputs traced clean (coffee, hardware, hotel, refund), 28 fixtures each failing through its
declared gate, fresh-clone green, CI green on GitHub. No regression - the outputs using `$`, `EUR`,
`Lodging`, and a negative refund all still pass.

---

## External red-team run - 2026-09-18 (v6, eight submitted passing-but-wrong outputs)

A fresh external review submitted eight outputs that passed the v5 checker while misstating the
receipt. Root cause: keyword-substring label detection. Five fixed, three disclosed. Suite re-run green.

- 4 outputs clean; 33 fixtures each through its declared gate; fresh-clone green; CI green.

### The reviewer's eight, run directly against v6

- **Fixed, now fail:** `Total Savings` as amount (`[trace]` forbid), `Auth Ref` as date (`[trace]`
  forbid), payment-processor footer as vendor (`[trace]` header rule), dropped `CAD` currency
  (`[trace]` currency-drop), duplicate `amount` keys (`[shape]` duplicate-key).
- **Disclosed as inherent keyword-ambiguity (pass, documented in README):** `Total incl. tax` claimed
  as tax; two totals (`Total` vs `Total Due`); two currencies collapsed to one. These are read by eye;
  the clear decoys are caught.

Reviewer's own negative controls (OCR garble, cross-block theft) fail correctly, as they did before.

---

## External red-team run - 2026-09-18 (v7, five submitted bypasses, kind-assembly root cause)

A fourth external review submitted five passing-but-wrong outputs whose root cause was kind-membership
assembled across two cited lines, plus substring label matching. One architectural fix (single-line
conjunction) plus word-boundary labels, vendor-verbatim-header, an extended date denylist, and a
require-list tweak closed all of them. Suite re-run green.

- 4 outputs clean; 39 fixtures each through its declared gate; fresh-clone green; CI green.

### The reviewer's five bypasses + the previous-balance torture, run directly against v7

All now fail, each through `[trace]`:
- split-citation amount (subtotal laundered by a clean line) - no single line is the right kind.
- taxi fare as tax - `taxi` no longer matches `tax` (word boundary).
- processor footer as vendor (co-citing the header) - vendor must equal the header verbatim.
- truncated vendor (`WALMART` of `WALMART SUPERCENTER`) - same.
- check-in date on a hotel folio - date denylist extended.
- previous balance (900.00) as amount - `balance` dropped from the require list; `previous` forbidden.

---

## External red-team run - 2026-09-18 (v8, positional binding)

A fifth external review showed the label was checked as present-on-line, not as governing the value.
Fixed with positional binding (the required label must sit immediately before the value), allowlist
label/date gates, and currency-must-be-adjacent-to-amount. Suite re-run green.

- 4 outputs clean; 43 fixtures each through its declared gate; fresh-clone green; CI green.

### The reviewer's new attacks, run directly against v8 (all fail `[trace]`)

- `Total Distance 12.40` as amount - the label governs "distance", not the money.
- order id `5567` on `Grand Total (order 5567) 40.00` as amount - and the legitimate `40.00` still passes.
- `was` pre-discount price `89.99` (`TOTAL 59.99 was 89.99`) as amount.
- currency `CAD` paired with the USD amount `20.00` on a two-currency line - currency must be adjacent to the amount.

---

## Self-red-team run - 2026-09-18 (v9, under-reporting + currency source + a false-positive)

Three internal rounds probing classes the external rounds missed. Suite re-run green.

- 5 outputs clean (added an item-count total that must not be false-rejected); 47 fixtures each through
  its gate; fresh-clone green; CI green.
- **Under-reporting fixed:** amount/tax/category marked `not in source` while the receipt prints them
  (dumped to `unmapped`) now fail `[trace]`; the legit "only a Total Distance, no money total" case
  still yields `not in source`.
- **Currency source fixed:** a currency lifted from a disclaimer while the total is in another currency
  fails `[trace]`; a header currency-declaration with a bare total still passes.
- **False-positive fixed:** `Total 40.00 (10 items)` (a legit total mentioning an item count) was being
  rejected by the amount forbid-list; positional binding subsumes that list, so it was removed - decoys
  stay rejected and the item-count total passes.

---

## Self-red-team run - 2026-09-18 (v10, date-shape: an NN.NN amount read as a date)

One internal round on the date field's shape check. Suite re-run green.

- 5 outputs clean; 48 fixtures each through its gate; fresh-clone green; CI green.
- **Date-shape fixed:** `looksLikeDate` treated a 2-part `NN.NN` as a date when both parts fell in
  month/day ranges (`12.30` reads as Dec 30), and the date gate accepts a bare line as date-context - so
  an amount printed alone on its own line could be parked in the `date` field and pass `[trace]`. The
  existing `fail_number-as-date` fixture used `20.00` (not date-shaped), so this ambiguous decimal case
  was never exercised. Fix: the 2-part date matcher no longer accepts `.` as a separator (a 2-part
  `NN.NN` is an amount; dotted 3-part dates like `14.03.2026` still match the 3-part rule). New fixture
  `fail_amount-as-date` (`12.30` on a bare line, parked in date) fails `[trace]`.

---

## Overnight hardening run - 2026-09-18 (v11, sustained self-red-team + comp-11/12 feedback re-read)

A long autonomous adversarial pass, plus a re-read of the comp-11 and comp-12 judge feedback aimed at
the silent-fail class both prior comps punish. Six new kept-red fixtures; each change tested and
committed separately; suite green throughout (5 outputs; fixtures 49 -> 55).

- **F1 label completeness.** Added `Total Amount` / `Total Payable` and a trailing `included`/`incl`
  modifier, so `Total Amount 40.00`, `Total Payable 40.00`, and `GST included 0.42` are accepted. The
  same shared list closes the dangerous half: a printed `Total Amount` can no longer be marked
  not-in-source and dropped. Decoys (`Total Distance`/`Total Savings`, `Subtotal`, `Taxi`) still reject.
  Fixture `fail_total-amount-dropped`.
- **Two silent-fails closed (the class the brief and both prior comps punish).** `date` and `vendor`
  had no drop guard: a printed transaction date and the merchant header could be dumped to `unmapped`
  and pass. Extended `fieldDropCheck` to date (labelled or bare, using the same `looksLikeDate` +
  `dateContextOk` the accept rule uses, so a check-in-only receipt still correctly yields not-in-source)
  and vendor (the header is the merchant). Fixtures `fail_date-dropped`, `fail_vendor-dropped`.
- **Currency launder (wrong-but-green).** A currency lifted from ad copy passed when the total line had
  no adjacent currency. `currencySourceCheck`: a filled currency must be adjacent to the amount, on a
  currency-declaration/monetary line, or a bare code line - still allowing `All prices in JPY`. Fixture
  `fail_currency-laundered`.
- **Ambiguity as first-class (wrong-but-green).** Two distinct totals let the output pick one.
  `amountAmbiguityCheck`: >1 distinct total -> amount must be not-in-source, reconciled with the
  under-reporting guard (amount-drop fires only when exactly one total is printed, so no deadlock).
  Fixture `fail_ambiguous-total`.
- **Robustness (false-negatives that rejected correct receipts).** A leading/trailing/double `---` no
  longer manufactures a phantom receipt; the merchant header may sit under a `CUSTOMER COPY` / `THANK
  YOU` preamble (bounded whole-line skip that cannot skip the real merchant). Fixture `fail_preamble-skip`.
- **Docs.** Published `reference/expense-report/input-grammar.md` (accepted input + stated limits);
  `rules.md` gained a fail-closed self-check step and the two-distinct-totals rule; F3 doc drift fixed
  (total-label list aligned to the schema; bare `Balance` removed).

Cross-check vs comp-11 + comp-12 feedback: all four judged criteria met; the silent-fail / "quiet
failure" class is now guarded on every field. Open weighted item: the recorded human outsider walk (a
bonus lever, not a rules requirement). Disclosed limit (not closed): cross-line labels (label on one
line, value on the next) are refused as not-in-source rather than stitched - a fidelity-safe refusal.

---

## Competition-tester run - 2026-09-18 (v10, hostile pre-submission)

A hostile pre-submission verification found one wrong-but-green path and closed it; suite re-run green.

- 5 outputs clean; 49 fixtures each through its declared gate; fresh-clone green; CI green.
- **Fixed:** on a cash-rounding receipt (`Total 22.94` + `Total Due 22.95`) the checker accepted
  `amount 22.94` (misattributed - the owed amount is 22.95). Added `total due` to the recognized
  totals and a final-total priority gate; the wrong total now fails `[trace]`, the correct `Total Due`
  passes. Locked as `fail_wrong-total-instance`.
- **Confirmed safe:** `Total incl. tax`, `You saved`, plain-Total-over-Grand-Total, and a
  statement-period date all fail or refuse rather than ship an invented/misattributed fact.
