# Format spec — input and output

## Input format

A plain-text file (`.txt`). Text describing one or more receipts — typed out, dictated, or the
text a phone's scanner pulled off a photo. Messy is fine; that is the point.

- **Physical lines are the unit of citation.** The checker numbers every line in the file 1..N by
  splitting on newlines. Line 1 is the first line of the file. Blank lines are counted in the
  numbering (so numbers stay stable) but are exempt from the coverage rule.
- **Multiple receipts** are separated by a line containing only `---`. Each receipt block becomes
  one output line. A single-receipt input needs no separator.
- Nothing else about the input is prescribed. The translator adapts to whatever the receipt text
  looks like; the **output** is what holds its shape.

## Output format

A single JSON object matching `field-definitions.md`, followed (for humans) by a rendered table.
The JSON is the checked artifact; the table is a convenience view of the same data.

- Field order in every line object follows `schema.json` (`line_no, date, vendor, amount,
  currency, category, tax`).
- Every field is present in every line. Empty fields are `{ "value": "not in source" }`.
- `source_file` names the input, so the checker can trace citations back to it.

### Rendered table (below the JSON)

```
| # | date  | vendor               | amount | currency     | category     | tax          |
|---|-------|----------------------|--------|--------------|--------------|--------------|
| 1 | Jan 3 | Blue Ridge Coffee Co | 6.50   | not in source | not in source | not in source |
```

The table must say `not in source` wherever the JSON does. It never fills a cell the JSON left
empty. If the two disagree, the JSON is the contract and the table is wrong.

## How the contract is checked

`node verify/check.mjs` reads each output in `verify/outputs/`, opens the `source_file` it names,
and runs four gates: shape (all fields present, in order), trace (each filled value sits in its
cited line), coverage (every non-blank input line is cited or listed unmapped), and the kept-red
fixtures (planted inventions that must fail). Any failure exits non-zero and prints the diagnostic.
