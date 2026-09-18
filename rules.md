# rules — how the translator maps receipt text to the expense-report record

Read `reference/expense-report/schema.json` and `field-definitions.md` first: they define the
output shape. This file defines the mapping - which input parts feed which fields, what to do when
a field has no source, and what to never add.

## The output, every time

- One JSON object. One `line` per receipt (per transaction). N receipts in, N lines out.
- Every line has all seven fields, in schema order: `line_no, date, vendor, amount, currency,
  category, tax`.
- Each field is either `{ "value": "<text>", "cite": [<input line numbers>] }` or
  `{ "value": "not in source" }`. No blanks, no dropped fields, no third form.
- Below the JSON, render the same data as a table for humans. The table says `not in source`
  wherever the JSON does.

## Line numbering (how citations work)

The input is numbered by physical line, starting at 1, counting every line including blanks.
A `cite` is the line number(s) the value is printed on. The value you put in a field must appear
**on the line(s) you cite** - not merely somewhere in the receipt. Cite the narrowest line(s)
that contain the value.

## Field-by-field mapping

- **`line_no`** - the row's 1-based index (1, 2, 3...). Not from the receipt. No citation.
- **`date`** - the transaction date, copied **exactly as printed**. `Jan 3` stays `Jan 3`.
  `03/14/2026` stays `03/14/2026`. Never reformat, never add a missing year, never convert.
- **`vendor`** - the merchant name **exactly as it appeared**. Do not expand `Co` to `Company`,
  do not fix a misspelling, do not drop a store number.
- **`amount`** - the transaction **total** exactly as printed on the total line. If no total is
  printed, `not in source`. Never add up the item prices to make one.
- **`currency`** - the symbol or code as printed (`$`, `USD`, `CAD`, `EUR`, `£`). If none is
  printed, `not in source`. Never assume it from the number format or the country.
- **`category`** - filled **only if the receipt literally prints a category** (for example a line
  like `Category: Lodging`). Otherwise `not in source`. Never infer the category from the vendor
  or the items. A coffee shop is not automatically "Meals".
- **`tax`** - the tax amount as printed on a tax line (GST, VAT, Sales Tax, City tax). Never
  compute it as total minus subtotal.

## The three laws (this is what makes it a translator, not a writer)

1. **Never derive.** No summed totals, no computed tax, no math of any kind. If the number is not
   printed, it is `not in source`.
2. **Never assume.** No currency from locale, no year added to a bare month/day, no category from
   the vendor. If it is not on the receipt, it is `not in source`.
3. **Never drop.** Every non-blank input line is either cited by a field or listed in
   `unmapped_input_lines` with a short reason. You may not silently ignore a line.

## Deterministic tie-breakers (so the mapping is repeatable, never a judgment call)

- **Multiple tax lines, no printed combined tax:** put the **first** printed tax line in `tax` and
  list every further tax line in `unmapped_input_lines` with the reason. Tax lines are never
  summed. (See `verify/outputs/receipts-hotel.json`: City tax fills `tax`, VAT is disclosed as
  unmapped.)
- **Subtotal and total both printed:** `amount` is the **total**. The subtotal goes to
  `unmapped_input_lines`.
- **A field's value would need two non-adjacent lines:** cite both line numbers.

## What goes in `unmapped_input_lines`

Lines the schema has no field for, disclosed so nothing is dropped silently: line items, subtotals,
second tax lines, payment methods, card masks, loyalty balances, greetings and footers. Each entry
is `{ "line": <n>, "reason": "<short reason>" }`. Blank lines and bare `---` separators are exempt
and need no entry.

## When in doubt

Prefer `not in source` over a guess. The translator is rewarded for refusing to invent, never for
filling a field it could not source. A correct `not in source` is a feature, not a gap.
