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
- **fixtures** - thirty-three planted flaws in `verify/fixtures/fail_*.json` (computed total,
  inferred category, assumed currency, invented year, expanded vendor, dropped line, missing field,
  hollow `not in source`, extra field, wrong conversion, cross-line value, subtotal-as-amount,
  line-item-as-amount, tax-total-as-amount, tax from a non-tax line, item-as-category, number-as-date,
  cross-block citation, dropped receipt, invented key inside a cell, underscore-key injection,
  truncated amount, truncated date, truncated currency, truncated category, empty amount,
  currency-holding-the-amount, category-holding-its-own-label, a `../` traversal source_file, a
  `Total Savings` decoy as amount, an `Auth Ref` date, a payment-processor footer as vendor, a dropped
  printed currency, and duplicate JSON keys) that MUST fail - and each must fail **through the gate it
  declares**, so a fixture cannot pass by failing for the wrong reason.

Beyond field-kind checks, the gates also require `vendor` to come from the **receipt header** (the
block's first line, so a footer or processor line can't pose as the merchant), reject a `currency`
marked `not in source` when a currency token sits on a cited line, keep `date` off `auth`/`ref`/`card`
lines, and **reject duplicate JSON keys** at the raw-text level so a reader and the parser cannot see
different values.

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

- **Vendor header assumption.** `vendor` must be the receipt's header (its block's first line), which
  holds for ordinary receipts and blocks a footer/processor line. The residual: if a receipt puts a
  non-name line first (a logo caption or address before the merchant name), the true name isn't the
  header - that layout is read by eye.
- **`not in source` on a shared line.** A field marked `not in source` whose value sits on a line a
  *different* field already cites is not caught mechanically (coverage still sees the line as
  accounted for). The common own-line case is caught by coverage, and the specific currency case (a
  currency printed on a cited line) is now caught; the general case for other fields is read by eye.
- **Ambiguous multi-keyword lines and multiples.** Line-kind detection is keyword-based, so it cannot
  disambiguate a line that carries two competing kinds, or pick among several lines of the same kind.
  Three inherent cases are read by eye: (1) a line with both a grand-total word and a tax word
  (`Total incl. tax 105.00`) - can't be told from a legitimate `Total Tax 5.00`; (2) two total-labeled
  lines (`Total` vs `Total Due`) - no authoritative-total rule; (3) two printed currencies - no
  tie-breaker. The clear decoys (`Total Savings`, `Total Discount`, an `Auth Ref` date) ARE rejected.
- **Duplicate JSON keys** are now rejected at the raw-text level (a repeated key in one object fails
  `[shape]`), so a reader and the parser cannot be shown different values.

## What it does not do

It does not summarize, rewrite, judge, categorize by guessing, compute totals or tax, or normalize
dates. It converts, with fidelity, and marks everything it could not source. That is the whole job.
