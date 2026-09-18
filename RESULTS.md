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

_To be filled by running a clean clone (see the fresh-clone step). Recorded here with the exit
code, not asserted._
