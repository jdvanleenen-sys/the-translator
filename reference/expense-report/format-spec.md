# Format spec — input and output

## Input format

A plain-text file (`.txt`). Text describing one or more receipts - typed, dictated, or the text a
phone's scanner pulled off a photo. Messy is fine; that is the point.

- **Physical lines are the unit of citation.** The checker numbers every line 1..N by splitting on
  newlines. Blank lines are counted in the numbering (so numbers stay stable) but are exempt from
  the coverage rule.
- **Multiple receipts** are separated by a line containing only `---`. Each receipt block becomes
  one output line, in order. A single-receipt input needs no separator. A citation in one output
  line may only point at lines inside that receipt's own block.
- Nothing else about the input is prescribed. The output is what holds its shape.

## Output format

A single JSON object matching `field-definitions.md`. The JSON **is** the record and the checked
artifact. When translating in chat, also render the same data as a table beneath the JSON so a human
can read it - the table is a convenience view, not a separate file, and it says `not in source`
wherever the JSON does. When you save an output to check it, save the JSON object (the checker parses
JSON; it does not parse a JSON-plus-table blob).

- Field order in every line object follows `schema.json` (`line_no, date, vendor, amount, currency,
  category, tax`). No extra keys at any level.
- Every field is present in every line. Empty fields are `{ "value": "not in source" }`.
- `conversion` must be `expense-report`. `source_file` names the input so citations can be traced.
- `unmapped_input_lines[]` entries use a controlled `code` from `schema.json`
  (`line_item, subtotal, tax_additional, discount, payment_method, card_mask, loyalty, location,
  header, greeting_footer, other`) plus an optional line-quoting `note`.

### Composite total lines

When the total prints the currency code and the number together (`Total CAD 16.42`), split into the
two schema fields: `amount` is the numeric portion (`16.42`), `currency` is the code (`CAD`), each
cited to that same line. This is a remap into the fixed fields, not an invention.

### Rendered table (the human view)

```
| # | date  | vendor               | amount | currency     | category     | tax          |
|---|-------|----------------------|--------|--------------|--------------|--------------|
| 1 | Jan 3 | Blue Ridge Coffee Co | 6.50   | not in source | not in source | not in source |
```

## How the contract is checked

`node verify/check.mjs` reads each output in `verify/outputs/`, opens the `source_file` it names,
and runs four gates: shape (all fields present, in order, no stray keys, envelope pinned), trace
(each value sits in a single cited line, of the right kind for its field), coverage (every non-blank
input line cited or listed unmapped with a controlled code), and block (one line per receipt, cites
stay inside their block). It then confirms every `verify/fixtures/fail_*.json` fails through the gate
it declares. Any failure exits non-zero and prints the diagnostic.
