# Field definitions — expense-report record

This is the contract. The output is a JSON object with a fixed shape. A reader can open this file
and `schema.json` next to it and check, field by field, whether the translator kept its promise.

## Record shape

```json
{
  "conversion": "expense-report",
  "source_file": "inputs/receipts-coffee.txt",
  "lines": [
    {
      "line_no": 1,
      "date":     { "value": "Jan 3",              "cite": [2] },
      "vendor":   { "value": "Blue Ridge Coffee Co", "cite": [1] },
      "amount":   { "value": "6.50",               "cite": [4] },
      "currency": { "value": "not in source" },
      "category": { "value": "not in source" },
      "tax":      { "value": "not in source" }
    }
  ],
  "unmapped_input_lines": [
    { "line": 5, "code": "card_mask", "note": "Card ****1234" }
  ]
}
```

- **`source_file`** — repo-relative path to the input text. The checker numbers its physical lines
  1..N and validates every citation against those numbers.
- **`lines`** — one object per receipt. N receipts → N lines. No extra keys; the shape is closed.
- Each field is `{ "value": "<text>", "cite": [<lines>] }` or `{ "value": "not in source" }`.

## The structural envelope (declared, not invented)

Some content in the output is not a claim about the receipt; it is the record's own scaffolding.
It is listed here so it is transparent and so the checker can pin it - it is never a place for
invented content to hide:

| Envelope item | What it is | How the checker pins it |
|---|---|---|
| field names | the fixed schema keys | rejects any key not in the schema (and any stray top-level key) |
| `line_no` | the row's 1-based index | must equal the row's position in `lines` |
| `source_file` | which input this record is of | must name a file that exists; all cites trace to it |
| `conversion` | which conversion this is | must equal the schema `id` (`expense-report`) |
| `unmapped_input_lines[].code` | why a line maps to no field | must be one of the controlled reason codes |

## The seven fields (fixed set, fixed order)

| # | Field | Cited? | Rule | Extra constraint the checker enforces |
|---|-------|--------|------|----------------------------------------|
| 1 | `line_no` | no | The row's 1-based index. Envelope, not a receipt claim. | equals its position in `lines` |
| 2 | `date` | yes | Exactly as printed; no year added; not normalized. | value must be **date-shaped** |
| 3 | `vendor` | yes | Exactly as it appeared; not expanded or corrected. | (free text; see limit in README) |
| 4 | `amount` | yes | The printed **total**; never summed; no total → `not in source`. | sourcing line must **not** be a subtotal/tax line |
| 5 | `currency` | yes | Symbol/code as printed; never assumed. | — |
| 6 | `category` | yes | Only if the receipt prints a category; never inferred. | sourcing line must be **category-labeled** |
| 7 | `tax` | yes | As printed on a tax line; never computed. | sourcing line must be **tax-labeled** |

## `not in source`

The exact string `not in source` is the only marker for a field the receipt did not state. A field
is never dropped, blank, or guessed. A `not in source` field carries no `cite`.

## `unmapped_input_lines`

Every non-blank input line must be accounted for: cited by a field, or listed here. Each entry has
`line` (the number), `code` (one of the controlled reason codes in `schema.json`), and an optional
`note` that, if present, must quote the line it describes. Blank and `---` lines are exempt.

## The trace rule (what "cite" means)

Checked at the **line level**, and now at the **line-kind level**. For a filled field, the value
(after light normalization) must be a substring of a **single cited line** - not merely present
somewhere in the input, and not assembled across two lines. On top of that, the sourcing line must
be the right kind of line for the field (a tax on a tax line, a category on a category line, an
amount not on a subtotal/tax line, a date that is date-shaped). Proving a value exists is not
enough; it must be the right value, from the right line, in the right field.
