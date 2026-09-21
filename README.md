# The Translator — receipt text to a source-locked expense record

A folder-based AI translator with an executable no-invention test. Feed it the text of one or more
receipts; it returns a fixed-shape expense-report record, one line per receipt, the same way every
time. Every value either quotes the exact input line it came from or says `not in source`. Nothing is
computed, normalized, or inferred, and a bundled offline checker (`verify/check.mjs`) proves it against
the input, so **a non-source value is a test failure, not a matter of trust**.

Who does this by hand today: bookkeepers, admins, freelancers, and small-business owners turning a
pile of receipts into an expense report at month end.

## Start here (three-minute proof)

If you are judging this, read **[`PROOF.md`](PROOF.md)** first — it is the cold walk: the one-page
contract, one command that shows every real output tracing clean and every planted invention failing,
one worked real receipt, and the full attack surface. Two commands are the whole proof:

```
node verify/check.mjs            # every output traces clean; all 68 planted inventions fail through their gate
node verify/check.mjs --matrix   # the same result as a one-screen verdict
```

Every deliberately-wrong output lives in `verify/fixtures/fail_*.json`, grouped by how someone would
cheat in [`verify/fixtures/THREAT-MODEL.md`](verify/fixtures/THREAT-MODEL.md). If any invention ever
passed, the run goes red.

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

See `examples.md` for three worked pairs. The full input grammar the translator accepts, and the
layouts it deliberately refuses, are in `reference/expense-report/input-grammar.md`.

## Limits (stated, not hidden)

- **Scope: transcription in, record out.** The input is the receipt's *text* — the lines a scanner or a
  person typing produces. Turning a photo into that text (OCR) is a separate, commodity step; it is not
  what this tool does or claims, and the guarantee begins at the text. Feed it a transcription, not a
  photo and not a prose story about a receipt. This is why the committed `inputs/*.txt` are readable
  transcriptions: the tool is measured on moving that text into fields without inventing, and the checker
  proves each value against those exact lines.
- **Cross-line labels.** A total whose label is on one line and value on the next (`AMOUNT DUE` then
  `47.83`) is reported `not in source`, not stitched together. A fidelity-safe refusal, never an
  invented value.
- **Currency on a remote line.** A currency stated only on a declaration line (`All prices in JPY`) is
  accepted; the checker bounds this to declaration / monetary / bare-code lines but cannot prove the
  declaration governs this particular receipt. Verify it by eye.
- **The checker audits the output, not the model.** It proves the emitted record against the input it
  cites; the model's obedience to the rules is shown by the recorded runs in `RESULTS.md` and
  `docs/DESIGN.md` (a cold run, a no-folder control run, and live model runs on unseen receipts, wired
  into the checked suite as `verify/outputs/model-run-*.json`), with a recorded human walk to be added
  under `receipts/human-walk/`.

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
by a stranger, with no dependencies beyond Node. For a one-screen verdict:

```
node verify/check.mjs --matrix
```

prints a pass/fail matrix: real outputs (including live model runs on unseen receipts) all trace to
their input, and every planted attack, by class (invented value / dropped field / schema break /
cross-receipt citation), is caught. For the full per-file detail:

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
- **fixtures** - the kept-red files in `verify/fixtures/fail_*.json` each plant exactly one invention or
  misattribution and MUST fail, each **through the gate it declares** (`_expect_gate`), so a fixture
  cannot pass by failing for the wrong reason. They span the whole attack surface: computed total,
  inferred category, assumed/laundered currency, invented year, normalized vendor (case or spacing),
  dropped line/field, hollow `not in source`, extra or underscore key, wrong conversion, cross-line or
  cross-receipt citation, over-citation, truncation, subtotal/tax/fare/tip/tender posing as the amount,
  a rate (`8.25%`) posing as money, ambiguous totals or dates, a `../` traversal source_file, and
  duplicate JSON keys. The file names in `verify/fixtures/` are the authoritative list, and
  `node verify/check.mjs --matrix` prints the live count by class.

Beyond field-kind checks, the gates enforce **positional binding**: a value's kind comes from **one
line**, and the required label must *govern* the value - sit immediately to its left. So a kind may
not be assembled across two lines (a subtotal supplying the word "total", a line item supplying
cleanliness), and a label may not be borrowed from a different number (`Total Distance 12.40` does not
make `12.40` a total; `Grand Total (order 5567) 40.00` binds `40.00`, not `5567`). Labels match on
**word boundaries** (`subtotal` is not a `total`, `taxi` is not a `tax`) and are **allowlists** of the
real total/date labels, not denylists of decoys. `vendor` must equal the **receipt header line
verbatim**. `currency` must be **adjacent to the amount** (so a second currency on the line can't be
paired with it) and is rejected as `not in source` when a currency token sits on a cited line. `date`
must be a **bare date or governed by a date label** (invoice/issued/…), not a check-in/expiry/auth
date. A field may **not be marked `not in source` when its label governs a value in the block** - a
printed total/tax/category can't be dropped into `unmapped` and reported empty. When the amount's line
prints a currency, the `currency` must be the code **adjacent to the amount** there (so a currency from
a disclaimer can't be paired with a total in another currency). Duplicate JSON keys are rejected at the
raw-text level. (Because the label must *govern* the value, a legitimate total that mentions an item
count - `Total 40.00 (10 items)` - is accepted; the gate does not blanket-ban money-adjacent words.)

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

- **Vendor header assumption.** `vendor` must equal the receipt header (its block's first line)
  verbatim, which holds for ordinary receipts and blocks a footer, processor line, or truncation. The
  residual: if a receipt puts a non-name line first (a logo caption or address before the merchant
  name), the true name isn't the header - that layout is read by eye.
- **`not in source` on a shared line.** A field marked `not in source` whose value sits on a line a
  *different* field already cites is not caught mechanically (coverage still sees the line as
  accounted for). The common own-line case is caught by coverage, and the specific currency case (a
  currency printed on a cited line) is now caught; the general case for other fields is read by eye.
- **Ambiguous multi-keyword lines and multiples.** Line-kind detection is keyword-based, so it cannot
  disambiguate a line that carries two competing kinds, or pick among several lines of the same kind.
  The residual cases read by eye are narrow: (1) a line with both a grand-total word and a tax word
  (`Total incl. tax 105.00`) resolves *safely* - the amount gate rejects it (positional binding), so
  the worst case is a refusal (`not in source`), never a wrong amount; (2) two *conflicting* final
  totals of different value (`Amount Due 40` and `Balance Due 45` on one receipt) - rare and
  self-contradictory; (3) two printed currencies where the amount's line has none. Note what is NOT a
  limit: a plain `Total` printed alongside a `Total Due`/`Amount Due`/`Grand Total` is resolved by the
  **final-total priority rule** (amount must be the final owed total, e.g. `22.95` not `22.94` on a
  cash-rounding receipt); and *assembling* a kind across two lines is closed by the single-line rule.
  The clear decoys (`Total Savings`, `Total Distance`, a `Previous Balance`, an `Auth Ref` or
  `Check-in` date, a taxi fare as tax) are all rejected.
- **Duplicate JSON keys** are now rejected at the raw-text level (a repeated key in one object fails
  `[shape]`), so a reader and the parser cannot be shown different values.

## What it does not do

It does not summarize, rewrite, judge, categorize by guessing, compute totals or tax, or normalize
dates. It converts, with fidelity, and marks everything it could not source. That is the whole job.

## The engine is reusable (evidence, not the entry)

This entry is one translator: receipt text to an expense record, ruthlessly proven. But the checker in
`verify/` is conversion-agnostic - it reads a cartridge (`reference/<id>/`) and proves any output the
same way. As evidence the discipline is a reusable engine and not a one-off, the `cartridge-demo` branch
runs the same `verify/check.mjs` over two more conversions (customer email to a support ticket,
sales-call notes to a CRM record), each refusing to invent a severity from tone or a next step nobody
agreed to. The graded entry is this one, focused; the branch is there if you want to watch it generalize.
