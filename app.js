/* سوبر ماركت أولاد يحيى — دفتر الحسابات
   ✅ PIN ثابت: 1234
   ✅ مدفوعات منفصلة payments[] مرتبطة بكل عملية entryId
   ✅ Refresh لا يعمل Logout (sessionStorage)
   ✅ حذف بــ PIN + سجل محذوفات (Trash)
   ✅ كشف حساب: بحث جزئي + بحث مباشر + تنسيق أوضح
   ✅ معاينة عملية (Entry Preview) + طباعة/PDF
   ✅ FINAL FIXES:
      - منع دفعة أولى للمصروف
      - منع دفعة تتجاوز إجمالي العملية
      - معاينة المصروف لا تعرض مدفوعات

   ✅ NEW (for next phase):
      - تصنيف العمليات ماليًا: (فلوس ليا / فلوس عليا / مصروف)
      - كشف حساب يدعم فلتر (عميل فقط / مورد فقط) عبر #ledgerMode إن وُجد
      - الضغط على اسم الشخص يفتح كشف حساب تلقائيًا (fallback لتفاصيل الشخص)
      - سجل المحذوفات: حذف نهائي لكل سطر مع PIN
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

/* -------------------- Storage -------------------- */
function loadData(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : { entries: [], payments: [] };
    if(!Array.isArray(data.entries)) data.entries = [];
    if(!Array.isArray(data.payments)) data.payments = [];
    return data;
  }catch{
    return { entries: [], payments: [] };
  }
}
function saveData(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

function loadTrash(){
  try{
    const raw = localStorage.getItem(TRASH_KEY);
    const t = raw ? JSON.parse(raw) : { logs: [] };
    if(!Array.isArray(t.logs)) t.logs = [];
    return t;
  }catch{
    return { logs: [] };
  }
}
function saveTrash(t){
  if(Array.isArray(t.logs) && t.logs.length > MAX_TRASH){
    t.logs = t.logs.slice(0, MAX_TRASH);
  }
  localStorage.setItem(TRASH_KEY, JSON.stringify(t));
}

function typeLabel(t){
  return ({
    expense: "مصروف",
    advance: "سُلفة",
    credit_customer: "آجل (عميل)",
    credit_supplier: "فاتورة/مورد"
  })[t] || "—";
}

/* ✅ تصنيف مالي (جاهز للـ KPI الجديد) */
function moneySide(entryType){
  if(entryType === "expense") return "expense";        // مصروف
  if(entryType === "credit_supplier") return "payable"; // فلوس عليا
  if(entryType === "credit_customer") return "receivable"; // فلوس ليا
  if(entryType === "advance") return "receivable";     // سُلفة (فلوس ليا عند الشخص)
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

function sumPaymentsForEntry(entryId, payments){
  return payments
    .filter(p => p.entryId === entryId)
    .reduce((a,p)=> a + Number(p.amount || 0), 0);
}

/* ✅ المصروفات ليست “مستحقات”
   remaining للمصروف = 0 دايمًا
*/
function computeEntryView(entry, payments){
  const total = Number(entry.total);
  const paid = sumPaymentsForEntry(entry.id, payments);

  const side = moneySide(entry.type);

  if(entry.type === "expense"){
    return { ...entry, side, paid, remaining: 0 };
  }

  const remaining = (Number.isFinite(total) ? Math.max(total - paid, 0) : NaN);
  return { ...entry, side, paid, remaining };
}

/* -------------------- Pages -------------------- */
const PAGES = [
  "dashboard","records","payments","ledger",
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
}

/* -------------------- Auth -------------------- */
function setAuthed(v){
  if(v) sessionStorage.setItem(AUTH_KEY, "1");
  else sessionStorage.removeItem(AUTH_KEY);
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
  refresh();
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
    pinForm.addEventListener("submit", (ev)=>{
      ev.preventDefault();
      const v = (pinInput.value || "").trim();

      if(v === PIN_CODE){
        setAuthed(true);
        if(pinError) pinError.hidden = true;
        pinInput.value = "";
        pinInput.type = "password";
        openApp();
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

/* -------------------- Trash Log -------------------- */
function logTrash(event){
  const t = loadTrash();
  t.logs.unshift({
    id: uid(),
    at: Date.now(),
    ...event
  });
  saveTrash(t);
}

/* ✅ حذف نهائي لسطر في المحذوفات */
function deleteTrashLogForever(logId){
  const t = loadTrash();
  t.logs = (t.logs || []).filter(x => x.id !== logId);
  saveTrash(t);
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

  // ✅ دفعة أولى
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

  // ✅ FINAL: ممنوع دفعة أولى للمصروف
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

/* -------------------- Data Ops -------------------- */
function addEntry(entry){
  const data = loadData();
  data.entries.push(entry);
  saveData(data);
}
function addPayment(payment){
  const data = loadData();
  data.payments.push(payment);
  saveData(data);
}

function deleteEntryWithLog(entryId){
  const data = loadData();
  const entry = data.entries.find(e => e.id === entryId);
  const pays = data.payments.filter(p => p.entryId === entryId);

  data.entries = data.entries.filter(e => e.id !== entryId);
  data.payments = data.payments.filter(p => p.entryId !== entryId);
  saveData(data);

  logTrash({
    type: "delete_entry",
    entryId,
    entrySnapshot: entry || null,
    paymentsSnapshot: pays || [],
  });
}

function deletePaymentWithLog(payId){
  const data = loadData();
  const pay = data.payments.find(p => p.id === payId) || null;

  data.payments = data.payments.filter(p => p.id !== payId);
  saveData(data);

  logTrash({
    type: "delete_payment",
    payId,
    paymentSnapshot: pay
  });
}

/* -------------------- Render KPIs -------------------- */
function computeTotals(entriesView, payments){
  const expensesTotal = entriesView
    .filter(e => e.type === "expense")
    .reduce((a,e)=> a + (Number.isFinite(e.total) ? e.total : 0), 0);

  const paidTotal = payments.reduce((a,p)=> a + Number(p.amount || 0), 0);

  const remainingReceivable = entriesView
    .filter(e => e.side === "receivable")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  const remainingPayable = entriesView
    .filter(e => e.side === "payable")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  const remainingTotal = entriesView
    .filter(e => e.type !== "expense")
    .reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  return { expensesTotal, paidTotal, remainingReceivable, remainingPayable, remainingTotal };
}

function renderKPIs(entriesView, payments){
  const t = computeTotals(entriesView, payments);

  // الموجود حاليًا في HTML:
  // kpiExpenses = مصروفات
  // kpiPaid     = إجمالي المدفوعات
  // kpiRemaining= إجمالي المستحق (حالياً إجمالي المتبقي لكل ما ليس مصروف)
  // kpiCount    = عدد العمليات
  el("kpiExpenses") && (el("kpiExpenses").textContent = fmt(t.expensesTotal));
  el("kpiPaid") && (el("kpiPaid").textContent = fmt(t.paidTotal));
  el("kpiRemaining") && (el("kpiRemaining").textContent = fmt(t.remainingTotal));
  el("kpiCount") && (el("kpiCount").textContent = entriesView.length.toLocaleString("ar-EG"));

  // ✅ جاهز للمرحلة الجاية: لو زودنا IDs جديدة في HTML
  // el("kpiReceivable") && (el("kpiReceivable").textContent = fmt(t.remainingReceivable));
  // el("kpiPayable") && (el("kpiPayable").textContent = fmt(t.remainingPayable));
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

    // ✅ الاسم clickable → يفتح كشف الحساب تلقائيًا (fallback لتفاصيل الشخص)
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
    return party.includes(q) || note.includes(q);
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
      <td>${escapeHtml(ref)}</td>
      <td class="num">${fmt(p.amount)}</td>
      <td>${escapeHtml(p.note || "—")}</td>
      <td><button class="btn small danger" data-paydel="${p.id}">حذف</button></td>
    `;
    tbody.appendChild(tr);
  }
}

/* -------------------- Payments Modal -------------------- */
let CURRENT_PAY_ENTRY_ID = null;

function openPayModal(entryId){
  const data = loadData();
  const entry = data.entries.find(e => e.id === entryId);
  if(entry?.type === "expense"){
    alert("المصروف لا يحتاج إضافة دفعات.");
    return;
  }

  CURRENT_PAY_ENTRY_ID = entryId;
  el("payDate") && (el("payDate").value = todayISO());
  el("payAmount") && (el("payAmount").value = "");
  el("payNote") && (el("payNote").value = "");
  el("payError") && (el("payError").hidden = true);
  el("payModal") && (el("payModal").hidden = false);
}
function closePayModal(){
  el("payModal") && (el("payModal").hidden = true);
  CURRENT_PAY_ENTRY_ID = null;
}

/* -------------------- Preview: Entry -------------------- */
function openEntryPreview(entryId){
  const data = loadData();
  const entry = data.entries.find(e => e.id === entryId);
  if(!entry) return;

  const v = computeEntryView(entry, data.payments);

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

    // ✅ FINAL: المصروف لا نعرض له مدفوعات حتى لو قديمًا اتسجل بالغلط
    if(v.type === "expense"){
      tb.innerHTML = `<tr><td colspan="3">المصروف لا يحتوي على مدفوعات.</td></tr>`;
    } else {
      const pays = data.payments
        .filter(p => p.entryId === entryId)
        .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));

      if(pays.length === 0){
        tb.innerHTML = `<tr><td colspan="3">لا توجد مدفوعات لهذه العملية.</td></tr>`;
      }else{
        for(const p of pays){
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${p.date || "—"}</td>
            <td>${escapeHtml(p.note || "—")}</td>
            <td class="num">${fmt(p.amount)}</td>
          `;
          tb.appendChild(tr);
        }
      }
    }
  }

  showPage("entryPreview");
}

/* -------------------- Ledger: Partial Search + Live + Mode -------------------- */
let ledgerTimer = null;

function getLedgerMode(){
  // ✅ هنضيفه في HTML بعدين، لكن لو موجود دلوقتي يشتغل فورًا
  const m = (el("ledgerMode")?.value || "all").trim();
  return (m === "customer" || m === "supplier" || m === "all") ? m : "all";
}

function entryMatchesLedgerMode(entry, mode){
  if(mode === "all") return true;

  // customer = فلوس ليا (عميل + سلفة)
  if(mode === "customer") return entry.side === "receivable";

  // supplier = فلوس عليا (مورد)
  if(mode === "supplier") return entry.side === "payable";

  return true;
}

function showLedger(name){
  const box = el("ledgerBox");
  if(!box) return;

  box.innerHTML = "";
  const q = (name || "").trim().toLowerCase();
  if(!q){
    box.innerHTML = `<div class="muted">اكتب الاسم… (مثال: اكتب "احم" وسيظهر كل من يحتوي عليها)</div>`;
    return;
  }

  const mode = getLedgerMode();

  const data = loadData();
  const entriesAll = data.entries.map(e => computeEntryView(e, data.payments));
  const paysAll = data.payments;

  const entries = entriesAll
    .filter(e => (e.party || "").trim().toLowerCase().includes(q))
    .filter(e => entryMatchesLedgerMode(e, mode))
    .sort((a,b)=> (a.date || "").localeCompare(a.date || "") || (a.createdAt - b.createdAt));

  // المدفوعات: نعرضها فقط لو مرتبطة بعمليات ضمن نفس الفلتر (حتى لا تلخبط)
  const allowedEntryIds = new Set(entries.map(e => e.id));

  const pays = paysAll
    .filter(p => (p.party || "").trim().toLowerCase().includes(q))
    .filter(p => allowedEntryIds.has(p.entryId))
    .sort((a,b)=> (a.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt));

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

  box.innerHTML += `
    <div class="line"><b>الإجمالي${headerMode}</b><b>${fmt(total)}</b></div>
    <div class="line"><span>المدفوع</span><b>${fmt(paid)}</b></div>
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
            <div class="muted">${p.date || "—"} • ${escapeHtml(p.note || "—")}</div>
          </div>
          <div style="text-align:left; min-width: 140px">
            <div>دفعة: <b>${fmt(p.amount)}</b></div>
          </div>
        </div>
      `;
    }
  }
}

/* ✅ فتح “تفاصيل شخص” (fallback لكشف حساب لحد ما نبني صفحة التفاصيل) */
function openPersonDetails(name, side = "all"){
  const clean = (name || "").trim();
  if(!clean) return;

  // لو صفحة تفاصيل الشخص اتضافت بعدين هنستخدمها
  // حالياً: نعمل fallback لكشف الحساب مباشرة
  showPage("ledger");
  if(el("ledgerName")){
    el("ledgerName").value = clean;

    // لو في ledgerMode: نضبطه حسب side
    if(el("ledgerMode")){
      if(side === "payable") el("ledgerMode").value = "supplier";
      else if(side === "receivable") el("ledgerMode").value = "customer";
      else el("ledgerMode").value = "all";
    }

    showLedger(clean);
  }
}

/* -------------------- Trash Page -------------------- */
function renderTrash(){
  const tbody = el("trashTbody");
  if(!tbody) return;

  const q = (el("trashQ")?.value || "").trim().toLowerCase();
  const t = loadTrash();
  tbody.innerHTML = "";

  const logs = Array.isArray(t.logs) ? t.logs : [];
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

/* -------------------- Refresh -------------------- */
function refresh(){
  const data = loadData();
  const entriesView = data.entries.map(e => computeEntryView(e, data.payments));

  renderKPIs(entriesView, data.payments);
  renderEntriesTable(applyEntryFilters(entriesView));
  renderPaymentsTable(data.payments, data.entries);

  const trashPage = document.getElementById("page-trash");
  if(trashPage && !trashPage.hidden){
    renderTrash();
  }
}

/* -------------------- DOM Events -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  try{
    setupPinGate();

    if(isAuthed()){
      openApp();
    }

    document.querySelectorAll(".navBtn").forEach(btn=>{
      btn.addEventListener("click", ()=> showPage(btn.dataset.page));
    });

    const logoutBtn = el("btnLogout");
    if(logoutBtn){
      logoutBtn.addEventListener("click", ()=>{
        if(confirm("هل تريد تسجيل الخروج؟")){
          setAuthed(false);
          closeApp();
        }
      });
    }

    const btnPrint = el("btnPrint");
    if(btnPrint){
      btnPrint.addEventListener("click", ()=> window.print());
    }

    // ✅ firstPay: لو المستخدم كتب 0 يمسحه + لو اختار مصروف نخليه فاضي
    el("firstPay")?.addEventListener("input", ()=>{
      const v = el("firstPay").value;
      if(v !== "" && Number(v) <= 0) el("firstPay").value = "";
      if(el("type")?.value === "expense") el("firstPay").value = "";
    });
    // ✅ لو النوع اتغير إلى مصروف: امسح الدفعة الأولى فورًا
    el("type")?.addEventListener("change", ()=>{
      if(el("type").value === "expense" && el("firstPay")) el("firstPay").value = "";
    });

    // ✅ Add Entry
    el("entryForm")?.addEventListener("submit", (ev)=>{
      ev.preventDefault();

      const { entry, firstPay } = getEntryFromForm();
      const err = validateEntry(entry);
      if(err) return alert(err);

      if(firstPay !== null){
        if(firstPay > entry.total) return alert("الدفعة الأولى لا يمكن أن تتجاوز الإجمالي.");
      }

      addEntry(entry);

      // ✅ إضافة دفعة أولى فقط لو النوع ليس مصروف
      if(firstPay !== null && entry.type !== "expense"){
        addPayment({
          id: uid(),
          entryId: entry.id,
          date: entry.date,
          party: entry.party,
          amount: firstPay,
          note: "دفعة أولى",
          createdAt: Date.now()
        });
      }

      resetForm();
      refresh();
    });

    el("btnReset")?.addEventListener("click", resetForm);

    ["q","filterType","filterOpen"].forEach(id=>{
      el(id)?.addEventListener("input", refresh);
      el(id)?.addEventListener("change", refresh);
    });

    el("payQ")?.addEventListener("input", refresh);
    el("trashQ")?.addEventListener("input", refresh);

    // ✅ Table actions
    el("tbody")?.addEventListener("click", (ev)=>{
      const btn = ev.target.closest("button");
      if(!btn) return;

      const act = btn.dataset.act;
      const id = btn.dataset.id;

      if(act === "del"){
        if(!requirePin("الحذف")) return;
        if(confirm("متأكد حذف العملية؟ (سيتم حذف المدفوعات التابعة لها أيضًا)")){
          deleteEntryWithLog(id);
          refresh();
        }
        return;
      }

      if(act === "pay"){
        openPayModal(id);
        return;
      }

      if(act === "preview"){
        openEntryPreview(id);
        return;
      }

      if(act === "person"){
        const name = btn.dataset.name || "";
        const side = btn.dataset.side || "all";
        openPersonDetails(name, side);
        return;
      }
    });

    // ✅ Preview buttons
    el("btnBackFromEntryPreview")?.addEventListener("click", ()=> showPage("records"));
    el("btnPrintEntry")?.addEventListener("click", ()=> window.print());

    el("btnBackFromLedgerPreview")?.addEventListener("click", ()=> showPage("ledger"));
    el("btnPrintLedger")?.addEventListener("click", ()=> window.print());

    // ✅ Payment modal
    el("payClose")?.addEventListener("click", closePayModal);
    el("payModal")?.addEventListener("click", (ev)=>{
      if(ev.target === el("payModal")) closePayModal();
    });

    // ✅ Save payment (مع منع تجاوز الإجمالي)
    el("paySave")?.addEventListener("click", ()=>{
      const data = loadData();
      const entry = data.entries.find(e => e.id === CURRENT_PAY_ENTRY_ID);
      if(!entry) return closePayModal();

      if(entry.type === "expense"){
        alert("المصروف لا يحتاج دفعات.");
        return closePayModal();
      }

      const date = (el("payDate")?.value || "").trim();
      const amount = (el("payAmount")?.value === "" || el("payAmount") == null) ? null : Number(el("payAmount").value);
      const note = (el("payNote")?.value || "").trim();

      if(!date || amount === null || !Number.isFinite(amount) || amount <= 0){
        el("payError") && (el("payError").hidden = false);
        return;
      }

      // ✅ FINAL: منع الدفع أكثر من الإجمالي
      const alreadyPaid = sumPaymentsForEntry(entry.id, data.payments);
      if(Number.isFinite(entry.total) && (alreadyPaid + amount) > Number(entry.total) + 1e-9){
        alert(`لا يمكن أن تتجاوز المدفوعات إجمالي العملية.\nالمدفوع حاليًا: ${fmt(alreadyPaid)}\nالإجمالي: ${fmt(entry.total)}`);
        return;
      }

      addPayment({
        id: uid(),
        entryId: entry.id,
        date,
        party: entry.party,
        amount,
        note,
        createdAt: Date.now()
      });

      closePayModal();
      refresh();
    });

    // ✅ Delete payment (PIN)
    el("payTbody")?.addEventListener("click", (ev)=>{
      const btn = ev.target.closest("button");
      if(!btn) return;
      const payId = btn.dataset.paydel;
      if(!payId) return;

      if(!requirePin("حذف الدفعة")) return;
      if(confirm("متأكد حذف الدفعة؟")){
        deletePaymentWithLog(payId);
        refresh();
      }
    });

    // ✅ Trash: delete forever per row (PIN)
    el("trashTbody")?.addEventListener("click", (ev)=>{
      const btn = ev.target.closest("button");
      if(!btn) return;
      const logId = btn.dataset.trashdel;
      if(!logId) return;

      if(!requirePin("الحذف النهائي من سجل المحذوفات")) return;
      if(confirm("متأكد حذف نهائي؟ لن يمكن استرجاع هذا السطر.")){
        deleteTrashLogForever(logId);
        renderTrash();
      }
    });

    // ✅ Ledger live search
    el("ledgerName")?.addEventListener("input", ()=>{
      clearTimeout(ledgerTimer);
      ledgerTimer = setTimeout(()=>{
        showLedger(el("ledgerName").value);
      }, 250);
    });

    el("btnLedger")?.addEventListener("click", ()=> showLedger(el("ledgerName").value));

    // ✅ لو أضفت ledgerMode في HTML: غير الفلتر ينعكس فوراً
    el("ledgerMode")?.addEventListener("change", ()=>{
      showLedger(el("ledgerName")?.value || "");
    });

  }catch(e){
    alert("فيه خطأ حصل في تشغيل الصفحة. امسح كاش الموقع وافتح تاني.");
    console.error(e);
  }
});
