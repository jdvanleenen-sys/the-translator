# Image input mode — a receipt photo, still provably

The translator's guarantee is defined on receipt **text**: every value traces to a printed line. This
mode extends the tool to a **photo** without giving up that guarantee, by making the text explicit and
citable rather than reading pixels straight into fields.

## The procedure (what the model does with an image)

Given a receipt image, the model does two things and **shows both**:

1. **Transcribe, verbatim.** Read the receipt top to bottom and write out its lines exactly as printed —
   one output line per printed line, numbered `1, 2, 3, ...`. Do not correct spelling, reformat a number
   or date, translate, reorder, merge, or drop anything. A line you genuinely cannot read is transcribed
   as `[illegible]`, and anything on it is therefore `not in source`. This numbered transcription is the
   **source text**: the citable record of what was on the page.

2. **Translate that transcription** exactly as in text mode (`rules.md`): the seven-field record, every
   value copied from a transcription line it cites or `not in source`, nothing invented, nothing dropped.

Output the numbered transcription first, then the record. The record's `cite` numbers refer to the
transcription's lines. To verify mechanically, save the transcription as the `source_file` (e.g.
`receipt.txt`) and run `node verify/check.mjs --input receipt.txt --output record.json` — the same
checker, unchanged.

## What is proven, and what you verify by eye

- **Proven mechanically, every time:** the record invents nothing *beyond the transcription* — every
  filled field traces to a transcription line, of the right kind, caught by the same checker that guards
  text mode. The structuring step cannot fabricate, drop, or mis-attribute a value.
- **Verified by eye (shown, never hidden):** that the transcription faithfully matches the photo. Turning
  pixels into text (OCR) is not something a deterministic checker can prove, so the tool does not pretend
  it can — instead it **shows** the transcription it read, next to the photo, so an OCR misread is visible
  and catchable rather than silent.

That is the honest boundary: the tool never claims a value its transcription does not contain, and it
never hides what it read off the page.

## Why it is built this way

A tool that silently turned a photo into fields would make OCR errors indistinguishable from faithful
reads — the exact "it made a number up" failure this entry exists to prevent. Splitting the **visible
transcription** from the **provable structuring** makes a photo usable without weakening the guarantee:
the part a machine can prove is proven, and the part it cannot (pixels → text) is put in front of you,
not buried. A receipt you can photograph, with a record where every field traces to a line you can see.
