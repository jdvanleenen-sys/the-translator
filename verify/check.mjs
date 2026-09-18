#!/usr/bin/env node
// Verify Translator outputs against the input they were produced from and the schema in
// reference/<id>/schema.json. Fails loud, exits non-zero, prints the diagnostic. Offline, no deps.
//
// Forked from the-auditor/verify/check.mjs (Comp #12 winner) and hardened after two independent
// cross-brain reviews (Perplexity + ChatGPT) named the same weakness: proving a value exists on a
// cited line is not the same as proving it came from the RIGHT KIND of line. So the trace gate now
// also enforces field-semantic constraints (a category must be sourced from a category-labeled
// line, a tax from a tax line, an amount not from a subtotal/tax line, a date must be date-shaped),
// citations are single-line and block-scoped, the envelope is closed (no stray keys, conversion is
// pinned, field order enforced), unmapped reasons are a controlled vocabulary, and every fixture
// must fail through its INTENDED gate.
//
// Usage:
//   node verify/check.mjs                 validate every verify/outputs/*.json (must PASS), then
//                                          confirm every verify/fixtures/fail_*.json fails through
//                                          the gate it declares in "_expect_gate"
//   node verify/check.mjs --output <path>  validate one output file only (must PASS)
//
// Every error string begins with a [gate] tag: [shape] [trace] [coverage] [block]. A fixture's
// "_expect_gate" must appear among its errors, so a fixture can't pass by failing for the wrong reason.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ---------- helpers ----------

// Light normalization for the trace check: lowercase, drop code ticks, fold em/en dashes to a
// hyphen and smart quotes to straight, collapse whitespace.
function norm(s) {
  return (s || '').toString().toLowerCase()
    .replace(/`/g, '').replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function isExemptLine(text) {
  const t = (text || '').trim();
  return t === '' || t === '---';
}

// A value goes in the date field only if it actually looks like a date, so a bare amount cannot be
// dropped there. Accepts month names, ISO, and slash/dot/dash dates with plausible day/month ranges.
// Rejects pure monetary numbers like "39.36" or "268.84".
function looksLikeDate(v) {
  const s = norm(v);
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/.test(s)) return true;
  if (/\b\d{4}-\d{1,2}-\d{1,2}\b/.test(s)) return true;
  if (/\b\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}\b/.test(s)) return true;
  const m = s.match(/\b(\d{1,2})[/.\-](\d{1,2})\b/);
  if (m) {
    const a = +m[1], b = +m[2];
    if ((a >= 1 && a <= 12 && b >= 1 && b <= 31) || (b >= 1 && b <= 12 && a >= 1 && a <= 31)) return true;
  }
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

// Split the input into receipt blocks on lines that are exactly "---". Returns 1-based inclusive
// { start, end } ranges. One block for a single-receipt input.
function computeBlocks(inputLines) {
  const blocks = [];
  let start = 1;
  for (let n = 1; n <= inputLines.length; n++) {
    if (inputLines[n - 1].trim() === '---') {
      blocks.push({ start, end: n - 1 });
      start = n + 1;
    }
  }
  blocks.push({ start, end: inputLines.length });
  return blocks;
}

const isAnnotation = (k) => k.startsWith('_');

// ---------- gates (every error is prefixed with a [gate] tag) ----------

function shapeCheck(out, schema, id, errs) {
  if (out.conversion !== id) errs.push(`[shape] top level: "conversion" must be "${id}", got ${JSON.stringify(out.conversion)}`);
  if (typeof out.source_file !== 'string') errs.push('[shape] top level: missing "source_file" string');
  for (const k of Object.keys(out)) {
    if (!isAnnotation(k) && !schema.top_level_keys.includes(k)) errs.push(`[shape] top level: unexpected key "${k}" - only ${schema.top_level_keys.join(', ')} are allowed`);
  }
  if (!Array.isArray(out.lines) || out.lines.length === 0) { errs.push('[shape] top level: "lines" must be a non-empty array'); return; }
  if (!Array.isArray(out.unmapped_input_lines)) errs.push('[shape] top level: "unmapped_input_lines" must be an array');

  const marker = schema.not_in_source_marker;
  const fieldNames = schema.fields.map((f) => f.name);
  out.lines.forEach((line, i) => {
    const where = `line ${i + 1}`;
    // presence + no stray keys + order
    for (const f of schema.fields) if (!(f.name in line)) errs.push(`[shape] ${where}: missing field "${f.name}" - every field present in every line, empty ones "${marker}"`);
    for (const k of Object.keys(line)) if (!isAnnotation(k) && !fieldNames.includes(k)) errs.push(`[shape] ${where}: unexpected key "${k}" - the record shape is fixed to ${fieldNames.join(', ')}`);
    const orderedKeys = Object.keys(line).filter((k) => fieldNames.includes(k));
    const expectedOrder = fieldNames.filter((n) => orderedKeys.includes(n));
    if (orderedKeys.join(',') !== expectedOrder.join(',')) errs.push(`[shape] ${where}: fields out of order - expected ${expectedOrder.join(', ')}, got ${orderedKeys.join(', ')}`);
    if (line.line_no !== i + 1) errs.push(`[shape] ${where}: line_no is ${JSON.stringify(line.line_no)}, must equal its 1-based row index ${i + 1}`);
    // cell validity
    for (const f of schema.fields) {
      if (f.role === 'structural') continue;
      const cell = line[f.name];
      if (cell === undefined) continue;
      if (typeof cell !== 'object' || cell === null || typeof cell.value !== 'string') { errs.push(`[shape] ${where}.${f.name}: must be an object with a string "value"`); continue; }
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
      // date must be date-shaped, so an amount can't be parked in the date field
      if (c.shape === 'date' && !looksLikeDate(cell.value)) {
        errs.push(`[trace] ${where}.${f.name}: value ${JSON.stringify(cell.value)} is not date-shaped - a non-date value may not be placed in the date field`);
      }
      // single-line containment: the value must sit inside ONE cited line, not a synthetic join
      const matchLines = cell.cite.filter((n) => norm(inputLines[n - 1]).includes(norm(cell.value)));
      if (matchLines.length === 0) {
        const span = cell.cite.map((n) => `${n}:${JSON.stringify(inputLines[n - 1])}`).join(', ');
        errs.push(`[trace] ${where}.${f.name}: value not found on any single cited line - invented, mis-cited, or fabricated across lines\n      value: ${JSON.stringify(cell.value)}\n      cited: ${span}`);
        continue;
      }
      // require_label: at least one matching line must carry a label word for this field kind
      if (Array.isArray(c.require_label)) {
        const ok = matchLines.some((n) => c.require_label.some((kw) => norm(inputLines[n - 1]).includes(kw)));
        if (!ok) errs.push(`[trace] ${where}.${f.name}: value is present but not on a ${f.name}-labeled line (expected one of: ${c.require_label.join(', ')}) - wrong field for this text`);
      }
      // forbid_label: the sourcing line must not be a subtotal/tax line for the amount field
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
    for (const k of Object.keys(u)) if (!isAnnotation(k) && !['line', 'code', 'note'].includes(k)) errs.push(`[shape] unmapped_input_lines line ${u.line}: unexpected key "${k}" (allowed: line, code, note)`);
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
  if (out.lines.length !== blocks.length) {
    errs.push(`[block] output has ${out.lines.length} line(s) but the input has ${blocks.length} receipt block(s) - one output line per receipt`);
    return;
  }
  out.lines.forEach((line, i) => {
    const b = blocks[i];
    for (const [k, cell] of Object.entries(line)) {
      if (!cell || typeof cell !== 'object' || !Array.isArray(cell.cite)) continue;
      for (const n of cell.cite) if (n < b.start || n > b.end) errs.push(`[block] line ${i + 1}.${k}: cites input line ${n}, outside its own receipt block (lines ${b.start}-${b.end}) - a receipt may not cite another receipt`);
    }
  });
}

function validateOutput(out, schema, id) {
  const errs = [];
  shapeCheck(out, schema, id, errs);
  const inputLines = readInputLines(out.source_file);
  if (inputLines === null) { errs.push(`[shape] source_file "${out.source_file}" does not exist - cannot trace citations`); return errs; }
  traceCheck(out, schema, inputLines, errs);
  coverageCheck(out, schema, inputLines, errs);
  blockCheck(out, inputLines, errs);
  return errs;
}

// ---------- runner ----------

function main() {
  const { schema, id } = loadSchema();
  const fileArgIdx = process.argv.indexOf('--output');

  if (fileArgIdx !== -1) {
    const path = process.argv[fileArgIdx + 1];
    const out = JSON.parse(readFileSync(path, 'utf8'));
    const errs = validateOutput(out, schema, id);
    if (errs.length) { console.error(`FAIL: ${path}`); for (const e of errs) console.error(`  - ${e}`); process.exit(1); }
    console.log(`ok: ${path} (${out.lines.length} line(s), schema: ${id})`);
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

  // Kept-red fixtures: each must fail AND fail through the gate it declares in "_expect_gate".
  const fixturesDir = join(root, 'verify', 'fixtures');
  for (const f of readdirSync(fixturesDir).filter((f) => f.startsWith('fail_') && f.endsWith('.json'))) {
    const out = JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'));
    const expect = out._expect_gate;
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
