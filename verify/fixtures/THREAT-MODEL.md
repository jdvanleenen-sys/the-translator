# Threat model — every way to cheat, and the fixture that catches it

The one way to lose this competition is to put something in the output that was not in the input. So the
threat model is *false provenance in all its forms*: an invented value, a value pulled from the wrong
line, a value altered on the way through, a value silently dropped, or the record shape bent to hide any
of those.

Each item below is a `verify/fixtures/fail_<name>.json` output that is deliberately wrong. Running
`node verify/check.mjs` requires **every one of them to fail, through the specific gate it declares**
(`[shape] [trace] [coverage] [block]`). If any planted invention ever passed, the run goes red. That is
what makes the guarantee executable rather than asserted.

The fixtures are grouped by how someone would cheat, below. For the live count, run
`node verify/check.mjs --matrix` (it prints `N/N caught`); fixtures added in later hardening rounds are
logged in `../../RESULTS.md`. The groups below name the representative cases in each class.

## 1. Invented value — a value that is nowhere in the receipt  ([trace])
The core disqualifier: a number, currency, name, or year manufactured from thin air.
`assumed-currency` · `currency-laundered` · `currency-disclaimer` · `invented-year` · `computed-total` · `phantom-vendor`

## 2. Right value, wrong kind of line — printed, but pulled from the wrong role  ([trace])
The number exists on the receipt, but under the wrong label: a subtotal or a tender posing as the total,
a fare or savings as the amount, a rate or taxable base as the tax, a line item as the category, an
auth/reference number as the date.
`subtotal-as-amount` · `tender-as-amount` · `lineitem-as-amount` · `savings-as-amount` · `total-tax-as-amount` · `total-distance-as-amount` · `orderid-as-amount` · `previous-balance-as-amount` · `was-price-as-amount` · `paid-vs-due` · `wrong-total-instance` · `tax-from-non-tax-line` · `taxi-as-tax` · `tax-rate` · `tax-base-not-value` · `ratelabel-nontax` · `item-as-category` · `category-is-label` · `amount-as-date` · `number-as-date` · `authref-as-date` · `checkin-as-date`

## 3. Mis-cited or fabricated across lines — false provenance  ([trace], one [block])
The value is real but the citation lies: assembled from two lines, split, over-cited to bury an
unrelated line, paired with the wrong currency, or cited across receipts.
`cross-line-value` · `split-amount` · `over-citation` · `currency-mispair` · `cross-block-citation` (block)

## 4. Altered value — truncated or normalized on the way through  ([trace])
A value changed from how it appeared: a truncated number/date, a "cleaned" vendor or category.
`truncated-amount` · `truncated-category` · `truncated-currency` · `truncated-date` · `category-normalized` · `vendor-normalized` · `vendor-truncation`

## 5. Ambiguity not refused — guessing when the receipt names more than one  ([trace])
Two distinct totals or two distinct dates: the receipt does not identify one, so the field must be
`not in source`. Choosing one is a guess.
`ambiguous-total` · `ambiguous-date`

## 6. Silent drop or false blank — something stated, but omitted or emptied  ([trace], [coverage], [block])
The mirror of invention: a printed value marked `not in source` and dumped, a line neither cited nor
disclosed, or a whole receipt dropped.
`false-not-in-source` · `amount-dropped` · `tax-dropped` · `date-dropped` · `category-dropped` · `vendor-dropped` · `dropped-currency` · `total-amount-dropped` · `datetime-date-dropped` · `batchcode-phantom-date` · `dropped-line` (coverage) · `dropped-receipt` (block)

## 7. Vendor / header integrity — a non-merchant line posing as the vendor  ([trace])
The merchant is the block header, verbatim: not a payment processor, a footer, a "guest copy" banner, a
card-terminal header, or a truncation.
`processor-as-vendor` · `vendor-cofooter` · `guest-copy-as-vendor` · `preamble-skip` · `txnrecord-as-vendor`

## 8. Shape / envelope integrity — bending the record to hide a claim  ([shape], two [trace])
The record shape is closed: no extra or missing fields, no stray keys (even in a cell or as an
annotation), no duplicate keys, the declared conversion, an in-repo evidence file, and a currency that is
a symbol/code with no digits, an amount that is a real number.
`extra-field` · `missing-field` · `extra-cell-key` · `annotation-key` · `duplicate-keys` · `wrong-conversion` · `traversal-source` · `currency-has-digits` (trace) · `empty-amount` (trace)
