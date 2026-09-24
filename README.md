# The Translator — receipt text to a source-locked expense record

## For judges — a 30-second proof

    node verify/check.mjs --matrix

    → 31/31 outputs traced clean · 92/92 planted inventions caught · READY

No install (Node standard library only). Every value in every output points at the exact input line it
was copied from, or says `not in source`; each planted-invention fixture fails through the specific gate
it declares, so a decoy cannot pass by failing for the wrong reason. Full cold walk:
**[`PROOF.md`](PROOF.md)**.

Prefer to *see* it? **[Open the live card view →](https://jdvanleenen-sys.github.io/the-translator/card.html)**
(or `card.html` in the repo) — four real committed outputs rendered as readable expense cards; click any
field to light up the exact receipt line it was copied from.

---

A folder-based AI translator with an executable no-invention test. Feed it the text of one or more
receipts; it returns a fixed-shape expense-report record, one line per receipt, the same way every
time. Every value either quotes the exact input line it came from or says `not in source` — nothing is
computed, normalized, or inferred. A bundled offline checker (`verify/check.mjs`) proves that against
the input, so **a non-source value is a test failure, not a matter of trust**.

Who does this by hand today: bookkeepers, admins, freelancers, and small-business owners turning a
pile of receipts into an expense report at month end.

## Start here (three-minute proof)

If you are judging this, read **[`PROOF.md`](PROOF.md)** first — the cold walk: the one-page contract,
one worked receipt, and the full attack surface. The whole proof is two commands, offline, no
dependencies beyond Node:

```
node verify/check.mjs            # every output traces clean; every planted invention fails through its gate
node verify/check.mjs --matrix   # the same result as a one-screen verdict (prints N/N caught)
```

Every deliberately-wrong output lives in `verify/fixtures/fail_*.json`, grouped by how someone would
cheat in [`verify/fixtures/THREAT-MODEL.md`](verify/fixtures/THREAT-MODEL.md). If any invention ever
passed, the run goes red. The round-by-round hardening log is `RESULTS.md`.

## Quick start

1. Create a Claude project and add this folder (or paste `identity.md`, `rules.md`, and
   `reference/expense-report/` into the context).
2. Paste the text of a receipt (or several, separated by a line with only `---`).
3. Claude returns one JSON object (the record) plus, for reading, a rendered table beneath it. The
   JSON is what you save and check.

## What you feed it, what comes back

- **In:** plain text describing receipts. Messy is fine.
- **Out:** a JSON object with one `line` per receipt and seven fixed fields per line:
  `line_no, date, vendor, amount, currency, category, tax`. Empty fields say `not in source`.

See `examples.md` for three worked pairs, and `reference/expense-report/input-grammar.md` for the full
grammar and the layouts it deliberately refuses.

## What the checker enforces

`node verify/check.mjs` reads every output in `verify/outputs/`, opens the input it names, and runs
four gates:

- **shape** — every line has all seven fields, in order; no stray keys at any level (including inside a
  cell and underscore-prefixed keys); empty ones say `not in source`; `conversion` pinned to the schema
  id; `line_no` equal to its row index; duplicate JSON keys rejected at the raw-text level.
- **trace** — every filled value sits in a single cited line as a **complete token** (not a truncation
  like `8` of `8.25`, not assembled across two lines), **and of the right kind**: an amount on a
  total-labeled line (never a subtotal/tax/fare), tax on a tax line, category on a category-labeled
  line, a date-shaped date. Beyond kind, the label must **govern** the value — sit immediately to its
  left — so `Total Distance 12.40` is not a total, and a subtotal can't lend the word "total" to another
  number. Labels match on word boundaries (`subtotal` ≠ `total`) and are allowlists, not decoy
  denylists. `vendor` = the receipt header verbatim; `currency` = the code adjacent to the amount on the
  total line; `date` = bare or governed by a date label, never a check-in/expiry/auth date.
  `source_file` must resolve inside the repo.
- **coverage** — every non-blank input line is either cited by a field or listed in
  `unmapped_input_lines` with a controlled reason code (any note must quote its line), so nothing is
  dropped silently. A field may not be marked `not in source` when its label governs a value in the block.
- **fixtures** — each `verify/fixtures/fail_*.json` plants one invention or misattribution and MUST
  fail **through the gate it declares** (`_expect_gate`), so it can't pass by failing for the wrong reason.

The output also carries a small structural envelope that is not a claim about the receipt — the field
names, `line_no`, `source_file`, `conversion`, and the controlled `unmapped_input_lines` reason codes —
all declared in `reference/` and pinned by the checker, so the envelope can't become a place for
invented content to hide.

To check one output: `node verify/check.mjs --output verify/outputs/receipts-coffee.json`.

To check your own run, pinning the evidence so the output can't name a different input than the one you
fed:

```
node verify/check.mjs --input <your-receipt>.txt --output <your-output>.json
```

The output's `source_file` must resolve to `<your-receipt>.txt`, and every citation is traced against
it. (Without `--input`, the checker trusts the `source_file` the output names — fine for the shipped
outputs, which name their own inputs.)

## The contract

`reference/expense-report/` is the contract, written so a reader can check it: `schema.json` (fields,
order, reason codes, per-field constraints), `field-definitions.md`, and `format-spec.md`.

## Limits, stated plainly (not hidden)

- **Two inputs: text, or a photo.** The core input is the receipt's *text* — the lines a scanner or a
  person typing produces (the committed `inputs/*.txt`). A **photo** also works via image mode
  (`reference/expense-report/image-input.md`): the model transcribes the photo verbatim into numbered
  lines, then translates that transcription, and **shows both** — so every value still traces to a
  citable line and the same checker still proves the record. The honest boundary is drawn where a machine
  can't prove: the *structuring* is proven every time (record ↔ transcription); reading pixels into text
  (OCR) is the one step shown-not-claimed, so an OCR misread is visible in the transcription, never
  silent. The tool never claims a value its transcription doesn't contain.
- **The checker audits the output, not the model.** It proves the emitted record against the input it
  cites. That the model *itself* obeys the rules is shown by live runs on unseen adversarial receipts
  across models (Haiku, Sonnet, Opus) — currency-declared-in-prose, cross-line totals, subtotal-vs-total,
  ambiguous totals, foreign VAT, a card-expiry-vs-date trap — each traced clean by the same checker
  (`verify/outputs/model-run-*.json`). A recorded human hand-check by a non-technical verifier is in
  `receipts/human-walk/` (a values-match check, honestly labeled — the verifier is known to the builder,
  not an independent stranger).
- **Cross-line labels.** A total whose label is on one line and value on the next (`AMOUNT DUE` /
  `47.83`) is reported `not in source`, not stitched — a fidelity-safe refusal, never an invention.
- **Vendor header assumption.** `vendor` must equal the block's first line verbatim, which blocks a
  footer, processor line, or truncation. If a receipt puts a non-name line first (a logo caption or
  address before the merchant name), the true name isn't the header — read by eye.
- **`not in source` on a shared line.** A field marked `not in source` whose value sits on a line a
  *different* field already cites is not caught mechanically. The own-line case is caught by coverage,
  and the currency case is caught; the general case for other fields is read by eye.
- **Look-alike labelled lines (stated honestly).** A value must sit under a required label, of the right
  kind, and — for amount and tax — look like money (carry a decimal), so a guest count next to `Gst`, an
  item count in `Total 3 Items`, or a registration number next to `GST` is neither taken as a total/tax
  nor forced into one when the field is correctly left `not in source`. What the checker *cannot* do is
  tell a real number that merely sits under a matching label from the one that belongs there: it treats
  `4` the same whether it is a $4 tax or `Gst 4` meaning four guests. So the guarantees are precise — no
  **fabrication** (nothing appears that isn't in the input) and no **forced** field (a stated total/tax
  can't be silently dropped, and a count/ID won't force one) — but "always the semantically perfect
  field" is not among them; a copied real value can land under a matching-but-wrong label. Genuinely
  ambiguous lines still resolve by refusing: a total word and a tax word on one line
  (`Total incl. tax 105.00`) is rejected by positional binding; a currency stated only remotely or in
  prose (`All prices in JPY`) is `not in source`. Not a limit: a plain `Total` beside a
  `Total Due`/`Grand Total` (final-owed priority); assembling a kind across two lines (single-line rule);
  the clear decoys (`Total Savings`, `Total Distance`, `Previous Balance`, an `Auth Ref` or `Check-in`
  date, a taxi fare as tax) are all rejected.

## What it does not do

It does not summarize, rewrite, judge, categorize by guessing, compute totals or tax, or normalize
dates. It converts, with fidelity, and marks everything it could not source. That is the whole job.

## The engine is reusable (evidence, not the entry)

This entry is one translator: receipt text to an expense record, ruthlessly proven. But the checker in
`verify/` is conversion-agnostic — it reads a cartridge (`reference/<id>/`) and proves any output the
same way. As evidence the discipline is a reusable engine and not a one-off, the `cartridge-demo` branch
runs the same `verify/check.mjs` over two more conversions (customer email → support ticket, sales-call
notes → CRM record), each refusing to invent a severity from tone or a next step nobody agreed to. The
graded entry is this one, focused; the branch is there if you want to watch it generalize.
