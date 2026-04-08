const { AIRTABLE_TOKEN, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } =
  window.APP_CONFIG || {};

const fields = [
  "Property Name",
  "Address",
  "City",
  "Submarket",
  "Asset Type",
  "Asking Price",
  "Price per SF",
  "Building SF",
  "Lot Size",
  "Cap Rate",
  "NOI",
  "Occupancy",
  "Year Built",
  "Broker Name",
  "Broker Email",
  "Source URL",
  "Status",
  "Notes",
  "Score"
];

const form = document.getElementById("property-form");
const formMessage = document.getElementById("form-message");
const tbody = document.getElementById("properties-body");
const refreshBtn = document.getElementById("refresh-btn");

const filterInputs = {
  search: document.getElementById("search-input"),
  city: document.getElementById("city-filter"),
  asset: document.getElementById("asset-filter"),
  status: document.getElementById("status-filter"),
  minScore: document.getElementById("min-score-filter"),
  sortField: document.getElementById("sort-field"),
  sortDirection: document.getElementById("sort-direction")
};

let records = [];

const numericFields = new Set([
  "Asking Price",
  "Price per SF",
  "Building SF",
  "Cap Rate",
  "NOI",
  "Occupancy",
  "Year Built",
  "Score"
]);

function verifyConfig() {
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
    formMessage.textContent =
      "Missing Airtable config. Copy config.example.js to config.js and fill in credentials.";
    formMessage.style.color = "#b42318";
    return false;
  }

  return true;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function calculateScoreFromFields(data) {
  const capRate = toNumber(data["Cap Rate"]);
  const pricePerSF = toNumber(data["Price per SF"]);
  const occupancy = toNumber(data["Occupancy"]);

  const capComponent =
    capRate == null ? 0 : clamp((capRate - 3) / (10 - 3), 0, 1) * 50;
  const priceComponent =
    pricePerSF == null ? 0 : clamp((300 - pricePerSF) / (300 - 50), 0, 1) * 30;

  const upside = occupancy == null ? 0 : clamp(100 - occupancy, 0, 100);
  const upsideComponent = clamp(upside / 40, 0, 1) * 20;

  return Math.round(capComponent + priceComponent + upsideComponent);
}

function baseUrl() {
  return `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}`;
}

async function airtableRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Airtable API error (${response.status}): ${body}`);
  }

  return response.json();
}

function serializeForm(formEl) {
  const formData = new FormData(formEl);
  const data = {};

  for (const [key, value] of formData.entries()) {
    if (!fields.includes(key)) continue;
    if (value === "") continue;

    if (numericFields.has(key)) {
      const n = toNumber(value);
      if (n != null) data[key] = n;
    } else {
      data[key] = value;
    }
  }

  data.Score = calculateScoreFromFields(data);
  return data;
}

function formatCurrency(value) {
  const n = toNumber(value);
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(n);
}

function formatPercent(value) {
  const n = toNumber(value);
  if (n == null) return "—";
  return `${n.toFixed(2)}%`;
}

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function applyFiltersAndSort(inputRecords) {
  const search = safeLower(filterInputs.search.value.trim());
  const city = safeLower(filterInputs.city.value.trim());
  const asset = safeLower(filterInputs.asset.value.trim());
  const status = safeLower(filterInputs.status.value.trim());
  const minScore = toNumber(filterInputs.minScore.value);
  const sortField = filterInputs.sortField.value;
  const sortDirection = filterInputs.sortDirection.value;

  let out = inputRecords.filter((record) => {
    const f = record.fields;

    const haystack = [
      f["Property Name"],
      f.Address,
      f.City,
      f["Submarket"],
      f["Broker Name"],
      f["Notes"]
    ]
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) return false;
    if (city && !safeLower(f.City).includes(city)) return false;
    if (asset && !safeLower(f["Asset Type"]).includes(asset)) return false;
    if (status && safeLower(f.Status) !== status) return false;

    const score = toNumber(f.Score ?? calculateScoreFromFields(f));
    if (minScore != null && (score == null || score < minScore)) return false;

    return true;
  });

  out.sort((a, b) => {
    const aVal = a.fields[sortField];
    const bVal = b.fields[sortField];

    const aNum = toNumber(aVal);
    const bNum = toNumber(bVal);

    let cmp;
    if (aNum != null && bNum != null) {
      cmp = aNum - bNum;
    } else {
      cmp = String(aVal || "").localeCompare(String(bVal || ""));
    }

    return sortDirection === "asc" ? cmp : -cmp;
  });

  return out;
}

function renderRows(inputRecords) {
  const filtered = applyFiltersAndSort(inputRecords);

  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td class="empty-row" colspan="11">No matching properties.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(({ fields: f }) => {
      const score = toNumber(f.Score ?? calculateScoreFromFields(f));
      return `
        <tr>
          <td>${f["Property Name"] || "—"}</td>
          <td>${f.Address || "—"}</td>
          <td>${f.City || "—"}</td>
          <td>${f["Asset Type"] || "—"}</td>
          <td>${formatCurrency(f["Asking Price"])}</td>
          <td>${formatCurrency(f["Price per SF"])}</td>
          <td>${formatPercent(f["Cap Rate"])}</td>
          <td>${formatPercent(f.Occupancy)}</td>
          <td>${f.Status || "—"}</td>
          <td>${score == null ? "—" : score}</td>
          <td>${
            f["Source URL"]
              ? `<a href="${f["Source URL"]}" target="_blank" rel="noopener noreferrer">Listing</a>`
              : "—"
          }</td>
        </tr>
      `;
    })
    .join("");
}

async function fetchAllRecords() {
  if (!verifyConfig()) return;

  tbody.innerHTML = '<tr><td class="empty-row" colspan="11">Loading…</td></tr>';

  try {
    let url = `${baseUrl()}?pageSize=100`;
    const all = [];

    while (url) {
      const data = await airtableRequest(url, { method: "GET" });
      all.push(...(data.records || []));
      url = data.offset
        ? `${baseUrl()}?pageSize=100&offset=${encodeURIComponent(data.offset)}`
        : "";
    }

    records = all;
    renderRows(records);
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td class="empty-row" colspan="11">Failed to load: ${error.message}</td></tr>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!verifyConfig()) return;

  try {
    const payloadFields = serializeForm(form);
    await airtableRequest(baseUrl(), {
      method: "POST",
      body: JSON.stringify({ records: [{ fields: payloadFields }] })
    });

    form.reset();
    formMessage.textContent = "Property saved successfully.";
    formMessage.style.color = "#027a48";
    await fetchAllRecords();
  } catch (error) {
    console.error(error);
    formMessage.textContent = `Save failed: ${error.message}`;
    formMessage.style.color = "#b42318";
  }
});

Object.values(filterInputs).forEach((el) => {
  el.addEventListener("input", () => renderRows(records));
  el.addEventListener("change", () => renderRows(records));
});

refreshBtn.addEventListener("click", fetchAllRecords);

fetchAllRecords();
