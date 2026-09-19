# support-ticket — field definitions

One record per customer email. Seven fields, fixed order. Every filled value cites the email line it
came from; anything the email does not state is `not in source`.

- **line_no** — the record's 1-based row index. Structural, no citation.
- **date** — the date the email states (a bare date line, or one a `Date`/`Sent`/`Received` label
  governs), verbatim. Never normalized, never invented.
- **requester** — the sender, copied verbatim from the line a `From`/`Sender`/`Requester` label governs.
  Not guessed from the signature.
- **order_ref** — an order/reference/account/ticket identifier, only if the email states one on a
  labeled line. Verbatim. Otherwise `not in source`.
- **product** — the product/service, only if named on a `Product`/`Service`/`Plan` labeled line. Never
  inferred from the subject or body.
- **severity** — only if literally stated on a `Severity`/`Priority`/`Urgency`/`Impact` labeled line.
  **Never inferred from tone.** "This is really frustrating" and "ASAP" are not a severity. This is the
  field a helpful-but-guessing tool invents; this one refuses.
- **category** — only if literally stated on a `Category`/`Type`/`Queue`/`Department` labeled line.
  Never inferred from what the email is about.
