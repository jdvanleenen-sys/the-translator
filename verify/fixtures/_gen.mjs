// Generator for the kept-red fixtures. Each fixture is a valid baseline output with exactly one
// planted flaw, tagged with the gate it must fail through. Run: node verify/fixtures/_gen.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));

const SIMPLE = 'verify/fixtures/sample-receipt.txt';       // 1 Blue Ridge Coffee Co / 2 Jan 3 / 3 1 Large Latte / 4 Total 6.50 / 5 Card ****1234
const RICH = 'verify/fixtures/sample-receipt-rich.txt';    // 1 Acme Hardware / 2 March 2 / 3 Hammer 20.00 / 4 Subtotal 20.00 / 5 Tax 1.00 / 6 Total 21.00 / 7 Category: Supplies
const BLOCKS = 'verify/fixtures/sample-receipt-blocks.txt'; // 1 Cafe One / 2 Jan 3 / 3 --- / 4 Jan 4 / 5 Total 5.00

const nis = { value: 'not in source' };

// valid baseline for the simple receipt
const simpleLine = () => ({
  line_no: 1,
  date: { value: 'Jan 3', cite: [2] },
  vendor: { value: 'Blue Ridge Coffee Co', cite: [1] },
  amount: { value: '6.50', cite: [4] },
  currency: nis, category: nis, tax: nis,
});
const simpleUnmapped = () => ([
  { line: 3, code: 'line_item', note: '1 Large Latte' },
  { line: 5, code: 'card_mask', note: 'Card ****1234' },
]);
const simple = () => ({ conversion: 'expense-report', source_file: SIMPLE, lines: [simpleLine()], unmapped_input_lines: simpleUnmapped() });

// valid baseline for the rich receipt
const richBase = () => ({
  conversion: 'expense-report', source_file: RICH,
  lines: [{
    line_no: 1,
    date: { value: 'March 2', cite: [2] },
    vendor: { value: 'Acme Hardware', cite: [1] },
    amount: { value: '21.00', cite: [6] },
    currency: nis,
    category: { value: 'Supplies', cite: [7] },
    tax: { value: '1.00', cite: [5] },
  }],
  unmapped_input_lines: [
    { line: 3, code: 'line_item', note: 'Hammer 20.00' },
    { line: 4, code: 'subtotal', note: 'Subtotal 20.00' },
  ],
});

const fixtures = {};

// --- simple-receipt fixtures ---
{ const f = simple(); f._expect_gate = 'trace'; f._fixture = 'amount is a computed/wrong total (12.00) not on its cited line'; f.lines[0].amount = { value: '12.00', cite: [4] }; fixtures['fail_computed-total'] = f; }
{ const f = simple(); f._expect_gate = 'trace'; f._fixture = 'date normalized to 2026-01-03; the year is not on the cited line (Jan 3)'; f.lines[0].date = { value: '2026-01-03', cite: [2] }; fixtures['fail_invented-year'] = f; }
{ const f = simple(); f._expect_gate = 'trace'; f._fixture = 'currency USD assumed; no symbol/code on the cited line'; f.lines[0].currency = { value: 'USD', cite: [4] }; fixtures['fail_assumed-currency'] = f; }
{ const f = simple(); f._expect_gate = 'trace'; f._fixture = 'vendor expanded to Company; input printed Co'; f.lines[0].vendor = { value: 'Blue Ridge Coffee Company', cite: [1] }; fixtures['fail_phantom-vendor'] = f; }
{ const f = simple(); f._expect_gate = 'coverage'; f._fixture = 'line 3 line item silently dropped'; f.unmapped_input_lines = [{ line: 5, code: 'card_mask', note: 'Card ****1234' }]; fixtures['fail_dropped-line'] = f; }
{ const f = simple(); f._expect_gate = 'shape'; f._fixture = 'tax field absent from the line object'; delete f.lines[0].tax; fixtures['fail_missing-field'] = f; }
{ const f = simple(); f._expect_gate = 'coverage'; f._fixture = 'date marked not in source though line 2 (Jan 3) is left unaccounted'; f.lines[0].date = nis; fixtures['fail_false-not-in-source'] = f; }
{ const f = simple(); f._expect_gate = 'shape'; f._fixture = 'invented extra field approved on the line object'; f.lines[0].approved = true; fixtures['fail_extra-field'] = f; }
{ const f = simple(); f._expect_gate = 'shape'; f._fixture = 'conversion is not the schema id'; f.conversion = 'anything-i-like'; fixtures['fail_wrong-conversion'] = f; }
{ const f = simple(); f._expect_gate = 'trace'; f._fixture = 'vendor fabricated across lines 1 and 2; on no single line'; f.lines[0].vendor = { value: 'Blue Ridge Coffee Co Jan 3', cite: [1, 2] }; fixtures['fail_cross-line-value'] = f; }

// --- rich-receipt fixtures (semantic mapping: the convergent weakest point) ---
{ const f = richBase(); f._expect_gate = 'trace'; f._fixture = 'amount sourced from the Subtotal line (20.00) instead of the Total (21.00)';
  f.lines[0].amount = { value: '20.00', cite: [4] };
  f.unmapped_input_lines = [{ line: 3, code: 'line_item', note: 'Hammer 20.00' }, { line: 6, code: 'other', note: 'Total 21.00' }];
  fixtures['fail_subtotal-as-amount'] = f; }
{ const f = richBase(); f._expect_gate = 'trace'; f._fixture = 'tax pulled from a non-tax line (Hammer 20.00)';
  f.lines[0].tax = { value: '20.00', cite: [3] };
  f.unmapped_input_lines = [{ line: 4, code: 'subtotal', note: 'Subtotal 20.00' }, { line: 5, code: 'other', note: 'Tax 1.00' }];
  fixtures['fail_tax-from-non-tax-line'] = f; }
{ const f = richBase(); f._expect_gate = 'trace'; f._fixture = 'category inferred from a line item (Hammer) not a category-labeled line';
  f.lines[0].category = { value: 'Hammer', cite: [3] };
  f.unmapped_input_lines = [{ line: 4, code: 'subtotal', note: 'Subtotal 20.00' }, { line: 7, code: 'other', note: 'Category: Supplies' }];
  fixtures['fail_item-as-category'] = f; }
{ const f = richBase(); f._expect_gate = 'trace'; f._fixture = 'a bare amount (20.00) parked in the date field';
  f.lines[0].date = { value: '20.00', cite: [3] };
  f.unmapped_input_lines = [{ line: 2, code: 'other', note: 'March 2' }, { line: 4, code: 'subtotal', note: 'Subtotal 20.00' }];
  fixtures['fail_number-as-date'] = f; }

// --- block fixtures ---
{ const f = { _expect_gate: 'block', _fixture: 'receipt 1 cites line 5 (Total 5.00) from receipt 2 block', conversion: 'expense-report', source_file: BLOCKS,
    lines: [
      { line_no: 1, date: { value: 'Jan 3', cite: [2] }, vendor: { value: 'Cafe One', cite: [1] }, amount: { value: '5.00', cite: [5] }, currency: nis, category: nis, tax: nis },
      { line_no: 2, date: { value: 'Jan 4', cite: [4] }, vendor: nis, amount: nis, currency: nis, category: nis, tax: nis },
    ],
    unmapped_input_lines: [] };
  fixtures['fail_cross-block-citation'] = f; }
{ const f = { _expect_gate: 'block', _fixture: 'two receipt blocks but only one output line (a receipt dropped)', conversion: 'expense-report', source_file: BLOCKS,
    lines: [
      { line_no: 1, date: { value: 'Jan 3', cite: [2] }, vendor: { value: 'Cafe One', cite: [1] }, amount: nis, currency: nis, category: nis, tax: nis },
    ],
    unmapped_input_lines: [{ line: 4, code: 'other', note: 'Jan 4' }, { line: 5, code: 'other', note: 'Total 5.00' }] };
  fixtures['fail_dropped-receipt'] = f; }

// --- v3 fixtures (third cross-brain round: closed envelope + amount total-label) ---
const FARE = 'verify/fixtures/sample-receipt-fare.txt'; // 1 RideNow / 2 March 2 / 3 Fare 18.40 / 4 Total CAD 16.42
{ const f = { _expect_gate: 'trace', _fixture: 'amount taken from a line item (Fare 18.40) not the printed Total', conversion: 'expense-report', source_file: FARE,
    lines: [{ line_no: 1,
      date: { value: 'March 2', cite: [2] },
      vendor: { value: 'RideNow', cite: [1] },
      amount: { value: '18.40', cite: [3] },
      currency: { value: 'CAD', cite: [4] },
      category: nis, tax: nis }],
    unmapped_input_lines: [] };
  fixtures['fail_lineitem-as-amount'] = f; }
{ const f = simple(); f._expect_gate = 'shape'; f._fixture = 'an invented factual claim smuggled inside the amount cell object';
  f.lines[0].amount = { value: '6.50', cite: [4], approved_by_manager: 'Johannes' };
  fixtures['fail_extra-cell-key'] = f; }
{ const f = simple(); f._expect_gate = 'shape'; f._fixture = 'an underscore-prefixed key must NOT be exempt in a production output';
  f._injected_claim = 'approved by manager';
  fixtures['fail_annotation-key'] = f; }

// --- v4 fixtures (substring-truncation + evidence-authority) ---
const MARKET = 'verify/fixtures/sample-receipt-market.txt'; // 1 Green Grocer / 2 14-03-2026 / 3 Apples 4.20 / 4 Bread 3.10 / 5 Member discount -1.00 / 6 7.30 / 7 HST 0.95 / 8 Balance Due 8.25 / 9 Paid Interac
const marketBase = () => ({
  conversion: 'expense-report', source_file: MARKET,
  lines: [{ line_no: 1,
    date: { value: '14-03-2026', cite: [2] },
    vendor: { value: 'Green Grocer', cite: [1] },
    amount: { value: '8.25', cite: [8] },
    currency: nis,
    category: nis,
    tax: { value: '0.95', cite: [7] } }],
  unmapped_input_lines: [
    { line: 3, code: 'line_item', note: 'Apples 4.20' },
    { line: 4, code: 'line_item', note: 'Bread 3.10' },
    { line: 5, code: 'discount', note: 'Member discount -1.00' },
    { line: 6, code: 'other', note: '7.30' },
    { line: 9, code: 'payment_method', note: 'Paid Interac' },
  ],
});
{ const f = marketBase(); f._expect_gate = 'trace'; f._fixture = 'amount "8" is a truncation of the printed 8.25 (substring, not the whole token)';
  f.lines[0].amount = { value: '8', cite: [8] }; fixtures['fail_truncated-amount'] = f; }
{ const f = marketBase(); f._expect_gate = 'trace'; f._fixture = 'date "14-03" is a truncation of the printed 14-03-2026';
  f.lines[0].date = { value: '14-03', cite: [2] }; fixtures['fail_truncated-date'] = f; }
{ const f = marketBase(); f._expect_gate = 'trace'; f._fixture = 'amount is an empty string (includes("") would otherwise be trivially true)';
  f.lines[0].amount = { value: '', cite: [8] }; fixtures['fail_empty-amount'] = f; }
{ const f = { _expect_gate: 'shape', _fixture: 'source_file uses a ../ traversal to prove claims from outside the repo', conversion: 'expense-report', source_file: '../attacker-receipt.txt',
    lines: [{ line_no: 1, date: nis, vendor: nis, amount: nis, currency: nis, category: nis, tax: nis }],
    unmapped_input_lines: [] };
  fixtures['fail_traversal-source'] = f; }

// --- v5 fixtures (self-red-team, three rounds: token truncation on text fields, tax-total confusion,
//     currency capturing the amount, label-as-value) ---
const USD = 'verify/fixtures/sample-receipt-usd.txt';      // 1 Shop / 2 Jan 1 / 3 Total USD 5.00 / 4 Category: Lodging
const TOTALTAX = 'verify/fixtures/sample-receipt-totaltax.txt'; // 1 Shop / 2 Jan 1 / 3 Total Tax 5.00 / 4 Total 105.00
const usdBase = () => ({ conversion: 'expense-report', source_file: USD,
  lines: [{ line_no: 1,
    date: { value: 'Jan 1', cite: [2] },
    vendor: { value: 'Shop', cite: [1] },
    amount: { value: '5.00', cite: [3] },
    currency: { value: 'USD', cite: [3] },
    category: { value: 'Lodging', cite: [4] },
    tax: nis }],
  unmapped_input_lines: [] });
{ const f = usdBase(); f._expect_gate = 'trace'; f._fixture = 'currency "US" is a truncation of the printed "USD"'; f.lines[0].currency = { value: 'US', cite: [3] }; fixtures['fail_truncated-currency'] = f; }
{ const f = usdBase(); f._expect_gate = 'trace'; f._fixture = 'currency captures the amount ("5.00" has digits; currency is a symbol/code)'; f.lines[0].currency = { value: '5.00', cite: [3] }; fixtures['fail_currency-has-digits'] = f; }
{ const f = usdBase(); f._expect_gate = 'trace'; f._fixture = 'category "Lodg" is a truncation of the printed "Lodging"'; f.lines[0].category = { value: 'Lodg', cite: [4] }; fixtures['fail_truncated-category'] = f; }
{ const f = usdBase(); f._expect_gate = 'trace'; f._fixture = 'category is the label word "Category", not the content it labels'; f.lines[0].category = { value: 'Category', cite: [4] }; fixtures['fail_category-is-label'] = f; }
{ const f = { _expect_gate: 'trace', _fixture: 'amount taken from a "Total Tax" line (a tax total), not the grand Total', conversion: 'expense-report', source_file: TOTALTAX,
    lines: [{ line_no: 1, date: { value: 'Jan 1', cite: [2] }, vendor: { value: 'Shop', cite: [1] },
      amount: { value: '5.00', cite: [3] }, currency: nis, category: nis, tax: { value: '5.00', cite: [3] } }],
    unmapped_input_lines: [{ line: 4, code: 'other', note: 'Total 105.00' }] };
  fixtures['fail_total-tax-as-amount'] = f; }

// --- v6 fixtures (external red-team: keyword-substring label detection standing in for line-kind) ---
{ const f = { _expect_gate: 'trace', _fixture: 'amount taken from a "Total Savings" decoy line, not the real Total', conversion: 'expense-report', source_file: 'verify/fixtures/sample-receipt-savings.txt',
    lines: [{ line_no: 1, date: nis, vendor: { value: 'Bloom Grocery', cite: [1] }, amount: { value: '40.00', cite: [3] }, currency: nis, category: nis, tax: nis }],
    unmapped_input_lines: [{ line: 2, code: 'subtotal', note: 'Subtotal 124.99' }, { line: 4, code: 'other', note: 'Total 84.99' }] };
  fixtures['fail_savings-as-amount'] = f; }
{ const f = { _expect_gate: 'trace', _fixture: 'a date promoted from an "Auth Ref" line, not a transaction date', conversion: 'expense-report', source_file: 'verify/fixtures/sample-receipt-authref.txt',
    lines: [{ line_no: 1, date: { value: '12/05/2023', cite: [2] }, vendor: { value: 'QuickMart', cite: [1] }, amount: { value: '8.50', cite: [3] }, currency: nis, category: nis, tax: nis }],
    unmapped_input_lines: [] };
  fixtures['fail_authref-as-date'] = f; }
{ const f = { _expect_gate: 'trace', _fixture: 'a payment-processor footer passed off as the merchant, not the header', conversion: 'expense-report', source_file: 'verify/fixtures/sample-receipt-processor.txt',
    lines: [{ line_no: 1, date: nis, vendor: { value: 'Stripe Inc', cite: [2] }, amount: { value: '19.99', cite: [3] }, currency: nis, category: nis, tax: nis }],
    unmapped_input_lines: [{ line: 1, code: 'header', note: 'WALMART SUPERCENTER' }] };
  fixtures['fail_processor-as-vendor'] = f; }
{ const f = { _expect_gate: 'trace', _fixture: 'currency dropped though CAD is printed on the cited total line', conversion: 'expense-report', source_file: 'verify/fixtures/sample-receipt-transit.txt',
    lines: [{ line_no: 1, date: nis, vendor: { value: 'Transit Authority', cite: [1] }, amount: { value: '16.42', cite: [2] }, currency: nis, category: nis, tax: nis }],
    unmapped_input_lines: [] };
  fixtures['fail_dropped-currency'] = f; }

let count = 0;
for (const [name, obj] of Object.entries(fixtures)) {
  // key order: annotations first, then conversion/source_file/lines/unmapped
  const { _fixture, _expect_gate, ...rest } = obj;
  const ordered = { _fixture, _expect_gate, ...rest };
  writeFileSync(join(dir, name + '.json'), JSON.stringify(ordered, null, 2) + '\n');
  count++;
}
console.log(`wrote ${count} fixtures`);
