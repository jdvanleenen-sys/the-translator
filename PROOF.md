# Prove it in three minutes

This translator's one promise: **every value in the output is copied from the receipt, or says
`not in source`.** Nothing is computed, inferred, or assumed. Here is how to confirm that yourself,
cold, in three minutes.

## 1. The contract (30 seconds)

- **In:** the text of one or more receipts (one item per line; separate receipts with a line of `---`).
- **Out:** one JSON record per receipt, seven fixed fields in fixed order:
  `line_no, date, vendor, amount, currency, category, tax`.
- Every filled field is `{ "value": <text>, "cite": [<input line numbers>] }`. A field the receipt does
  not state is `{ "value": "not in source" }` (the brief's own marker).
- The rule, in one line: **extraction only — no math, no inferred currency, no guessed category, no
  normalized dates, no OCR repair.** If it is not printed, it is `not in source`.
- Full contract, open and checkable: `reference/expense-report/` (`schema.json`, `field-definitions.md`,
  `input-grammar.md`).

## 2. Run it (30 seconds)

Offline, no dependencies, Node only:

```
node verify/check.mjs
```

Every real output traces clean, and every planted invention fails through the gate it declares:

```
RESULT: all outputs traced clean, all fixtures failed through their intended gate.
```

One-screen verdict for a judge:

```
node verify/check.mjs --matrix
```

## 3. See a real one (60 seconds)

`inputs/receipts-superstore.txt` is a real (pseudonymized) Real Canadian Superstore receipt; its checked
record is `verify/outputs/receipts-superstore.json`. Pin the evidence yourself so the output cannot
choose its own input:

```
node verify/check.mjs --input inputs/receipts-superstore.txt --output verify/outputs/receipts-superstore.json
```

Open both files side by side:
- `amount` is `29.65`, cited to the `TOTAL` line (not the items, which it never sums).
- `currency` is `CAD$`, cited to that same line (read, not assumed from "Calgary").
- `tax` is `not in source` — the receipt prints a `GST #` **registration number**, not a tax amount, and
  the tool refuses to mistake one for the other.

## 4. Try to break it (60 seconds)

Every file in `verify/fixtures/fail_*.json` is a deliberately wrong output — an invented value, a
mis-citation, a guessed field, a dropped line. Each one **must** fail, and through the specific gate it
declares (`[shape] [trace] [coverage] [block]`). `verify/fixtures/THREAT-MODEL.md` lists all 68, grouped
by how someone would cheat. If any planted invention ever passed, `node verify/check.mjs` would go red.

---

That is the whole entry: a fixed shape, every value traced to the input, and an executable test that
rejects every unsupported claim. If a reader cannot check it, it does not count — so every claim here is
one command away from checking.
