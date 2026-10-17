# Lucky Draw Lark proxy

The Worker reads one Lark Base table and returns participants for a workshop. It does not write to Lark or save draw results.

## Configure

Set these Worker secrets with `wrangler secret put <NAME>`:

- `APP_ID`
- `APP-SECRET`
- `LARK_APP_TOKEN` (the Base token)
- `LARK_TABLE_ID`
- `PROXY_ACCESS_KEY` (a long random value shared with draw operators)

Field IDs are configured from the supplied Base schema: workshop `fld3Z7MnaB`, name `fldtDlmW1w`, phone `fldlRDbj9a`, student ID `fldv64kybI`.
`ALLOWED_ORIGIN` allows the two Lucky Draw custom domains and `http://localhost:3000` / `http://127.0.0.1:3000` for local development.

The Lark app needs read access to the configured Base and table. Deploy this directory with Wrangler after setting the secrets.

## Request and response

The app calls `GET /?workshopId=<workshop-code>` with `Authorization: Bearer <PROXY_ACCESS_KEY>`.

```json
{
  "workshopId": "VHWS-2026-01",
  "records": [
    { "phone": "0901234567", "studentId": "20260001", "name": "Nguyen Van A" }
  ]
}
```

The browser validates the selected ID field for missing and duplicate values. It shows the list for review and requires confirmation before spinning. Refreshing or changing the data clears confirmation. In Lark mode, previous winners are excluded from future draws even when the existing “Loại bỏ người đã thắng?” setting is off.

The access key is entered in the app and is not saved in source code. Restrict the Worker to the deployed app origin and distribute the key only to draw operators. A browser based key can still be read by an operator with browser access.
