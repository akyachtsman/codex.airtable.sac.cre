const CONFIG_STORAGE_KEY = "sac_cre_airtable_settings";

function readStoredConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function getAirtableConfig() {
  const stored = readStoredConfig();
  const fallback = window.APP_CONFIG || {};

  return {
    AIRTABLE_TOKEN:
      stored.AIRTABLE_TOKEN || fallback.AIRTABLE_TOKEN || "",
    AIRTABLE_BASE_ID:
      stored.AIRTABLE_BASE_ID || fallback.AIRTABLE_BASE_ID || "",
    AIRTABLE_TABLE_NAME:
      stored.AIRTABLE_TABLE_NAME || fallback.AIRTABLE_TABLE_NAME || "Properties"
  };
}

function saveAirtableConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function clearAirtableConfig() {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

let airtableConfig = getAirtableConfig();

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

const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const settingsForm = document.getElementById("settings-form");
const settingsToken = document.getElementById("settings-token");
const settingsBaseId = document.getElementById("settings-base-id");
const settingsTableName = document.getElementById("settings-table-name");
const settingsMessage = document.getElementById("settings-message");
const testConnectionBtn = document.getElementById("test-connection-btn");
const clearSettingsBtn = document.getElementById("clear-settings-btn");

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

function setStatus(element, message, color) {
  element.textContent = message;
  element.style.color = color;
}

function verifyConfig() {
  airtableConfig = getAirtableConfig();

  if (
    !airtableConfig.AIRTABLE_TOKEN ||
    !airtableConfig.AIRTABLE_BASE_ID ||
    !airtableConfig.AIRTABLE_TABLE_NAME
  ) {
    setStatus(
      formMessage,
      "Missing Airtable config. Click Settings and enter your Airtable token, base ID, and table name.",
      "#b42318"
    );
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
  airtableConfig = getAirtableConfig();

  return `https://api.airtable.com/v0/${airtableConfig.AIRTABLE_BASE_ID}/${encodeURIComponent(
    airtableConfig.AIRTABLE_TABLE_NAME
  )}`;
}

async function airtableRequest(url, options = {}) {
  airtableConfig = getAirtableConfig();

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${airtableConfig.AIRTABLE_TOKEN}`,
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

function fillSettingsForm() {
  airtableConfig = getAirtableConfig();
  settingsToken.value = airtableConfig.AIRTABLE_TOKEN || "";
  settingsBaseId.value = airtableConfig.AIRTABLE_BASE_ID || "";
  settingsTableName.value = airtableConfig.AIRTABLE_TABLE_NAME || "Properties";
  settingsMessage.textContent = "";
}

function openSettings() {
  fillSettingsForm();
  settingsOverlay.hidden = false;
  settingsBtn.setAttribute("aria-expanded", "true");
  settingsToken.focus();
}

function closeSettings() {
  settingsOverlay.hidden = true;
  settingsBtn.setAttribute("aria-expanded", "false");
  settingsBtn.focus();
}

async function testConnection() {
  const config = {
    AIRTABLE_TOKEN: settingsToken.value.trim(),
    AIRTABLE_BASE_ID: settingsBaseId.value.trim(),
    AIRTABLE_TABLE_NAME: settingsTableName.value.trim() || "Properties"
  };

  if (!config.AIRTABLE_TOKEN || !config.AIRTABLE_BASE_ID || !config.AIRTABLE_TABLE_NAME) {
    setStatus(settingsMessage, "Enter token, base ID, and table name first.", "#b42318");
    return;
  }

  saveAirtableConfig(config);
  airtableConfig = getAirtableConfig();
  setStatus(settingsMessage, "Testing connection…", "#6b7280");

  try {
    await airtableRequest(`${baseUrl()}?pageSize=1`, { method: "GET" });
    setStatus(settingsMessage, "Connection successful.", "#027a48");
  } catch (error) {
    console.error(error);
    setStatus(settingsMessage, `Connection failed: ${error.message}`, "#b42318");
  }
}

settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);

settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay) closeSettings();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !settingsOverlay.hidden) closeSettings();
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const config = {
    AIRTABLE_TOKEN: settingsToken.value.trim(),
    AIRTABLE_BASE_ID: settingsBaseId.value.trim(),
    AIRTABLE_TABLE_NAME: settingsTableName.value.trim() || "Properties"
  };

  saveAirtableConfig(config);
  airtableConfig = getAirtableConfig();
  setStatus(settingsMessage, "Settings saved in this browser.", "#027a48");
  setStatus(formMessage, "Airtable settings saved. Click Refresh to load records.", "#027a48");
});

testConnectionBtn.addEventListener("click", testConnection);

clearSettingsBtn.addEventListener("click", () => {
  clearAirtableConfig();
  airtableConfig = getAirtableConfig();
  fillSettingsForm();
  setStatus(settingsMessage, "Saved browser settings cleared.", "#6b7280");
});

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
    setStatus(formMessage, "Property saved successfully.", "#027a48");
    await fetchAllRecords();
  } catch (error) {
    console.error(error);
    setStatus(formMessage, `Save failed: ${error.message}`, "#b42318");
  }
});

Object.values(filterInputs).forEach((el) => {
  el.addEventListener("input", () => renderRows(records));
  el.addEventListener("change", () => renderRows(records));
});

refreshBtn.addEventListener("click", fetchAllRecords);

fetchAllRecords();
