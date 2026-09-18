# The Translator — receipt text to expense report

A folder-based AI translator. Feed it the text of one or more receipts; it returns a fixed-shape
expense-report record, one line per receipt, the same way every time. Every value in the output
either quotes the input line it came from or says `not in source`. Nothing is invented.

Who does this by hand today: bookkeepers, admins, freelancers, and small-business owners turning a
pile of receipts into an expense report at month end.

## Quick start

1. Create a Claude project and add this folder to it (or paste `identity.md`, `rules.md`, and
   `reference/expense-report/` into the context).
2. Paste the text of a receipt (or several, separated by a line with only `---`).
3. Claude returns one JSON object plus a rendered table. That is your expense-report record.

## What you feed it, what comes back

- **In:** plain text describing receipts. Messy is fine - typed, dictated, or pulled off a photo.
- **Out:** a JSON object with one `line` per receipt and seven fixed fields per line:
  `line_no, date, vendor, amount, currency, category, tax`. Empty fields say `not in source`.
  A readable table is rendered beneath the JSON.

See `examples.md` for three worked pairs.

## The promise, and how to check it

The point of this translator is that it does not make things up. That claim is checkable, offline,
by a stranger, with no dependencies beyond Node:

```
node verify/check.mjs
```

This reads every output in `verify/outputs/`, opens the input file it names, and runs four gates:

- **shape** - every line has all seven fields, in order; empty ones marked `not in source`.
- **trace** - every filled value is found on the specific input line it cites (not merely
  somewhere in the input).
- **coverage** - every non-blank input line is either cited by a field or listed as unmapped, so
  nothing is dropped silently.
- **fixtures** - eight planted inventions in `verify/fixtures/fail_*.json` (a computed total, an
  inferred category, an assumed currency, an invented year, an expanded vendor name, a dropped
  line, a missing field, a hollow `not in source`) that MUST fail. If any passes, the gate it
  tests is dead.

To check a single output: `node verify/check.mjs --output verify/outputs/receipts-coffee.json`.

To check your own run: save Claude's JSON to a file whose `source_file` points at your input text,
then run `node verify/check.mjs --output <your-file>.json`.

## The contract

`reference/expense-report/` is the contract, written down so a reader can check it:

- `schema.json` - the fields, their order, and which is structural.
- `field-definitions.md` - what each field means and its rule.
- `format-spec.md` - the input and output formats.

## Honest limit

The trace and coverage gates catch an invented value, a mis-cited value, a dropped line, and a
`not in source` that skips a value sitting on its own line. The one case they do **not** fully
catch mechanically: a field marked `not in source` whose value is sitting on a line that a
*different* field already cites (so coverage still sees the line as accounted for). That case is
caught by reading, not by the checker. It is disclosed here rather than hidden.

## Repo layout

```
identity.md            what it converts, from what, to what
rules.md               how it maps; the three laws; the tie-breakers
examples.md            three worked input/output pairs
reference/
  expense-report/      the contract: schema.json, field-definitions.md, format-spec.md
inputs/                three real (pseudonymized) receipt-text inputs
verify/
  check.mjs            the offline checker (four gates)
  outputs/             the checked outputs for the three inputs
  fixtures/            kept-red inventions that must fail, plus the sample receipt
TEST_METHOD.md         the frozen test method (what is tested, the pass bars)
RESULTS.md             the recorded run of the method
```

## What it does not do

It does not summarize, rewrite, judge, categorize by guessing, compute totals or tax, or normalize
dates. It converts, with fidelity, and marks everything it could not source. That is the whole job.
