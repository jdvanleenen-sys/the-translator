#!/usr/bin/env node
// Verify Translator outputs against the input they were produced from and the schema in
// reference/<id>/schema.json. Fails loud, exits non-zero, prints the diagnostic. Offline,
// no dependencies, runnable by a stranger on a fresh clone.
//
// Forked from the-auditor/verify/check.mjs (Comp #12 winner). There, every finding cited a
// provision and the checker byte-compared the cited text against the standard. Here, every
// output field cites the input line(s) it came from and the checker confirms the value sits
// inside the cited line - not merely somewhere in the input. Same discipline, repointed.
//
// Usage:
//   node verify/check.mjs                 validate every verify/outputs/*.json against its
//                                          source_file (must PASS), then confirm every
//                                          verify/fixtures/fail_*.json FAILS as required
//   node verify/check.mjs --output <path>  validate one output file only (must PASS)
//
// Four gates, every output gets all four:
//   1. shape    - fixed shape: every schema field present in every line, in order; line_no is
//                 the row index; each field is {value:"not in source"} or {value, cite:[lines]}
//   2. trace    - every filled value is a substring of the specific cited input line(s), after
//                 light normalization. Proving the value exists SOMEWHERE in the input is not
//                 enough; it must sit inside the line it names (the span-scoped citation bar).
//   3. coverage - nothing dropped: every non-blank input line is either cited by a field or
//                 listed in unmapped_input_lines with a reason. Blank and '---' lines are exempt.
//   4. fixtures - the kept-red fail_*.json each plant one invention and MUST fail; if one ever
//                 passes, the gate it tests is dead.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// ---------- helpers ----------

// Light normalization for the trace check: lowercase, drop code ticks, fold em/en dashes to a
// hyphen and smart quotes to straight, collapse whitespace. Lets a value written in plain text
// still match a line that uses a typographic dash, without letting an invented value slip through.
function norm(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// A line is exempt from the coverage rule if it carries nothing to map: blank/whitespace-only,
// or a bare '---' receipt separator.
function isExemptLine(text) {
  const t = (text || '').trim();
  return t === '' || t === '---';
}

function loadSchema() {
  const refDir = join(root, 'reference');
  // Discover the one schema cartridge under reference/. The engine is schema-driven: point it at
  // a different reference/<id>/schema.json and it translates a different conversion, no code change.
  for (const entry of readdirSync(refDir)) {
    const p = join(refDir, entry, 'schema.json');
    if (existsSync(p)) return { schema: JSON.parse(readFileSync(p, 'utf8')), id: entry };
  }
  throw new Error('no reference/<id>/schema.json found');
}

function readInputLines(sourceFile) {
  const p = join(root, sourceFile);
  if (!existsSync(p)) return null;
  // Physical lines, 1-based. Split on newlines; a trailing newline yields a trailing '' which is
  // an exempt blank line and never breaks numbering.
  return readFileSync(p, 'utf8').split(/\r?\n/);
}

// ---------- the four gates ----------

function shapeCheck(out, schema, errs) {
  if (typeof out.conversion !== 'string') errs.push('top level: missing "conversion" string');
  if (typeof out.source_file !== 'string') errs.push('top level: missing "source_file" string');
  if (!Array.isArray(out.lines) || out.lines.length === 0) {
    errs.push('top level: "lines" must be a non-empty array');
    return;
  }
  if (!Array.isArray(out.unmapped_input_lines)) {
    errs.push('top level: "unmapped_input_lines" must be an array (empty is fine)');
  }
  const marker = schema.not_in_source_marker;
  out.lines.forEach((line, i) => {
    const where = `line ${i + 1}`;
    // Field order + presence: every schema field, in schema order.
    const keys = Object.keys(line);
    const expected = schema.fields.map((f) => f.name);
    for (const f of schema.fields) {
      if (!(f.name in line)) {
        errs.push(`${where}: missing field "${f.name}" - every field is present in every line, empty ones marked "${marker}"`);
      }
    }
    // structural line_no
    if (line.line_no !== i + 1) {
      errs.push(`${where}: line_no is ${JSON.stringify(line.line_no)}, must equal its 1-based row index ${i + 1}`);
    }
    // each source field is {value:"not in source"} or {value:string, cite:[ints]}
    for (const f of schema.fields) {
      if (f.role === 'structural') continue;
      const cell = line[f.name];
      if (cell === undefined) continue; // already reported as missing
      if (typeof cell !== 'object' || cell === null || typeof cell.value !== 'string') {
        errs.push(`${where}.${f.name}: must be an object with a string "value"`);
        continue;
      }
      if (cell.value === marker) {
        if (cell.cite !== undefined && Array.isArray(cell.cite) && cell.cite.length > 0) {
          errs.push(`${where}.${f.name}: marked "${marker}" but carries a citation - a not-in-source field cites nothing`);
        }
      } else {
        if (!Array.isArray(cell.cite) || cell.cite.length === 0) {
          errs.push(`${where}.${f.name}: filled value "${cell.value}" has no cite - a value with no citation is not traceable`);
        } else if (!cell.cite.every((n) => Number.isInteger(n) && n >= 1)) {
          errs.push(`${where}.${f.name}: cite must be an array of positive line numbers, got ${JSON.stringify(cell.cite)}`);
        }
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
      if (!Array.isArray(cell.cite) || cell.cite.length === 0) continue; // shape already flagged
      const badLine = cell.cite.find((n) => n < 1 || n > N);
      if (badLine !== undefined) {
        errs.push(`${where}.${f.name}: cites input line ${badLine}, which does not exist (input has ${N} lines)`);
        continue;
      }
      const span = cell.cite.map((n) => inputLines[n - 1]).join(' ');
      if (!norm(span).includes(norm(cell.value))) {
        errs.push(
          `${where}.${f.name}: value is not found in the cited line(s) - invented or mis-cited\n` +
          `      value: ${JSON.stringify(cell.value)}\n` +
          `      cited line(s) ${JSON.stringify(cell.cite)}: ${JSON.stringify(span)}`
        );
      }
    }
  });
}

function coverageCheck(out, schema, inputLines, errs) {
  const marker = schema.not_in_source_marker;
  const N = inputLines.length;
  const accounted = new Set();
  // every cited line
  for (const line of out.lines) {
    for (const f of schema.fields) {
      const cell = line[f.name];
      if (cell && typeof cell === 'object' && cell.value !== marker && Array.isArray(cell.cite)) {
        for (const n of cell.cite) accounted.add(n);
      }
    }
  }
  // every explicitly unmapped line (must carry a reason)
  for (const u of out.unmapped_input_lines || []) {
    if (!u || typeof u.line !== 'number') {
      errs.push(`unmapped_input_lines: an entry is missing a numeric "line": ${JSON.stringify(u)}`);
      continue;
    }
    if (u.line < 1 || u.line > N) {
      errs.push(`unmapped_input_lines: line ${u.line} does not exist (input has ${N} lines)`);
    }
    if (!u.reason || typeof u.reason !== 'string') {
      errs.push(`unmapped_input_lines: line ${u.line} has no reason - say why it maps to no field`);
    }
    accounted.add(u.line);
  }
  // every non-exempt input line must be accounted for
  for (let n = 1; n <= N; n++) {
    if (isExemptLine(inputLines[n - 1])) continue;
    if (!accounted.has(n)) {
      errs.push(
        `coverage: input line ${n} is neither cited nor listed unmapped - nothing may be dropped silently\n` +
        `      line ${n}: ${JSON.stringify(inputLines[n - 1])}`
      );
    }
  }
}

function validateOutput(out, schema) {
  const errs = [];
  shapeCheck(out, schema, errs);
  const inputLines = readInputLines(out.source_file);
  if (inputLines === null) {
    errs.push(`source_file "${out.source_file}" does not exist - cannot trace citations`);
    return errs;
  }
  traceCheck(out, schema, inputLines, errs);
  coverageCheck(out, schema, inputLines, errs);
  return errs;
}

// ---------- runner ----------

function main() {
  const { schema, id } = loadSchema();
  const fileArgIdx = process.argv.indexOf('--output');

  if (fileArgIdx !== -1) {
    const path = process.argv[fileArgIdx + 1];
    const out = JSON.parse(readFileSync(path, 'utf8'));
    const errs = validateOutput(out, schema);
    if (errs.length) {
      console.error(`FAIL: ${path}`);
      for (const e of errs) console.error(`  - ${e}`);
      process.exit(1);
    }
    console.log(`ok: ${path} (${out.lines.length} line(s), schema: ${id})`);
    return;
  }

  let failed = false;
  console.log(`--- schema: ${id} (${schema.name}) ---`);

  // Real outputs must PASS.
  const outputsDir = join(root, 'verify', 'outputs');
  for (const f of readdirSync(outputsDir).filter((f) => f.endsWith('.json'))) {
    const out = JSON.parse(readFileSync(join(outputsDir, f), 'utf8'));
    const errs = validateOutput(out, schema);
    if (errs.length) {
      failed = true;
      console.error(`FAIL: verify/outputs/${f}`);
      for (const e of errs) console.error(`  - ${e}`);
    } else {
      console.log(`ok: verify/outputs/${f} (${out.lines.length} line(s))`);
    }
  }

  // Kept-red fixtures must FAIL. If one passes, the gate it tests is dead.
  const fixturesDir = join(root, 'verify', 'fixtures');
  for (const f of readdirSync(fixturesDir).filter((f) => f.startsWith('fail_') && f.endsWith('.json'))) {
    const out = JSON.parse(readFileSync(join(fixturesDir, f), 'utf8'));
    const errs = validateOutput(out, schema);
    if (errs.length === 0) {
      failed = true;
      console.error(`FAIL: fixture ${f} was supposed to fail but passed - the gate it tests is dead`);
    } else {
      console.log(`ok (failed as required): verify/fixtures/${f}`);
    }
  }

  if (failed) {
    console.error('\nRESULT: FAIL');
    process.exit(1);
  }
  console.log('\nRESULT: all outputs traced clean, all fixtures failed as required.');
}

main();
