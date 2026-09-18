# Field definitions — expense-report record

This is the contract. The output is a JSON object with a fixed shape. A reader can open this
file and `schema.json` next to it and check, field by field, whether the translator kept its
promise. If a value in the output is not accounted for here, the translator broke the contract.

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
    { "line": 5, "reason": "card mask, no schema field" }
  ]
}
```

- **`source_file`** — repo-relative path to the input text this record was produced from. The
  checker reads that file, numbers its physical lines 1..N, and validates every citation against
  those line numbers.
- **`lines`** — one object per receipt (per transaction). N receipts in the input produce N lines.
- Each field is either `{ "value": "<text>", "cite": [<line numbers>] }` (a value found in the
  input) or `{ "value": "not in source" }` (the receipt did not state it). There is no third form.

## The seven fields (fixed set, fixed order)

| # | Field | Role | Cited? | Rule |
|---|-------|------|--------|------|
| 1 | `line_no` | structural | no | The row's 1-based index. Must equal its position in `lines`. It is the record's own address, not a claim about the receipt, so it carries no citation and is the only field the trace gate skips. |
| 2 | `date` | source | yes | The date **exactly as printed**. Not normalized. `Jan 3` stays `Jan 3`; a year that is not on the receipt is never added. |
| 3 | `vendor` | source | yes | The vendor name **exactly as it appeared**. `Blue Ridge Coffee Co` is not expanded to `...Company` and a misspelling is not corrected. |
| 4 | `amount` | source | yes | The transaction total **exactly as printed**. Never summed from item prices. No printed total → `not in source`. |
| 5 | `currency` | source | yes | The symbol or code **as printed** (`$`, `USD`, `CAD`, `€`). Never assumed from the amount format or the locale. |
| 6 | `category` | source | yes | Filled **only if the receipt literally prints a category**. Never inferred from the vendor or the items. On a normal receipt this is `not in source`, and that is the correct, contract-honoring answer. |
| 7 | `tax` | source | yes | The tax amount **as printed on a tax line**. Never computed as `total − subtotal`. |

## `not in source`

The exact string `not in source` (lowercase, no punctuation) is the only marker for a field the
receipt did not state. A field is never dropped, never left blank, never filled with a plausible
guess. A `not in source` field carries no `cite`.

## `unmapped_input_lines`

Every non-blank input line must be accounted for: either it is cited by at least one field, or it
appears here with a short reason it maps to no field (a card mask, a loyalty-points line, a
"thank you" footer). This is how the record proves it dropped nothing silently. Blank or
whitespace-only lines are exempt.

## The trace rule (what "cite" means)

A citation is checkable, and it is checked at the **line level, not the file level**. For a filled
field, the value (after light normalization: lowercase, collapse whitespace, fold smart quotes and
dashes) must be a substring of the **cited line(s) only** — not merely present somewhere in the
input. Proving a value exists *somewhere* is not enough; it must sit inside the line it names.
