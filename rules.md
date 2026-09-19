# rules — how the translator maps receipt text to the expense-report record

Read `reference/expense-report/schema.json` and `field-definitions.md` first: they define the
output shape. This file defines the mapping - which input parts feed which output fields, what to do
when a field has no source, and what to never add.

## The output, every time

- One JSON object. One `line` per receipt (per transaction). N receipts in, N lines out.
- Every line has all seven fields, in schema order: `line_no, date, vendor, amount, currency,
  category, tax`. No extra fields; the record shape is closed.
- Each field is either `{ "value": "<text>", "cite": [<input line numbers>] }` or
  `{ "value": "not in source" }`. No blanks, no dropped fields, no third form.
- The JSON is the record and the checked artifact. When you translate in chat, also render the same
  data as a table beneath the JSON for humans; the table is a view, not a separate file, and it says
  `not in source` wherever the JSON does. What you save and check is the JSON.

## Line numbering (how citations work)

The input is numbered by physical line, starting at 1, counting every line including blanks.
A `cite` is the line number(s) the value is printed on. The value you put in a field must appear
**on a single one of the line(s) you cite** - not merely somewhere in the receipt, and not
assembled across two lines. Cite the narrowest line that contains the value.

## Field-by-field mapping

- **`line_no`** - the row's 1-based index (1, 2, 3...). Structural envelope, not from the receipt. No citation.
- **`date`** - the transaction date, copied **exactly and completely as printed**. `Jan 3` stays
  `Jan 3`; `14-03-2026` stays `14-03-2026`, never truncated to `14-03`. Never reformat, never add a
  missing year. The value must look like a date; a bare number is not a date. It is the **transaction
  date**, never a date-shaped token from an auth/reference/card/expiry line. If the receipt prints no
  transaction date, `not in source`.
- **`vendor`** - the merchant name is the **entire receipt header line** (the first line of its block),
  copied verbatim. Do not expand `Co` to `Company`, do not fix a misspelling, do not drop a store
  number, do not shorten it, and do not take a footer, address, or payment-processor line as the merchant.
- **`amount`** - the transaction **total** exactly as printed on a **total-labeled line** (`Total`,
  `Total Due`, `Total Amount`, `Total Payable`, `Amount Due`, `Balance Due`, `Amount Payable`,
  `Amount Paid`, `Total Paid`, `Grand Total`). It must **not** be taken
  from a subtotal line, a tax line, or a line item/fare. If no total-labeled line is printed, `not in
  source` - a bare unlabeled number is not assumed to be the total. Never sum the items. It is the
  **complete printed number** (`8.25`), never a truncation (`8`). It must come from the grand-total
  line, **not** a `Total Savings`, `Total Discount`, `Total Items`, tip, change, or rounding line -
  those carry the word "total" but are not the amount owed.
- **`currency`** - the symbol or code as printed (`$`, `USD`, `CAD`, `EUR`, `£`). If none is
  printed, `not in source`. Never assume it. When the total line prints the code and the number
  together (e.g. `Total CAD 16.42`), `amount` is the numeric portion (`16.42`) and `currency` is the
  code (`CAD`), each cited to that line.
- **`category`** - filled **only if the receipt literally prints a category on a category-labeled
  line** (e.g. `Category: Lodging`). Otherwise `not in source`. Never infer it from the vendor or
  items. A coffee shop is not automatically "Meals".
- **`tax`** - the tax amount as printed **on a tax-labeled line** (GST, VAT, HST, PST, Sales Tax,
  City tax, duty, levy), the complete printed number. Never compute it as total minus subtotal, never
  pull it from a non-tax line.

## The three laws (this is what makes it a translator, not a writer)

1. **Never derive.** No summed totals, no computed tax, no math. If the number is not printed, it is `not in source`.
2. **Never assume.** No currency from locale, no year added to a bare month/day, no category from the vendor.
3. **Never drop.** Every non-blank input line is either cited by a field or listed in
   `unmapped_input_lines`. You may not silently ignore a line.

## Sourced from the right kind of line

Fidelity is not only "the value is on the cited line," it is "the value came from the right kind of
line." A number that appears on the subtotal line is not the amount; a fare is not the total;
loyalty points that happen to be a number are not tax; a line item is not a category. The checker
enforces this for `amount` (must be a total-labeled line, never a subtotal/tax line), `tax` (must be
a tax-labeled line), `category` (must be a category-labeled line), and `date` (must be date-shaped).

## Deterministic tie-breakers (so the mapping is repeatable, never a judgment call)

- **Multiple tax lines, no printed combined tax:** put the **first** printed tax line in `tax` and
  list every further tax line in `unmapped_input_lines` (code `tax_additional`). Tax lines are never summed.
- **Subtotal and total both printed:** `amount` is the **total**. The subtotal goes to `unmapped_input_lines` (code `subtotal`).
- **Multiple total-labeled lines:** `amount` is the **final owed total**. A final-owed label (`Total Due`,
  `Amount Due`, `Balance Due`, `Amount Payable`, `Grand Total`) outranks a plain `Total`. On a
  cash-rounding receipt with `Total 22.94` and `Total Due 22.95`, `amount` is `22.95`; the plain
  `Total` goes to `unmapped_input_lines` (code `other`).
- **Two or more DISTINCT totals with no single final-owed total** (e.g. `Total 10.00` and `Total 12.00`):
  the receipt does not identify one total, so `amount` is **`not in source`** and each total line goes to
  `unmapped_input_lines`. Choosing one would be a guess. (Same value under a plain `Total` and a
  `Total Due` is one distinct value - not ambiguous.)
- **A field's value would need two non-adjacent lines:** it does not. Each field's value is a single printed token/phrase on one line.

## `unmapped_input_lines` (a controlled vocabulary, not free prose)

Lines the schema has no field for, disclosed so nothing is dropped silently. Each entry is
`{ "line": <n>, "code": "<reason code>", "note": "<optional quote of the line>" }`. The `code` must
be one of the codes declared in `schema.json` (`line_item, subtotal, tax_additional, discount,
payment_method, card_mask, loyalty, location, header, greeting_footer, other`) - a fixed vocabulary,
so the disclosure layer classifies with declared codes rather than invented prose. The optional
`note`, if present, must itself quote the line it describes (the checker traces it). Blank lines and
bare `---` separators are exempt and need no entry.

## Before you output (self-check, fail closed)

After you draft the record, re-read it against the receipt line by line, then emit only what survives:

1. For every filled field, confirm the value appears on the exact line it cites, as a complete token,
   and is the right KIND (total from a total-labeled line, tax from a tax line, currency adjacent or
   declared, a date-shaped transaction date, vendor = the block header verbatim). If you cannot confirm
   it on the cited line, change the field to `not in source`.
2. Confirm every non-blank input line is either cited by a field or listed in `unmapped_input_lines`.
3. If any value was computed, summed, normalized, corrected, or inferred, replace it with `not in source`.

Emit the record only after this pass. This is the fail-closed default: when unsure, refuse. The folder
also ships a mechanical checker (`verify/check.mjs`) that enforces exactly these rules against the
output; run it on your result if you can.

## When in doubt

Prefer `not in source` over a guess. A correct `not in source` is a feature, not a gap.
