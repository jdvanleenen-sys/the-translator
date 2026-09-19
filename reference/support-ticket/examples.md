# support-ticket — worked example

**Input** (`inputs/email-support-1.txt`):

```
1  From: Jane Doe
2  Date: 2026-09-10
3  Subject: Login broken after update
4  Order 84321
5  Hi team,
6  Since the update this morning I cannot log in.
7  It just spins and returns to the login screen.
8  I have tried two browsers. This is really frustrating.
9  Please help as soon as possible.
10 Thanks,
11 Jane
```

**Output** (`verify/outputs/ticket-support-1.json`):

| field | value | from |
|---|---|---|
| date | 2026-09-10 | line 2 |
| requester | Jane Doe | line 1 |
| order_ref | 84321 | line 4 |
| product | not in source | — |
| severity | not in source | — |
| category | not in source | — |

**What it teaches:** the objective facts fill (date, requester, order). Severity and category are
`not in source` even though the email is plainly urgent and plainly about login — because it never
*states* a severity or a category. A commodity tool would write "High / Authentication" from the tone
and topic; that is invented content. The body lines are disclosed in `unmapped_input_lines`, not dropped.
