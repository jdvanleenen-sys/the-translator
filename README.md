# The Translator — receipt text to expense report

A folder-based AI translator. Feed it the text of one or more receipts; it returns a fixed-shape
expense-report record, one line per receipt, the same way every time. Every value that makes a claim
about the receipt either quotes the input line it came from or says `not in source`. Nothing is
invented.

Who does this by hand today: bookkeepers, admins, freelancers, and small-business owners turning a
pile of receipts into an expense report at month end.

## Quick start

1. Create a Claude project and add this folder to it (or paste `identity.md`, `rules.md`, and
   `reference/expense-report/` into the context).
2. Paste the text of a receipt (or several, separated by a line with only `---`).
3. Claude returns one JSON object (the record) plus, for reading, a rendered table beneath it. The
   JSON is what you save and check.

## What you feed it, what comes back

- **In:** plain text describing receipts. Messy is fine.
- **Out:** a JSON object with one `line` per receipt and seven fixed fields per line:
  `line_no, date, vendor, amount, currency, category, tax`. Empty fields say `not in source`.

See `examples.md` for three worked pairs.

## The structural envelope (nothing hides here)

Besides the receipt values, the output carries a small envelope that is not a claim about the
receipt: the field names, `line_no` (row index), `source_file`, `conversion`, and the controlled
`unmapped_input_lines` reason codes. These are declared in `reference/` and each is pinned by the
checker (conversion must equal the schema id, no stray keys are allowed, line_no must equal its row
index, reason codes must come from the fixed vocabulary), so the envelope cannot become a place for
invented content to hide.

## The promise, and how to check it

The point of this translator is that it does not make things up. That claim is checkable, offline,
by a stranger, with no dependencies beyond Node:

```
node verify/check.mjs
```

This reads every output in `verify/outputs/`, opens the input file it names, and runs four gates:

- **shape** - every line has all seven fields, in order; no stray keys; empty ones `not in source`;
  `conversion` pinned to the schema id; `line_no` equal to its row index.
- **trace** - every filled value sits in a single cited input line (not merely somewhere, not
  fabricated across lines), **and of the right kind for its field**: a tax on a tax line, a category
  on a category-labeled line, an amount not on a subtotal/tax line, a date that is date-shaped.
- **coverage** - every non-blank input line is either cited by a field or listed as unmapped with a
  controlled reason code (and any note must quote its line), so nothing is dropped silently.
- **fixtures** - sixteen planted flaws in `verify/fixtures/fail_*.json` (computed total, inferred
  category, assumed currency, invented year, expanded vendor, dropped line, missing field, hollow
  `not in source`, extra field, wrong conversion, cross-line value, subtotal-as-amount, tax from a
  non-tax line, item-as-category, number-as-date, cross-block citation, dropped receipt) that MUST
  fail - and each must fail **through the gate it declares**, so a fixture cannot pass by failing for
  the wrong reason.

To check a single output: `node verify/check.mjs --output verify/outputs/receipts-coffee.json`.

To check your own run: save Claude's JSON to a file whose `source_file` points at your input text,
then run `node verify/check.mjs --output <your-file>.json`.

## The contract

`reference/expense-report/` is the contract, written down so a reader can check it:
`schema.json` (fields, order, reason codes, per-field constraints), `field-definitions.md`, and
`format-spec.md`.

## Honest limits

Stated plainly rather than hidden:

- **Vendor semantics.** A vendor name is free text, so the checker confirms the vendor value sits on
  its cited line but cannot prove that line is "the merchant line" rather than some other text. This
  one field is verified by reading, not mechanically. Every other field is line-kind constrained.
- **`not in source` on a shared line.** A field marked `not in source` whose value sits on a line
  that a *different* field already cites is not caught mechanically (coverage still sees the line as
  accounted for). Caught by reading. The common case - the skipped value on its own line - is caught
  by coverage.

## What it does not do

It does not summarize, rewrite, judge, categorize by guessing, compute totals or tax, or normalize
dates. It converts, with fidelity, and marks everything it could not source. That is the whole job.
