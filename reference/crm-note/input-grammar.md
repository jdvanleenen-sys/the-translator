# crm-note — input grammar

**In:** the text of one sales-call note, one line per line. Some labeled lines (`Call date:`,
`Contact:`, `Company:`, `Budget:`, `Next step:`, `Stage:`) mixed with free discussion.

**Out:** one CRM record (see `schema.json`), plus `unmapped_input_lines` disclosing every non-blank line
the record does not use (the discussion, the objections) with a controlled reason code. The objection a
prospect raised is disclosed, never dropped.

**The rule, same as every cartridge:** a value is filled only when the right label governs it on a single
line; otherwise `not in source`. Stage, next_step, and budget are the fields to watch — filled ONLY from
an explicit label, never inferred from the tenor of the call. A CRM tool that writes a stage because the
call "felt" advanced, or a next step nobody agreed to, has invented content.
