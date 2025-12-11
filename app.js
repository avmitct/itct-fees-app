// ================= Helper $ & supabase =================
function $(id) { return document.getElementById(id); }
const supa = window.supabaseClient;

// ============== State =================
let currentUser = null;
let courses = [];
let students = [];
let enquiries = [];
let fees = [];
let users = [];
let lastReportRows = [];

// ============== Utilities =================
function calcAgeFromDob(dobStr) {
  if (!dobStr) return "";
  const d = new Date(dobStr);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : "";
}

function validateMobile(m) {
  if (!m) return { ok: false, msg: "मोबाईल आवश्यक आहे" };
  const digits = m.replace(/\D/g, "");
  if (digits.length !== 10) return { ok: false, msg: "Mobile number 10 digits असावा" };
  return { ok: true, value: digits };
}

function validateMobiles(m1, m2) {
  const d1 = m1 ? m1.replace(/\D/g, "") : "";
  const d2 = m2 ? m2.replace(/\D/g, "") : "";
  if (!d1 && !d2) return { ok: false, msg: "किमान एक मोबाईल नंबर भरा" };
  if (d1 && d1.length !== 10) return { ok: false, msg: "Mobile 1 10 digits असावा" };
  if (d2 && d2.length !== 10) return { ok: false, msg: "Mobile 2 10 digits असावा" };
  return { ok: true, m1: d1, m2: d2 };
}

function isAdmin() { return currentUser && currentUser.role === "admin"; }
function applyRoleUI() {
  const adminButtons = ["manage-courses-btn","settings-btn","backup-btn"];
  adminButtons.forEach(id => {
    const el = $(id); if (!el) return;
    if (isAdmin()) el.classList.remove("hidden"); else el.classList.add("hidden");
  });
}

// ============== Show Sections =================
function showSection(sectionId) {
  const ids = ["dashboard-section","courses-section","student-form","enquiry-section",
    "students-list","reports-section","settings-section","backup-section"];
  ids.forEach(id => {
    const el = $(id); if (!el) return;
    if (id === sectionId) el.classList.remove("hidden"); else el.classList.add("hidden");
  });
}

// ============== Supabase Loaders =================
async function loadCourses(){ const {data,error}=await supa.from("courses").select("*").order("name"); if(error){console.error(error);courses=[];}else courses=data||[];}
async function loadStudents(){ const {data,error}=await supa.from("students").select("*").order("name"); if(error){console.error(error);students=[];}else students=data||[];}
async function loadEnquiries(){ const {data,error}=await supa.from("enquiries").select("*").order("created_at",{ascending:false}); if(error){console.error(error);enquiries=[];}else enquiries=data||[];}
async function loadFees(){ const {data,error}=await supa.from("fees").select("*").order("date",{ascending:false}); if(error){console.error(error);fees=[];}else fees=data||[];}
async function loadUsers(){ const {data,error}=await supa.from("users").select("*").order("username",{ascending:true}); if(error){console.error(error);users=[];}else users=data||[];}

// ============== Renderers =================
function renderCourses(){
  const list=$("courses-list"), csSel=$("course-select"), enqSel=$("enq-course-select"), repSel=$("report-course");
  if(list) list.innerHTML=""; if(csSel) csSel.innerHTML=""; if(enqSel) enqSel.innerHTML=""; if(repSel) repSel.innerHTML=`<option value="">-- सर्व कोर्स --</option>`;
  courses.forEach(c=>{
    if(list){const li=document.createElement("li"); li.textContent=`${c.name} – ₹${c.fee||0}`; list.appendChild(li);}
    if(csSel){const opt=document.createElement("option"); opt.value=c.id; opt.textContent=`${c.name} (₹${c.fee||0})`; csSel.appendChild(opt);}
    if(enqSel){const opt2=document.createElement("option"); opt2.value=c.name; opt2.textContent=c.name; enqSel.appendChild(opt2);}
    if(repSel){const opt3=document.createElement("option"); opt3.value=c.name; opt3.textContent=c.name; repSel.appendChild(opt3);}
  });
}

// ---------- Render students with paid/discount/balance and buttons ----------
async function renderStudents(){
  const ul = $("list");
  if(!ul) return;
  const search = ($("search") ? $("search").value.trim().toLowerCase() : "");
  ul.innerHTML = "";

  // Ensure fees are loaded if you maintain a local fees array (optional)
  // await loadFees(); // uncomment if you rely on a cached fees[] array

  // Filter students by search
  const visible = students.filter(s=>{
    if(!search) return true;
    const hay = [s.name, s.mobile, s.mobile2, s.course_name].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(search);
  });

  for(const s of visible){
    // calculate paid & discount by querying fees table for this student
    // (we do it per student — fine for moderate sized lists; can optimize by pre-aggregating)
    const feeRows = await getFeesForStudent(s.id);

    const totalPaid = feeRows.reduce((acc,r)=> acc + (Number(r.amount||0)), 0);
    const totalDiscount = feeRows.reduce((acc,r)=> acc + (Number(r.discount||0)), 0);
    const studentTotalFee = Number(s.total_fee || s.course_fee || s.course_amount || 0); // adjust to your schema field

    const balance = Math.max(0, studentTotalFee - totalPaid - totalDiscount);

    // build item
    const li = document.createElement("li");
    li.className = "student-item";

    li.innerHTML = `
      <div class="info">
        <strong class="s-name">${escapeHtml(s.name || "-")}</strong>
        <div class="s-meta">
          ${escapeHtml(s.course_name || "")} ${s.course_due_date ? `| Due: ${s.course_due_date}` : ""} <br>
          Mobile: ${escapeHtml(s.mobile || "-")}${s.mobile2 ? " / "+escapeHtml(s.mobile2):""}
        </div>
        <div style="margin-top:6px; font-size:0.9rem; color:var(--muted);">
          Fee: ₹${studentTotalFee.toFixed(2)} | Paid: ₹${totalPaid.toFixed(2)} | Discount: ₹${totalDiscount.toFixed(2)} | <strong>Balance: ₹${balance.toFixed(2)}</strong>
        </div>
      </div>
      <div class="actions" style="display:flex;flex-direction:column;gap:6px;">
        <button class="pay-btn">${"फीस भरा"}</button>
        <button class="view-btn">पहा</button>
        <button class="delete-btn admin-only">हटवा</button>
      </div>
    `;

    // hook actions
    const payBtn = li.querySelector(".pay-btn");
    if(payBtn) payBtn.addEventListener("click", ()=> openFeesModal(s)); // use your existing modal

    const viewBtn = li.querySelector(".view-btn");
    if(viewBtn) viewBtn.addEventListener("click", ()=> showStudentFeesHistory(s.id));
// ---------- Get fees rows for a student ----------
async function getFeesForStudent(studentId){
  try{
    // Query Supabase fees table for this student
    const { data, error } = await (window.supabaseClient || supabase).from("fees")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false });

    if(error){
      console.error("Error fetching fees for student", studentId, error);
      return [];
    }
    return data || [];
  }catch(err){
    console.error("Exception fetching fees for student", err);
    return [];
  }
}

// ---------- Show fee history modal for a student ----------
async function showStudentFeesHistory(studentId){
  const s = students.find(x => x.id === studentId);
  if(!s){
    alert("Student not found");
    return;
  }

  const feeRows = await getFeesForStudent(studentId);

  // Build modal UI (uses #modal container from earlier)
  let modal = document.getElementById("modal");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "modal";
    document.body.appendChild(modal);
  }
  modal.classList.remove("hidden");
  modal.innerHTML = "";

  const card = document.createElement("div");
  card.className = "modal-card";

  const rowsHtml = feeRows.length ? feeRows.map(f=>{
    const dt = (f.date||"").slice(0,10);
    return `<div style="padding:8px;border-radius:8px;margin-bottom:6px;background:#fff;border:1px solid rgba(120,80,180,0.04)">
              <div><strong>₹${Number(f.amount||0).toFixed(2)}</strong>  <small style="color:var(--muted)">(${dt})</small></div>
              <div style="font-size:0.85rem;color:var(--muted)">Discount: ₹${Number(f.discount||0).toFixed(2)} ${f.receipt_no ? '| Receipt: ' + escapeHtml(f.receipt_no) : ''}</div>
            </div>`;
  }).join("") : `<div>No fee records found.</div>`;

  card.innerHTML = `
    <h3>Fees — ${escapeHtml(s.name || "")}</h3>
    <div style="margin:6px 0 12px 0; color:var(--muted)">Total fee: ₹${Number(s.total_fee || s.course_fee || 0).toFixed(2)}</div>
    <div>${rowsHtml}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button id="modal-fees-add" class="btn-primary">Add Fees</button>
      <button id="modal-close" class="btn-small secondary">Close</button>
    </div>
  `;

  modal.appendChild(card);

  // events
  document.getElementById("modal-close").addEventListener("click", ()=>{
    modal.classList.add("hidden");
    modal.innerHTML = "";
  });

  document.getElementById("modal-fees-add").addEventListener("click", ()=>{
    modal.classList.add("hidden"); modal.innerHTML = "";
    // open the existing fees modal for adding payment
    if(typeof openFeesModal === "function") openFeesModal(s);
    else alert("Fees modal not found");
  });
}

    const delBtn = li.querySelector(".delete-btn");
    if(delBtn){
      if(isAdmin()) delBtn.classList.remove("hidden"); else delBtn.classList.add("hidden");
      delBtn.addEventListener("click", ()=> deleteStudent(s.id));
    }

    ul.appendChild(li);
  }
}


function renderEnquiries(){
  const list=$("enquiry-list"); if(!list) return; list.innerHTML="";
  enquiries.forEach(e=>{
    const li=document.createElement("li");
    const d=(e.created_at||"").slice(0,10);
    const courseName = e.course_name || e.course || "-";
    li.innerHTML = `
      <div>
        <strong>${e.name}</strong><br>
        ${e.mobile||"-"}${e.mobile2? " / " + e.mobile2 : ""}<br>
        <span style="color:#7b6a8c;font-size:0.75rem;">${courseName} | Age: ${e.age || "-" } ${d ? '| ' + d : ''}</span>
      </div>
      <div class="actions">
        <button class="success" title="Send WhatsApp" onclick="sendEnquiryWhatsApp('${e.id}','auto')"><i class="ri-whatsapp-line"></i></button>
        <button class="secondary" title="Convert to Admission" onclick="convertEnquiry('${e.id}')"><i class="ri-user-add-line"></i></button>
        <button class="danger" title="Delete" onclick="deleteEnquiry('${e.id}')"><i class="ri-delete-bin-line"></i></button>
      </div>
    `;
    list.appendChild(li);
  });
}

function renderUsers(){
  const ul=$("users-list"); if(!ul) return; ul.innerHTML="";
  users.forEach(u=>{
    const li=document.createElement("li"); li.textContent = `${u.username} (${u.role||'data-entry'})`;
    if(u.username !== "admin"){
      const btn=document.createElement("button"); btn.className="danger"; btn.textContent="Delete"; btn.addEventListener("click",()=>deleteUser(u.id));
      li.appendChild(btn);
    }
    ul.appendChild(li);
  });
}

function renderDashboard(){
  $("dash-total-students").textContent = `Total students: ${students.length}`;
  const totalFee = students.reduce((s,v)=> s + (v.total_fee||v.course_fee||0), 0);
  const totalPaid = fees.reduce((s,v)=> s + (v.amount||0), 0);
  const totalDiscount = fees.reduce((s,v)=> s + (v.discount||0), 0);
  const balance = totalFee - totalPaid - totalDiscount;
  $("dash-total-fee").textContent = `Total course fee: ₹${totalFee}`;
  $("dash-total-paid").textContent = `Total paid: ₹${totalPaid}`;
  $("dash-total-discount").textContent = `Total discount: ₹${totalDiscount}`;
  $("dash-total-balance").textContent = `Total balance: ₹${balance}`;
}

// ============== Students CRUD =================
async function saveStudent(){
  const name = $("name").value.trim();
  const dob = $("dob").value || null;
  const ageVal = $("age").value.trim();
  const addr = $("address").value.trim();
  const m1 = $("mobile").value.trim();
  const m2 = $("mobile2").value.trim();
  const courseId = $("course-select").value;
  const dueDate = $("course-duedate").value;

  if(!name){ alert("नाव आवश्यक आहे"); return; }
  const mobCheck = validateMobiles(m1,m2); if(!mobCheck.ok){ alert(mobCheck.msg); return; }
  const course = courses.find(c=> String(c.id) === String(courseId));
  const totalFee = course ? Number(course.fee || 0) : 0;

  const payload = {
    name, dob, age: ageVal? Number(ageVal): null,
    address: addr, mobile: mobCheck.m1||"", mobile2: mobCheck.m2||"",
    course_id: course? course.id : null, course_name: course? course.name : "",
    course_due_date: dueDate || null, total_fee: totalFee
  };

  const { data, error } = await supa.from("students").insert(payload).select().single();
  if(error){ console.error(error); alert("Student save करताना त्रुटी"); return; }
  students.unshift(data);
  clearStudentForm(); renderStudents(); renderDashboard(); showSection("students-list");
}

function clearStudentForm(){ ["name","dob","age","address","mobile","mobile2","course-duedate"].forEach(id=>{ const el=$(id); if(el) el.value=""; }); if($("course-select")) $("course-select").selectedIndex=0; }

async function deleteStudent(id){ if(!confirm("हा विद्यार्थी delete करायचा आहे?")) return; const { error } = await supa.from("students").delete().eq("id", id); if(error){console.error(error); alert("Delete error"); return;} students = students.filter(s=> s.id !== id); renderStudents(); renderDashboard(); }

// placeholders
// Replace your existing openFeesModal function with this one.
async function openFeesModal(student) {
  // get supabase client (support different var names)
  const supaClient = window.supabaseClient || window.supa || (window.supabase && window.supabase.createClient && window.supabase) || null;
  if (!supaClient) {
    alert("Supabase client उपलब्ध नाही. console मध्ये तपासा.");
    console.error("Supabase client not found as window.supabaseClient / window.supa / window.supabase");
    return;
  }

  // modal container (index.html मध्ये #modal असावे)
  let modal = document.getElementById("modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal";
    document.body.appendChild(modal);
  }
  modal.classList.remove("hidden");
  modal.innerHTML = "";

  // build modal content
  const card = document.createElement("div");
  card.className = "modal-card";

  card.innerHTML = `
    <h3>Fees Entry — ${escapeHtml(student.name || "")}</h3>
    <div style="margin:8px 0;">
      <label>Amount (₹)</label>
      <input id="modal-fees-amount" type="number" step="0.01" placeholder="Amount" class="input">
    </div>
    <div style="margin:8px 0;">
      <label>Discount (₹) — optional</label>
      <input id="modal-fees-discount" type="number" step="0.01" placeholder="Discount" class="input">
    </div>
    <div style="margin:8px 0;">
      <label>Receipt No (optional)</label>
      <input id="modal-fees-receipt" type="text" placeholder="Receipt No" class="input">
    </div>
    <div style="margin:8px 0;">
      <label>Date</label>
      <input id="modal-fees-date" type="date" class="input" value="${(new Date()).toISOString().slice(0,10)}">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
      <button id="modal-fees-save" class="btn-primary">Save</button>
      <button id="modal-fees-cancel" class="btn-small secondary">Cancel</button>
    </div>
  `;

  modal.appendChild(card);

  // helpers
  function closeModal() {
    modal.classList.add("hidden");
    modal.innerHTML = "";
  }
  function numericVal(id) {
    const v = (document.getElementById(id) || {}).value;
    return v ? Number(v) : 0;
  }

  // event handlers
  document.getElementById("modal-fees-cancel").addEventListener("click", closeModal);

  document.getElementById("modal-fees-save").addEventListener("click", async () => {
    const amount = numericVal("modal-fees-amount");
    const discount = numericVal("modal-fees-discount");
    const receipt = (document.getElementById("modal-fees-receipt") || {}).value.trim();
    const date = (document.getElementById("modal-fees-date") || {}).value;

    if (!amount || amount <= 0) {
      alert("कृपया वैध रक्कम भरा (Amount > 0).");
      return;
    }

    // prepare record for 'fees' table
    const payload = {
      student_id: student.id || null,
      student_name: student.name || "",
      amount: amount,
      discount: discount || 0,
      receipt_no: receipt || null,
      date: date || new Date().toISOString().slice(0,10),
      created_by: (window.currentUser && window.currentUser.username) || (student.created_by || null)
    };

    // insert into Supabase
    try {
      const { data, error } = await supaClient.from("fees").insert([payload]).select().single();
      if (error) {
        console.error("Fees insert error:", error);
        alert("Fees save करताना त्रुटी. Console तपासा.");
        return;
      }

      // Optionally update student's paid/balance fields (if your schema has those fields)
      // Example: increment paid sum (uncomment if you maintain student.paid_total field)
      // await supaClient.from('students').update({ paid_total: student.paid_total + amount }).eq('id', student.id);

      alert("Fees saved successfully.");
      closeModal();

      // refresh local data lists on UI (call your existing loaders)
      if (typeof loadFees === "function") await loadFees();
      if (typeof loadStudents === "function") await loadStudents();
      if (typeof renderStudents === "function") renderStudents();
      if (typeof renderDashboard === "function") renderDashboard();

    } catch (err) {
      console.error("Exception while saving fees:", err);
      alert("Unexpected error while saving fees. Console तपासा.");
    }
  });

  // focus on amount
  setTimeout(()=> {
    const el = document.getElementById("modal-fees-amount");
    if (el) el.focus();
  }, 100);
}

// small helper to escape HTML (prevent XSS when injecting name)
function escapeHtml(str) {
  if(!str) return "";
  return String(str).replace(/[&<>"']/g, function(m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}

function viewStudentDetails(student){ alert(`Student: ${student.name}\nCourse: ${student.course_name||""}\nMobile: ${student.mobile}`); }

// ============== Enquiry CRUD & Buttons =================
async function saveEnquiry(){
  const name = $("enq-name").value.trim();
  const dob = $("enq-dob").value || null;
  const m1 = $("enq-mobile").value.trim();
  const m2 = $("enq-mobile2").value.trim();
  const courseName = $("enq-course-select").value;

  if(!name || !courseName){ alert("नाव आणि course निवडणे आवश्यक आहे"); return; }
  const mobCheck = validateMobiles(m1,m2); if(!mobCheck.ok){ alert(mobCheck.msg); return; }
  const ageComputed = calcAgeFromDob(dob);

  const payload = { name, dob, age: ageComputed===""? null: Number(ageComputed), mobile: mobCheck.m1||"", mobile2: mobCheck.m2||"", course_name: courseName };
  const { data, error } = await supa.from("enquiries").insert(payload).select().single();
  if(error){ console.error(error); alert("Enquiry save करताना त्रुटी"); return; }
  enquiries.unshift(data); clearEnquiryForm(); renderEnquiries();
}
function clearEnquiryForm(){ ["enq-name","enq-dob","enq-age","enq-mobile","enq-mobile2"].forEach(id=>{ const el=$(id); if(el) el.value=""; }); if($("enq-course-select")) $("enq-course-select").selectedIndex=0; }

async function deleteEnquiry(id){ if(!confirm("ही enquiry delete करायची?")) return; const { error } = await supa.from("enquiries").delete().eq("id", id); if(error){ console.error(error); alert("Error deleting enquiry"); return; } enquiries = enquiries.filter(e=> e.id !== id); renderEnquiries(); }

window.convertEnquiry = async function(id){
  const e = enquiries.find(x=> x.id === id); if(!e) return; if(!confirm("ही enquiry admission मध्ये convert करायची?")) return;
  const mobCheck = validateMobiles(e.mobile, e.mobile2); if(!mobCheck.ok){ alert("मोबाईल नंबर चुकिचे आहेत, कृपया enquiry edit करा."); return; }
  const master = courses.find(c=> c.name === e.course_name); const totalFee = master ? Number(master.fee) : 0;
  const payload = { name: e.name, dob: e.dob||null, age: e.age?Number(e.age):null, address:"", mobile: mobCheck.m1||"", mobile2: mobCheck.m2||"", course_name: e.course_name, total_fee: totalFee, due_date: null };
  const { data, error } = await supa.from("students").insert(payload).select().single();
  if(error){ console.error(error); alert("Admission create करताना त्रुटी"); return; }
  students.unshift(data);
  const { error: delErr } = await supa.from("enquiries").delete().eq("id", id);
  if(delErr) console.error(delErr);
  enquiries = enquiries.filter(x=> x.id !== id);
  renderStudents(); renderEnquiries(); renderDashboard(); showSection("students-list"); alert("Enquiry admission मध्ये बदलली.");
}

// ============== Reports basic =================
function generatePaymentReport(){ $("report-output").innerHTML = "<div>Payment report - placeholder</div>"; lastReportRows = []; }
function generateBalanceReport(){ $("report-output").innerHTML = "<div>Balance report - placeholder</div>"; lastReportRows = []; }
function generateDueReport(){ $("report-output").innerHTML = "<div>Due report - placeholder</div>"; lastReportRows = []; }

function generateEnquiryReport(){
  const course = $("report-course").value;
  const from = $("report-from").value;
  const to = $("report-to").value;
  const rows = enquiries.filter(e=>{
    const c = e.course_name || e.course || "";
    if(course && c !== course) return false;
    const d = (e.created_at||"").slice(0,10);
    if(from && d < from) return false;
    if(to && d > to) return false;
    return true;
  }).map(e=>({ type:"enquiry", date:(e.created_at||"").slice(0,10), student:e.name, course:e.course_name||e.course||"", age:e.age||"", mobile1:e.mobile||"", mobile2:e.mobile2||"" }));
  lastReportRows = rows;
  $("report-output").innerHTML = rows.length ? rows.map(r=> `<div>${r.date} — ${r.student} (${r.course}) — Age: ${r.age} — Mob1: ${r.mobile1||"-"} / Mob2: ${r.mobile2||"-"}</div>`).join("") : "<div>No enquiry records</div>";
}

function exportCSV(){
  if(!lastReportRows || lastReportRows.length===0){ alert("Report आधी तयार करा"); return; }
  let header="";
  const rows = lastReportRows;
  if(rows[0].type==="enquiry") header="Date,Student,Course,Age,Mobile1,Mobile2";
  else header="Row";
  const csvLines=[header];
  rows.forEach(r=>{
    if(r.type==="enquiry") csvLines.push(`${r.date},"${r.student}","${r.course}",${r.age},"${r.mobile1}","${r.mobile2}"`);
    else csvLines.push(`"${JSON.stringify(r).replace(/"/g,'""')}"`);
  });
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "report.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ============== Backup helpers =================
function downloadCSVFile(filename, rows){ const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
function backupStudents(){ const rows=["ID,Name,Course,Mobile,Mobile2"]; students.forEach(s=> rows.push(`${s.id},"${s.name}","${s.course_name||""}","${s.mobile||""}","${s.mobile2||""}"`)); downloadCSVFile("students.csv", rows); }
function backupFees(){ const rows=["ID,StudentID,Amount,Discount,Date"]; fees.forEach(f=> rows.push(`${f.id},${f.student_id},${f.amount||0},${f.discount||0},"${(f.date||"").slice(0,10)}"`)); downloadCSVFile("fees.csv", rows); }
function backupCourses(){ const rows=["ID,Name,Fee"]; courses.forEach(c=> rows.push(`${c.id},"${c.name}",${c.fee||0}`)); downloadCSVFile("courses.csv", rows); }

// ============== Users & Settings =================
async function changeAdminPassword(){
  const newPass = $("new-pass").value.trim(); if(!newPass){ alert("नवीन password भरा"); return; }
  const { error } = await supa.from("users").update({ password: newPass }).eq("username","admin");
  if(error){ console.error(error); alert("Password update error"); return; } alert("Admin password बदलला"); $("new-pass").value="";
}
async function addUser(){ const uname=$("new-user-username").value.trim(); const pwd=$("new-user-password").value.trim(); const role=$("new-user-role").value; if(!uname||!pwd){ alert("Username आणि Password दोन्ही आवश्यक"); return; } const { data, error } = await supa.from("users").insert({ username: uname, password: pwd, role }).select().single(); if(error){ console.error(error); alert("User add करताना त्रुटी"); return; } users.push(data); renderUsers(); $("new-user-username").value=""; $("new-user-password").value=""; }
async function deleteUser(id){ if(!confirm("User delete करायचा आहे?")) return; const { error } = await supa.from("users").delete().eq("id", id); if(error){ console.error(error); alert("User delete error"); return; } users = users.filter(u=> u.id !== id); renderUsers(); }

// ============== WhatsApp Templates & Auto-followup ==============
const WA_SETTINGS_KEY = 'itct-wa-enquiry-settings';
const DEFAULT_WA_SETTINGS = {
  instituteName: 'ITCT Computer Education, Nandurbar',
  initialTemplate:
`नमस्कार {NAME},
आपण {COURSE} कोर्स बद्दल ITCT Computer Education, Nandurbar येथे enquiry केली होती.
आपल्याला अजून काही माहिती हवी असल्यास जरूर सांगा.`,
  followupTemplate:
`नमस्कार {NAME},
आपल्या {COURSE} कोर्स बाबतच्या enquiry चा follow-up करत आहे.
आपण admission बद्दल निर्णय घेतला का? काही शंका असल्यास मला कळवा.`,
  initialDays: 0,
  followupDays: 3
};

function loadWaSettings(){ try{ const raw=localStorage.getItem(WA_SETTINGS_KEY); if(!raw) return {...DEFAULT_WA_SETTINGS}; const parsed=JSON.parse(raw); return {...DEFAULT_WA_SETTINGS, ...parsed}; }catch{ return {...DEFAULT_WA_SETTINGS}; } }
function saveWaSettingsToStorage(settings){ localStorage.setItem(WA_SETTINGS_KEY, JSON.stringify(settings)); }

function initWaSettingsUI(){
  const s = loadWaSettings();
  const inst = $('wa-inst-name'); const t1 = $('wa-tpl-initial'); const t2 = $('wa-tpl-followup'); const d1 = $('wa-initial-days'); const d2 = $('wa-followup-days'); const btn = $('wa-save-settings');
  if(inst) inst.value = s.instituteName; if(t1) t1.value = s.initialTemplate; if(t2) t2.value = s.followupTemplate; if(d1) d1.value = s.initialDays; if(d2) d2.value = s.followupDays;
  if(btn) btn.addEventListener('click', ()=>{ const updated = { instituteName: inst? inst.value.trim() || DEFAULT_WA_SETTINGS.instituteName : DEFAULT_WA_SETTINGS.instituteName, initialTemplate: t1? (t1.value.trim()||DEFAULT_WA_SETTINGS.initialTemplate) : DEFAULT_WA_SETTINGS.initialTemplate, followupTemplate: t2? (t2.value.trim()||DEFAULT_WA_SETTINGS.followupTemplate) : DEFAULT_WA_SETTINGS.followupTemplate, initialDays: d1? Number(d1.value||0) : 0, followupDays: d2? Number(d2.value||3) : 3 }; saveWaSettingsToStorage(updated); alert('WhatsApp settings जतन झाले.'); });
}

function fillTemplate(tpl, enquiry, settings){
  const mobile = enquiry.mobile || enquiry.mobile2 || '';
  return tpl.replace(/\{NAME\}/gi, enquiry.name || '')
            .replace(/\{COURSE\}/gi, enquiry.course_name || enquiry.course || '')
            .replace(/\{AGE\}/gi, (enquiry.age || '').toString())
            .replace(/\{MOBILE\}/gi, mobile)
            .replace(/\{INSTITUTE\}/gi, settings.instituteName || DEFAULT_WA_SETTINGS.instituteName);
}

function normalizeMobile(m){
  if(!m) return '';
  let s = m.replace(/\D/g,'');
  if(s.startsWith('91') && s.length === 12) s = s.slice(2);
  if(s.length === 10) return s;
  return s;
}

window.sendEnquiryWhatsApp = function(id, mode = 'auto'){
  const e = enquiries.find(x=> x.id === id); if(!e){ alert("Enquiry सापडली नाही"); return; }
  const settings = loadWaSettings();
  const created = e.created_at ? new Date(e.created_at) : new Date();
  const today = new Date(); const diffDays = Math.floor((today - created) / (1000*60*60*24));
  let tpl;
  if(mode === 'initial') tpl = settings.initialTemplate;
  else if(mode === 'followup') tpl = settings.followupTemplate;
  else { if(diffDays >= settings.followupDays) tpl = settings.followupTemplate; else tpl = settings.initialTemplate; }
  const msg = fillTemplate(tpl, e, settings);
  const mobile = normalizeMobile(e.mobile || e.mobile2);
  if(!mobile){ alert('मोबाईल नंबर उपलब्ध नाही.'); return; }
  const url = 'https://wa.me/91' + mobile + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
};

// ============== Refresh all =================
async function refreshAllData(){
  await Promise.all([loadCourses(), loadStudents(), loadEnquiries(), loadFees(), loadUsers()]);
  renderCourses(); renderStudents(); renderEnquiries(); renderUsers(); renderDashboard();
}

// ============== DOM INIT =================
document.addEventListener('DOMContentLoaded', async ()=> {
  // Buttons & nav
  $("login-btn").addEventListener("click", handleLogin);
  $("logout-btn").addEventListener("click", handleLogout);
  $("dashboard-btn").addEventListener("click", ()=>{ showSection("dashboard-section"); renderDashboard(); });
  $("manage-courses-btn").addEventListener("click", ()=> showSection("courses-section"));
  $("add-student-btn").addEventListener("click", ()=> showSection("student-form"));
  $("enquiry-btn").addEventListener("click", ()=> showSection("enquiry-section"));
  $("students-list-btn").addEventListener("click", ()=> showSection("students-list"));
  $("reports-btn").addEventListener("click", ()=> showSection("reports-section"));
  $("settings-btn").addEventListener("click", ()=> showSection("settings-section"));
  $("backup-btn").addEventListener("click", ()=> showSection("backup-section"));

  // Student
  $("save-student-btn").addEventListener("click", saveStudent);
  $("cancel-student-btn").addEventListener("click", ()=>{ clearStudentForm(); showSection("students-list"); });
  const dobInput = $("dob"); if(dobInput){ dobInput.addEventListener("change", ()=>{ $("age").value = String(calcAgeFromDob(dobInput.value)||""); }); }

  // Enquiry
  $("save-enquiry-btn").addEventListener("click", saveEnquiry);
  $("clear-enquiry-btn").addEventListener("click", clearEnquiryForm);
  const enqDob = $("enq-dob"); if(enqDob){ const fn = ()=>{ const a = calcAgeFromDob(enqDob.value); if($("enq-age")) $("enq-age").value = a; }; enqDob.addEventListener("change", fn); enqDob.addEventListener("blur", fn); }
  $("enq-search").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = enquiries.filter(en => { const hay = [en.name, en.mobile, en.mobile2, en.course_name].filter(Boolean).join(" ").toLowerCase(); return hay.includes(q); });
    // quick render
    const list=$("enquiry-list"); if(!list) return; list.innerHTML=""; filtered.forEach(en=>{
      const li=document.createElement("li"); const d=(en.created_at||"").slice(0,10); const courseName = en.course_name || "-";
      li.innerHTML = `<div><strong>${en.name}</strong><br>${en.mobile||"-"}${en.mobile2? " / " + en.mobile2 : ""}<br><span style="color:#7b6a8c;font-size:0.75rem;">${courseName} | Age: ${en.age || "-" } ${d ? '| ' + d : ''}</span></div><div class="actions"><button class="success" onclick="sendEnquiryWhatsApp('${en.id}','auto')"><i class="ri-whatsapp-line"></i></button><button class="secondary" onclick="convertEnquiry('${en.id}')"><i class="ri-user-add-line"></i></button><button class="danger" onclick="deleteEnquiry('${en.id}')"><i class="ri-delete-bin-line"></i></button></div>`; list.appendChild(li);
    });
  });

  // Reports
  $("generate-payment-report").addEventListener("click", generatePaymentReport);
  $("generate-balance-report").addEventListener("click", generateBalanceReport);
  $("generate-due-report").addEventListener("click", generateDueReport);
  $("generate-enquiry-report").addEventListener("click", generateEnquiryReport);
  $("export-csv").addEventListener("click", exportCSV);

  // Backup
  $("backup-students").addEventListener("click", backupStudents);
  $("backup-fees").addEventListener("click", backupFees);
  $("backup-courses").addEventListener("click", backupCourses);

  // Settings
  $("change-pass-btn").addEventListener("click", changeAdminPassword);
  $("add-user-btn").addEventListener("click", addUser);

  // Try auto-login from localStorage
  const cached = localStorage.getItem("itct_current_user");
  if(cached){ try{ currentUser = JSON.parse(cached); $("current-user-name").textContent = currentUser.username; $("current-user-role").textContent = currentUser.role; $("login-section").classList.add("hidden"); $("app-section").classList.remove("hidden"); applyRoleUI(); await refreshAllData(); showSection("dashboard-section"); }catch(e){ console.error(e); localStorage.removeItem("itct_current_user"); } }

  // init WhatsApp settings UI
  initWaSettingsUI();
});

// ============== Login / Logout (simple username/password against users table) =================
async function handleLogin(){
  const username = $("login-username").value.trim(); const password = $("login-password").value.trim();
  if(!username || !password){ alert("Username आणि Password दोन्ही आवश्यक आहेत"); return; }
  const { data, error } = await supa.from("users").select("*").eq("username", username).eq("password", password).maybeSingle();
  if(error){ console.error(error); alert("Login error (server)"); return; }
  if(!data){ alert("Invalid username / password"); return; }
  currentUser = { id: data.id, username: data.username, role: data.role || "data-entry" };
  localStorage.setItem("itct_current_user", JSON.stringify(currentUser));
  $("current-user-name").textContent = currentUser.username; $("current-user-role").textContent = currentUser.role;
  $("login-section").classList.add("hidden"); $("app-section").classList.remove("hidden");
  applyRoleUI(); await refreshAllData(); showSection("dashboard-section");
}
function handleLogout(){ currentUser = null; localStorage.removeItem("itct_current_user"); $("app-section").classList.add("hidden"); $("login-section").classList.remove("hidden"); }
