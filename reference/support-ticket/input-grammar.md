# support-ticket — input grammar

**In:** the text of one customer email, one line per line as pasted or exported. Header-ish lines
(`From:`, `Date:`, `Subject:`, `Order ...`) followed by the message body and a signature.

**Out:** one support-ticket record (see `schema.json`), plus `unmapped_input_lines` disclosing every
non-blank line the record does not use (the greeting, body, signature) with a controlled reason code.
Nothing is dropped silently.

**The rule, same as every cartridge:** a value is filled only when the right label governs it on a
single line; otherwise the field is `not in source`. Severity and category are the fields to watch —
they are filled ONLY from an explicit label, never inferred from the email's tone or topic. A tool that
writes "severity: high" because the customer sounded upset has invented content, which is the one way to
lose.
