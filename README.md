# Sacramento Commercial Property Comparison App

A simple Airtable-backed web app for tracking and comparing Sacramento commercial property listings.

## What this app includes

- **Airtable backend** with one table: `Properties`
- **Add Property form** to create new records
- **Table view** with search, filter, and sort controls
- **Scoring logic** (0–100) based on:
  - higher cap rate (better)
  - lower price per SF (better)
  - occupancy upside (more room to lease up = better)
- Clean, lightweight UI using plain HTML/CSS/JS

---

## 1) Airtable setup

1. Create a new Airtable Base.
2. Create one table named **`Properties`**.
3. Add these fields exactly (recommended field types in parentheses):

- `Property Name` (Single line text)
- `Address` (Single line text)
- `City` (Single line text)
- `Submarket` (Single line text)
- `Asset Type` (Single select or single line text)
- `Asking Price` (Currency)
- `Price per SF` (Currency)
- `Building SF` (Number)
- `Lot Size` (Single line text)
- `Cap Rate` (Percent)
- `NOI` (Currency)
- `Occupancy` (Percent)
- `Year Built` (Number)
- `Broker Name` (Single line text)
- `Broker Email` (Email)
- `Source URL` (URL)
- `Status` (Single select)
- `Notes` (Long text)
- `Score` (Number)

> The app writes `Score` on create, but still recalculates score client-side when rendering records.

---

## 2) Airtable API credentials

You need:

- **Base ID** (from Airtable API docs for your base)
- **Personal Access Token** with scopes:
  - `data.records:read`
  - `data.records:write`
  - Access to your target base

Then:

1. Copy the config template:

   ```bash
   cp config.example.js config.js
   ```

2. Open `config.js` and add your credentials:

   ```js
   window.APP_CONFIG = {
     AIRTABLE_TOKEN: "pat_your_token_here",
     AIRTABLE_BASE_ID: "app_your_base_id_here",
     AIRTABLE_TABLE_NAME: "Properties"
   };
   ```

⚠️ This is a client-side demo. Do **not** use this pattern for production without a backend proxy because the token is exposed in browser code.

---

## 3) Run locally

Any static web server works. Example with Python:

```bash
python3 -m http.server 8080
```

Then open:

- `http://localhost:8080`

---

## 4) Scoring logic details

The app computes a weighted score from **0 to 100**:

- **Cap Rate (50 pts max):** normalized from 3% to 10%.
- **Price per SF (30 pts max):** lower is better; normalized from $300 down to $50.
- **Occupancy Upside (20 pts max):** upside = `100 - Occupancy`; capped for practical range.

### App formula

```text
Score = round(
  clamp((CapRate - 3) / 7, 0..1) * 50
  + clamp((300 - PricePerSF) / 250, 0..1) * 30
  + clamp((100 - Occupancy) / 40, 0..1) * 20
)
```

### Optional Airtable formula field alternative

If you prefer calculating directly in Airtable, change `Score` to a formula field and use:

```text
ROUND(
  MAX(0, MIN(1, ({Cap Rate} - 3) / 7)) * 50 +
  MAX(0, MIN(1, (300 - {Price per SF}) / 250)) * 30 +
  MAX(0, MIN(1, (100 - {Occupancy}) / 40)) * 20,
0)
```

---

## 5) Using the app

- Fill out the **Add Property** form and click **Save Property**.
- Use filters to narrow list by city, asset type, status, or minimum score.
- Use **Sort By** and **Direction** to compare opportunities quickly.
- Click **Refresh** to reload from Airtable.

