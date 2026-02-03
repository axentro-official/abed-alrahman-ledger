/* عباد الرحمن — دفتر الحسابات
   ✅ PIN ثابت: 1234
   ✅ مدفوعات منفصلة payments[] مرتبطة بكل عملية entryId
   ✅ لا يوجد أي 0 تلقائي في الحقول
*/

const LS_KEY = "abed_alrahman_ledger_v2";
const PIN_CODE = "1234";

const el = (id) => document.getElementById(id);

const fmt = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

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
function saveData(data){
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function typeLabel(t){
  return ({
    expense: "مصروف",
    advance: "سُلفة",
    credit_customer: "آجل (عميل)",
    credit_supplier: "فاتورة/مورد"
  })[t] || "—";
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

function computeEntryView(entry, payments){
  const total = Number(entry.total);
  const paid = sumPaymentsForEntry(entry.id, payments);
  const remaining = (Number.isFinite(total) ? Math.max(total - paid, 0) : NaN);
  return { ...entry, paid, remaining };
}

/* ---------- PIN Gate ---------- */
function setupPinGate(){
  const gate = el("pinGate");
  const root = el("appRoot");
  const pinForm = el("pinForm");
  const pinInput = el("pinInput");
  const pinError = el("pinError");

  pinForm.addEventListener("submit", (ev)=>{
    ev.preventDefault();
    const v = (pinInput.value || "").trim();
    if(v === PIN_CODE){
      gate.hidden = true;
      root.hidden = false;
      pinError.hidden = true;
      pinInput.value = "";
      refresh();
    } else {
      pinError.hidden = false;
      pinInput.focus();
      pinInput.select();
    }
  });
}

/* ---------- Forms ---------- */
function resetForm(){
  el("date").value = "";
  el("type").value = "";
  el("party").value = "";
  el("desc").value = "";
  el("category").value = "";
  el("total").value = "";
  el("firstPay").value = "";
  el("notes").value = "";
}

function getEntryFromForm(){
  const entry = {
    id: uid(),
    date: (el("date").value || "").trim(),
    type: (el("type").value || "").trim(),
    party: (el("party").value || "").trim(),
    desc: (el("desc").value || "").trim(),
    category: (el("category").value || "").trim(),
    total: el("total").value === "" ? null : Number(el("total").value),
    notes: (el("notes").value || "").trim(),
    createdAt: Date.now()
  };

  const firstPay = el("firstPay").value === "" ? null : Number(el("firstPay").value);

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

/* ---------- Data Ops ---------- */
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

function deleteEntry(entryId){
  const data = loadData();
  data.entries = data.entries.filter(e => e.id !== entryId);
  data.payments = data.payments.filter(p => p.entryId !== entryId); // حذف مدفوعاته
  saveData(data);
}

function deletePayment(payId){
  const data = loadData();
  data.payments = data.payments.filter(p => p.id !== payId);
  saveData(data);
}

/* ---------- Render ---------- */
function renderKPIs(entriesView, payments){
  const expensesTotal = entriesView
    .filter(e => e.type === "expense")
    .reduce((a,e)=> a + (Number.isFinite(e.total) ? e.total : 0), 0);

  const paidTotal = payments.reduce((a,p)=> a + Number(p.amount || 0), 0);
  const remainingTotal = entriesView.reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  el("kpiExpenses").textContent = fmt(expensesTotal);
  el("kpiPaid").textContent = fmt(paidTotal);
  el("kpiRemaining").textContent = fmt(remainingTotal);
  el("kpiCount").textContent = entriesView.length.toLocaleString("ar-EG");
}

function applyEntryFilters(entriesView){
  const q = (el("q").value || "").trim().toLowerCase();
  const ft = el("filterType").value;
  const fo = el("filterOpen").value;

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

function renderEntriesTable(entriesView){
  const tbody = el("tbody");
  tbody.innerHTML = "";

  const sorted = [...entriesView].sort((a,b)=>
    (b.date || "").localeCompare(a.date || "") || (b.createdAt - a.createdAt)
  );

  for(const e of sorted){
    const cat = e.type === "expense" ? (e.category || "—") : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date || "—"}</td>
      <td><span class="badge">${typeLabel(e.type)}</span></td>
      <td>${escapeHtml(e.party || "")}</td>
      <td>${escapeHtml(e.desc || "")}</td>
      <td>${escapeHtml(cat)}</td>
      <td class="num">${fmt(e.total)}</td>
      <td class="num">${fmt(e.paid)}</td>
      <td class="num">${fmt(e.remaining)}</td>
      <td>
        <div class="rowActions">
          <button class="btn small" data-act="pay" data-id="${e.id}">إضافة دفعة</button>
          <button class="btn small danger" data-act="del" data-id="${e.id}">حذف</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderPaymentsTable(payments, entries){
  const q = (el("payQ").value || "").trim().toLowerCase();
  const tbody = el("payTbody");
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
      <td>
        <button class="btn small danger" data-paydel="${p.id}">حذف</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* ---------- Payments Modal ---------- */
let CURRENT_PAY_ENTRY_ID = null;

function openPayModal(entryId){
  CURRENT_PAY_ENTRY_ID = entryId;
  el("payDate").value = todayISO();
  el("payAmount").value = "";
  el("payNote").value = "";
  el("payError").hidden = true;
  el("payModal").hidden = false;
}

function closePayModal(){
  el("payModal").hidden = true;
  CURRENT_PAY_ENTRY_ID = null;
}

/* ---------- Ledger ---------- */
function showLedger(name){
  const box = el("ledgerBox");
  box.innerHTML = "";
  const key = (name || "").trim().toLowerCase();
  if(!key){
    box.innerHTML = `<div class="muted">اكتب الاسم ثم اضغط عرض.</div>`;
    return;
  }

  const data = loadData();
  const entries = data.entries;
  const payments = data.payments;

  const listEntries = entries
    .filter(e => (e.party || "").trim().toLowerCase() === key)
    .map(e => computeEntryView(e, payments))
    .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));

  const listPays = payments
    .filter(p => (p.party || "").trim().toLowerCase() === key)
    .sort((a,b)=> (a.date || "").localeCompare(b.date || "") || (a.createdAt - b.createdAt));

  if(listEntries.length === 0 && listPays.length === 0){
    box.innerHTML = `<div class="muted">لا توجد بيانات لهذا الاسم.</div>`;
    return;
  }

  const total = listEntries.reduce((a,e)=> a + (Number.isFinite(e.total) ? e.total : 0), 0);
  const paid = listEntries.reduce((a,e)=> a + (Number.isFinite(e.paid) ? e.paid : 0), 0);
  const rem  = listEntries.reduce((a,e)=> a + (Number.isFinite(e.remaining) ? e.remaining : 0), 0);

  box.innerHTML += `
    <div class="line"><b>الإجمالي</b><b>${fmt(total)}</b></div>
    <div class="line"><span>المدفوع</span><b>${fmt(paid)}</b></div>
    <div class="line"><span>المتبقي</span><b>${fmt(rem)}</b></div>
    <div class="muted" style="margin:10px 0">تفاصيل العمليات:</div>
  `;

  for(const e of listEntries){
    box.innerHTML += `
      <div class="line">
        <div>
          <div><b>${e.date}</b> • ${typeLabel(e.type)}</div>
          <div class="muted">${escapeHtml(e.desc || "—")}</div>
        </div>
        <div style="text-align:left">
          <div>إجمالي: <b>${fmt(e.total)}</b></div>
          <div class="muted">مدفوع: ${fmt(e.paid)} • باقي: ${fmt(e.remaining)}</div>
        </div>
      </div>
    `;
  }

  if(listPays.length){
    box.innerHTML += `<div class="muted" style="margin:10px 0">تفاصيل المدفوعات:</div>`;
    for(const p of listPays){
      box.innerHTML += `
        <div class="line">
          <div><b>${p.date}</b></div>
          <div style="text-align:left">
            <div>دفعة: <b>${fmt(p.amount)}</b></div>
            <div class="muted">${escapeHtml(p.note || "—")}</div>
          </div>
        </div>
      `;
    }
  }
}

/* ---------- Export/Import ---------- */
function exportJSON(data){
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `abed-alrahman-ledger-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportPaymentsOnly(){
  const data = loadData();
  exportJSON({ payments: data.payments, exportedAt: Date.now() });
}

function importJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if(!obj) throw new Error("bad");

      const data = loadData();

      // لو ملف كامل
      if(Array.isArray(obj.entries) || Array.isArray(obj.payments)){
        data.entries = Array.isArray(obj.entries) ? obj.entries : data.entries;
        data.payments = Array.isArray(obj.payments) ? obj.payments : data.payments;
      } else {
        throw new Error("bad");
      }

      saveData(data);
      refresh();
      alert("تم الاستيراد ✅");
    }catch{
      alert("فشل الاستيراد: الملف غير صالح.");
    }
  };
  reader.readAsText(file, "utf-8");
}

/* ---------- Refresh ---------- */
function refresh(){
  const data = loadData();
  const entriesView = data.entries.map(e => computeEntryView(e, data.payments));

  renderKPIs(entriesView, data.payments);
  renderEntriesTable(applyEntryFilters(entriesView));
  renderPaymentsTable(data.payments, data.entries);
}

/* ---------- Events ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setupPinGate();

  // نموذج إضافة عملية
  el("entryForm").addEventListener("submit", (ev)=>{
    ev.preventDefault();

    const { entry, firstPay } = getEntryFromForm();
    const err = validateEntry(entry);
    if(err) return alert(err);

    addEntry(entry);

    // لو في دفعة أولى (اختياري)
    if(firstPay !== null){
      if(!Number.isFinite(firstPay) || firstPay <= 0) return alert("الدفعة الأولى لازم تكون رقم أكبر من صفر أو سيبها فاضية.");
      if(firstPay > entry.total) return alert("الدفعة الأولى لا يمكن أن تتجاوز الإجمالي.");

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

  el("btnReset").addEventListener("click", resetForm);

  // فلاتر العمليات
  ["q","filterType","filterOpen"].forEach(id=>{
    el(id).addEventListener("input", refresh);
    el(id).addEventListener("change", refresh);
  });

  // فلاتر المدفوعات
  el("payQ").addEventListener("input", refresh);

  // أزرار الجدول (إضافة دفعة / حذف عملية)
  el("tbody").addEventListener("click", (ev)=>{
    const btn = ev.target.closest("button");
    if(!btn) return;
    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if(act === "del"){
      if(confirm("متأكد حذف العملية؟ (سيتم حذف المدفوعات التابعة لها أيضًا)")){
        deleteEntry(id);
        refresh();
      }
      return;
    }
    if(act === "pay"){
      openPayModal(id);
      return;
    }
  });

  // مودال الدفعات
  el("payClose").addEventListener("click", closePayModal);
  el("payModal").addEventListener("click", (ev)=>{
    if(ev.target === el("payModal")) closePayModal();
  });

  el("paySave").addEventListener("click", ()=>{
    const data = loadData();
    const entry = data.entries.find(e => e.id === CURRENT_PAY_ENTRY_ID);
    if(!entry) return closePayModal();

    const date = (el("payDate").value || "").trim();
    const amount = el("payAmount").value === "" ? null : Number(el("payAmount").value);
    const note = (el("payNote").value || "").trim();

    if(!date || amount === null || !Number.isFinite(amount) || amount <= 0){
      el("payError").hidden = false;
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

  // حذف دفعة من جدول المدفوعات
  el("payTbody").addEventListener("click", (ev)=>{
    const btn = ev.target.closest("button");
    if(!btn) return;
    const payId = btn.dataset.paydel;
    if(!payId) return;

    if(confirm("متأكد حذف الدفعة؟")){
      deletePayment(payId);
      refresh();
    }
  });

  // حذف كل البيانات
  el("btnClearAll").addEventListener("click", ()=>{
    if(confirm("تحذير: سيتم حذف كل البيانات نهائيًا من هذا الجهاز. هل أنت متأكد؟")){
      localStorage.removeItem(LS_KEY);
      refresh();
      alert("تم الحذف ✅");
    }
  });

  // تصدير/استيراد
  el("btnExport").addEventListener("click", ()=> exportJSON(loadData()));
  el("btnPaymentsExport").addEventListener("click", exportPaymentsOnly);

  el("fileImport").addEventListener("change", (ev)=>{
    const f = ev.target.files?.[0];
    if(f) importJSON(f);
    ev.target.value = "";
  });

  // طباعة
  el("btnPrint").addEventListener("click", ()=> window.print());

  // كشف حساب
  el("btnLedger").addEventListener("click", ()=> showLedger(el("ledgerName").value));
});
