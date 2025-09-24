// State
const STORAGE_KEY = "productRequests.v1";
let requests = [];

// Elements
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initForm();
  initList();
  loadFromStorage();
  // Backfill Jalali fields for older entries
  requests = requests.map((e) => {
    const r = { ...e };
    if (r.requestDate && !r.requestDateJalali) {
      r.requestDateJalali = isoToJalaliString(r.requestDate);
    }
    if (r.deliveryTime && !r.deliveryTimeJalali) {
      r.deliveryTimeJalali = isoToJalaliString(r.deliveryTime);
    }
    return r;
  });
  renderTable();
});

function initTabs() {
  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.getAttribute("data-target");
      $$(".view").forEach((v) => v.classList.remove("active"));
      document.querySelector(target).classList.add("active");
    });
  });
}

function initForm() {
  const form = $("#request-form");
  const statusSelect = $("#requestStatus");
  const receiptWrap = $("#receiptWrap");
  const receiptFile = $("#receiptFile");
  const receiptPreview = $("#receiptPreview");
  const requestDateHidden = $("#requestDate");
  const deliveryTimeHidden = $("#deliveryTime");
  const requestDateJalali = $("#requestDateJalali");
  const deliveryTimeJalali = $("#deliveryTimeJalali");

  statusSelect.addEventListener("change", () => {
    const done = statusSelect.value === "done";
    receiptWrap.classList.toggle("hidden", !done);
  });

  receiptFile.addEventListener("change", async () => {
    receiptPreview.innerHTML = "";
    const file = receiptFile.files && receiptFile.files[0];
    if (!file) {
      receiptPreview.classList.add("hidden");
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      const img = document.createElement("img");
      img.src = dataUrl;
      img.style.maxWidth = "260px";
      img.style.borderRadius = "8px";
      receiptPreview.appendChild(img);
    } else {
      const link = document.createElement("a");
      link.href = dataUrl;
      link.textContent = `Receipt: ${file.name}`;
      link.target = "_blank";
      receiptPreview.appendChild(link);
    }
    receiptPreview.classList.remove("hidden");
  });

  // Initialize Jalali datepicker widgets (from CDN lib)
  document.addEventListener("DOMContentLoaded", () => {
    if (window.jalaliDatepicker && window.jalaliDatepicker.startWatch) {
      window.jalaliDatepicker.startWatch({ time: false });
    }
  });

  const syncJalaliToIso = () => {
    // Inputs provide Jalali YYYY-MM-DD, convert to ISO via Jalali->JDN->Gregorian
    requestDateHidden.value = jalaliToIsoString(requestDateJalali.value);
    deliveryTimeHidden.value = jalaliToIsoString(deliveryTimeJalali.value);
  };
  requestDateJalali.addEventListener("input", syncJalaliToIso);
  deliveryTimeJalali.addEventListener("input", syncJalaliToIso);
  syncJalaliToIso();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = await getFormData();
    entry.id = cryptoRandomId();
    requests.unshift(entry);
    saveToStorage();
    renderTable();
    form.reset();
    $("#receiptPreview").classList.add("hidden");
    $("#receiptPreview").innerHTML = "";
    $("#requestStatus").dispatchEvent(new Event("change"));
    $("#tab-list").click();
  });
}

function initList() {
  $("#export-list-jpg").addEventListener("click", () => exportListAsJpg());
  $("#clear-all").addEventListener("click", () => {
    if (confirm("Clear all saved requests?")) {
      requests = [];
      saveToStorage();
      renderTable();
    }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getFormData() {
  const status = $("#requestStatus").value;
  const receiptFile = $("#receiptFile").files && $("#receiptFile").files[0];
  const receiptDataUrl = receiptFile ? await readFileAsDataUrl(receiptFile) : null;
  return {
    customerName: $("#customerName").value.trim(),
    customerPhone: $("#customerPhone").value.trim(),
    customerEmail: $("#customerEmail").value.trim(),
    customerAddress: $("#customerAddress").value.trim(),
    postalCode: $("#postalCode").value.trim(),
    customerRequest: $("#customerRequest").value.trim(),
    employee: $("#employee").value.trim(),
    requestDate: $("#requestDate").value,
    requestDateJalali: isoToJalaliString($("#requestDate").value),
    price: parseFloat($("#price").value || "0").toFixed(2),
    deliveryTime: $("#deliveryTime").value,
    deliveryTimeJalali: isoToJalaliString($("#deliveryTime").value),
    requestStatus: status,
    receipt: status === "done" ? receiptDataUrl : null,
  };
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    requests = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load storage", e);
    requests = [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch (e) {
    alert("Could not save data. Storage may be full or blocked.");
  }
}

function renderTable() {
  const tbody = $("#requests-tbody");
  tbody.innerHTML = "";
  if (!requests.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "No requests yet.";
    td.style.color = "#a8b0d9";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const entry of requests) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(entry.customerName)}</td>
      <td>${escapeHtml(entry.customerPhone)}</td>
      <td>${escapeHtml(entry.requestStatus)}</td>
      <td>$${escapeHtml(entry.price)}</td>
      <td>${escapeHtml(entry.requestDateJalali || isoToJalaliString(entry.requestDate))}</td>
      <td>
        <button class="secondary" data-action="export" data-id="${entry.id}">Export JPG</button>
        <button class="ghost" data-action="view" data-id="${entry.id}">View</button>
        <button class="danger" data-action="delete" data-id="${entry.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Row actions
  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      const entry = requests.find((r) => r.id === id);
      if (!entry) return;
      if (action === "delete") {
        if (confirm("Delete this entry?")) {
          requests = requests.filter((r) => r.id !== id);
          saveToStorage();
          renderTable();
        }
      } else if (action === "export") {
        exportEntryAsJpg(entry);
      } else if (action === "view") {
        openViewDialog(entry);
      }
    });
  });
}

function openViewDialog(entry) {
  const temp = document.createElement("div");
  temp.style.position = "fixed";
  temp.style.inset = "0";
  temp.style.background = "rgba(0,0,0,0.6)";
  temp.style.display = "flex";
  temp.style.alignItems = "center";
  temp.style.justifyContent = "center";
  temp.style.zIndex = "50";
  temp.addEventListener("click", () => document.body.removeChild(temp));

  const card = renderEntryCard(entry);
  card.style.maxHeight = "80vh";
  card.style.overflow = "auto";
  temp.appendChild(card);
  document.body.appendChild(temp);
}

function renderEntryCard(entry) {
  const tpl = document.getElementById("card-template");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.querySelectorAll("[data-key]").forEach((el) => {
    const key = el.getAttribute("data-key");
    if (key === "requestDate") {
      el.textContent = entry.requestDateJalali || isoToJalaliString(entry.requestDate) || "";
    } else if (key === "deliveryTime") {
      el.textContent = entry.deliveryTimeJalali || isoToJalaliString(entry.deliveryTime) || "";
    } else {
      el.textContent = entry[key] || "";
    }
  });
  return node;
}

async function exportEntryAsJpg(entry) {
  const card = renderEntryCard(entry);
  // Attach temporarily to measure and render
  card.style.position = "fixed";
  card.style.left = "-9999px";
  document.body.appendChild(card);
  await nextFrame();
  const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#ffffff" });
  document.body.removeChild(card);
  downloadCanvasAsJpg(canvas, `request_${sanitizeFileName(entry.customerName)}_${entry.id}.jpg`);
}

async function exportListAsJpg() {
  const container = document.createElement("div");
  container.style.background = "white";
  container.style.padding = "16px";
  container.style.color = "#0b1020";
  container.style.fontFamily = "Peyda, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial";
  const title = document.createElement("h2");
  title.textContent = "Product Requests List";
  container.appendChild(title);
  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gridTemplateColumns = "repeat(1, minmax(0, 1fr))";
  list.style.gap = "8px";
  for (const entry of requests) {
    const row = document.createElement("div");
    row.style.border = "1px solid #e5e7eb";
    row.style.borderRadius = "8px";
    row.style.padding = "8px";
    const jDate = entry.requestDateJalali || isoToJalaliString(entry.requestDate);
    row.textContent = `${jDate} • ${entry.customerName} • ${entry.customerPhone} • $${entry.price} • ${entry.requestStatus}`;
    list.appendChild(row);
  }
  container.appendChild(list);
  document.body.appendChild(container);
  container.style.position = "fixed";
  container.style.left = "-9999px";
  await nextFrame();
  const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
  document.body.removeChild(container);
  downloadCanvasAsJpg(canvas, `requests_list_${new Date().toISOString().slice(0,10)}.jpg`);
}

function downloadCanvasAsJpg(canvas, filename) {
  canvas.toBlob((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, "image/jpeg", 0.92);
}

function nextFrame() { return new Promise((r) => requestAnimationFrame(() => r())); }
function cryptoRandomId() { return Math.random().toString(36).slice(2, 8); }
function sanitizeFileName(name) { return name.replace(/[^a-z0-9\-_.]+/gi, "_"); }
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"]+/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}

// --- Jalali (Solar Hijri) date utilities ---
// Minimal conversion adapted from algorithmic approach (no external deps)
// Source reference: Calendrical Calculations (K&W) inspired routines
function toInt(num) { return Math.trunc(num); }

function gregorianToJdn(gy, gm, gd) {
  const a = toInt((14 - gm) / 12);
  const y = gy + 4800 - a;
  const m = gm + 12 * a - 3;
  return gd + toInt((153 * m + 2) / 5) + 365 * y + toInt(y / 4) - toInt(y / 100) + toInt(y / 400) - 32045;
}

function jdnToJalali(jdn) {
  const depoch = jdn - gregorianToJdn(622, 3, 19) + 1;
  const cycle = toInt(depoch / 1029983);
  const cyear = depoch % 1029983;
  let ycycle;
  if (cyear === 1029982) {
    ycycle = 2820;
  } else {
    const aux1 = toInt(cyear / 366);
    const aux2 = cyear % 366;
    ycycle = toInt((2134 * aux1 + 2816 * aux2 + 2815) / 1028522) + aux1 + 1;
  }
  let jy = ycycle + 2820 * cycle + 474;
  if (jy <= 0) jy -= 1;
  const jyFirstDay = jalaliToJdn(jy, 1, 1);
  const yday = jdn - jyFirstDay + 1;
  const jm = yday <= 186 ? toInt((yday - 1) / 31) + 1 : toInt((yday - 187) / 30) + 7;
  const jd = jdn - jalaliToJdn(jy, jm, 1) + 1;
  return [jy, jm, jd];
}

function jalaliToJdn(jy, jm, jd) {
  jy = jy > 0 ? jy : jy + 1;
  const epbase = jy - 474;
  const epyear = 474 + (epbase % 2820);
  return jd + (jm <= 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186) +
    toInt((epyear * 682 - 110) / 2816) + (epyear - 1) * 365 +
    toInt(epbase / 2820) * 1029983 + (gregorianToJdn(622, 3, 19) - 1);
}

function isoToJalaliString(iso) {
  if (!iso) return "";
  const [gy, gm, gd] = iso.split("-").map((x) => parseInt(x, 10));
  if (!gy || !gm || !gd) return iso;
  const jdn = gregorianToJdn(gy, gm, gd);
  const [jy, jm, jd] = jdnToJalali(jdn);
  const mm = String(jm).padStart(2, "0");
  const dd = String(jd).padStart(2, "0");
  return `${jy}-${mm}-${dd}`;
}

function jalaliToIsoString(jalali) {
  if (!jalali) return "";
  const [jy, jm, jd] = jalali.split("-").map((x) => parseInt(x, 10));
  if (!jy || !jm || !jd) return "";
  const jdn = jalaliToJdn(jy, jm, jd);
  // Convert JDN to Gregorian
  const g = jdnToGregorian(jdn);
  const y = String(g[0]).padStart(4, "0");
  const m = String(g[1]).padStart(2, "0");
  const d = String(g[2]).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function jdnToGregorian(jdn) {
  let a = jdn + 32044;
  const b = Math.trunc((4 * a + 3) / 146097);
  a = a - Math.trunc((146097 * b) / 4);
  const c = Math.trunc((4 * a + 3) / 1461);
  a = a - Math.trunc((1461 * c) / 4);
  const d = Math.trunc((5 * a + 2) / 153);
  const day = a - Math.trunc((153 * d + 2) / 5) + 1;
  const month = d + 3 - 12 * Math.trunc(d / 10);
  const year = 100 * b + c - 4800 + Math.trunc(d / 10);
  return [year, month, day];
}


