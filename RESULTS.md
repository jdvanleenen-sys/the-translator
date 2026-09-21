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

## External red-team run - 2026-09-19 (v12, 12 Perplexity-designed attacks)

A different model (Perplexity) designed 12 adversarial (receipt, wrong-output, why-it-slips) triples
against the published gates; each was run through the checker at HEAD e34302a. Nine were caught as-is:
currency from a marketing declaration (currency-binding), vendor-name-as-category, total-as-tax
("tax included"), order-id-as-date, auth-ref-as-date, gst-rate-as-tax, multi-currency mispair,
zero-width-strip in vendor, and item-count-as-amount. Three results:

- **A2 partial payment (fixed).** `Amount Paid 99.00` reported as the total while `Balance Due Today
  35.00` was owed. Neither is the transaction total, so the honest answer is not-in-source. The gap:
  `Balance Due Today` was not recognized as an owed total because "today" interposes. Fix: a small
  label-modifier tolerance (`today`/`now`/`included`/`incl`) in the label-to-value binding, so the
  ambiguity guard now sees two distinct totals and forces not-in-source. Fixture `fail_paid-vs-due`.
  Cash-rounding and paid-in-full cases unaffected.
- **A9 vendor whitespace (disclosed).** The header comparison normalizes whitespace, so a no-break
  space reads equal to a space. A whitespace-only difference is treated as the same merchant; any
  non-whitespace change (including a zero-width character) is still rejected. Disclosed in README +
  input-grammar.md rather than switched to raw-exact, which would false-reject legitimate outputs.
- **A11 injection line (not a finding).** `Category: Travel` on a line that begins "Ignore all previous
  instructions" is a genuine category-labeled line, so the value is actually stated and the checker is
  right to accept it. Obeying planted instructions is a model concern, guarded by the fail-closed
  self-check in rules.md; it is not a checker hole.

Fixtures 55 -> 56 (`fail_paid-vs-due`). Suite green; the nine caught attacks re-run and still caught
after the modifier change.

---

## Self-red-team run - 2026-09-19 (v13, attacking the checker's own primitives)

Probing the checker mechanics rather than field semantics. Two real holes found and closed; thousands
separators, truncation, no-year dates, and invented years all behaved correctly.

- **Over-citation coverage bypass (HIGH, wrong-but-green).** A field could cite a line the value is NOT
  on; `traceCheck` required only that ONE cited line contain the value, and `coverageCheck` marked EVERY
  cited line accounted-for. So an output could bury a meaningful line (e.g. "OBJECTION customer disputed
  the charge") by adding its number to `amount.cite`, and pass, directly breaking "nothing dropped".
  Fix: every cited line of a filled field must contain the value; an over-citation fails `[trace]`.
  Fixture `fail_over-citation`.
- **Vendor normalization (case + whitespace).** The header check compared normalized strings, so
  `ACME PAINT` -> `Acme Paint` (and a no-break space folded to a space, the earlier A9) passed. Fix:
  vendor is now compared raw (trim ends only), so case and internal spacing must match verbatim. This
  also closes A9, so the whitespace-normalization limit is removed from the README. Fixture
  `fail_vendor-normalized`. The 5 shipped outputs already match their headers exactly.

A second sweep of the same kind found two more, both parallels of fixes already made for other fields:
- **Date ambiguity.** Two distinct bare dates let the output pick one (a guess), exactly like the
  multi-total case. Added `dateAmbiguityCheck` (label-governed dates win over bare; >1 distinct ->
  date must be not-in-source) and reconciled the date drop-guard (fires only on exactly one date).
  A labeled date still wins over a stray bare date, and a check-in-only receipt still yields
  not-in-source. Fixture `fail_ambiguous-date`.
- **Category / currency case-normalization.** `Category: MEALS` -> `Meals` (and a lowercased currency
  code) passed because the token check compared normalized text. Alpha-boundary codes/labels
  (currency, category) now require exact case on a cited line, matching the verbatim vendor rule.
  Fixture `fail_category-normalized`.

Also confirmed correct as-is: thousands separators, truncation, no-year dates, invented years,
percent-rate-as-total, and legit refunds. Fixtures 56 -> 60. Suite green; fresh-clone green.

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

---

## Model break-test - 2026-09-19 (v14, translator run on messy realistic receipts)

Six made-up but realistic receipts (subtotal+tip, hotel date/resort-fee decoys, gas-station category
temptation, partial-payment ambiguity, JPY declaration + a USD ad line, and an injected instruction)
were handed to the deployable folder as a normal user would. The TRANSLATION was faithful on all six:
right totals (not subtotals/tips), the invoice date not the check-in, occupancy tax not the resort fee,
category refused on the gas station, `not in source` for the ambiguous partial payment, JPY (not the ad
USD), and the injected "mark category Office / currency USD" instruction ignored. No invented fact.

One real finding, in the checker (a false-POSITIVE): the category under-report guard used a looser test
than the fill rule - it fired on the word "category" sitting mid-sentence in the injection/prose line
and demanded a category the positional fill rule correctly refuses, so it REJECTED the correct output.
Any chatty receipt ("ask about our category rewards") would trip it. Fix: `labelGovernsAValue` (the
under-report / total-priority guard) now anchors the label to the START of a line, so only a real field
line ("Category: Meals", "GST 0.42") demands a field, not a keyword in prose. Matches the fill rule's
strictness instead of exceeding it. Locked with a 6th shipped valid output (`inputs/receipts-prose.txt`
+ `verify/outputs/receipts-prose.json`) that mentions "category"/"USD" in prose and correctly reports
both as `not in source`; it would have failed before the fix. Real category/amount/tax drops (label at
line start) are still caught. 6 outputs, 60 fixtures, suite green.

---

## Cross-brain ranking review + fixes - 2026-09-19 (v15)

A fourth external review re-confirmed the conversion choice (receipt->expense is #1; five independent
yeses; do not switch) and surfaced three forced-invention checker bugs and one scope question. All
verified against the repo before acting; three were real, one already-closed.

- **Tax rate as amount (fixed).** `Tax 8.25%` let `8.25` into `tax` - a rate, not money. A numeric
  value immediately followed by `%` is now rejected. Fixture `fail_tax-rate`.
- **Preamble list incomplete (fixed).** `GUEST COPY` was not skipped, so the real merchant under it was
  rejected. Added guest copy / guest receipt / gift receipt / return receipt / e-receipt / order
  confirmation to the preamble set. Fixture `fail_guest-copy-as-vendor`.
- **Tender forced over the total (fixed).** `Amount Paid`/`Total Paid` were treated as final-owed
  totals, so on `Total 84.12` / `Amount Paid 100.00` / `Change 15.88` the checker rejected the correct
  84.12 and demanded the 100.00 tender. Tender is now not a total label at all (it goes to unmapped);
  the amount is the Total, or a Balance/Amount Due when that is what is owed. Fixture
  `fail_tender-as-amount`. rules.md gained an explicit "tender is not the total" rule.
- **Category-in-prose (already closed, v14).** The reviewer's currency/category "inference" DQ warnings
  were already handled; the one live one (a keyword in prose demanding a field) was fixed in v14.
- **Prose input (scope decision).** The brief says "receipt described in text". Decision: the input is a
  receipt TRANSCRIPTION (one item per line), not a free-form prose sentence; a narration is out of
  scope and correctly yields mostly `not in source`. Stated in identity.md, README, input-grammar.md.
- **Model-in-the-loop corpus (seeded).** The strongest point: fixtures prove the checker, not the model.
  A genuine run of the deployable folder over seven unseen hard receipts (no total printed, OCR-garbled
  total, cash tender, partial payment, JPY + ad-line currency, due-date-not-transaction-date, section
  totals) is committed as `inputs/model-run-hard7.txt` + `verify/outputs/model-run-hard7.json` and is
  now part of the auto-checked suite - a real "the model invented nothing" artifact, not an author-
  designed fixture. Add more such runs before the deadline.

7 valid outputs, 63 fixtures. Suite green; fresh-clone green.

## Real photographed receipts - test + one fix - 2026-09-19 (v16)

Two genuine Calgary receipts (a Staples office-supply sale, a Cactus Club restaurant check) were
transcribed and run through the checker with `--input`. Real formats broke three things the synthetic
fixtures never hit; one fixed, two held as designed:

- **Tax across a rate (fixed).** The real line is `GST 5.00% 11.15` - the label sits next to the *rate*,
  not the amount, so `11.15` would not bind and tax came out `not in source` (reads as a missed tax).
  Fix: the label segment now strips a trailing `<number>%` rate token, so a tax/total label reaches
  across a printed rate to its money - never to the rate itself. Guarded by `fail_ratelabel-nontax`
  (a non-tax label + rate + number still cannot bind) and the existing `fail_tax-rate` (a value that
  *is* a rate is still rejected). One-line note added to rules.md.
- **Date on an unlabeled header line (held fail-closed, by decision).** `0253 01/04/25 13:25` jams a
  register number, date, and time with no `Date:` label; the checker will not guess which token is the
  transaction date, so date is `not in source` and the line is disclosed as unmapped. Left strict on
  purpose - relaxing it risks grabbing an auth-line date. Nothing invented; the datum is disclosed.
- **Vendor not on the first line (input-grammar boundary).** The restaurant check leads with
  `CHECK # 1364520`; the merchant `CACTUS CLUB CAFE` prints lower. The contract's "vendor = first line
  of the block" does not fit that layout - a documented boundary of the input grammar, not a silent
  failure.
- **Currency confirmed reading the printed symbol, not locale.** On the Staples receipt the checker
  accepts `currency: $` because `$234.18` is literally printed on the Mastercard line - it is not
  inferred from "Calgary/Canada". With no printed symbol anywhere, currency is `not in source`.

7 valid outputs, 64 fixtures. Suite green; fresh-clone green.

## Folder of real receipts - grocery pass + 3-slip boundary - 2026-09-19 (v17)

More genuine Calgary receipts run through the checker with `--input`:

- **Grocery (Real Canadian Superstore) - clean pass, shipped.** Four fields fill (date `2024/09/14`
  from a bare date line, vendor, amount `29.65` from the `TOTAL` line, currency `CAD$` read from the
  printed code) and two are principled refusals: no `Category:` line, and - the sharp one - the receipt
  prints `GST #<reg>`, a *registration number*, which the tool correctly does **not** report as a tax
  amount. Committed as `inputs/receipts-superstore.txt` + `verify/outputs/receipts-superstore.json`.
- **3-slip split payment (Cactus Club) - one transaction, one line.** A single dinner (Check #257878)
  printed across three slips: itemized bill, a Givex gift-card payment, and a Visa for the remainder.
  Transcribed as one block, the tool resolved a five-way total minefield correctly - it chose the meal's
  `TOTAL DUE 193.74` over `TOTAL CAD$228.61`, `TOTAL CAD$78.61`, `AMOUNT OWED 78.61`, and the paid/tip
  lines, disclosing every split-payment number as unmapped and summing nothing. Date, GST tax, and
  currency all bound correctly. **One break: vendor.** The bill slip leads with `CHECK # 257878`, so the
  "merchant = header" rule cannot reach the real `CACTUS CLUB CAFE` lower on the page. Decision: document
  as an input-grammar boundary (merchant must head the receipt), not patch the header rule 6 days out -
  finding the merchant by position is a judgement the deterministic checker cannot verify. input-grammar.md
  gains the "merchant not in the header" and "one transaction is one block" limits.

8 valid outputs, 64 fixtures. Suite green; fresh-clone green.

## Columnar tax bug - found on a grocery receipt, fixed - 2026-09-19 (v18)

The Save-On-Foods receipt prints tax as columns: `Tax-Code | Taxable-Value | Tax-Value`, i.e.
`GST 27.98 1.40`. This exposed a **forced-wrong-answer** bug - the worst class:

- `tax: 1.40` (the correct Tax-Value) was **rejected** (`GST` did not sit immediately before it),
- `tax: not in source` (honest refusal) was **rejected** (the drop-guard sees a printed tax),
- `tax: 27.98` (the taxable **base** - wrong) was **accepted**.

So the checker rejected the right value and the honest refusal, and passed only the wrong one. Fix
(decision: capture the tax correctly): for the tax field, the label may reach across an intervening
taxable-value/base, but the bound value must be the **last money token** the label governs - the
Tax-Value column. Now `GST 27.98 1.40` -> `1.40` binds, `27.98` is rejected, and `not in source` is
still refused because the correct value is reachable. Guarded by `fail_tax-base-not-value` (the base
27.98 must not bind); schema.json gains `columnar_tax` on the tax field; rules.md and input-grammar note
the Tax-Value rule. Save-On shipped as `inputs/receipts-saveon.txt` + `verify/outputs/receipts-saveon.json`.

11 valid outputs, 65 fixtures. Suite green; fresh-clone green.

## Compound date labels recognized - 2026-09-19 (v19)

`DateTime:` (Superstore) and `DATE/TIME:` (Save-On) were not recognized date labels, so date came out
`not in source` on both grocery receipts (accepted as honest refusals, but a visible miss). Decision:
recognize them - reading an explicit label is not guessing. Added `datetime` and `date/time` to the date
label set. Date now fills: Superstore cites its `DateTime:` line (`24/09/14`), Save-On its `DATE/TIME:`
line (`09/25/2024`). The labeled date takes priority over a bare footer date, so no ambiguity is
introduced. Guarded by `fail_datetime-date-dropped` (a `DateTime:` date may not be dropped to empty).

11 valid outputs, 66 fixtures. Suite green; fresh-clone green.

## Earls (tipped restaurant) - clean pass, no fix - 2026-09-19 (v20)

A two-slip Earls dinner with a tip, run through the checker: **no change needed.** It leads with the
merchant (`EARLS RESTAURANTS`, in-grammar), so vendor binds; the apostrophe date `Sep23'24` binds as a
bare date; tax `6.85` from `GST Tax`; and - the point of the test - the **tip (25.89) went to unmapped**
and `amount` stayed the labeled meal `Total 143.85`, not the unlabeled `169.74` grand total on the card
line, and not via the time-wedged `Total @ 1:14PM 143.85`. Currency is `not in source` (none printed).
Shipped as `inputs/receipts-earls.txt` + `verify/outputs/receipts-earls.json`.

Five real photographed receipts now ship in the checked suite (Staples, Superstore, Save-On, Earls, plus
the earlier corpus): 12 valid outputs, 66 fixtures. Suite green; fresh-clone green.

## Gas receipt (Mobil) - two fixes - 2026-09-19 (v21)

A Mobil gas receipt (fuel, GST-included, pump preset) surfaced two issues:

- **Phantom date from a batch code (bug, fixed).** The only real date is `2026-09-19`; the checker also
  read `01/02` out of `01/027 APPROVED` (a batch/approval code), saw two dates, called it ambiguous, and
  suppressed the real one. The date-candidate scanner now requires a whole token - a numeric date bounded
  by `(?<!\d)...(?!\d)` - so `01/027` is not read as `01/02`. Guarded by `fail_batchcode-phantom-date`.
- **Merchant under a card-terminal header (fixed).** The receipt leads with
  `TRANSACTION RECORD / RELEVE DE / TRANSACTION`, a bilingual decoration, so the merchant `MOBIL 1743 GAS
  STN` was not line 1. Added `transaction record`, `releve de transaction`, `releve de`, `transaction` to
  the whole-line preamble set (same move as the earlier `GUEST COPY` fix), so the merchant binds. Guarded
  by `fail_txnrecord-as-vendor`. (This is coverage-by-accretion; it is fixable only because the merchant
  sits right under the preamble - unlike the Cactus check-number case, which stays a documented boundary.)

Everything else bound correctly: amount `100.00` (TOTAL), currency `CAD$`, tax `4.76` from
`GST INCLUDED $ 4.76` (the amount, not the `GST #` registration number). Shipped as
`inputs/receipts-mobil.txt` + `verify/outputs/receipts-mobil.json`.

Six real photographed receipts now ship: 13 valid outputs, 68 fixtures. Suite green; fresh-clone green.

## Adversary break + fix: the accept-vs-guard currency-code asymmetry - 2026-09-20 (v22)

An independent adversarial subagent (blind to the build, tasked only with fabricating a value that
passes) found a real disqualifier-class bug, reproduced three ways:

- **Root cause.** The accept path `stripLabelTail()` strips a trailing currency CODE (so it binds
  `Amount Due USD 22.95`), but the total guards (`governedValues`, `labelGovernsAValue`, which power
  `totalPriorityCheck` / `amountAmbiguityCheck` / the amount branch of `fieldDropCheck`) matched only a
  separator class with no currency code. So a currency code between a total label and its number was
  invisible to every total guard while the accept path still bound it.
- **Three passing exploits (all fixed):** (1) `Total 22.94` + `Amount Due USD 22.95` -> output `22.94`
  accepted (the exact wrong-total misattribution the tool exists to prevent); (2) a lone
  `Amount Due USD 40.00` dropped to `not in source`; (3) `Total USD 50.00` + `Total 90.00` -> `50.00`
  accepted as THE total despite two distinct totals.
- **Fix.** A shared `LBL_GAP` pattern lets the guards skip exactly what `stripLabelTail` strips -
  whitespace, punctuation, currency symbols AND codes, modifier words, a rate, a parenthetical - so the
  accept path and the guards can no longer disagree. All three now fail through `[trace]`
  (total-priority, under-report, ambiguity). Locked by `fail_currency-code-hides-final-total`,
  `fail_currency-code-total-dropped`, `fail_currency-code-ambiguity`.

Correction to an earlier overconfident claim: the entry was NOT "structurally immune" before this fix -
this asymmetry was a live hole. It is closed now, with the same accept/guard routine reading one gap.

13 valid outputs, 71 fixtures. Suite green; fresh-clone green.
