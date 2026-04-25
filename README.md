# Sacramento Investment Property Analytics App

A GitHub Pages app backed by Airtable for tracking and comparing Sacramento-area commercial real estate investment deals.

## Current app structure

The app is designed for one Airtable table named `Properties`. The form is grouped to mirror the investment-property analytics spreadsheet layout:

- Property Info
- CAP / Return Metrics
- Purchase / Cost Inputs
- Debt Service
- Income Summary
- Tenant 1 through Tenant 4
- Expenses
- 5-Year Forecast
- Review / Workflow

## Airtable setup

Open the app, click **Settings**, enter:

- Airtable Personal Access Token
- Airtable Base ID
- Table Name: `Properties`

Then click:

1. **Save Settings**
2. **Setup / Expand Properties Table**
3. **Test Connection**
4. **Refresh**

The setup button creates missing fields only. It does not delete records, delete tables, or remove existing fields.

Your Airtable token needs access to the base and these scopes for the setup button:

- `data.records:read`
- `data.records:write`
- `schema.bases:read`
- `schema.bases:write`

## Security note

This is a client-side browser app. Any Airtable token entered into the browser is visible to that browser. Use a token restricted to the specific base and scopes needed. For production, use a backend proxy so the token is not exposed in browser JavaScript.

## Local development

Run a static web server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```
