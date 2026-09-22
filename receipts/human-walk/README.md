# Human hand-check (non-technical verifier)

A non-technical person went through the tool's output against the receipt, item by item, and confirmed
that **every value on the form is accurate — it matches the line printed on the receipt** — and that
where the form says `not in source`, the receipt genuinely has no such value. It is evidence that the
"never invents" promise is checkable by an ordinary person, not only by the machine.

- **The card they followed:** `walk-card.html` (open in a browser). Receipt and output side by side, with
  step-by-step checks tracing each value to its line and confirming the `not in source` fields are blank
  because the receipt is silent, not because anything was guessed.
- **Example used:** `inputs/receipts-coffee.txt` → `verify/outputs/receipts-coffee.json`.

## Recording

- **Audio recording available on request** (kept out of this public repo).
- **Date:** 2026-09-21.
- **Example walked:** receipts-coffee.

## Who did the check, and what it shows (stated plainly)

- **Verifier:** a non-technical person, kept anonymous, **known to the builder — not an independent
  stranger.** Disclosed honestly on purpose; we are not presenting this as an unconnected outsider.
- **What it confirms:** that the output's values are accurate against the receipt — each figure matches
  the line it cites, and the `not in source` fields are truly absent. A non-technical person could follow
  the trace and verify it by hand.
- **What it is not:** an independent investigation. This is a values-match confirmation by a connected
  verifier working from the card, not a stranger reconstructing the receipt from scratch. A genuinely
  unconnected outsider walk would carry more weight and can be added alongside this if one becomes
  available.
