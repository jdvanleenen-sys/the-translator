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
  decoration (`*** CUSTOMER COPY ***`, `THANK YOU`, `RECEIPT`, `DUPLICATE`, ...). A line that merely
  contains such a word ("Thank You Cafe") is a merchant, not a preamble.

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
  never computed as total minus subtotal.
- **Currency** must be adjacent to the amount, or come from a currency declaration / monetary line
  (`All prices in JPY`, `Currency: USD`, a bare code line). A currency lifted from unrelated text (an ad
  line) is rejected. **Stated limit:** a currency stated only on a remote declaration line is read by a
  human against that line; the mechanical check bounds it to declaration/monetary/bare lines but cannot
  prove the declaration governs *this* receipt.
- **Date** is the transaction date, exactly as printed (never normalized): a bare date line, or one a
  date label governs (`Date`, `Invoice`, `Issued`, `Sale`, `Order`, ...). A check-in, expiry, or
  auth-ref date does not qualify and is `not in source`.

## What the checker proves, and what it does not

`verify/check.mjs` validates the OUTPUT artifact against the input it cites: shape, span-and-kind trace,
coverage (nothing dropped), block isolation. It does not execute the model; the rules the model follows
are prose, and the live evidence for the model obeying them is the recorded runs in `RESULTS.md` and
`docs/DESIGN.md` (a cold run, a no-folder control run, and live model runs on unseen receipts checked
in `verify/outputs/model-run-*.json`); a recorded human walk will be added under `receipts/human-walk/`.
