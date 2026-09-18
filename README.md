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
checker (conversion must equal the schema id, no stray keys are allowed at any level - including
inside a field cell and including underscore-prefixed keys, line_no must equal its row index, reason
codes must come from the fixed vocabulary), so the envelope cannot become a place for invented
content to hide. `source_file` is confirmed to exist, and is pinned to the input the verifier chose
when the checker is run with `--input` (see below).

## The promise, and how to check it

The point of this translator is that it does not make things up. That claim is checkable, offline,
by a stranger, with no dependencies beyond Node:

```
node verify/check.mjs
```

This reads every output in `verify/outputs/`, opens the input file it names, and runs four gates:

- **shape** - every line has all seven fields, in order; no stray keys; empty ones `not in source`;
  `conversion` pinned to the schema id; `line_no` equal to its row index.
- **trace** - every filled value sits in a single cited input line as a **complete token** (not
  merely somewhere, not a truncation like `8` of `8.25`, not fabricated across lines, not empty),
  **and of the right kind for its field**: a numeric amount on a total-labeled line (never a
  subtotal/tax line or a fare), a numeric tax on a tax line, a category on a category-labeled line, a
  date that is date-shaped. The `source_file` must resolve **inside the repo** - an output cannot
  point its evidence at a `../` traversal or absolute path.
- **coverage** - every non-blank input line is either cited by a field or listed as unmapped with a
  controlled reason code (and any note must quote its line), so nothing is dropped silently.
- **fixtures** - twenty-eight planted flaws in `verify/fixtures/fail_*.json` (computed total,
  inferred category, assumed currency, invented year, expanded vendor, dropped line, missing field,
  hollow `not in source`, extra field, wrong conversion, cross-line value, subtotal-as-amount,
  line-item-as-amount, tax-total-as-amount, tax from a non-tax line, item-as-category, number-as-date,
  cross-block citation, dropped receipt, invented key inside a cell, underscore-key injection,
  truncated amount, truncated date, truncated currency, truncated category, empty amount,
  currency-holding-the-amount, category-holding-its-own-label, and a `../` traversal source_file) that
  MUST fail - and each must fail **through the gate it declares**, so a fixture cannot pass by failing
  for the wrong reason.

To check a single output: `node verify/check.mjs --output verify/outputs/receipts-coffee.json`.

To check your own run, pinning the evidence so the output cannot name a different input than the one
you fed:

```
node verify/check.mjs --input <your-receipt>.txt --output <your-output>.json
```

The output's `source_file` must resolve to `<your-receipt>.txt`, and every citation is traced
against that file. (Without `--input`, the checker trusts the `source_file` the output names - fine
for the shipped outputs, which name their own inputs.)

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
- **Ambiguous total labels.** Line-kind detection is keyword-based. A line that carries both a total
  word and a tax word (e.g. `Total incl. tax 105.00`) is uncommon on point-of-sale receipts; the
  amount gate treats a tax word on the cited line as a tax line, so such a sole-total-label case would
  need the plain total or is read by eye. The common tax-total confusion (`Total Tax 5.00`) is
  correctly rejected.
- **Duplicate JSON keys.** The checker validates the parsed object, so if a hand-crafted file
  contained the same key twice, `JSON.parse` keeps the last (as does any standard JSON reader), and
  the checker validates that same last value - there is no human-vs-checker discrepancy in the single
  saved artifact a judge runs. It does not separately reject duplicate keys at the raw-text level.

## What it does not do

It does not summarize, rewrite, judge, categorize by guessing, compute totals or tax, or normalize
dates. It converts, with fidelity, and marks everything it could not source. That is the whole job.
