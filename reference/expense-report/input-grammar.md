# Input grammar and stated limits

The contract has two halves. `schema.json` and `field-definitions.md` fix the OUTPUT. This file fixes
the INPUT the translator accepts, and states, in the open, the layouts it deliberately treats as
"not in source" rather than guess. Publishing the grammar is the point: the checker's strictness is
strict *by contract*, not brittleness. When the input does not match the grammar, the honest result is
a refusal (`not in source`), never an invented value.

## Accepted input

- **A receipt transcription, not prose.** The input is the receipt's own lines (one item per line, as
  OCR or typing produces), not a free-form sentence describing a receipt. A prose narration ("a crumpled
  receipt, total looks like $84, dated March 3") is out of scope: with no receipt lines to cite, the
  fidelity rules correctly leave most fields `not in source`. This is a stated scope, not a failure.
- **Plain UTF-8 text.** One physical line in equals one citable line out (1-based). No OCR correction,
  no reflowing; the text is treated exactly as supplied.
- **One receipt per block.** Multiple receipts are separated by a line containing only `---`. A leading,
  trailing, or doubled `---` (an empty block) is ignored, not counted as a receipt.
- **Blank lines and `---`** are exempt from coverage. Every other line must be cited by a field or
  listed in `unmapped_input_lines` with a controlled reason code. Nothing is dropped silently.
- **The merchant is the block header:** the first line that is not blank and not a whole-line preamble
  decoration (`*** CUSTOMER COPY ***`, `THANK YOU`, `RECEIPT`, `DUPLICATE`, `TRANSACTION RECORD`,
  `RELEVE DE TRANSACTION`, ...). A line that merely contains such a word ("Thank You Cafe") is a
  merchant, not a preamble.

  **Stated limit - merchant not in the header.** This assumes the merchant name heads the receipt, which
  holds for the common case (storefront and grocery receipts print the name first). Some restaurant POS
  bill slips instead lead with `CHECK #<n>` / `TABLE #<n>` and print the merchant name lower down or only
  on the attached card slip. Those receipts are outside this grammar: feed a transcription whose first
  line is the merchant (e.g. lead with the card-slip copy that prints the name). The translator does not
  hunt for the merchant elsewhere on the page - finding it by position would be a judgement the
  deterministic checker cannot verify, and guessing is the failure mode this tool exists to avoid.

- **One transaction is one block.** N *receipts* means N *transactions*, one `line` each. A single
  transaction printed across several slips (an itemized bill plus one or more card/gift-card payment
  slips, even a split payment) is **one** receipt: transcribe it as one block, not several. Separating
  the slips with `---` would wrongly emit one line per slip. Within that one block the translator picks
  the single owed total (`Total Due`) over the payment-slip and tip-inclusive totals and discloses the
  rest as unmapped - it never sums the slips.

## Same-line binding (and the stated limit)

A labelled value is captured only when its label **governs it on the same line** - the label sits
immediately to the left of the value (`Total 40.00`, `GST 0.42`, `Category: Meals`). Punctuation,
currency symbols/codes, a trailing `(parenthetical)`, and a trailing `included`/`incl` modifier between
the label and the value are tolerated (`Grand Total: $40.00`, `GST included 0.42`).

**Stated limit - cross-line labels.** When a label is on one line and its value on the next
(`AMOUNT DUE` / `47.83`), the translator does **not** stitch them together; that total is reported
`not in source`. This is a deliberate, fidelity-safe refusal (a refusal is not an invention), and it is
the one common layout the same-line rule does not yet cover. Do not work around it by guessing.

## Totals, taxes, currency, dates - the disambiguation rules

- **Amount** is the transaction total from a total-labelled line. If a **final-owed** total is printed
  (`Total Due`, `Amount Due`, `Balance Due`, `Grand Total`, `Amount/Total Payable/Paid`), the amount
  must come from it, not from a plain `Total` (a cash-rounding receipt with `Total 22.94` and
  `Total Due 22.95` yields `22.95`). If the receipt names **more than one distinct total** and none is
  a single final-owed total, the amount is **`not in source`** - the receipt does not identify one, and
  choosing is a guess.
- **Tax** comes from a tax-labelled line (`Tax`, `GST`, `HST`, `PST`, `QST`, `VAT`, `Duty`, `Levy`),
  never computed as total minus subtotal. On a **columnar** grocery layout (`GST 27.98 1.40`, i.e.
  `Tax-Code | Taxable-Value | Tax-Value`), the tax is the **Tax-Value column** - the last money value the
  label governs (`1.40`) - never the taxable base (`27.98`). A `<rate>%` between the label and the amount
  is skipped (`GST 5.00% 11.15` -> `11.15`).
- **Currency** must be printed **adjacent to the amount value** (`Total CAD 16.42`, `$39.36`). It is the
  code on the money. **Stated limit (deliberate):** a currency that is only declared remotely
  (`All prices in JPY` at the top), printed on a different line than the total, or mentioned in prose is
  reported `not in source`, not attributed. This refuses more than a human would, on purpose: attributing
  a non-adjacent currency is where currencies get laundered or guessed (a tourist-info `EUR`, one of two
  declared currencies), so the checker binds currency only to the amount it sits on.
- **Date** is the transaction date, exactly as printed (never normalized): a bare date line, or one a
  date label governs (`Date`, `DateTime`, `DATE/TIME`, `Invoice`, `Issued`, `Sale`, `Order`, ...). A
  label-governed date outranks a bare footer date, so a receipt that prints the date twice is not
  ambiguous. A check-in, expiry, or auth-ref date does not qualify and is `not in source`; a date sharing
  a line with a register/terminal number but no date label (`0253 01/04/25 13:25`) is also `not in source`.

## What the checker proves, and what it does not

`verify/check.mjs` validates the OUTPUT artifact against the input it cites: shape, span-and-kind trace,
coverage (nothing dropped), block isolation. It does not execute the model; the rules the model follows
are prose, and the live evidence for the model obeying them is the live model runs on unseen receipts
(the model-in-the-loop corpus) checked in `verify/outputs/model-run-*.json`. A recorded human walk will
be added under `receipts/human-walk/`.
