#!/usr/bin/env node
// Verify Translator outputs against the input they were produced from and the schema in
// reference/<id>/schema.json. Fails loud, exits non-zero, prints the diagnostic. Offline, no deps.
//
// Forked from the-auditor/verify/check.mjs (Comp #12 winner) and hardened across two rounds of
// independent cross-brain review (Perplexity + ChatGPT). The trust boundary is closed recursively:
// the record shape is fixed and CLOSED at every level (no stray keys, including underscore keys, and
// each field cell holds only value/cite), citations are single-line, block-scoped, and line-kind
// constrained (a tax on a tax line, a category on a category line, an amount on a total line and
// never a subtotal/tax line, a date that is date-shaped), and the evidence file can be pinned by the
// verifier so an output cannot choose its own input.
//
// Usage:
//   node verify/check.mjs                          validate every verify/outputs/*.json (must PASS),
//                                                    then confirm every fixtures/fail_*.json fails
//                                                    through the gate it declares in "_expect_gate"
//   node verify/check.mjs --output <out.json>       validate one output (must PASS)
//   node verify/check.mjs --input <in.txt> --output <out.json>
//                                                    validate one output AND pin its evidence: the
//                                                    output's source_file must resolve to <in.txt>,
//                                                    and citations are traced against <in.txt> - the
//                                                    verifier, not the output, chooses the input.
//
// Every error string begins with a [gate] tag: [shape] [trace] [coverage] [block]. A fixture's
// "_expect_gate" must appear among its errors, so a fixture can't pass by failing for the wrong reason.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ---------- helpers ----------

function norm(s) {
  return (s || '').toString().toLowerCase()
    .replace(/`/g, '').replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ').trim();
}
function isExemptLine(text) { const t = (text || '').trim(); return t === '' || t === '---'; }
// A leading non-merchant preamble line (a whole-line receipt decoration), so the merchant header can
// sit under "*** CUSTOMER COPY ***" or "THANK YOU". Matches only when the ENTIRE line (minus
// punctuation) is a known preamble phrase - "Thank You Cafe" is NOT preamble, it is a merchant.
const PREAMBLE = /^(customer copy|merchant copy|guest copy|guest receipt|customer receipt|gift receipt|return receipt|reprint|duplicate|duplicate receipt|copy|thank you|thanks|welcome|receipt|tax invoice|invoice|sales receipt|itemized receipt|order confirmation|e-receipt|transaction record|releve de transaction|releve de|transaction)$/;
function isPreambleLine(text) {
  const t = norm(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t !== '' && PREAMBLE.test(t);
}
// The merchant header of a block: the first line that is neither exempt (blank/---) nor a preamble.
function blockHeader(inputLines, b) {
  for (let n = b.start; n <= b.end; n++) if (!isExemptLine(inputLines[n - 1]) && !isPreambleLine(inputLines[n - 1])) return n;
  return null;
}
const samePath = (a, b) => resolve(root, a).replace(/\\/g, '/').toLowerCase() === resolve(root, b).replace(/\\/g, '/').toLowerCase();
// The evidence file must live inside the repo - an output may not point its source_file at a
// traversal path (../) or an absolute path outside the project to prove its claims.
const insideRepo = (p) => { const abs = resolve(root, p); return abs === resolve(root) || abs.startsWith(resolve(root) + sep); };

// Does the value sit on the line as a COMPLETE token? For numeric/date fields, exactToken rejects a
// truncation: "8" must not match inside "8.25", "14-03" must not match inside "14-03-2026". A match
// counts only when it is not flanked by a token-continuation char (digit, decimal, comma, date
// separator). Text fields (vendor, currency, category) use plain substring so "$" glued to a number
// and multi-word names still match.
// Token-continuation character sets per boundary kind. numeric: a number/date continues through
// digits, decimals, commas, date separators (so "8" can't match inside "8.25"). alpha: an alpha
// code/word continues through letters (so "US" can't match inside "USD"), while a symbol like "$"
// glued to digits still matches because a digit is not a letter.
const BOUNDARY = { numeric: /[0-9.,/\-]/, alpha: /[a-z]/ };
// Join digit groups separated by a thousands separator (a space "1 234,56" or a Swiss apostrophe
// "1'234.56" -> "1234,56"/"1234.56") so a grouped number is ONE token. Without this, neither separator is
// a token-continuation char, so the leading group ("1") reads as a complete value and the total silently
// truncates to "1". Two guards keep it from corrupting a columnar money line ("GST 27.98 1.40", tax >=
// $100 like "HST 900.00 117.00"): the right group must be EXACTLY 3 digits not followed by a digit (a
// separate number's decimal part is not), and (?<![.,]\d*) means the left digit must NOT be the fraction
// of a decimal - so the "0 117" inside "900.00 117.00" is never joined, while "1 234,56" (left "1" is a
// bare integer) still is. Dot/comma are left alone (locale decimal/grouping, already single-token-safe).
// Narrow/no-break spaces are folded to a normal space by norm() first. Applied on both value and line in
// occursOnLine, and in the guard scanners, so the accept path and the ambiguity/drop guards never drift.
const joinDigitGroups = (s) => { let p; do { p = s; s = s.replace(/(?<![.,]\d*)(\d)[ '](\d{3})(?!\d)/g, '$1$2'); } while (s !== p); return s; };
function occursOnLine(lineNorm, valNorm, boundaryRe) {
  if (valNorm === '') return false;
  if (!boundaryRe) return lineNorm.includes(valNorm);
  if (boundaryRe === BOUNDARY.numeric) { lineNorm = joinDigitGroups(lineNorm); valNorm = joinDigitGroups(valNorm); }
  let idx = lineNorm.indexOf(valNorm);
  while (idx !== -1) {
    const before = idx > 0 ? lineNorm[idx - 1] : '';
    const after = idx + valNorm.length < lineNorm.length ? lineNorm[idx + valNorm.length] : '';
    if ((before === '' || !boundaryRe.test(before)) && (after === '' || !boundaryRe.test(after))) return true;
    idx = lineNorm.indexOf(valNorm, idx + 1);
  }
  return false;
}
// A monetary value is digits with optional leading minus (a refund), grouping, and decimal - never a
// word like "Due", never empty.
const isNumericValue = (v) => /^-?\d[\d.,]*$/.test(norm(v).replace(/[\s']/g, '')); // strip thousands separators (space, Swiss apostrophe) before the shape test

// Does a label word appear on the line as a WHOLE word (bounded by start/end or a non-alphanumeric)?
// Word-boundary matching, not substring: "total" must not match inside "subtotal", "tax" must not
// match inside "taxi". lineNorm is already lowercased/whitespace-collapsed.
const esc = (s) => s.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function labelOnLine(lineNorm, kw) {
  if (!kw || !kw.trim()) return false;
  return new RegExp('(^|[^a-z0-9])' + esc(kw) + '([^a-z0-9]|$)').test(lineNorm);
}

const CUR_CODES = 'usd|cad|eur|gbp|aud|jpy|chf|cny|inr|mxn|nzd|sek|nok|dkk|zar|brl|rub|hkd|sgd|pln|czk|huf|ron|try|ils|aed|sar|thb|myr|krw|idr|php|twd|isk|kr|kn|zl|kc|ft|fr|rm';
// The label segment is the line text just before the value; strip trailing punctuation, currency
// symbols, and a trailing currency code so "Total EUR " and "Total: $" both reduce to "total".
function stripLabelTail(seg, opts = {}) {
  let s = seg, prev;
  do {
    prev = s;
    s = s.replace(/\s+$/, '');
    s = s.replace(/\([^()]*\)$/, '');                                   // a trailing complete (parenthetical)
    s = s.replace(/(^|[^a-z0-9])(ca|us|au|nz|hk|sg|mx|c|a|r)?[$€£¥₹₩฿₪₫₴₦₱]$/, '$1'); // a currency symbol with an optional country prefix (CA$, US$, C$, R$) - "$" alone strips too
    s = s.replace(/[:$€£¥₹₩฿₪₫₴₦₱.,\-]+$/u, '');                        // trailing punctuation / currency symbols
    s = s.replace(new RegExp('(^|[^a-z0-9])(' + CUR_CODES + ')$'), '$1'); // a trailing currency code
    s = s.replace(/(^|[^a-z0-9])(included|inclusive|incl|today|now)$/, '$1'); // a trailing modifier so "GST included 0.42" / "Balance Due Today 35.00" bind to the label
    s = s.replace(/(^|[^a-z0-9])@?\s*\d[\d.,]*\s*%$/, '$1');             // a trailing rate token, optionally with the "@" idiom ("GST 5.00% 11.15", "VAT @ 20% 1.25") - binds the amount to the label, never the rate
    s = s.replace(/([a-z0-9])@$/, '$1');                                 // a "@" glued to the label ("VAT@20% 1.25" -> after the rate strip, "vat@" -> "vat"); a spaced "@" (Total @ 1:14PM) is left so a time is not read as the total
    if (opts.baseNumber) s = s.replace(/(^|[^a-z0-9])-?\d[\d.,]*$/, '$1'); // a trailing taxable-value/base so a columnar "GST 27.98 1.40" reaches the label
  } while (s !== prev);
  return s.replace(/\s+$/, '');
}
// A modifier placed before a label word across a space or hyphen can NAME A DIFFERENT QUANTITY than the
// label: "sub/item/line/running total" is not the transaction total, "pre-/post-/after-tax" is not the tax
// (they are the base and the grand total), and "expiry/due/best before/ship date" is not the transaction
// date. The word boundary ([^a-z0-9]) would otherwise let the label match the compound's tail ("sub total"
// ends with "total"), reading the wrong number as the field. Glue such a modifier to its label so the
// word-bounded label no longer matches. These are small CLOSED sets of meaning-INVERTING modifiers; a
// kind/scope prefix that names the SAME quantity ("grand/net/gross total", "sales/state/room/city/eco tax",
// "invoice/sale/order date") is deliberately NOT here, so genuine named totals, taxes, and dates still
// match. This is a denylist by design, not an allowlist: the good-prefix set is open-ended (every tax
// jurisdiction), so an allowlist would drop real labels - a false negative that rejects a correct
// conversion, which is worse than an adversarially-constructed novel modifier leaking. One chokepoint, so
// the accept path and the guards decide compound labels the same way.
const collapseModifier = (seg) => seg
  .replace(/(^|[^a-z0-9])(sub|item|line|running|tax)[\s-]*(total)$/, '$1$2$3')
  .replace(/(^|[^a-z0-9])(pre|post|after)[\s-]*(tax)$/, '$1$2$3')
  .replace(/(^|[^a-z0-9])(expiry|expiration|exp|due|ship|shipped|shipping|delivery|delivered|valid|before|by|thru|through|until)[\s.\-]*(date)$/, '$1$2$3');
const endsWithLabel = (seg, labels) => { const s = collapseModifier(seg); return labels.some((kw) => kw && kw.trim() && new RegExp('(^|[^a-z0-9])' + esc(kw) + '$').test(s)); };
// Positional binding: the value is valid only if a required label GOVERNS it - i.e. the label sits
// immediately to the value's left. This is what "Total Distance 12.40" fails and "Total 41.90" passes:
// the number must be the one the label quantifies, not merely present on a line that has the word.
function labelGovernsValue(lineNorm, valNorm, labels, opts = {}) {
  if (!valNorm) return false; // indexOf("") never returns -1 -> guard against an empty value
  let idx = lineNorm.indexOf(valNorm);
  while (idx !== -1) { if (endsWithLabel(stripLabelTail(lineNorm.slice(0, idx), opts), labels)) return true; idx = lineNorm.indexOf(valNorm, idx + 1); }
  return false;
}
// The last monetary token on a line (a number not followed by "%"). Used for columnar tax lines
// ("GST <taxable-value> <tax-value>"): the tax is the Tax-Value column, i.e. the last money token.
function lastMoneyToken(lineNorm) {
  const toks = lineNorm.match(/-?\d[\d.,]*%?/g) || [];
  for (let i = toks.length - 1; i >= 0; i--) if (!toks[i].endsWith('%')) return toks[i];
  return null;
}
// Date: the line must be a bare date (nothing before the value) or governed by a date-context label.
function dateContextOk(lineNorm, valNorm, ctx) {
  if (!valNorm) return false; // indexOf("") never returns -1 -> guard against an empty value
  let idx = lineNorm.indexOf(valNorm);
  while (idx !== -1) { const seg = stripLabelTail(lineNorm.slice(0, idx)); if (seg === '' || endsWithLabel(seg, ctx)) return true; idx = lineNorm.indexOf(valNorm, idx + 1); }
  return false;
}
// Currency must be immediately adjacent to the amount value (only whitespace between), so a second
// currency printed elsewhere on the line (USD 20.00 (CAD 27.00)) cannot be paired with the amount.
function currencyAdjacentToAmount(lineNorm, amountNorm, curNorm) {
  if (!amountNorm || !curNorm) return false; // indexOf("") never returns -1 -> guard against an empty value
  let idx = lineNorm.indexOf(amountNorm);
  while (idx !== -1) {
    const before = lineNorm.slice(0, idx).replace(/\s+$/, '');
    const after = lineNorm.slice(idx + amountNorm.length).replace(/^\s+/, '');
    const bOk = before.endsWith(curNorm) && (before.length === curNorm.length || /[^a-z0-9]/.test(before[before.length - curNorm.length - 1]));
    const aOk = after.startsWith(curNorm) && (after.length === curNorm.length || /[^a-z0-9]/.test(after[curNorm.length]));
    if (bOk || aOk) return true;
    idx = lineNorm.indexOf(amountNorm, idx + 1);
  }
  return false;
}
// The currency of the total, tied to a SINGLE occurrence: is there one occurrence of the amount value on
// this line that is BOTH governed by a total label AND has a currency adjacent to it? Both conditions on
// the SAME occurrence - so "Total $40.00 deposit refund EUR 40.00" (two occurrences of 40.00) cannot pair
// the total's occurrence with the other occurrence's currency. curNorm null = match any currency (drop guard).
function currencyOnTotal(lineNorm, av, curNorm, totalLabels) {
  if (!av) return false; // indexOf("") never returns -1 -> guard against an empty value
  let idx = lineNorm.indexOf(av);
  while (idx !== -1) {
    const before = lineNorm.slice(0, idx);
    const beforeTrim = before.replace(/\s+$/, '');
    const afterTrim = lineNorm.slice(idx + av.length).replace(/^\s+/, '');
    let curAdj;
    if (curNorm) {
      curAdj = (beforeTrim.endsWith(curNorm) && (beforeTrim.length === curNorm.length || /[^a-z0-9]/.test(beforeTrim[beforeTrim.length - curNorm.length - 1])))
        || (afterTrim.startsWith(curNorm) && (afterTrim.length === curNorm.length || /[^a-z0-9]/.test(afterTrim[curNorm.length])));
    } else {
      curAdj = /[$€£¥₹₩฿₪₫₴₦₱]$/.test(beforeTrim) || new RegExp('(^|[^a-z0-9])(' + CUR_CODES + ')$').test(beforeTrim)
        || /^[$€£¥₹₩฿₪₫₴₦₱]/.test(afterTrim) || new RegExp('^(' + CUR_CODES + ')([^a-z0-9]|$)').test(afterTrim);
    }
    if (curAdj && endsWithLabel(stripLabelTail(before), totalLabels)) return true;
    idx = lineNorm.indexOf(av, idx + 1);
  }
  return false;
}

// Detect a duplicate key within the same JSON object at the raw-text level. JSON.parse keeps the last
// value, so a file could show a reader one value and hand the checker another; this rejects that.
// A string immediately followed by ':' is a key; each object frame tracks the keys it has seen.
function firstDuplicateKey(text) {
  const stack = [];
  let i = 0; const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < n) { if (text[j] === '\\') { j += 2; continue; } if (text[j] === '"') break; j++; }
      const key = text.slice(i + 1, j);
      i = j + 1;
      let k = i; while (k < n && /\s/.test(text[k])) k++;
      if (text[k] === ':') { const top = stack[stack.length - 1]; if (top && top.set) { if (top.set.has(key)) return key; top.set.add(key); } }
      continue;
    }
    if (ch === '{') stack.push({ set: new Set() });
    else if (ch === '[') stack.push({ set: null });
    else if (ch === '}' || ch === ']') stack.pop();
    i++;
  }
  return null;
}

// A value goes in the date field only if it actually looks like a date. Rejects pure amounts.
function looksLikeDate(v) {
  const s = norm(v);
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/.test(s)) return true;
  if (/\b\d{4}-\d{1,2}-\d{1,2}\b/.test(s)) return true;
  if (/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/.test(s)) return true;
  const m = s.match(/\b(\d{1,2})[/\-](\d{1,2})\b/); // dot excluded: a 2-part NN.NN is an amount (12.30), not a date; dotted 3-part dates (14.03.2026) match the rule above
  if (m) { const a = +m[1], b = +m[2];
    if ((a >= 1 && a <= 12 && b >= 1 && b <= 31) || (b >= 1 && b <= 12 && a >= 1 && a <= 31)) return true; }
  return false;
}
function loadSchema() {
  const refDir = join(root, 'reference');
  for (const entry of readdirSync(refDir)) {
    const p = join(refDir, entry, 'schema.json');
    if (existsSync(p)) return { schema: JSON.parse(readFileSync(p, 'utf8')), id: entry };
  }
  throw new Error('no reference/<id>/schema.json found');
}
function readInputLines(sourceFile) {
  const p = join(root, sourceFile);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8').split(/\r?\n/); // physical lines, 1-based
}
function computeBlocks(inputLines) {
  const blocks = []; let start = 1;
  for (let n = 1; n <= inputLines.length; n++) {
    if (inputLines[n - 1].trim() === '---') { blocks.push({ start, end: n - 1 }); start = n + 1; }
  }
  blocks.push({ start, end: inputLines.length });
  // Drop blocks that hold no non-exempt line, so a leading/trailing/double "---" separator does not
  // manufacture a phantom receipt that the one-line-per-receipt gate would then demand.
  return blocks.filter((b) => { for (let n = b.start; n <= b.end; n++) if (!isExemptLine(inputLines[n - 1])) return true; return false; });
}

// ---------- gates ----------
// No key anywhere in a real output is exempt. Fixture metadata (_fixture, _expect_gate) is stripped
// by the runner before validation, so production validation rejects EVERY unexpected key.

function shapeCheck(out, schema, id, errs) {
  if (typeof out !== 'object' || out === null || Array.isArray(out)) { errs.push(`[shape] top level: output must be a JSON object, got ${Array.isArray(out) ? 'an array' : JSON.stringify(out)}`); return; }
  if (out.conversion !== id) errs.push(`[shape] top level: "conversion" must be "${id}", got ${JSON.stringify(out.conversion)}`);
  if (typeof out.source_file !== 'string') errs.push('[shape] top level: missing "source_file" string');
  for (const k of Object.keys(out)) if (!schema.top_level_keys.includes(k)) errs.push(`[shape] top level: unexpected key "${k}" - only ${schema.top_level_keys.join(', ')} are allowed`);
  if (!Array.isArray(out.lines) || out.lines.length === 0) { errs.push('[shape] top level: "lines" must be a non-empty array'); return; }
  if (!Array.isArray(out.unmapped_input_lines)) errs.push('[shape] top level: "unmapped_input_lines" must be an array');

  const marker = schema.not_in_source_marker;
  const fieldNames = schema.fields.map((f) => f.name);
  out.lines.forEach((line, i) => {
    const where = `line ${i + 1}`;
    if (typeof line !== 'object' || line === null || Array.isArray(line)) { errs.push(`[shape] ${where}: must be an object, got ${Array.isArray(line) ? 'an array' : JSON.stringify(line)}`); return; }
    for (const f of schema.fields) if (!(f.name in line)) errs.push(`[shape] ${where}: missing field "${f.name}"`);
    for (const k of Object.keys(line)) if (!fieldNames.includes(k)) errs.push(`[shape] ${where}: unexpected key "${k}" - the record shape is fixed to ${fieldNames.join(', ')}`);
    const orderedKeys = Object.keys(line).filter((k) => fieldNames.includes(k));
    const expectedOrder = fieldNames.filter((n) => orderedKeys.includes(n));
    if (orderedKeys.join(',') !== expectedOrder.join(',')) errs.push(`[shape] ${where}: fields out of order - expected ${expectedOrder.join(', ')}, got ${orderedKeys.join(', ')}`);
    if (line.line_no !== i + 1) errs.push(`[shape] ${where}: line_no is ${JSON.stringify(line.line_no)}, must equal its 1-based row index ${i + 1}`);
    for (const f of schema.fields) {
      if (f.role === 'structural') continue;
      const cell = line[f.name];
      if (cell === undefined) continue;
      if (typeof cell !== 'object' || cell === null || typeof cell.value !== 'string') { errs.push(`[shape] ${where}.${f.name}: must be an object with a string "value"`); continue; }
      // a cell is closed: value alone when not-in-source, value+cite when filled. Nothing else may ride along.
      const allowed = cell.value === marker ? ['value'] : ['value', 'cite'];
      for (const k of Object.keys(cell)) if (!allowed.includes(k)) errs.push(`[shape] ${where}.${f.name}: unexpected key "${k}" inside the cell - a cell holds only ${allowed.join(' and ')}, nothing else`);
      if (cell.value === marker) {
        if (Array.isArray(cell.cite) && cell.cite.length > 0) errs.push(`[shape] ${where}.${f.name}: marked "${marker}" but carries a citation`);
      } else {
        if (!Array.isArray(cell.cite) || cell.cite.length === 0) errs.push(`[shape] ${where}.${f.name}: filled value "${cell.value}" has no cite`);
        else if (!cell.cite.every((n) => Number.isInteger(n) && n >= 1)) errs.push(`[shape] ${where}.${f.name}: cite must be positive line numbers, got ${JSON.stringify(cell.cite)}`);
      }
    }
  });
}

function traceCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const N = inputLines.length;
  out.lines.forEach((line, i) => {
    const where = `line ${i + 1}`;
    for (const f of schema.fields) {
      if (!f.traceable) continue;
      const cell = line[f.name];
      if (!cell || typeof cell !== 'object' || cell.value === marker) continue;
      if (!Array.isArray(cell.cite) || cell.cite.length === 0) continue;
      const bad = cell.cite.find((n) => n < 1 || n > N);
      if (bad !== undefined) { errs.push(`[trace] ${where}.${f.name}: cites input line ${bad}, which does not exist (input has ${N} lines)`); continue; }
      const c = f.constraints || {};
      if (norm(cell.value) === '') { errs.push(`[trace] ${where}.${f.name}: value is empty - a filled field must carry a real value`); continue; }
      if (c.numeric && !isNumericValue(cell.value)) errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is not a numeric amount - this field holds a printed number, nothing else`);
      if (c.no_digits && /\d/.test(cell.value)) errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} contains digits - currency is a symbol or code, not the amount`);
      if (Array.isArray(c.require_label) && c.require_label.includes(norm(cell.value))) errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is the field label itself, not the content it labels`);
      if (c.shape === 'date' && !looksLikeDate(cell.value)) errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is not date-shaped - a non-date value may not be placed in the date field`);
      // exact_token rejects a truncation of a longer token ("8" of "8.25", "US" of "USD"); the
      // boundary kind (numeric for numbers/dates, alpha for currency/category codes) sets what counts
      // as a continuation character.
      const boundaryRe = c.exact_token ? (BOUNDARY[c.token_boundary] || BOUNDARY.numeric) : null;
      const matchLines = cell.cite.filter((n) => occursOnLine(norm(inputLines[n - 1]), norm(cell.value), boundaryRe));
      if (matchLines.length === 0) {
        const span = cell.cite.map((n) => `${n}:${JSON.stringify(inputLines[n - 1])}`).join(', ');
        errs.push(`[trace] ${where}.${f.name}: value not found as a complete token on any single cited line - invented, mis-cited, truncated, or fabricated across lines\n      value: ${JSON.stringify(cell.value)}\n      cited: ${span}`);
        continue;
      }
      // Every cited line must actually contain the value. An over-citation (citing a line the value is
      // NOT on) would otherwise mark that line "accounted" in the coverage gate and silently bury it.
      if (matchLines.length !== cell.cite.length) {
        const bad = cell.cite.filter((n) => !matchLines.includes(n));
        errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is not on cited line(s) ${bad.join(', ')} - every cited line must contain the value; an over-citation cannot be used to mark an unrelated line accounted-for`);
        continue;
      }
      // Verbatim case for alpha-boundary codes/labels (currency, category): the value must appear with
      // its exact case on a cited line, so "Category: MEALS" is not normalized to "Meals" and a currency
      // code keeps its case. (Numbers are case-free; vendor is checked raw in blockCheck.)
      if (c.token_boundary === 'alpha' && !cell.cite.every((n) => (inputLines[n - 1] || '').includes(cell.value))) {
        errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} does not appear with its exact case on a cited line - a code/label is copied verbatim, not normalized`);
        continue;
      }
      // A monetary value immediately followed by "%" is a RATE, not an amount (a "Tax 8.25%" line
      // states a rate; the tax AMOUNT is a separate number). Reject when every cited line shows it as a %.
      if (c.numeric) {
        const vN = norm(cell.value);
        const allRate = matchLines.every((n) => {
          const ln = norm(inputLines[n - 1]); let idx = ln.indexOf(vN);
          while (idx !== -1) { if (ln.slice(idx + vN.length).replace(/^\s+/, '').startsWith('%')) { idx = ln.indexOf(vN, idx + 1); continue; } return false; }
          return true;
        });
        if (allRate) { errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is a percentage/rate (followed by "%"), not a monetary amount`); continue; }
      }
      // Right-kind check, on ONE line at a time, with POSITIONAL binding: a single cited line must
      // hold the value AND have a required label GOVERN it (the label immediately to its left) AND
      // carry no forbid-word. Independent quantifiers let an attacker assemble "right kind" from two
      // lines; requiring the label to govern the value also stops "Total Distance 12.40" (the word
      // "total" is present but governs "distance", not the money).
      if (Array.isArray(c.require_label) || Array.isArray(c.date_context) || Array.isArray(c.forbid_label)) {
        const val = norm(cell.value);
        const qualifies = matchLines.some((n) => {
          const ln = norm(inputLines[n - 1]);
          let labelOk = true;
          if (Array.isArray(c.require_label)) labelOk = c.columnar_tax
            ? (labelGovernsValue(ln, val, c.require_label, { baseNumber: true }) && val === lastMoneyToken(ln))
            : labelGovernsValue(ln, val, c.require_label);
          else if (Array.isArray(c.date_context)) labelOk = dateContextOk(ln, val, c.date_context);
          const forbidden = Array.isArray(c.forbid_label) && c.forbid_label.some((kw) => labelOnLine(ln, kw));
          return labelOk && !forbidden;
        });
        if (!qualifies) {
          let why;
          if (Array.isArray(c.require_label)) why = `a required label (one of: ${c.require_label.join(', ')}) must sit immediately before the value`;
          else if (Array.isArray(c.date_context)) why = `the line must be a bare date or governed by a date label (${c.date_context.join(', ')})`;
          else why = `the cited line carries a forbidden label (${c.forbid_label.join(', ')})`;
          errs.push(`[trace] ${where}.${f.name}: no single cited line binds the value to the right kind - ${why}. A value's kind may not be assembled from two lines, nor taken from a label that governs a different number.`);
        }
      }
    }
  });
}

function coverageCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const N = inputLines.length;
  const codes = schema.unmapped_reason_codes || [];
  const accounted = new Set();
  for (const line of out.lines) for (const f of schema.fields) {
    const cell = line[f.name];
    if (cell && typeof cell === 'object' && cell.value !== marker && Array.isArray(cell.cite)) for (const n of cell.cite) accounted.add(n);
  }
  for (const u of out.unmapped_input_lines || []) {
    if (!u || typeof u.line !== 'number') { errs.push(`[shape] unmapped_input_lines: an entry is missing a numeric "line": ${JSON.stringify(u)}`); continue; }
    for (const k of Object.keys(u)) if (!['line', 'code', 'note'].includes(k)) errs.push(`[shape] unmapped_input_lines line ${u.line}: unexpected key "${k}" (allowed: line, code, note)`);
    if (u.line < 1 || u.line > N) errs.push(`[coverage] unmapped_input_lines: line ${u.line} does not exist (input has ${N} lines)`);
    if (!codes.includes(u.code)) errs.push(`[shape] unmapped_input_lines line ${u.line}: "code" must be one of the controlled reasons (${codes.join(', ')}), got ${JSON.stringify(u.code)} - reasons are a fixed vocabulary, not free prose`);
    if (u.note !== undefined && u.line >= 1 && u.line <= N && !norm(inputLines[u.line - 1]).includes(norm(u.note))) {
      errs.push(`[trace] unmapped_input_lines line ${u.line}: "note" must quote the line it describes\n      note: ${JSON.stringify(u.note)}\n      line: ${JSON.stringify(inputLines[u.line - 1])}`);
    }
    accounted.add(u.line);
  }
  for (let n = 1; n <= N; n++) {
    if (isExemptLine(inputLines[n - 1])) continue;
    if (!accounted.has(n)) errs.push(`[coverage] input line ${n} is neither cited nor listed unmapped - nothing may be dropped silently\n      line ${n}: ${JSON.stringify(inputLines[n - 1])}`);
  }
}

function blockCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const blocks = computeBlocks(inputLines);
  if (out.lines.length !== blocks.length) { errs.push(`[block] output has ${out.lines.length} line(s) but the input has ${blocks.length} receipt block(s) - one output line per receipt`); return; }
  out.lines.forEach((line, i) => {
    const b = blocks[i];
    for (const [k, cell] of Object.entries(line)) {
      if (!cell || typeof cell !== 'object' || !Array.isArray(cell.cite)) continue;
      for (const n of cell.cite) if (n < b.start || n > b.end) errs.push(`[block] line ${i + 1}.${k}: cites input line ${n}, outside its own receipt block (lines ${b.start}-${b.end}) - a receipt may not cite another receipt`);
    }
    // header value: a field pinned to the header (vendor) must equal the block's first non-exempt
    // line VERBATIM (not merely cite it) - so a footer/address/processor line, or a truncation of the
    // real name, can't pose as the merchant.
    const header = blockHeader(inputLines, b);
    for (const f of schema.fields) {
      if (!(f.constraints && f.constraints.header_full_line)) continue;
      const cell = line[f.name];
      if (!cell || cell.value === marker || !Array.isArray(cell.cite)) continue;
      if (header === null) continue;
      // Verbatim means verbatim: compare raw (trim ends only), so case and internal whitespace must
      // match exactly. "ACME PAINT" -> "Acme Paint" or a no-break space folded to a space is a
      // normalization, which the brief treats as invention.
      if (!cell.cite.includes(header) || cell.value.trim() !== inputLines[header - 1].trim()) {
        errs.push(`[trace] line ${i + 1}.${f.name}: must be the receipt header verbatim (line ${header}: ${JSON.stringify(inputLines[header - 1])}), not ${JSON.stringify(cell.value)} - not normalized in case or spacing, and not a footer/address/truncation`);
      }
    }
  });
}

// Currency must not be silently dropped: if it is marked "not in source" yet a currency token sits
// on a line this record cites, the drop is caught (the disclosed shared-line hole, closed for currency).
const CURRENCY_TOKEN = new RegExp('[$€£¥₹₩฿₪₫₴₦₱]|\\b(' + CUR_CODES + ')\\b');
function currencyDropCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const af = schema.fields.find((f) => f.name === 'amount');
  const totalLabels = (af && af.constraints && af.constraints.require_label) || [];
  out.lines.forEach((line, i) => {
    const cur = line.currency, a = line.amount;
    if (!cur || cur.value !== marker) return;
    if (!a || a.value === marker || !Array.isArray(a.cite)) return; // no amount -> nothing to bind a currency to
    const av = norm(a.value);
    const cited = new Set();
    for (const f of schema.fields) { const c = line[f.name]; if (c && Array.isArray(c.cite)) for (const n of c.cite) cited.add(n); }
    for (const n of cited) {
      if (n < 1 || n > inputLines.length) continue;
      const ln = norm(inputLines[n - 1]);
      if (currencyOnTotal(ln, av, null, totalLabels)) { // a currency sits on the SAME occurrence a total label governs
        errs.push(`[trace] line ${i + 1}.currency: marked "${marker}" but a currency is printed on the total line adjacent to ${JSON.stringify(a.value)} (line ${n}) - it may not be dropped`);
        break;
      }
    }
  });
}

// pinnedInput: when the verifier supplies --input, the output may not choose its own evidence - its
// source_file must resolve to that file, and citations are traced against it.
// When amount and currency are both filled and share a cited line, the currency must be adjacent to
// the amount value on that line - so on a two-currency line the currency can't be paired with a
// different currency's number.
function currencyBindingCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  out.lines.forEach((line, i) => {
    const a = line.amount, cur = line.currency;
    if (!a || !cur || a.value === marker || cur.value === marker || !Array.isArray(a.cite) || !Array.isArray(cur.cite)) return;
    // If the amount's own line carries any currency token, the currency MUST be the one adjacent to
    // the amount there - so a currency lifted from a disclaimer/header (or a second currency on the
    // line) cannot be paired with an amount whose line states a different currency. If the amount's
    // line has no currency token, the currency may legitimately come from a header declaration.
    const amountLinesWithCurrency = a.cite.filter((n) => n >= 1 && n <= inputLines.length && CURRENCY_TOKEN.test(norm(inputLines[n - 1])));
    if (amountLinesWithCurrency.length === 0) return;
    const ok = amountLinesWithCurrency.some((n) => currencyAdjacentToAmount(norm(inputLines[n - 1]), norm(a.value), norm(cur.value)));
    if (!ok) errs.push(`[trace] line ${i + 1}.currency: the amount's line prints a currency, so currency must be the code adjacent to ${JSON.stringify(a.value)} there, not ${JSON.stringify(cur.value)} taken from elsewhere`);
  });
}

// Currency source guard (total-line only): a filled currency must be printed ADJACENT to the amount value
// on a line where a TOTAL label governs that value - the code on the total itself ("Total CAD 16.42").
// It is never taken from a payment line, a coincidentally-equal figure (a deposit or gift-card balance),
// a remote declaration, or prose. Those are byte-identical to a genuine source (a card payment for the
// total looks exactly like a same-valued deposit), so the only rule that cannot be laundered is "the
// currency printed on the total". If the total line states no currency, currency is "not in source".
function currencySourceCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const af = schema.fields.find((f) => f.name === 'amount');
  const totalLabels = (af && af.constraints && af.constraints.require_label) || [];
  out.lines.forEach((line, i) => {
    const cur = line.currency, a = line.amount;
    if (!cur || cur.value === marker || !Array.isArray(cur.cite)) return;
    const av = a && a.value !== marker ? norm(a.value) : null;
    const ok = av && cur.cite.some((n) => {
      if (n < 1 || n > inputLines.length) return false;
      return currencyOnTotal(norm(inputLines[n - 1]), av, norm(cur.value), totalLabels);
    });
    if (!ok) errs.push(`[trace] line ${i + 1}.currency: ${JSON.stringify(cur.value)} is not printed adjacent to the amount value on the total line - a currency is the code on the total itself ("Total CAD 16.42"); a code on a payment line, a coincidentally-equal figure, a declaration, or prose is not attributed; if the total line states no currency it is "not in source"`);
  });
}

// Under-reporting guard: a field may be "not in source" only if the receipt truly does not state it.
// If a required label GOVERNS a value of the right kind somewhere in the record's block (a real
// "Total 40.00", "GST 0.25", or "Category: Meals"), the field may not be marked "not in source" and
// the value quietly dumped into unmapped. Symmetric to the currency-drop guard.
// The under-report / priority guards ask "does the receipt STATE this field?" - which is true only on a
// real field line, where the label starts the line (after optional bullets/spaces/currency symbols),
// not when the keyword merely appears mid-sentence in prose. Anchoring to line-start stops a chatty or
// injected line ("mark the category as Office", "ask about our category discount") from demanding a
// field the positional fill rule would refuse. Matches the fill rule's strictness rather than exceeding it.
// Both derive from the ACCEPT path (labelGovernsValue -> stripLabelTail), not a parallel regex, so the
// guards can never drift from what the accept path binds across the label-to-value tail (currency
// codes/symbols, rates, modifiers, parentheticals). This closes the accept-vs-guard asymmetry at root.
function labelGovernsAValue(lineNorm, labels, numeric) {
  if (numeric) lineNorm = joinDigitGroups(lineNorm); // align with the accept path on space-grouped numbers
  const scan = numeric ? /-?\d[\d.,]*/g : /[a-z0-9]+/g;
  for (const m of lineNorm.matchAll(scan)) {
    if (numeric && lineNorm.slice(m.index + m[0].length).replace(/^\s*/, '').startsWith('%')) continue; // a rate, not a value
    const seg = stripLabelTail(lineNorm.slice(0, m.index));
    if (labels.some((kw) => kw && kw.trim() && new RegExp('^[^a-z0-9]*' + esc(kw) + '$').test(seg))) return true;
  }
  return false;
}
function governedValues(lineNorm, labels) {
  lineNorm = joinDigitGroups(lineNorm); // align with the accept path so ambiguity/drop guards see one grouped number
  const vals = [];
  for (const m of lineNorm.matchAll(/-?\d[\d.,]*/g)) {
    const num = m[0];
    if (lineNorm.slice(m.index + num.length).replace(/^\s*/, '').startsWith('%')) continue; // a rate, not an amount
    if (labelGovernsValue(lineNorm, num, labels)) vals.push(num);
  }
  return vals;
}
// The distinct total values a block offers: the final-owed totals if any are printed, otherwise the
// plain totals. >1 distinct value means the receipt does not name a single total.
function amountCandidateSet(inputLines, b, c) {
  const finals = new Set(), plain = new Set();
  for (let n = b.start; n <= b.end; n++) {
    const ln = norm(inputLines[n - 1]);
    for (const v of governedValues(ln, c.final_total_labels)) finals.add(v);
    for (const v of governedValues(ln, c.require_label)) plain.add(v);
  }
  return finals.size > 0 ? finals : plain;
}
// Ambiguity is a first-class outcome: if the receipt names more than one distinct total, it does not
// identify THE total, so amount must be "not in source". Choosing one is a guess. (A plain "Total"
// plus a "Total Due" with the SAME value is one distinct value - not ambiguous.)
function amountAmbiguityCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const af = schema.fields.find((f) => f.name === 'amount');
  const c = af && af.constraints; if (!c) return;
  const blocks = computeBlocks(inputLines);
  out.lines.forEach((line, i) => {
    const a = line.amount;
    if (!a || a.value === marker) return;
    const b = blocks[i] || { start: 1, end: inputLines.length };
    const cands = amountCandidateSet(inputLines, b, c);
    if (cands.size > 1) errs.push(`[trace] line ${i + 1}.amount: the receipt names ${cands.size} distinct total values (${[...cands].join(', ')}) - it does not identify a single total, so amount must be "not in source"; choosing one is a guess`);
  });
}
// Same for the date: more than one distinct transaction date -> date must be "not in source".
function dateAmbiguityCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const df = schema.fields.find((f) => f.name === 'date');
  const ctx = df && df.constraints && df.constraints.date_context;
  if (!Array.isArray(ctx)) return;
  const blocks = computeBlocks(inputLines);
  out.lines.forEach((line, i) => {
    const d = line.date;
    if (!d || d.value === marker) return;
    const b = blocks[i] || { start: 1, end: inputLines.length };
    const cands = dateCandidateSet(inputLines, b, ctx);
    if (cands.size > 1) errs.push(`[trace] line ${i + 1}.date: the receipt names ${cands.size} distinct dates (${[...cands].join(', ')}) - it does not identify a single transaction date, so date must be "not in source"`);
  });
}
// A line "prints a fillable transaction date": some date-shaped token on it sits in valid
// date-context (bare, or governed by a date label). Uses the SAME authorities the trace gate uses
// to ACCEPT a date (looksLikeDate + dateContextOk), so the drop guard and the accept rule agree.
// A date-shaped token. The numeric form is bounded by (?<!\d)...(?!\d) so a date is not read out of a
// longer number/code: "01/027 APPROVED" (a batch code) must NOT yield the phantom date "01/02".
const DATE_CAND = /[a-z]{3,9}\.?\s*\d{1,2}(?:,?\s*\d{2,4})?|(?<!\d)\d{1,4}[./\-]\d{1,2}(?:[./\-]\d{2,4})?(?!\d)/gi;
function linePrintsFillableDate(lineNorm, dateCtx) {
  const cands = lineNorm.match(DATE_CAND) || [];
  return cands.some((t) => looksLikeDate(t) && dateContextOk(lineNorm, norm(t), dateCtx));
}
// The distinct transaction-date values a block offers: label-governed dates if any are printed,
// otherwise bare dates. >1 distinct value means the receipt does not identify a single date.
function dateCandidateSet(inputLines, b, ctx) {
  const labeled = new Set(), bare = new Set();
  for (let n = b.start; n <= b.end; n++) {
    const ln = norm(inputLines[n - 1]);
    for (const t of (ln.match(DATE_CAND) || [])) {
      const v = norm(t);
      if (!looksLikeDate(v)) continue;
      let idx = ln.indexOf(v);
      while (idx !== -1) {
        const seg = stripLabelTail(ln.slice(0, idx));
        if (seg === '') bare.add(v);
        else if (endsWithLabel(seg, ctx)) labeled.add(v);
        idx = ln.indexOf(v, idx + 1);
      }
    }
  }
  return labeled.size > 0 ? labeled : bare;
}
function fieldDropCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const blocks = computeBlocks(inputLines);
  out.lines.forEach((line, i) => {
    const b = blocks[i] || { start: 1, end: inputLines.length };
    const header = blockHeader(inputLines, b);
    for (const f of schema.fields) {
      const c = f.constraints || {};
      const cell = line[f.name];
      if (!cell || cell.value !== marker) continue;
      // (a) labelled fields (amount/tax/category): a stated, label-governed value may not be dropped.
      if (Array.isArray(c.require_label)) {
        if (f.name === 'amount') {
          // amount-drop is a violation only when the receipt names exactly ONE total; 0 = nothing to
          // drop, >1 = ambiguous and "not in source" is the correct answer (see amountAmbiguityCheck).
          if (amountCandidateSet(inputLines, b, c).size === 1) {
            errs.push(`[trace] line ${i + 1}.amount: marked "${marker}", but the receipt prints a single total - a stated total may not be dropped into unmapped and reported empty`);
          }
        } else {
          for (let n = b.start; n <= b.end; n++) {
            if (labelGovernsAValue(norm(inputLines[n - 1]), c.require_label, c.numeric)) {
              errs.push(`[trace] line ${i + 1}.${f.name}: marked "${marker}", but line ${n} (${JSON.stringify(inputLines[n - 1])}) prints a ${f.name} - a stated field may not be dropped into unmapped and reported empty`);
              break;
            }
          }
        }
      }
      // (b) date: a printed transaction date may not be dropped - but only when the receipt names
      // exactly ONE. Zero = nothing to drop; more than one = ambiguous, and "not in source" is correct
      // (see dateAmbiguityCheck), so the drop-guard must yield, exactly as it does for amount.
      else if (Array.isArray(c.date_context)) {
        if (dateCandidateSet(inputLines, b, c.date_context).size === 1) {
          errs.push(`[trace] line ${i + 1}.${f.name}: marked "${marker}", but the receipt prints a single transaction date - a stated date may not be dropped into unmapped and reported empty`);
        }
      }
      // (c) vendor: the merchant is the block header; if a header line exists it may not be dropped.
      else if (c.header_full_line && header !== null) {
        errs.push(`[trace] line ${i + 1}.${f.name}: marked "${marker}", but line ${header} (${JSON.stringify(inputLines[header - 1])}) is the receipt header - the merchant may not be dropped into unmapped and reported empty`);
      }
    }
  });
}

// Total priority: if a final-owed total (Total Due / Amount Due / Balance Due / Grand Total / ...)
// is printed in the block, the amount must be taken from it, not from a plain "Total". Closes the
// cash-rounding misattribution (Total 22.94 vs Total Due 22.95 -> amount must be 22.95).
function totalPriorityCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const amountField = schema.fields.find((f) => f.name === 'amount');
  const finals = amountField && amountField.constraints && amountField.constraints.final_total_labels;
  if (!Array.isArray(finals)) return;
  const blocks = computeBlocks(inputLines);
  out.lines.forEach((line, i) => {
    const a = line.amount;
    if (!a || a.value === marker || !Array.isArray(a.cite)) return;
    const b = blocks[i] || { start: 1, end: inputLines.length };
    let blockHasFinal = false;
    for (let n = b.start; n <= b.end; n++) if (labelGovernsAValue(norm(inputLines[n - 1]), finals, true)) { blockHasFinal = true; break; }
    if (!blockHasFinal) return;
    const amountIsFinal = a.cite.some((n) => n >= 1 && n <= inputLines.length && labelGovernsValue(norm(inputLines[n - 1]), norm(a.value), finals));
    if (!amountIsFinal) errs.push(`[trace] line ${i + 1}.amount: a final total is printed (one of: ${finals.join(', ')}), so amount must be taken from it, not from a plain "total" - ${JSON.stringify(a.value)} is the wrong total`);
  });
}

function validateOutput(out, schema, id, pinnedInput = null) {
  const errs = [];
  shapeCheck(out, schema, id, errs);
  // The trace/coverage/block passes below assume out.lines is an array of line OBJECTS and
  // out.unmapped_input_lines (if present) is an array. If the record is not structurally that - a missing
  // or non-array lines, a null/non-object line entry, a non-array unmapped - shapeCheck has already
  // recorded the [shape] error; decline here rather than crash with a raw stack trace (a truncated model
  // output must fail closed with a diagnostic, per this file's runner contract).
  const structurallyTraceable = out && typeof out === 'object' && !Array.isArray(out)
    && Array.isArray(out.lines) && out.lines.every((l) => l && typeof l === 'object' && !Array.isArray(l))
    && (out.unmapped_input_lines === undefined || Array.isArray(out.unmapped_input_lines));
  if (!structurallyTraceable) {
    if (!errs.length) errs.push('[shape] record structure invalid - "lines" must be an array of line objects and "unmapped_input_lines" an array');
    return errs;
  }
  let sourceForTrace = out.source_file;
  if (pinnedInput) {
    if (typeof out.source_file !== 'string' || !samePath(out.source_file, pinnedInput)) {
      errs.push(`[shape] source_file ${JSON.stringify(out.source_file)} does not match the --input the checker was given (${pinnedInput}) - the output may not choose its own evidence`);
    }
    sourceForTrace = pinnedInput;
  }
  if (typeof sourceForTrace !== 'string' || !insideRepo(sourceForTrace)) {
    errs.push(`[shape] source_file ${JSON.stringify(sourceForTrace)} is outside the project directory - evidence must be a file inside the repo, not a traversal (../) or absolute path`);
    return errs;
  }
  const inputLines = readInputLines(sourceForTrace);
  if (inputLines === null) { errs.push(`[shape] input "${sourceForTrace}" does not exist - cannot trace citations`); return errs; }
  traceCheck(out, schema, inputLines, errs);
  coverageCheck(out, schema, inputLines, errs);
  blockCheck(out, schema, inputLines, errs);
  currencyDropCheck(out, schema, inputLines, errs);
  currencyBindingCheck(out, schema, inputLines, errs);
  currencySourceCheck(out, schema, inputLines, errs);
  fieldDropCheck(out, schema, inputLines, errs);
  totalPriorityCheck(out, schema, inputLines, errs);
  amountAmbiguityCheck(out, schema, inputLines, errs);
  dateAmbiguityCheck(out, schema, inputLines, errs);
  return errs;
}

// ---------- runner ----------

// A malformed output should decline gracefully with a [shape] diagnostic, not crash with a stack trace.
function tryParseJson(raw) {
  try { return { ok: true, value: JSON.parse(raw) }; }
  catch (e) { return { ok: false, msg: `[shape] not valid JSON - ${e.message}` }; }
}

function main() {
  const { schema, id } = loadSchema();
  const inIdx = process.argv.indexOf('--input');
  const pinnedInput = inIdx !== -1 ? process.argv[inIdx + 1] : null;
  const fileArgIdx = process.argv.indexOf('--output');

  if (fileArgIdx !== -1) {
    const path = process.argv[fileArgIdx + 1];
    let raw;
    try { raw = readFileSync(path, 'utf8'); }
    catch (e) { console.error(`FAIL: ${path}`); console.error(`  - [shape] cannot read output file - ${e.message}`); process.exit(1); }
    const parsed = tryParseJson(raw);
    if (!parsed.ok) { console.error(`FAIL: ${path}`); console.error(`  - ${parsed.msg}`); process.exit(1); }
    const out = parsed.value;
    const errs = validateOutput(out, schema, id, pinnedInput);
    const dup = firstDuplicateKey(raw);
    if (dup) errs.unshift(`[shape] duplicate key "${dup}" in the JSON - a record must not repeat a key, or a reader and the parser could see different values`);
    if (errs.length) { console.error(`FAIL: ${path}`); for (const e of errs) console.error(`  - ${e}`); process.exit(1); }
    console.log(`ok: ${path} (${out.lines.length} line(s), schema: ${id}${pinnedInput ? `, input pinned to ${pinnedInput}` : ''})`);
    return;
  }

  const matrix = process.argv.includes('--matrix');
  let failed = false;
  const outRes = [];   // { f, lines, pass }
  const fixRes = [];    // { f, expect, caught }
  if (!matrix) console.log(`--- schema: ${id} (${schema.name}) ---`);

  const outputsDir = join(root, 'verify', 'outputs');
  for (const f of readdirSync(outputsDir).filter((f) => f.endsWith('.json'))) {
    const raw = readFileSync(join(outputsDir, f), 'utf8');
    const out = JSON.parse(raw);
    const errs = validateOutput(out, schema, id);
    const dup = firstDuplicateKey(raw);
    if (dup) errs.unshift(`[shape] duplicate key "${dup}" in the JSON`);
    const pass = errs.length === 0;
    outRes.push({ f, lines: (out.lines || []).length, pass });
    if (!pass) { failed = true; if (!matrix) { console.error(`FAIL: verify/outputs/${f}`); for (const e of errs) console.error(`  - ${e}`); } }
    else if (!matrix) console.log(`ok: verify/outputs/${f} (${out.lines.length} line(s))`);
  }

  const fixturesDir = join(root, 'verify', 'fixtures');
  for (const f of readdirSync(fixturesDir).filter((f) => f.startsWith('fail_') && f.endsWith('.json'))) {
    const rawText = readFileSync(join(fixturesDir, f), 'utf8');
    const raw = JSON.parse(rawText);
    const expect = raw._expect_gate;
    // Strip ONLY the harness metadata keys, then validate strictly - so a fixture cannot rely on the
    // annotation exemption to smuggle anything, and production validation stays fully closed.
    const { _fixture, _expect_gate, ...out } = raw;
    const errs = validateOutput(out, schema, id);
    const dup = firstDuplicateKey(rawText);
    if (dup) errs.unshift(`[shape] duplicate key "${dup}" in the JSON`);
    let caught = true;
    if (errs.length === 0) { caught = false; failed = true; if (!matrix) console.error(`FAIL: fixture ${f} was supposed to fail but passed - the gate it tests is dead`); }
    else if (expect && !errs.some((e) => e.startsWith(`[${expect}]`))) {
      caught = false; failed = true;
      if (!matrix) { console.error(`FAIL: fixture ${f} failed, but not through its intended [${expect}] gate - it fails for the wrong reason`); for (const e of errs) console.error(`      ${e}`); }
    } else if (!matrix) console.log(`ok (failed through [${expect}] as required): verify/fixtures/${f}`);
    fixRes.push({ f, expect, caught });
  }

  if (matrix) printMatrix(outRes, fixRes, failed);
  else if (failed) console.error('\nRESULT: FAIL');
  else console.log('\nRESULT: all outputs traced clean, all fixtures failed through their intended gate.');
  if (failed) process.exit(1);
}

// A judge-facing summary: what the entry promises, proven in one screen.
function printMatrix(outRes, fixRes, failed) {
  const GATE = { trace: 'invented / misattributed value', coverage: 'dropped or hollow field', shape: 'schema / envelope break', block: 'cross-receipt citation' };
  const okOut = outRes.filter((o) => o.pass).length, lines = outRes.reduce((s, o) => s + o.lines, 0);
  const byGate = {};
  for (const x of fixRes) { (byGate[x.expect] = byGate[x.expect] || { n: 0, c: 0 }).n++; if (x.caught) byGate[x.expect].c++; }
  const totFix = fixRes.length, caughtFix = fixRes.filter((x) => x.caught).length;
  const mark = (ok) => (ok ? 'PASS' : 'FAIL');
  const L = [];
  L.push('THE TRANSLATOR - verdict matrix');
  L.push('receipt text -> fixed expense record; every value traces to the input or says "not in source".');
  L.push('');
  L.push('  Real outputs, every value traced to its input');
  L.push(`      ${String(okOut).padStart(2)}/${String(outRes.length).padEnd(2)} outputs  (${lines} lines, incl. live model runs on unseen receipts)   ${mark(okOut === outRes.length)}`);
  L.push('');
  L.push('  Planted attacks, each MUST be rejected');
  for (const g of ['trace', 'coverage', 'shape', 'block']) { const b = byGate[g]; if (!b) continue; L.push(`      ${(GATE[g] + ' ').padEnd(34, '.')} ${String(b.c).padStart(2)}/${String(b.n).padEnd(2)} caught   ${mark(b.c === b.n)}`); }
  L.push(`      ${'all attack fixtures '.padEnd(34, '.')} ${String(caughtFix).padStart(2)}/${String(totFix).padEnd(2)} caught   ${mark(caughtFix === totFix)}`);
  L.push('');
  L.push(`  RESULT: ${failed ? 'FAIL - see node verify/check.mjs for detail' : 'READY - every real value traces to its input; every planted invention is caught'}`);
  console.log(L.join('\n'));
}

main();
