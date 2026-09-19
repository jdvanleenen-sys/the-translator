# Cartridge demo — one engine, two conversions

> This branch (`cartridge-demo`) is a demonstration, not the competition entry. The entry lives on
> `master`: a single, focused receipt-to-expense-report translator. This branch adds a **second
> conversion on the unchanged verification engine**, to show that the value is the *structure*, not the
> receipt task — and not the AI.

## The point

`verify/check.mjs` is conversion-agnostic. It reads a **cartridge** — `reference/<id>/schema.json` plus
its field definitions and rules — and proves any output against it: fixed shape, every value traced to
the line it cites, nothing dropped, no cross-record citation. Swap the cartridge, the same engine
translates something else, with the same guarantee.

Two cartridges ship here, and one command proves both:

| cartridge | converts | fills | refuses (never invents) |
|---|---|---|---|
| `expense-report` | receipt text → expense line items | date, vendor, amount, currency, tax | a currency from locale, a category from the vendor, a summed total |
| `support-ticket` | customer email → support ticket | date, requester, order_ref | **severity from tone, category from topic** |

```
node verify/check.mjs
# → both cartridges' outputs trace clean; every planted invention is caught,
#   including "severity: urgent" invented from an email's tone.
```

## Why the engine didn't change

The receipt-specific gates (currency adjacency, total priority, columnar tax) self-disable when a
cartridge has no `currency`/`amount` field — so the support-ticket cartridge runs on the generic core
(shape, trace, coverage, block, drop-guards) with no gate edits. The only engine change from `master` is
the runner loading **all** cartridges and validating each output against the one its `conversion` names.

## What this proves

A phone app scans receipts. It cannot be pointed at "customer email → support ticket." This can — and it
still refuses to invent, in a domain with no dollars in it. The discipline is the product; the
conversion is just the cartridge you load.
