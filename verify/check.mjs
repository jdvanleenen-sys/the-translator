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
const samePath = (a, b) => resolve(root, a).replace(/\\/g, '/').toLowerCase() === resolve(root, b).replace(/\\/g, '/').toLowerCase();
// The evidence file must live inside the repo - an output may not point its source_file at a
// traversal path (../) or an absolute path outside the project to prove its claims.
const insideRepo = (p) => { const abs = resolve(root, p); return abs === resolve(root) || abs.startsWith(resolve(root) + sep); };

// Does the value sit on the line as a COMPLETE token? For numeric/date fields, exactToken rejects a
// truncation: "8" must not match inside "8.25", "14-03" must not match inside "14-03-2026". A match
// counts only when it is not flanked by a token-continuation char (digit, decimal, comma, date
// separator). Text fields (vendor, currency, category) use plain substring so "$" glued to a number
// and multi-word names still match.
const CONT = /[0-9.,/\-]/;
function occursOnLine(lineNorm, valNorm, exactToken) {
  if (valNorm === '') return false;
  if (!exactToken) return lineNorm.includes(valNorm);
  let idx = lineNorm.indexOf(valNorm);
  while (idx !== -1) {
    const before = idx > 0 ? lineNorm[idx - 1] : '';
    const after = idx + valNorm.length < lineNorm.length ? lineNorm[idx + valNorm.length] : '';
    if ((before === '' || !CONT.test(before)) && (after === '' || !CONT.test(after))) return true;
    idx = lineNorm.indexOf(valNorm, idx + 1);
  }
  return false;
}
// A monetary value is digits with optional grouping/decimal - never a word like "Due" or empty.
const isNumericValue = (v) => /^\d[\d.,]*$/.test(norm(v).replace(/\s+/g, ''));

// A value goes in the date field only if it actually looks like a date. Rejects pure amounts.
function looksLikeDate(v) {
  const s = norm(v);
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/.test(s)) return true;
  if (/\b\d{4}-\d{1,2}-\d{1,2}\b/.test(s)) return true;
  if (/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/.test(s)) return true;
  const m = s.match(/\b(\d{1,2})[/.\-](\d{1,2})\b/);
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
  return blocks;
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
      if (c.shape === 'date' && !looksLikeDate(cell.value)) errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is not date-shaped - a non-date value may not be placed in the date field`);
      // exact_token rejects a truncation of a longer number/date ("8" of "8.25", "14-03" of "14-03-2026")
      const matchLines = cell.cite.filter((n) => occursOnLine(norm(inputLines[n - 1]), norm(cell.value), !!c.exact_token));
      if (matchLines.length === 0) {
        const span = cell.cite.map((n) => `${n}:${JSON.stringify(inputLines[n - 1])}`).join(', ');
        errs.push(`[trace] ${where}.${f.name}: value not found as a complete token on any single cited line - invented, mis-cited, truncated, or fabricated across lines\n      value: ${JSON.stringify(cell.value)}\n      cited: ${span}`);
        continue;
      }
      if (Array.isArray(c.require_label)) {
        const ok = matchLines.some((n) => c.require_label.some((kw) => norm(inputLines[n - 1]).includes(kw)));
        if (!ok) errs.push(`[trace] ${where}.${f.name}: value is present but not on a ${f.name}-labeled line (expected one of: ${c.require_label.join(', ')}) - wrong field, or an unlabeled value that should be "${marker}"`);
      }
      if (Array.isArray(c.forbid_label)) {
        const clean = matchLines.some((n) => !c.forbid_label.some((kw) => norm(inputLines[n - 1]).includes(kw)));
        if (!clean) errs.push(`[trace] ${where}.${f.name}: value is sourced from a forbidden line kind (${c.forbid_label.join('/')}) - amount must be the printed total, not a subtotal or tax line`);
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

function blockCheck(out, inputLines, errs) {
  const blocks = computeBlocks(inputLines);
  if (out.lines.length !== blocks.length) { errs.push(`[block] output has ${out.lines.length} line(s) but the input has ${blocks.length} receipt block(s) - one output line per receipt`); return; }
  out.lines.forEach((line, i) => {
    const b = blocks[i];
    for (const [k, cell] of Object.entries(line)) {
      if (!cell || typeof cell !== 'object' || !Array.isArray(cell.cite)) continue;
      for (const n of cell.cite) if (n < b.start || n > b.end) errs.push(`[block] line ${i + 1}.${k}: cites input line ${n}, outside its own receipt block (lines ${b.start}-${b.end}) - a receipt may not cite another receipt`);
    }
  });
}

// pinnedInput: when the verifier supplies --input, the output may not choose its own evidence - its
// source_file must resolve to that file, and citations are traced against it.
function validateOutput(out, schema, id, pinnedInput = null) {
  const errs = [];
  shapeCheck(out, schema, id, errs);
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
  blockCheck(out, inputLines, errs);
  return errs;
}

// ---------- runner ----------

function main() {
  const { schema, id } = loadSchema();
  const inIdx = process.argv.indexOf('--input');
  const pinnedInput = inIdx !== -1 ? process.argv[inIdx + 1] : null;
  const fileArgIdx = process.argv.indexOf('--output');

  if (fileArgIdx !== -1) {
    const path = process.argv[fileArgIdx + 1];
    const out = JSON.parse(readFileSync(path, 'utf8'));
    const errs = validateOutput(out, schema, id, pinnedInput);
    if (errs.length) { console.error(`FAIL: ${path}`); for (const e of errs) console.error(`  - ${e}`); process.exit(1); }
    console.log(`ok: ${path} (${out.lines.length} line(s), schema: ${id}${pinnedInput ? `, input pinned to ${pinnedInput}` : ''})`);
    return;
  }

  let failed = false;
  console.log(`--- schema: ${id} (${schema.name}) ---`);

  const outputsDir = join(root, 'verify', 'outputs');
  for (const f of readdirSync(outputsDir).filter((f) => f.endsWith('.json'))) {
    const out = JSON.parse(readFileSync(join(outputsDir, f), 'utf8'));
    const errs = validateOutput(out, schema, id);
    if (errs.length) { failed = true; console.error(`FAIL: verify/outputs/${f}`); for (const e of errs) console.error(`  - ${e}`); }
    else console.log(`ok: verify/outputs/${f} (${out.lines.length} line(s))`);
  }

  const fixturesDir = join(root, 'verify', 'fixtures');
  for (const f of readdirSync(fixturesDir).filter((f) => f.startsWith('fail_') && f.endsWith('.json'))) {
    const raw = JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'));
    const expect = raw._expect_gate;
    // Strip ONLY the harness metadata keys, then validate strictly - so a fixture cannot rely on the
    // annotation exemption to smuggle anything, and production validation stays fully closed.
    const { _fixture, _expect_gate, ...out } = raw;
    const errs = validateOutput(out, schema, id);
    if (errs.length === 0) { failed = true; console.error(`FAIL: fixture ${f} was supposed to fail but passed - the gate it tests is dead`); continue; }
    if (expect && !errs.some((e) => e.startsWith(`[${expect}]`))) {
      failed = true;
      console.error(`FAIL: fixture ${f} failed, but not through its intended [${expect}] gate - it fails for the wrong reason`);
      for (const e of errs) console.error(`      ${e}`);
      continue;
    }
    console.log(`ok (failed through [${expect}] as required): verify/fixtures/${f}`);
  }

  if (failed) { console.error('\nRESULT: FAIL'); process.exit(1); }
  console.log('\nRESULT: all outputs traced clean, all fixtures failed through their intended gate.');
}

main();
