# crm-note — worked example

**Input** (`inputs/call-notes-1.txt`):

```
1  Call date: 2026-09-12
2  Contact: Marcus Lee
3  Company: Ridgeline Logistics
4  Discussed the Q4 rollout and their two-warehouse pilot.
5  He seemed keen but raised onboarding-time concerns.
6  Budget: 40000
7  Next step: send the pilot proposal by Sept 19
```

**Output** (`verify/outputs/crm-note-1.json`):

| field | value | from |
|---|---|---|
| date | 2026-09-12 | line 1 |
| contact | Marcus Lee | line 2 |
| company | Ridgeline Logistics | line 3 |
| budget | 40000 | line 6 |
| next_step | send the pilot proposal by Sept 19 | line 7 |
| stage | not in source | — |

**What it teaches:** the stated facts fill. `stage` is `not in source` even though the call "seemed
keen" — because no stage was written. A commodity CRM assistant would set stage to "Evaluation" from the
tone; that is invented. The discussion and the objection (lines 4-5) are disclosed in
`unmapped_input_lines`, so the objection the prospect raised is never silently lost.
