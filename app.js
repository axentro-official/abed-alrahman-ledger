/* سوبر ماركت أولاد يحيى — دفتر الحسابات
   ✅ PIN ثابت: 1234
   ✅ مدفوعات منفصلة payments[] مرتبطة بكل عملية entryId
   ✅ Refresh لا يعمل Logout (sessionStorage)
   ✅ حذف بــ PIN + سجل محذوفات (Trash)
   ✅ كشف حساب + معاينات + طباعة/PDF
   ✅ تقارير Reports + اتجاه المدفوعات (out/in)

   ✅ FIX (نهائي):
   - حل CORS على اللاب: apiCall = GET فقط (بدون preflight)
   - تسريع: البحث/الفلاتر لا تعيد تحميل الشيت — فقط Render من الكاش
*/

const LS_KEY   = "oy_ledger_v3";
const PIN_CODE = "1234";
const AUTH_KEY = "oy_auth_v1";

const TRASH_KEY = "oy_trash_v1";
const MAX_TRASH = 1000;

const SHOP_NAME  = "سوبر ماركت أولاد يحيى";
const ADMIN_NAME = "إدارة هيثم";

const el = (id) => document.getElementById(id);

const fmt = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
function todayISO(){ return new Date().toISOString().slice(0,10); }

function typeLabel(t){
  return ({
    expense: "مصروف",
    advance: "سُلفة",
    credit_customer: "آجل (عميل)",
    credit_supplier: "فاتورة/مورد"
  })[t] || "—";
}

/* ✅ تصنيف مالي */
function moneySide(entryType){
  if(entryType === "expense") return "expense";
  if(entryType === "credit_supplier") return "payable";
  if(entryType === "credit_customer") return "receivable";
  if(entryType === "advance") return "receivable";
  return "other";
}
function sideLabel(side){
  return ({
    receivable: "فلوس ليا",
    payable: "فلوس عليا",
    expense: "مصروف"
  })[side] || "—";
}

function escapeHtml(str){
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ✅ Labels */
function flowLabel(flow){
  return flow === "in" ? "متحصلات داخلة" : "مدفوعات خارجة";
}

/* ✅ مجموع المدفوعات لعملية */
function sumPaymentsForEntry(entryId, payments, flow = "all"){
  return payments
    .filter(p => p.entryId === entryId)
    .filter(p => flow === "all" ? true : (p.flow === flow))
    .reduce((a,p)=> a + Number(p.amount || 0), 0);
}

/* -------------------- ✅ UI Error Banner (بديل alert) -------------------- */
function ensureGlobalBanner(){
  if(document.getElementById("globalBanner")) return;

  const box = document.createElement("div");
  box.id = "globalBanner";
  box.hidden = true;
  box.style.position = "fixed";
  box.style.left = "14px";
  box.style.right = "14px";
  box.style.bottom = "14px";
  box.style.zIndex = "9999";
  box.style.maxWidth = "900px";
  box.style.margin = "0 auto";

  box.innerHTML = `
    <div class="error" style="display:flex; gap:10px; align-items:flex-start; justify-content:space-between;">
      <div style="flex:1">
        <div id="globalBannerText" style="font-weight:900; margin-bottom:6px;">—</div>
        <div style="opacity:.9; font-size:12px">لو المشكلة مستمرة: راجع نشر الـ Web App أو جرّب بعد دقيقة.</div>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button id="globalBannerRetry" class="btn small" type="button">إعادة المحاولة</button>
        <button id="globalBannerClose" class="btn small ghost" type="button">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);

  const btnClose = document.getElementById("globalBannerClose");
  const btnRetry = document.getElementById("globalBannerRetry");
  btnClose?.addEventListener("click", ()=> hideGlobalError());
  btnRetry?.addEventListener("click", async ()=>{
    hideGlobalError();
    if(isAuthed()){
      try{ await STORE.init(); }catch(_e){}
      await refresh(true);
    }
  });
}

function showGlobalError(msg){
  ensureGlobalBanner();
  const banner = document.getElementById("globalBanner");
  const t = document.getElementById("globalBannerText");
  if(t) t.textContent = msg || "حدث خطأ غير متوقع.";
  if(banner) banner.hidden = false;
}
function hideGlobalError(){
  const banner = document.getElementById("globalBanner");
  if(banner) banner.hidden = true;
}

/* -------------------- Pages -------------------- */
const PAGES = [
  "dashboard","records","payments","ledger",
  "reports",
  "entryPreview","ledgerPreview",
  "trash"
];

function showPage(name){
  PAGES.forEach(p=>{
    const node = document.getElementById("page-"+p);
    if(node) node.hidden = (p !== name);
  });

  document.querySelectorAll(".navBtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.page === name);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if(name === "trash") renderTrash();
  if(name === "reports") renderReports();
}

/* -------------------- Auth -------------------- */
function setAuthed(v){
  if(v){
    sessionStorage.setItem(AUTH_KEY, "1");
    document.documentElement.classList.add("authed");
  }else{
    sessionStorage.removeItem(AUTH_KEY);
    document.documentElement.classList.remove("authed");
  }
}
function isAuthed(){
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

function openApp(){
  const gate = el("pinGate");
  const root = el("appRoot");
  const nav  = el("navBar");

  if(gate){
    gate.hidden = true;
    gate.style.display = "none";
  }
  if(root) root.hidden = false;
  if(nav) nav.hidden = false;

  showPage("dashboard");
}

function closeApp(){
  const gate = el("pinGate");
  const root = el("appRoot");
  const nav  = el("navBar");

  if(root) root.hidden = true;
  if(nav) nav.hidden = true;

  if(gate){
    gate.hidden = false;
    gate.style.display = "block";
  }

  if(el("pinInput")){
    el("pinInput").type = "password";
    el("pinInput").value = "";
  }
  if(el("pinError")) el("pinError").hidden = true;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* -------------------- PIN Gate -------------------- */
function setupPinGate(){
  const pinForm  = el("pinForm");
  const pinInput = el("pinInput");
  const pinError = el("pinError");
  const toggle   = el("pinToggle");

  if(toggle && pinInput){
    toggle.addEventListener("click", ()=>{
      pinInput.type = (pinInput.type === "password") ? "text" : "password";
    });
  }

  if(pinForm && pinInput){
    pinForm.addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      hideGlobalError();

      const v = (pinInput.value || "").trim();

      if(v === PIN_CODE){
        setAuthed(true);
        if(pinError) pinError.hidden = true;
        pinInput.value = "";
        pinInput.type = "password";

        openApp();

        try{
          await STORE.init();
        }catch(e){
          console.error(e);
          showGlobalError("تعذر تهيئة التخزين على الشيت. سيتم استخدام التخزين المحلي مؤقتًا.");
        }

        await refresh(true);

      } else {
        if(pinError) pinError.hidden = false;
        pinInput.focus();
        pinInput.select();
      }
    });
  }
}

/* -------------------- Helpers: PIN confirm -------------------- */
function requirePin(actionText = "تنفيذ العملية"){
  const v = prompt(`تأكيد ${actionText}\nاكتب PIN:`);
  if(v === null) return false;
  if((v || "").trim() !== PIN_CODE){
    alert("PIN غير صحيح.");
    return false;
  }
  return true;
}

/* -------------------- Forms -------------------- */
function resetForm(){
  el("date") && (el("date").value = "");
  el("type") && (el("type").value = "");
  el("party") && (el("party").value = "");
  el("desc") && (el("desc").value = "");
  el("category") && (el("category").value = "");
  el("total") && (el("total").value = "");
  el("firstPay") && (el("firstPay").value = "");
  el("notes") && (el("notes").value = "");
}

function getEntryFromForm(){
  const entry = {
    id: uid(),
    date: (el("date")?.value || "").trim(),
    type: (el("type")?.value || "").trim(),
    party: (el("party")?.value || "").trim(),
    desc: (el("desc")?.value || "").trim(),
    category: (el("category")?.value || "").trim(),
    total: (el("total")?.value === "" || el("total") == null) ? null : Number(el("total")?.value),
    notes: (el("notes")?.value || "").trim(),
    createdAt: Date.now()
  };

  const fpRaw = el("firstPay")?.value;
  let firstPay = null;

  if(fpRaw != null && fpRaw !== ""){
    const fpNum = Number(fpRaw);
    if(Number.isFinite(fpNum) && fpNum > 0) firstPay = fpNum;
    else {
      firstPay = null;
      if(el("firstPay")) el("firstPay").value = "";
    }
  }

  if(entry.type === "expense"){
    firstPay = null;
    if(el("firstPay")) el("firstPay").value = "";
  }

  return { entry, firstPay };
}

function validateEntry(entry){
  if(!entry.date) return "من فضلك اختر التاريخ.";
  if(!entry.type) return "من فضلك اختر النوع.";
  if(!entry.party) return "من فضلك اكتب الاسم/الجهة.";
  if(entry.total === null || !Number.isFinite(entry.total) || entry.total <= 0) return "من فضلك اكتب الإجمالي (رقم أكبر من صفر).";
  if(entry.type === "expense" && !entry.category) return "من فضلك اختر تصنيف للمصاريف.";
  return null;
}

/* -------------------- ✅ الحساب الصحيح للمدفوع/الباقي -------------------- */
function computeEntryView(entry, payments){
  const total = Number(entry.total);
  const side = moneySide(entry.type);

  if(entry.type === "expense"){
    return { ...entry, side, paid: 0, remaining: 0 };
  }

  const affectingFlow = (side === "receivable") ? "in" : "out";
  const paid = sumPaymentsForEntry(entry.id, payments, affectingFlow);

  const remaining = (Number.isFinite(total) ? Math.max(total - paid, 0) : NaN);
  return { ...entry, side, paid, remaining };
}

/* -------------------- ✅ Store Layer (Sheets + fallback) -------------------- */
const API_CFG = (window.AXENTRO_API && typeof window.AXENTRO_API === "object")
  ? window.AXENTRO_API
  : null;

const API_ACTIONS = {
  init: "init",
  getAll: "getAll",
  addEntry: "addEntry",
  addPayment: "addPayment",
  deleteEntry: "deleteEntry",
  deletePayment: "deletePayment",
  getTrash: "getTrash",
  deleteTrashLog: "deleteTrashLog"
};

/* ✅✅✅ FIX CORS: GET ONLY (بدون preflight) */
async function apiCall(action, payload = {}){
  if(!API_CFG?.scriptUrl) throw new Error("NO_SCRIPT_URL");

  const url = API_CFG.scriptUrl;
  const pin = String(API_CFG.pin || PIN_CODE);

  const qs = new URLSearchParams();
  qs.set("action", action);
  qs.set("pin", pin);
  qs.set("payload", JSON.stringify(payload));
  qs.set("_ts", String(Date.now())); // cache-buster

  const full = `${url}?${qs.toString()}`;

  const r = await fetch(full, { method:"GET", mode:"cors" });
  const j = await r.json();
  if(!j || j.ok === false) throw new Error(j?.error || "API_ERROR");
  return j;
}

class LocalStore {
  async init(){ return true; }
  async getAll(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      const data = raw ? JSON.parse(raw) : { entries: [], payments: [] };
      if (!Array.isArray(data.entries)) data.entries = [];
      if (!Array.isArray(data.payments)) data.payments = [];

      data.payments = data.payments.map(p => ({
        ...p,
        flow: (p.flow === "in" || p.flow === "out") ? p.flow : "out"
      }));

      const rawT = localStorage.getItem(TRASH_KEY);
      const t = rawT ? JSON.parse(rawT) : { logs: [] };
      if (!Array.isArray(t.logs)) t.logs = [];

      return { entries: data.entries, payments: data.payments, trash: t.logs };
    }catch{
      return { entries: [], payments: [], trash: [] };
    }
  }
  async setAll(entries, payments, trashLogs){
    localStorage.setItem(LS_KEY, JSON.stringify({ entries, payments }));
    localStorage.setItem(TRASH_KEY, JSON.stringify({ logs: (trashLogs || []).slice(0, MAX_TRASH) }));
  }
  async addEntry(entry){
    const all = await this.getAll();
    all.entries.push(entry);
    await this.setAll(all.entries, all.payments, all.trash);
  }
  async addPayment(payment){
    const all = await this.getAll();
    all.payments.push(payment);
    await this.setAll(all.entries, all.payments, all.trash);
  }
  async deleteEntry(entryId, snapshot){
    const all = await this.getAll();
    all.entries = all.entries.filter(e => e.id !== entryId);
    all.payments = all.payments.filter(p => p.entryId !== entryId);

    const logs = (all.trash || []);
    logs.unshift({ id: uid(), at: Date.now(), type:"delete_entry", ...snapshot });

    await this.setAll(all.entries, all.payments, logs);
  }
  async deletePayment(payId, snapshot){
    const all = await this.getAll();
    all.payments = all.payments.filter(p => p.id !== payId);

    const logs = (all.trash || []);
    logs.unshift({ id: uid(), at: Date.now(), type:"delete_payment", ...snapshot });

    await this.setAll(all.entries, all.payments, logs);
  }
  async getTrash(){
    const all = await this.getAll();
    return all.trash || [];
  }
  async deleteTrashLog(logId){
    const rawT = localStorage.getItem(TRASH_KEY);
    const t = rawT ? JSON.parse(rawT) : { logs: [] };
    t.logs = (t.logs || []).filter(x => x.id !== logId);
    localStorage.setItem(TRASH_KEY, JSON.stringify(t));
  }
}

class SheetsStore {
  async init(){
    await apiCall(API_ACTIONS.init, {});
    return true;
  }
  async getAll(){
    const j = await apiCall(API_ACTIONS.getAll, {});
    return {
      entries: Array.isArray(j.entries) ? j.entries : [],
      payments: Array.isArray(j.payments) ? j.payments : [],
      trash: Array.isArray(j.trash) ? j.trash : []
    };
  }
  async addEntry(entry){ await apiCall(API_ACTIONS.addEntry, { entry }); }
  async addPayment(payment){ await apiCall(API_ACTIONS.addPayment, { payment }); }
  async deleteEntry(entryId, snapshot){ await apiCall(API_ACTIONS.deleteEntry, { entryId, snapshot }); }
  async deletePayment(payId, snapshot){ await apiCall(API_ACTIONS.deletePayment, { payId, snapshot }); }
  async getTrash(){
    const j = await apiCall(API_ACTIONS.getTrash, {});
    return Array.isArray(j.trash) ? j.trash : [];
  }
  async deleteTrashLog(logId){ await apiCall(API_ACTIONS.deleteTrashLog, { logId }); }
}

class HybridStore {
  constructor(){
    this.local = new LocalStore();
    this.sheets = new SheetsStore();
    this.mode = (API_CFG?.scriptUrl) ? "sheets" : "local";
  }

  async init(){
    await this.local.init();
    if(this.mode === "local") return true;

    try{
      await this.sheets.init();
      this.mode = "sheets";
      return true;
    }catch(e){
      console.error(e);
      this.mode = "local";
      throw e;
    }
  }

  async getAll(){
    if(this.mode === "local"){
      return await this.local.getAll();
    }

    try{
      const all = await this.sheets.getAll();

      const payments = (all.payments || []).map(p => ({
        ...p,
        flow: (p.flow === "in" || p.flow === "out") ? p.flow : "out"
      }));
      await this.local.setAll(all.entries || [], payments, all.trash || []);
      return { entries: all.entries || [], payments, trash: all.trash || [] };

    }catch(e){
      console.error(e);
      this.mode = "local";
      return await this.local.getAll();
    }
  }

  async addEntry(entry){
    if(this.mode === "local"){
      return await this.local.addEntry(entry);
    }
    try{
      await this.sheets.addEntry(entry);
      await this.local.addEntry(entry);
    }catch(e){
      console.error(e);
      this.mode = "local";
      await this.local.addEntry(entry);
      throw e;
    }
  }

  async addPayment(payment){
    if(this.mode === "local"){
      return await this.local.addPayment(payment);
    }
    try{
      await this.sheets.addPayment(payment);
      await this.local.addPayment(payment);
    }catch(e){
      console.error(e);
      this.mode = "local";
      await this.local.addPayment(payment);
      throw e;
    }
  }

  async deleteEntry(entryId, snapshot){
    if(this.mode === "local"){
      return await this.local.deleteEntry(entryId, snapshot);
    }
    try{
      await this.sheets.deleteEntry(entryId, snapshot);
      await this.local.deleteEntry(entryId, snapshot);
    }catch(e){
      console.error(e);
      this.mode = "local";
      await this.local.deleteEntry(entryId, snapshot);
      throw e;
    }
  }

  async deletePayment(payId, snapshot){
    if(this.mode === "local"){
      return await this.local.deletePayment(payId, snapshot);
    }
    try{
      await this.sheets.deletePayment(payId, snapshot);
      await this.local.deletePayment(payId, snapshot);
    }catch(e){
      console.error(e);
      this.mode = "local";
      await this.local.deletePayment(payId, snapshot);
      throw e;
    }
  }

  async getTrash(){
    const all = await this.getAll();
    return all.trash || [];
  }

  async deleteTrashLog(logId){
    if(this.mode === "local"){
      return await this.local.deleteTrashLog(logId);
    }
    try{
      await this.sheets.deleteTrashLog(logId);
      await this.local.deleteTrashLog(logId);
    }catch(e){
      console.error(e);
      this.mode = "local";
      await this.local.deleteTrashLog(logId);
      throw e;
    }
  }
}

const STORE = new HybridStore();

/* -------------------- Global Cache -------------------- */
const STATE = {
  entries: [],
  payments: [],
  trash: []
};

/* -------------------- Render (من الكاش فقط) ✅ سرعة -------------------- */
function renderFromState(){
  const entriesView = STATE.entries.map(e => computeEntryView(e, STATE.payments));
  renderKPIs(entriesView, STATE.payments);
  renderEntriesTable(applyEntryFilters(entriesView));
  renderPaymentsTable(STATE.payments, STATE.entries);

  const trashPage = document.getElementById("page-trash");
  if(trashPage && !trashPage.hidden) renderTrash();

  const reportsPage = document.getElementById("page-reports");
  if(reportsPage && !reportsPage.hidden) renderReports();
}

/* -------------------- Render KPIs -------------------- */
function computeTotals(entriesView, payments){
  const expensesTotal = entriesView
    .filter(e => e.type === "expense")
    .reduce((a,e)=> a + (Number.isFinite(e.total) ? e.total : 0), 0);

  const paidOutTotal = payments
    .filter(p => (p.flow || "out") === "out")
    .reduce((a,p)=> a + Number(p.amount || 0), 0);

  const remainingReceivable = entriesView
    .filter(e => e.side === "receivable")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  const remainingPayable = entriesView
    .filter(e => e.side === "payable")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  return { expensesTotal, paidOutTotal, remainingReceivable, remainingPayable };
}

function renderKPIs(entriesView, payments){
  const t = computeTotals(entriesView, payments);

  el("kpiExpenses") && (el("kpiExpenses").textContent = fmt(t.expensesTotal));
  el("kpiPaid") && (el("kpiPaid").textContent = fmt(t.paidOutTotal));
  el("kpiReceivable") && (el("kpiReceivable").textContent = fmt(t.remainingReceivable));
  el("kpiPayable") && (el("kpiPayable").textContent = fmt(t.remainingPayable));
  el("kpiCount") && (el("kpiCount").textContent = entriesView.length.toLocaleString("ar-EG"));
}

/* -------------------- Filters -------------------- */
function applyEntryFilters(entriesView){
  const q  = (el("q")?.value || "").trim().toLowerCase();
  const ft = el("filterType")?.value || "";
  const fo = el("filterOpen")?.value || "";

  return entriesView.filter(e=>{
    const hitQ = !q || (
      (e.party || "").toLowerCase().includes(q) ||
      (e.desc || "").toLowerCase().includes(q) ||
      (e.notes || "").toLowerCase().includes(q)
    );

    const hitT = !ft || e.type === ft;

    const hitO =
      !fo ||
      (fo === "open" && e.remaining > 0) ||
      (fo === "closed" && e.remaining === 0);

    return hitQ && hitT && hitO;
  });
}

/* -------------------- Entries Table -------------------- */
function renderEntriesTable(entriesView){
  const tbody = el("tbody");
  if(!tbody) return;
  tbody.innerHTML = "";

  const sorted = [...entriesView].sort((a,b)=>
    (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt)
  );

  for(const e of sorted){
    const cat = e.type === "expense" ? (e.category || "—") : "—";

    const payBtn = (e.type === "expense")
      ? `<button class="btn small" type="button" disabled title="المصروف لا يحتاج دفعات">إضافة دفعة</button>`
      : `<button class="btn small" data-act="pay" data-id="${e.id}">إضافة دفعة</button>`;

    const partyCell = `
      <button class="btn small ghost" data-act="person" data-name="${escapeHtml(e.party || "")}" data-side="${e.side}">
        ${escapeHtml(e.party || "")}
      </button>
    `;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date || "—"}</td>
      <td><span class="badge">${typeLabel(e.type)}</span></td>
      <td>${partyCell}</td>
      <td>${escapeHtml(e.desc || "")}</td>
      <td>${escapeHtml(cat)}</td>
      <td class="num">${fmt(e.total)}</td>
      <td class="num">${fmt(e.paid)}</td>
      <td class="num">${fmt(e.remaining)}</td>
      <td>
        <div class="rowActions">
          <button class="btn small" data-act="preview" data-id="${e.id}">معاينة</button>
          ${payBtn}
          <button class="btn small danger" data-act="del" data-id="${e.id}">حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* -------------------- Payments Table -------------------- */
function renderPaymentsTable(payments, entries){
  const tbody = el("payTbody");
  if(!tbody) return;

  const q = (el("payQ")?.value || "").trim().toLowerCase();
  tbody.innerHTML = "";

  const entryById = new Map(entries.map(e => [e.id, e]));

  const filtered = payments.filter(p=>{
    if(!q) return true;
    const en = entryById.get(p.entryId);
    const party = (p.party || en?.party || "").toLowerCase();
    const note = (p.note || "").toLowerCase();
    const flow = flowLabel(p.flow || "out").toLowerCase();
    return party.includes(q) || note.includes(q) || flow.includes(q);
  });

  const sorted = [...filtered].sort((a,b)=>
    (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt)
  );

  for(const p of sorted){
    const en = entryById.get(p.entryId);
    const ref = en ? `${typeLabel(en.type)} • ${en.date} • إجمالي ${fmt(en.total)}` : "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.date || "—"}</td>
      <td>${escapeHtml(p.party || en?.party || "—")}</td>
      <td>${escapeHtml(ref)} • <span class="badge">${flowLabel(p.flow || "out")}</span></td>
      <td class="num">${fmt(p.amount)}</td>
      <td>${escapeHtml(p.note || "—")}</td>
      <td><button class="btn small danger" data-paydel="${p.id}">حذف</button></td>
    `;
    tbody.appendChild(tr);
  }
}

/* -------------------- Payments Modal -------------------- */
let CURRENT_PAY_ENTRY_ID = null;

function ensurePayFlowControl(){
  const modalBody = el("payModal")?.querySelector(".modalBody");
  if(!modalBody) return;

  if(el("payFlow")) return;

  const wrap = document.createElement("div");
  wrap.className = "field";
  wrap.innerHTML = `
    <label>اتجاه الدفعة</label>
    <select id="payFlow">
      <option value="out" selected>مدفوعات خارجة (أنا دفعت)</option>
      <option value="in">متحصلات داخلة (اتدفعتلي)</option>
    </select>
    <div class="help">اختار هل الدفعة خرجت منك ولا دخلت لك.</div>
  `;

  const saveBtn = el("paySave");
  if(saveBtn) modalBody.insertBefore(wrap, saveBtn);
  else modalBody.appendChild(wrap);
}

function openPayModal(entryId){
  const entry = STATE.entries.find(e => e.id === entryId);
  if(entry?.type === "expense"){
    alert("المصروف لا يحتاج إضافة دفعات.");
    return;
  }

  ensurePayFlowControl();

  CURRENT_PAY_ENTRY_ID = entryId;
  el("payDate") && (el("payDate").value = todayISO());
  el("payAmount") && (el("payAmount").value = "");
  el("payNote") && (el("payNote").value = "");
  el("payError") && (el("payError").hidden = true);

  el("payFlow") && (el("payFlow").value = "out");

  el("payModal") && (el("payModal").hidden = false);
}
function closePayModal(){
  el("payModal") && (el("payModal").hidden = true);
  CURRENT_PAY_ENTRY_ID = null;
}

/* -------------------- Print Footer -------------------- */
function cleanupLegacyInjectedFooters(){
  document.querySelectorAll(".__printFooterInjected").forEach(n => n.remove());
}
function preparePrintForCurrentPage(){
  cleanupLegacyInjectedFooters();
}
window.addEventListener("beforeprint", preparePrintForCurrentPage);

/* -------------------- Preview: Entry -------------------- */
function openEntryPreview(entryId){
  const entry = STATE.entries.find(e => e.id === entryId);
  if(!entry) return;

  const v = computeEntryView(entry, STATE.payments);

  el("prevEntryMeta") && (el("prevEntryMeta").textContent =
    `تاريخ الإنشاء: ${new Date(entry.createdAt).toLocaleString("ar-EG")}`
  );

  const statusText =
    (v.type === "expense")
      ? "الحالة: مصروف (ليس مستحق)"
      : (v.remaining === 0 ? "الحالة: مقفول" : `الحالة: عليه باقي ${fmt(v.remaining)} ج.م`);

  el("prevEntryStatus") && (el("prevEntryStatus").textContent = statusText);

  el("prevDate") && (el("prevDate").textContent = v.date || "—");
  el("prevType") && (el("prevType").textContent = typeLabel(v.type));
  el("prevParty") && (el("prevParty").textContent = v.party || "—");
  el("prevDesc") && (el("prevDesc").textContent = v.desc || "—");
  el("prevCat") && (el("prevCat").textContent = (v.type === "expense" ? (v.category || "—") : "—"));
  el("prevNotes") && (el("prevNotes").textContent = v.notes || "—");
  el("prevTotal") && (el("prevTotal").textContent = `${fmt(v.total)} ج.م`);
  el("prevPaidRemain") && (el("prevPaidRemain").textContent = `${fmt(v.paid)} / ${fmt(v.remaining)} ج.م`);

  const tb = el("prevPaysTbody");
  if(tb){
    tb.innerHTML = "";

    if(v.type === "expense"){
      tb.innerHTML = `<tr><td colspan="3">المصروف لا يحتوي على مدفوعات.</td></tr>`;
    } else {
      const pays = STATE.payments
        .filter(p => p.entryId === entryId)
        .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));

      if(pays.length === 0){
        tb.innerHTML = `<tr><td colspan="3">لا توجد مدفوعات لهذه العملية.</td></tr>`;
      }else{
        for(const p of pays){
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${p.date || "—"}</td>
            <td>${escapeHtml(`${p.note || "—"} • ${flowLabel(p.flow || "out")}`)}</td>
            <td class="num">${fmt(p.amount)}</td>
          `;
          tb.appendChild(tr);
        }
      }
    }
  }

  showPage("entryPreview");
}

/* -------------------- Ledger -------------------- */
let ledgerTimer = null;

function getLedgerMode(){
  const m = (el("ledgerMode")?.value || "all").trim();
  return (m === "customer" || m === "supplier" || m === "all") ? m : "all";
}

function entryMatchesLedgerMode(entry, mode){
  if(mode === "all") return true;
  if(mode === "customer") return entry.side === "receivable";
  if(mode === "supplier") return entry.side === "payable";
  return true;
}

function showLedger(name){
  const box = el("ledgerBox");
  if(!box) return;

  box.innerHTML = "";
  const q = (name || "").trim().toLowerCase();
  const mode = getLedgerMode();

  const entriesAll = STATE.entries.map(e => computeEntryView(e, STATE.payments));
  const paysAll = STATE.payments;

  // ✅ NEW: لو الاسم فاضي → اعرض كل العمليات حسب الوضع (الكل/عملاء/موردين)
  const entries = entriesAll
    .filter(e => !q ? true : (e.party || "").trim().toLowerCase().includes(q))
    .filter(e => entryMatchesLedgerMode(e, mode))
    .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));

  const allowedEntryIds = new Set(entries.map(e => e.id));

  const pays = paysAll
    .filter(p => !q ? true : (p.party || "").trim().toLowerCase().includes(q))
    .filter(p => allowedEntryIds.has(p.entryId))
    .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (b.createdAt - a.createdAt));

  if(entries.length === 0 && pays.length === 0){
    box.innerHTML = `<div class="muted">لا توجد بيانات مطابقة.</div>`;
    return;
  }

  const total = entries.reduce((a,e)=> a + (Number.isFinite(e.total) ? e.total : 0), 0);
  const paid  = entries.reduce((a,e)=> a + (Number.isFinite(e.paid) ? e.paid : 0), 0);
  const rem   = entries.reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  const headerMode =
    mode === "customer" ? " (عملاء فقط)" :
    mode === "supplier" ? " (موردين فقط)" :
    "";

  const paidLabel = (mode === "customer") ? "المدفوع (داخلة)" :
                    (mode === "supplier") ? "المدفوع (خارجة)" :
                    "المدفوع";

  const who = q ? ` (${escapeHtml(name)})` : " (الكل)";
  box.innerHTML += `
    <div class="line"><b>الإجمالي${headerMode}${who}</b><b>${fmt(total)}</b></div>
    <div class="line"><span>${paidLabel}</span><b>${fmt(paid)}</b></div>
    <div class="line"><span>المتبقي</span><b>${fmt(rem)}</b></div>
  `;

  box.innerHTML += `<div class="muted" style="margin:10px 0">تفاصيل العمليات (مطابقة):</div>`;
  for(const e of entries){
    box.innerHTML += `
      <div class="line">
        <div style="max-width:70%">
          <div><b>${escapeHtml(e.party || "—")}</b></div>
          <div class="muted">${e.date || "—"} • ${typeLabel(e.type)} • ${escapeHtml(e.desc || "—")}</div>
          <div class="muted">الجهة المالية: ${sideLabel(e.side)}</div>
          <div class="muted">ملاحظات: ${escapeHtml(e.notes || "—")}</div>
        </div>
        <div style="text-align:left; min-width: 140px">
          <div>إجمالي: <b>${fmt(e.total)}</b></div>
          <div class="muted">مدفوع: ${fmt(e.paid)}</div>
          <div class="muted">باقي: ${fmt(e.remaining)}</div>
        </div>
      </div>
    `;
  }

  if(pays.length){
    box.innerHTML += `<div class="muted" style="margin:10px 0">تفاصيل المدفوعات (مطابقة):</div>`;
    for(const p of pays){
      box.innerHTML += `
        <div class="line">
          <div style="max-width:70%">
            <div><b>${escapeHtml(p.party || "—")}</b></div>
            <div class="muted">${p.date || "—"} • ${escapeHtml(p.note || "—")} • ${flowLabel(p.flow || "out")}</div>
          </div>
          <div style="text-align:left; min-width: 140px">
            <div>دفعة: <b>${fmt(p.amount)}</b></div>
          </div>
        </div>
      `;
    }
  }
}

function openPersonDetails(name, side = "all"){
  const clean = (name || "").trim();
  if(!clean) return;

  showPage("ledger");
  if(el("ledgerName")){
    el("ledgerName").value = clean;

    if(el("ledgerMode")){
      if(side === "payable") el("ledgerMode").value = "supplier";
      else if(side === "receivable") el("ledgerMode").value = "customer";
      else el("ledgerMode").value = "all";
    }

    showLedger(clean);
  }
}

/* -------------------- Ledger Preview -------------------- */
function openLedgerPreview(){
  const q = (el("ledgerName")?.value || "").trim();
  const mode = getLedgerMode();

  const entriesAll = STATE.entries.map(e => computeEntryView(e, STATE.payments));
  const paysAll = STATE.payments;

  const entries = entriesAll
    .filter(e => !q ? true : (e.party || "").trim().toLowerCase().includes(q.toLowerCase()))
    .filter(e => entryMatchesLedgerMode(e, mode))
    .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));

  const allowedEntryIds = new Set(entries.map(e => e.id));
  const pays = paysAll
    .filter(p => !q ? true : (p.party || "").trim().toLowerCase().includes(q.toLowerCase()))
    .filter(p => allowedEntryIds.has(p.entryId))
    .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (b.createdAt - a.createdAt));

  const total = entries.reduce((a,e)=> a + (Number.isFinite(e.total) ? e.total : 0), 0);
  const paid  = entries.reduce((a,e)=> a + (Number.isFinite(e.paid) ? e.paid : 0), 0);
  const rem   = entries.reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  const headerMode =
    mode === "customer" ? "عملاء فقط" :
    mode === "supplier" ? "موردين فقط" :
    "الكل";

  el("prevLedgerMeta") && (el("prevLedgerMeta").textContent =
    `الاسم: ${q ? q : "الكل"} • الوضع: ${headerMode} • ${new Date().toLocaleString("ar-EG")}`
  );

  const paidLabel = (mode === "customer") ? "المدفوع (داخلة)" :
                    (mode === "supplier") ? "المدفوع (خارجة)" :
                    "المدفوع";

  el("prevLedgerSummary") && (el("prevLedgerSummary").textContent =
    `الإجمالي: ${fmt(total)} • ${paidLabel}: ${fmt(paid)} • المتبقي: ${fmt(rem)}`
  );

  const tbE = el("prevLedgerEntriesTbody");
  if(tbE){
    tbE.innerHTML = "";
    if(entries.length === 0){
      tbE.innerHTML = `<tr><td colspan="6">لا توجد عمليات مطابقة.</td></tr>`;
    }else{
      for(const e of entries){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${e.date || "—"}</td>
          <td>${typeLabel(e.type)}</td>
          <td>${escapeHtml(e.desc || "—")}</td>
          <td class="num">${fmt(e.total)}</td>
          <td class="num">${fmt(e.paid)}</td>
          <td class="num">${fmt(e.remaining)}</td>
        `;
        tbE.appendChild(tr);
      }
    }
  }

  const tbP = el("prevLedgerPaysTbody");
  if(tbP){
    tbP.innerHTML = "";
    if(pays.length === 0){
      tbP.innerHTML = `<tr><td colspan="3">لا توجد مدفوعات مطابقة.</td></tr>`;
    }else{
      for(const p of pays){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.date || "—"}</td>
          <td>${escapeHtml(`${p.note || "—"} • ${flowLabel(p.flow || "out")}`)}</td>
          <td class="num">${fmt(p.amount)}</td>
        `;
        tbP.appendChild(tr);
      }
    }
  }

  showPage("ledgerPreview");
}

/* -------------------- Trash Page -------------------- */
function renderTrash(){
  const tbody = el("trashTbody");
  if(!tbody) return;

  const q = (el("trashQ")?.value || "").trim().toLowerCase();
  tbody.innerHTML = "";

  const logs = Array.isArray(STATE.trash) ? STATE.trash : [];
  const filtered = !q ? logs : logs.filter(item=>{
    const kind = (item.type === "delete_entry" ? "حذف عملية" : "حذف دفعة");
    const party =
      item.type === "delete_entry"
        ? (item.entrySnapshot?.party || "")
        : (item.paymentSnapshot?.party || "");
    const note =
      item.type === "delete_entry"
        ? (item.entrySnapshot?.desc || "")
        : (item.paymentSnapshot?.note || "");
    const blob = `${kind} ${party} ${note}`.toLowerCase();
    return blob.includes(q);
  });

  if(filtered.length === 0){
    tbody.innerHTML = `<tr><td colspan="6">لا توجد محذوفات مطابقة.</td></tr>`;
    return;
  }

  for(const item of filtered){
    const when = new Date(item.at).toLocaleString("ar-EG");
    const kind = item.type === "delete_entry" ? "حذف عملية" : "حذف دفعة";
    const party =
      item.type === "delete_entry"
        ? (item.entrySnapshot?.party || "—")
        : (item.paymentSnapshot?.party || "—");

    const amount =
      item.type === "delete_entry"
        ? (item.entrySnapshot?.total != null ? fmt(item.entrySnapshot.total) : "—")
        : (item.paymentSnapshot?.amount != null ? fmt(item.paymentSnapshot.amount) : "—");

    const note =
      item.type === "delete_entry"
        ? (item.entrySnapshot?.desc || "—")
        : (item.paymentSnapshot?.note || "—");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${when}</td>
      <td>${kind}</td>
      <td>${escapeHtml(party)}</td>
      <td class="num">${escapeHtml(amount)}</td>
      <td>${escapeHtml(note)}</td>
      <td>
        <button class="btn small danger" data-trashdel="${item.id}">حذف نهائي</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* -------------------- Reports -------------------- */
function toDateNum(iso){
  if(!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
  return Number(iso.replaceAll("-", ""));
}
function clampDateRange(fromISO, toISO){
  const f = toDateNum(fromISO);
  const t = toDateNum(toISO);
  if(!Number.isFinite(f) || !Number.isFinite(t)) return null;
  if(f > t) return { fromISO: toISO, toISO: fromISO };
  return { fromISO, toISO };
}
function presetRange(preset){
  const today = todayISO();
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,"0");
  const firstDayMonth = `${y}-${m}-01`;
  const firstDayYear = `${y}-01-01`;

  if(preset === "today") return { fromISO: today, toISO: today };
  if(preset === "this_month") return { fromISO: firstDayMonth, toISO: today };
  if(preset === "this_year") return { fromISO: firstDayYear, toISO: today };

  if(preset === "last_7" || preset === "last_30"){
    const days = preset === "last_7" ? 7 : 30;
    const d = new Date();
    d.setDate(d.getDate() - (days-1));
    const from = d.toISOString().slice(0,10);
    return { fromISO: from, toISO: today };
  }
  return null;
}
function filterEntriesByReportType(entriesView, repType){
  if(repType === "all") return entriesView;
  if(repType === "payments_out" || repType === "receipts_in") return [];
  return entriesView.filter(e => e.type === repType);
}

function renderReports(){
  const hasUI = !!el("page-reports");
  if(!hasUI) return;

  const entriesViewAll = STATE.entries.map(e => computeEntryView(e, STATE.payments));
  const paymentsAll = STATE.payments;

  const preset = el("repRangePreset")?.value || "custom";
  const type = el("repType")?.value || "all";
  const partyQ = (el("repParty")?.value || "").trim().toLowerCase();

  let fromISO = el("repFrom")?.value || "";
  let toISO   = el("repTo")?.value || "";

  const pr = presetRange(preset);
  if(pr){
    fromISO = pr.fromISO;
    toISO = pr.toISO;
    if(el("repFrom")) el("repFrom").value = fromISO;
    if(el("repTo")) el("repTo").value = toISO;
  }

  const rr = clampDateRange(fromISO, toISO);
  const fromNum = rr ? toDateNum(rr.fromISO) : NaN;
  const toNum   = rr ? toDateNum(rr.toISO) : NaN;

  const inRange = (iso)=> {
    const n = toDateNum(iso);
    if(!Number.isFinite(fromNum) || !Number.isFinite(toNum)) return true;
    return Number.isFinite(n) && n >= fromNum && n <= toNum;
  };

  let entries = entriesViewAll.filter(e => inRange(e.date));
  if(partyQ){
    entries = entries.filter(e =>
      (e.party || "").toLowerCase().includes(partyQ) ||
      (e.desc || "").toLowerCase().includes(partyQ) ||
      (e.notes || "").toLowerCase().includes(partyQ)
    );
  }

  const entriesAfterType = filterEntriesByReportType(entries, type);

  let pays = paymentsAll.filter(p => inRange(p.date));
  if(partyQ){
    pays = pays.filter(p =>
      (p.party || "").toLowerCase().includes(partyQ) ||
      (p.note || "").toLowerCase().includes(partyQ)
    );
  }

  if(type === "payments_out") pays = pays.filter(p => (p.flow || "out") === "out");
  if(type === "receipts_in") pays = pays.filter(p => (p.flow || "out") === "in");

  const repEntriesCount = entriesAfterType.length;
  const repPaysTotal = pays.reduce((a,p)=> a + Number(p.amount || 0), 0);

  const repReceivable = entriesAfterType
    .filter(e => e.side === "receivable")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  const repPayable = entriesAfterType
    .filter(e => e.side === "payable")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  el("repKpiEntries") && (el("repKpiEntries").textContent = repEntriesCount.toLocaleString("ar-EG"));
  el("repKpiPays") && (el("repKpiPays").textContent = fmt(repPaysTotal));
  el("repKpiReceivable") && (el("repKpiReceivable").textContent = fmt(repReceivable));
  el("repKpiPayable") && (el("repKpiPayable").textContent = fmt(repPayable));

  const repEntriesTbody = el("repEntriesTbody");
  if(repEntriesTbody){
    repEntriesTbody.innerHTML = "";
    const sorted = [...entriesAfterType].sort((a,b)=>
      (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt)
    );

    if(sorted.length === 0){
      repEntriesTbody.innerHTML = `<tr><td colspan="7">لا توجد عمليات داخل هذه الفلاتر.</td></tr>`;
    }else{
      for(const e of sorted){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${e.date || "—"}</td>
          <td><span class="badge">${typeLabel(e.type)}</span></td>
          <td>${escapeHtml(e.party || "—")}</td>
          <td>${escapeHtml(e.desc || "—")}</td>
          <td class="num">${fmt(e.total)}</td>
          <td class="num">${fmt(e.paid)}</td>
          <td class="num">${fmt(e.remaining)}</td>
        `;
        repEntriesTbody.appendChild(tr);
      }
    }
  }

  const repPaysTbody = el("repPaysTbody");
  if(repPaysTbody){
    repPaysTbody.innerHTML = "";
    const sortedPays = [...pays].sort((a,b)=>
      (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt)
    );

    if(sortedPays.length === 0){
      repPaysTbody.innerHTML = `<tr><td colspan="4">لا توجد مدفوعات داخل هذه الفلاتر.</td></tr>`;
    }else{
      for(const p of sortedPays){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.date || "—"}</td>
          <td>${escapeHtml(p.party || "—")}</td>
          <td>${escapeHtml(`${p.note || "—"} • ${flowLabel(p.flow || "out")}`)}</td>
          <td class="num">${fmt(p.amount)}</td>
        `;
        repPaysTbody.appendChild(tr);
      }
    }
  }
}

/* -------------------- Refresh (تحميل من الشيت) -------------------- */
let __refreshLock = false;
async function refresh(forceNetwork = false){
  if(__refreshLock) return;
  __refreshLock = true;

  try{
    hideGlobalError();

    // ✅ عرض فوري من الكاش المحلي (لو موجود) — بيريح المستخدم
    if(!forceNetwork){
      const local = await STORE.local.getAll();
      STATE.entries = Array.isArray(local.entries) ? local.entries : [];
      STATE.payments = Array.isArray(local.payments) ? local.payments : [];
      STATE.trash = Array.isArray(local.trash) ? local.trash : [];
      renderFromState();
    }

    // ✅ بعدها نجيب من الشيت (مرة واحدة)
    const all = await STORE.getAll();

    const payments = (all.payments || []).map(p => ({
      ...p,
      flow: (p.flow === "in" || p.flow === "out") ? p.flow : "out"
    }));

    STATE.entries = Array.isArray(all.entries) ? all.entries : [];
    STATE.payments = payments;
    STATE.trash = Array.isArray(all.trash) ? all.trash : [];

    renderFromState();
    hideGlobalError();

  }catch(e){
    console.error(e);
    const msg =
      (STORE.mode === "local")
        ? "تعذر تحميل البيانات من الشيت. جاري استخدام التخزين المحلي مؤقتًا."
        : "حصلت مشكلة في تحميل البيانات. تأكد إن Web App شغال وبعدين اضغط إعادة المحاولة.";
    showGlobalError(msg);
  }finally{
    __refreshLock = false;
  }
}

/* -------------------- DOM Events -------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  try{
    ensureGlobalBanner();
    setupPinGate();

    if(isAuthed()){
      document.documentElement.classList.add("authed");
      openApp();

      try{ await STORE.init(); }
      catch(e){
        console.error(e);
        showGlobalError("تعذر تهيئة التخزين على الشيت. سيتم استخدام التخزين المحلي مؤقتًا.");
      }

      await refresh(true);
    }

    document.querySelectorAll(".navBtn").forEach(btn=>{
      btn.addEventListener("click", ()=> showPage(btn.dataset.page));
    });

    el("btnLogout")?.addEventListener("click", ()=>{
      if(confirm("هل تريد تسجيل الخروج؟")){
        setAuthed(false);
        closeApp();
      }
    });

    el("btnPrint")?.addEventListener("click", ()=>{
      preparePrintForCurrentPage();
      window.print();
    });

    // ✅ Add Entry
    el("entryForm")?.addEventListener("submit", async (ev)=>{
      ev.preventDefault();
      hideGlobalError();

      const { entry, firstPay } = getEntryFromForm();
      const err = validateEntry(entry);
      if(err){ alert(err); return; }

      if(firstPay !== null && firstPay > entry.total){
        alert("الدفعة الأولى لا يمكن أن تتجاوز الإجمالي.");
        return;
      }

      try{
        await STORE.addEntry(entry);

        if(firstPay !== null && entry.type !== "expense"){
          const side = moneySide(entry.type);
          const flow = (side === "receivable") ? "in" : "out";

          await STORE.addPayment({
            id: uid(),
            entryId: entry.id,
            date: entry.date,
            party: entry.party,
            amount: firstPay,
            note: "دفعة أولى",
            flow,
            createdAt: Date.now()
          });
        }

        resetForm();
        await refresh(true);

      }catch(e){
        console.error(e);
        showGlobalError("تعذر حفظ العملية على الشيت. تم الحفظ محليًا إذا كان الوضع Offline.");
        renderFromState();
      }
    });

    el("btnReset")?.addEventListener("click", resetForm);

    // ✅✅✅ سرعة: الفلاتر تعمل render فقط (لا تعمل refresh للشيت)
    ["q","filterType","filterOpen"].forEach(id=>{
      el(id)?.addEventListener("input", renderFromState);
      el(id)?.addEventListener("change", renderFromState);
    });
    el("payQ")?.addEventListener("input", renderFromState);
    el("trashQ")?.addEventListener("input", renderFromState);

    // Reports
    el("btnRunReports")?.addEventListener("click", renderReports);
    el("btnPrintReports")?.addEventListener("click", ()=>{ preparePrintForCurrentPage(); window.print(); });
    el("repRangePreset")?.addEventListener("change", renderReports);
    el("repFrom")?.addEventListener("change", renderReports);
    el("repTo")?.addEventListener("change", renderReports);
    el("repType")?.addEventListener("change", renderReports);
    el("repParty")?.addEventListener("input", ()=>{
      clearTimeout(ledgerTimer);
      ledgerTimer = setTimeout(renderReports, 250);
    });

    // Table actions
    el("tbody")?.addEventListener("click", async (ev)=>{
      const btn = ev.target.closest("button");
      if(!btn) return;

      const act = btn.dataset.act;
      const id = btn.dataset.id;

      if(act === "del"){
        if(!requirePin("الحذف")) return;
        if(confirm("متأكد حذف العملية؟ (سيتم حذف المدفوعات التابعة لها أيضًا)")){
          const entry = STATE.entries.find(e => e.id === id) || null;
          const pays = STATE.payments.filter(p => p.entryId === id);

          try{
            await STORE.deleteEntry(id, { entrySnapshot: entry, paymentsSnapshot: pays });
          }catch(e){
            console.error(e);
            showGlobalError("تعذر الحذف على الشيت. تم تنفيذ الحذف محليًا إذا كان الوضع Offline.");
          }

          await refresh(true);
        }
        return;
      }

      if(act === "pay"){ openPayModal(id); return; }
      if(act === "preview"){ openEntryPreview(id); return; }

      if(act === "person"){
        const name = btn.dataset.name || "";
        const side = btn.dataset.side || "all";
        openPersonDetails(name, side);
      }
    });

    // Ledger
    el("btnLedger")?.addEventListener("click", ()=> showLedger(el("ledgerName")?.value || ""));
    el("ledgerMode")?.addEventListener("change", ()=> showLedger(el("ledgerName")?.value || ""));
    el("ledgerName")?.addEventListener("input", ()=>{
      clearTimeout(ledgerTimer);
      ledgerTimer = setTimeout(()=> showLedger(el("ledgerName").value), 250);
    });
    el("btnLedgerPreview")?.addEventListener("click", openLedgerPreview);

    // Payment modal
    el("payClose")?.addEventListener("click", closePayModal);
    el("payModal")?.addEventListener("click", (ev)=>{ if(ev.target === el("payModal")) closePayModal(); });

    el("paySave")?.addEventListener("click", async ()=>{
      const entry = STATE.entries.find(e => e.id === CURRENT_PAY_ENTRY_ID);
      if(!entry) return closePayModal();

      if(entry.type === "expense"){
        alert("المصروف لا يحتاج دفعات.");
        return closePayModal();
      }

      const date = (el("payDate")?.value || "").trim();
      const amount = (el("payAmount")?.value === "" || el("payAmount") == null) ? null : Number(el("payAmount").value);
      const note = (el("payNote")?.value || "").trim();
      const flow = (el("payFlow")?.value || "out").trim();

      if(!date || amount === null || !Number.isFinite(amount) || amount <= 0){
        el("payError") && (el("payError").hidden = false);
        return;
      }

      const side = moneySide(entry.type);
      const affectingFlow = (side === "receivable") ? "in" : "out";

      if(flow === affectingFlow && Number.isFinite(entry.total)){
        const alreadyAffecting = sumPaymentsForEntry(entry.id, STATE.payments, affectingFlow);
        if((alreadyAffecting + amount) > Number(entry.total) + 1e-9){
          alert(`لا يمكن أن تتجاوز الدفعات المؤثرة إجمالي العملية.\nالمدفوع حاليًا: ${fmt(alreadyAffecting)}\nالإجمالي: ${fmt(entry.total)}`);
          return;
        }
      }

      try{
        await STORE.addPayment({
          id: uid(),
          entryId: entry.id,
          date,
          party: entry.party,
          amount,
          note,
          flow: (flow === "in" ? "in" : "out"),
          createdAt: Date.now()
        });
      }catch(e){
        console.error(e);
        showGlobalError("تعذر حفظ الدفعة على الشيت. تم الحفظ محليًا إذا كان الوضع Offline.");
      }

      closePayModal();
      await refresh(true);
    });

    // Delete payment
    el("payTbody")?.addEventListener("click", async (ev)=>{
      const btn = ev.target.closest("button");
      if(!btn) return;
      const payId = btn.dataset.paydel;
      if(!payId) return;

      if(!requirePin("حذف الدفعة")) return;
      if(confirm("متأكد حذف الدفعة؟")){
        const pay = STATE.payments.find(p => p.id === payId) || null;

        try{ await STORE.deletePayment(payId, { paymentSnapshot: pay }); }
        catch(e){
          console.error(e);
          showGlobalError("تعذر حذف الدفعة على الشيت. تم تنفيذ الحذف محليًا إذا كان الوضع Offline.");
        }

        await refresh(true);
      }
    });

    // Trash delete forever
    el("trashTbody")?.addEventListener("click", async (ev)=>{
      const btn = ev.target.closest("button");
      if(!btn) return;
      const logId = btn.dataset.trashdel;
      if(!logId) return;

      if(!requirePin("الحذف النهائي من سجل المحذوفات")) return;
      if(confirm("متأكد حذف نهائي؟ لن يمكن استرجاع هذا السطر.")){
        try{
          await STORE.deleteTrashLog(logId);
          STATE.trash = await STORE.getTrash();
          renderTrash();
        }catch(e){
          console.error(e);
          showGlobalError("تعذر حذف السطر من الشيت. تم الحذف محليًا إذا كان الوضع Offline.");
        }
      }
    });

  }catch(e){
    console.error(e);
    showGlobalError("فيه خطأ حصل في تشغيل الصفحة. جرّب تحديث الصفحة أو امسح كاش الموقع.");
  }
});
