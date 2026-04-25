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

The Airtable `Properties` table should already exist with the expanded investment analytics fields.

Open the app, click **Settings**, enter:

- Airtable Personal Access Token
- Airtable Base ID
- Table Name: `Properties`

Then click:

1. **Save Settings**
2. **Test Connection**
3. **Refresh**

Your Airtable token needs access to the base and these scopes for normal app use:

- `data.records:read`
- `data.records:write`

Schema setup is handled outside the GitHub Pages app through Airtable directly or through the connected Airtable tool, not from the Settings modal.

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
