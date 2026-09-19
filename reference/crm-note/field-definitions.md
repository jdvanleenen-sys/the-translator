# crm-note — field definitions

One record per sales-call note. Seven fields, fixed order. Every filled value cites the note line it
came from; anything the rep did not write is `not in source`.

- **line_no** — the record's 1-based row index. Structural, no citation.
- **date** — the call date (a bare date line, or one a `Call date`/`Date` label governs), verbatim.
- **contact** — the person on the call, verbatim from a `Contact`/`Spoke with` labeled line.
- **company** — the account, verbatim from a `Company`/`Account` labeled line. Not inferred.
- **budget** — the deal size, only if a number is stated on a `Budget`/`Deal size` labeled line. Never
  estimated.
- **next_step** — the agreed next step, verbatim from a `Next step`/`Action` labeled line. **A next step
  nobody committed to may not be written here** — that is the invention the brief warns about.
- **stage** — the pipeline stage, only if literally stated on a `Stage`/`Status` labeled line. **Never
  inferred from how the call felt** — "seemed keen" is not a stage. Otherwise `not in source`.
