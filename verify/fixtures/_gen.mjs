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

let count = 0;
for (const [name, obj] of Object.entries(fixtures)) {
  // key order: annotations first, then conversion/source_file/lines/unmapped
  const { _fixture, _expect_gate, ...rest } = obj;
  const ordered = { _fixture, _expect_gate, ...rest };
  writeFileSync(join(dir, name + '.json'), JSON.stringify(ordered, null, 2) + '\n');
  count++;
}
console.log(`wrote ${count} fixtures`);
