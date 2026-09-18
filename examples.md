# examples — the contract holding across three receipts

Three inputs of the same kind, three outputs with the same shape. The full inputs are in
`inputs/`; the machine-checkable outputs are in `verify/outputs/`. Run `node verify/check.mjs` to
confirm every value below traces to its cited line.

Input lines are shown numbered so you can trace each `cite` by eye.

---

## Example 1 — a bare receipt (what `not in source` is for)

**Input** (`inputs/receipts-coffee.txt`):

```
1  Blue Ridge Coffee Co
2  Jan 3
3  1 Large Latte
4  Total 6.50
5  Card ****1234
6  Earn 65 loyalty points
```

**Output:**

```json
{
  "line_no": 1,
  "date":     { "value": "Jan 3", "cite": [2] },
  "vendor":   { "value": "Blue Ridge Coffee Co", "cite": [1] },
  "amount":   { "value": "6.50", "cite": [4] },
  "currency": { "value": "not in source" },
  "category": { "value": "not in source" },
  "tax":      { "value": "not in source" }
}
```

| # | date  | vendor               | amount | currency      | category      | tax           |
|---|-------|----------------------|--------|---------------|---------------|---------------|
| 1 | Jan 3 | Blue Ridge Coffee Co | 6.50   | not in source | not in source | not in source |

**What it teaches:** the receipt has no currency symbol, no printed category, no tax line, and no
year on the date. A writer would fill those - `$`, `Meals`, a computed tax, `2026`. The translator
says `not in source` four times and keeps the date as the bare `Jan 3` that was printed. Lines 3, 5
and 6 map to no field and are disclosed in `unmapped_input_lines`.

---

## Example 2 — two receipts, filled currency and tax, no carry-over

**Input** (`inputs/receipts-hardware.txt`):

```
1  HARDWARE DEPOT #42
2  03/14/2026
3  Garden hose 24.99
4  Work gloves 12.50
5  Subtotal $37.49
6  GST $1.87
7  Total $39.36
8  ---
9  Corner Lumber
10 Mar 15 2026
11 2x4 stud x10
12 Total $88.00
13 VISA approved
```

**Output** (two lines, one per receipt):

| # | date       | vendor             | amount | currency | category      | tax           |
|---|------------|--------------------|--------|----------|---------------|---------------|
| 1 | 03/14/2026 | HARDWARE DEPOT #42 | 39.36  | $        | not in source | 1.87          |
| 2 | Mar 15 2026| Corner Lumber      | 88.00  | $        | not in source | not in source |

**What it teaches:** `amount` is the printed **total** (39.36), not the subtotal and not a sum of
the items - the subtotal on line 5 is disclosed as unmapped. Receipt 1 has a GST line so `tax` is
1.87; receipt 2 has no tax line, so its `tax` is `not in source` - the tax from receipt 1 is never
carried over or assumed.

---

## Example 3 — a printed category, foreign currency, two tax lines

**Input** (`inputs/receipts-hotel.txt`):

```
1  Hotel Rivoli — Paris
2  Invoice 2026-02-08
3  Category: Lodging
4  Room (2 nights) 240.00
5  City tax 4.40
6  VAT 24.44
7  Total EUR 268.84
8  Paid by card
```

**Output:**

| # | date       | vendor              | amount | currency | category | tax  |
|---|------------|---------------------|--------|----------|----------|------|
| 1 | 2026-02-08 | Hotel Rivoli — Paris | 268.84 | EUR      | Lodging  | 4.40 |

**What it teaches:** `category` is filled here - and only here - because the receipt literally
prints `Category: Lodging` on line 3. `currency` is `EUR` because it is printed on line 7, not
assumed. There are two tax lines; the translator puts the first (City tax, 4.40) in `tax` and
discloses the second (VAT) in `unmapped_input_lines` rather than summing them. Nothing is derived,
nothing is dropped.
