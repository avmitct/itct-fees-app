// ==================================================
// PART 1 : GLOBALS, HELPERS, LOGIN, ROLES, NAVIGATION
// ==================================================

// ---------- Helper ----------
function $(id) {
  return document.getElementById(id);
}

// ---------- Supabase Client ----------
const supa = window.supabaseClient;

// ---------- Global State ----------
let currentUser = null;
let courses = [];
let students = [];
let enquiries = [];
let fees = [];
let users = [];
let lastReportRows = [];

// ---------- Utilities ----------
function calcAgeFromDob(dobStr) {
  if (!dobStr) return "";
  const d = new Date(dobStr);
  if (Number.isNaN(d.getTime())) return "";
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  if (
    t.getMonth() < d.getMonth() ||
    (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())
  ) age--;
  return age >= 0 ? age : "";
}

function validateMobiles(m1, m2) {
  const d1 = (m1 || "").replace(/\D/g, "");
  const d2 = (m2 || "").replace(/\D/g, "");
  if (!d1 && !d2)
    return { ok: false, msg: "किमान एक मोबाईल नंबर आवश्यक आहे" };
  if (d1 && d1.length !== 10)
    return { ok: false, msg: "Mobile 1 10 digits असावा" };
  if (d2 && d2.length !== 10)
    return { ok: false, msg: "Mobile 2 10 digits असावा" };
  return { ok: true, m1: d1, m2: d2 };
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[m]);
}

// ---------- Role Helpers ----------
function isAdmin() {
  return currentUser && currentUser.role === "admin";
}

function applyRoleUI() {
  const adminOnly = [
    "manage-courses-btn",
    "settings-btn",
    "backup-btn"
  ];
  adminOnly.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (isAdmin()) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

// ---------- Section Navigation ----------
function showSection(sectionId) {
  const sections = [
    "dashboard-section",
    "courses-section",
    "student-form",
    "enquiry-section",
    "students-list",
    "reports-section",
    "settings-section",
    "backup-section"
  ];
  sections.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (id === sectionId) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

// ==================================================
// LOGIN / LOGOUT
// ==================================================

async function handleLogin() {
  if (!supa) {
    alert("Supabase client उपलब्ध नाही");
    return;
  }

  const username = ($("login-username") || {}).value?.trim() || "";
  const password = ($("login-password") || {}).value?.trim() || "";

  if (!username || !password) {
    alert("Username आणि Password आवश्यक आहेत");
    return;
  }

  const { data, error } = await supa
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .maybeSingle();

  if (error) {
    console.error(error);
    alert("Login error");
    return;
  }

  if (!data) {
    alert("Invalid username / password");
    return;
  }

  currentUser = {
    id: data.id,
    username: data.username,
    role: data.role || "data-entry"
  };

  localStorage.setItem("itct_current_user", JSON.stringify(currentUser));

  if ($("current-user-name"))
    $("current-user-name").textContent = currentUser.username;
  if ($("current-user-role"))
    $("current-user-role").textContent = currentUser.role;

  if ($("login-section")) $("login-section").classList.add("hidden");
  if ($("app-section")) $("app-section").classList.remove("hidden");

  applyRoleUI();
  showSection("dashboard-section");
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem("itct_current_user");

  if ($("app-section")) $("app-section").classList.add("hidden");
  if ($("login-section")) $("login-section").classList.remove("hidden");
}

// ==================================================
// AUTO LOGIN (LOCAL STORAGE)
// ==================================================

function tryAutoLogin() {
  const raw = localStorage.getItem("itct_current_user");
  if (!raw) return;

  try {
    currentUser = JSON.parse(raw);
    if ($("current-user-name"))
      $("current-user-name").textContent = currentUser.username;
    if ($("current-user-role"))
      $("current-user-role").textContent = currentUser.role;

    if ($("login-section")) $("login-section").classList.add("hidden");
    if ($("app-section")) $("app-section").classList.remove("hidden");

    applyRoleUI();
    showSection("dashboard-section");
  } catch (e) {
    console.error(e);
    localStorage.removeItem("itct_current_user");
  }
}
// ==================================================
// PART 2 : COURSES + STUDENTS (ADMISSION)
// ==================================================

// ---------------- COURSES ----------------

async function loadCourses() {
  if (!supa) return (courses = []);
  const { data, error } = await supa
    .from("courses")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Load courses error:", error);
    courses = [];
  } else {
    courses = data || [];
  }
}

function renderCourses() {
  const list = $("courses-list");
  const sel = $("course-select");
  const enqSel = $("enq-course-select");
  const repSel = $("report-course");

  if (list) list.innerHTML = "";
  if (sel) sel.innerHTML = `<option value="">-- Course निवडा --</option>`;
  if (enqSel) enqSel.innerHTML = `<option value="">-- Course निवडा --</option>`;
  if (repSel) repSel.innerHTML = `<option value="">-- सर्व कोर्स --</option>`;

  courses.forEach(c => {
    if (list) {
      const li = document.createElement("li");
      li.textContent = `${c.name} – ₹${c.fee || 0}`;
      list.appendChild(li);
    }

    if (sel) {
      const opt = document.createElement("option");
      opt.value = c.id;              // used internally only
      opt.textContent = `${c.name} (₹${c.fee || 0})`;
      sel.appendChild(opt);
    }

    if (enqSel) {
      const opt2 = document.createElement("option");
      opt2.value = c.name;
      opt2.textContent = c.name;
      enqSel.appendChild(opt2);
    }

    if (repSel) {
      const opt3 = document.createElement("option");
      opt3.value = c.name;
      opt3.textContent = c.name;
      repSel.appendChild(opt3);
    }
  });
}

async function saveCourse() {
  if (!supa) {
    alert("Supabase client उपलब्ध नाही");
    return;
  }

  const name = ($("course-name") || {}).value?.trim() || "";
  const feeVal = ($("course-fee") || {}).value || "";

  if (!name) {
    alert("Course नाव आवश्यक आहे");
    return;
  }

  const payload = {
    name: name,
    fee: feeVal ? Number(feeVal) : 0
  };

  const { data, error } = await supa
    .from("courses")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Course insert error:", error);
    alert("Course save करताना त्रुटी");
    return;
  }

  courses.push(data);
  renderCourses();

  if ($("course-name")) $("course-name").value = "";
  if ($("course-fee")) $("course-fee").value = "";

  alert("Course यशस्वीरीत्या add झाला");
}

// ---------------- STUDENTS (ADMISSION) ----------------

async function loadStudents() {
  if (!supa) return (students = []);
  const { data, error } = await supa
    .from("students")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Load students error:", error);
    students = [];
  } else {
    students = data || [];
  }
}

function renderStudents() {
  const ul = $("list");
  if (!ul) return;

  ul.innerHTML = "";

  students.forEach(s => {
    const li = document.createElement("li");
    li.className = "student-item";

    li.innerHTML = `
      <div class="info">
        <strong>${escapeHtml(s.name)}</strong><br>
        ${escapeHtml(s.course_name || "")}
        ${s.due_date ? " | Due: " + s.due_date : ""}<br>
        Mobile: ${escapeHtml(s.mobile || "")}
        ${s.mobile2 ? " / " + escapeHtml(s.mobile2) : ""}
        <div style="font-size:0.9rem;margin-top:4px;">
          Total Fee: ₹${Number(s.total_fee || 0).toFixed(2)}
        </div>
      </div>
    `;
    ul.appendChild(li);
  });
}

async function saveStudent() {
  if (!supa) {
    alert("Supabase client उपलब्ध नाही");
    return;
  }

  const name = ($("name") || {}).value?.trim() || "";
  const dob = ($("dob") || {}).value || null;
  const ageVal = ($("age") || {}).value || "";
  const address = ($("address") || {}).value?.trim() || "";
  const m1 = ($("mobile") || {}).value || "";
  const m2 = ($("mobile2") || {}).value || "";
  const courseId = ($("course-select") || {}).value;
  const dueDate = ($("course-duedate") || {}).value || null;

  if (!name) {
    alert("नाव आवश्यक आहे");
    return;
  }

  const mob = validateMobiles(m1, m2);
  if (!mob.ok) {
    alert(mob.msg);
    return;
  }

  const course = courses.find(c => String(c.id) === String(courseId));
  if (!course) {
    alert("Course निवडा");
    return;
  }

  const payload = {
    name: name,
    dob: dob,
    age: ageVal ? Number(ageVal) : null,
    address: address,
    mobile: mob.m1,
    mobile2: mob.m2,
    course_name: course.name,     // TEXT only
    total_fee: Number(course.fee || 0),
    due_date: dueDate
  };

  const { data, error } = await supa
    .from("students")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Student insert error:", error);
    alert("Student save करताना त्रुटी");
    return;
  }

  students.unshift(data);
  renderStudents();
  clearStudentForm();

  showSection("students-list");
  alert("विद्यार्थी admission यशस्वी");
}

function clearStudentForm() {
  [
    "name",
    "dob",
    "age",
    "address",
    "mobile",
    "mobile2",
    "course-duedate"
  ].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  if ($("course-select")) $("course-select").selectedIndex = 0;
}
// ==================================================
// PART 3 : ENQUIRY + FEES + CONVERT TO ADMISSION
// ==================================================

// ---------------- ENQUIRIES ----------------

async function loadEnquiries() {
  if (!supa) return (enquiries = []);
  const { data, error } = await supa
    .from("enquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load enquiries error:", error);
    enquiries = [];
  } else {
    enquiries = data || [];
  }
}

function renderEnquiries() {
  const list = $("enquiry-list");
  if (!list) return;

  list.innerHTML = "";

  enquiries.forEach(e => {
    const d = (e.created_at || "").slice(0, 10);
    const li = document.createElement("li");

    li.innerHTML = `
      <div>
        <strong>${escapeHtml(e.name)}</strong><br>
        ${escapeHtml(e.mobile || "")}
        ${e.mobile2 ? " / " + escapeHtml(e.mobile2) : ""}<br>
        <span style="font-size:0.8rem;color:#777">
          ${escapeHtml(e.course_name || "")}
          ${e.age ? " | Age: " + e.age : ""}
          ${d ? " | " + d : ""}
        </span>
      </div>
      <div class="actions">
        <button class="secondary" onclick="convertEnquiry('${e.id}')">Admission</button>
        <button class="danger" onclick="deleteEnquiry('${e.id}')">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

async function saveEnquiry() {
  if (!supa) {
    alert("Supabase client उपलब्ध नाही");
    return;
  }

  const name = ($("enq-name") || {}).value?.trim() || "";
  const dob = ($("enq-dob") || {}).value || null;
  const m1 = ($("enq-mobile") || {}).value || "";
  const m2 = ($("enq-mobile2") || {}).value || "";
  const courseName = ($("enq-course-select") || {}).value || "";

  if (!name || !courseName) {
    alert("नाव आणि Course आवश्यक आहे");
    return;
  }

  const mob = validateMobiles(m1, m2);
  if (!mob.ok) {
    alert(mob.msg);
    return;
  }

  const age = calcAgeFromDob(dob);

  const payload = {
    name: name,
    dob: dob,
    age: age === "" ? null : Number(age),
    mobile: mob.m1,
    mobile2: mob.m2,
    course_name: courseName
  };

  const { data, error } = await supa
    .from("enquiries")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Enquiry insert error:", error);
    alert("Enquiry save error");
    return;
  }

  enquiries.unshift(data);
  renderEnquiries();
  clearEnquiryForm();

  alert("Enquiry saved");
}

function clearEnquiryForm() {
  ["enq-name", "enq-dob", "enq-mobile", "enq-mobile2"].forEach(id => {
    const el = $(id);
    if (el) el.value = "";
  });
  if ($("enq-course-select")) $("enq-course-select").selectedIndex = 0;
}

async function deleteEnquiry(id) {
  if (!confirm("ही enquiry delete करायची?")) return;
  const { error } = await supa.from("enquiries").delete().eq("id", id);
  if (error) {
    console.error(error);
    alert("Delete error");
    return;
  }
  enquiries = enquiries.filter(e => e.id !== id);
  renderEnquiries();
}

// ---------------- CONVERT ENQUIRY TO ADMISSION ----------------

window.convertEnquiry = async function (id) {
  const e = enquiries.find(x => x.id === id);
  if (!e) return;

  if (!confirm("ही enquiry admission मध्ये convert करायची?")) return;

  const course = courses.find(c => c.name === e.course_name);
  const totalFee = course ? Number(course.fee || 0) : 0;

  const payload = {
    name: e.name,
    dob: e.dob || null,
    age: e.age ? Number(e.age) : null,
    address: "",
    mobile: e.mobile || "",
    mobile2: e.mobile2 || "",
    course_name: e.course_name,
    total_fee: totalFee,
    due_date: null
  };

  const { data, error } = await supa
    .from("students")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error("Convert admission error:", error);
    alert("Admission create error");
    return;
  }

  students.unshift(data);

  await supa.from("enquiries").delete().eq("id", id);
  enquiries = enquiries.filter(x => x.id !== id);

  renderStudents();
  renderEnquiries();
  showSection("students-list");

  alert("Enquiry admission मध्ये convert झाली");
};

// ---------------- FEES ----------------

async function loadFees() {
  if (!supa) return (fees = []);
  const { data, error } = await supa
    .from("fees")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Load fees error:", error);
    fees = [];
  } else {
    fees = data || [];
  }
}

async function openFeesModal(student) {
  const amount = prompt("Fees amount भरा:");
  if (!amount) return;

  const payload = {
    student_id: student.id,
    total_fee: Number(amount),
    discount: 0,
    date: new Date().toISOString()
  };

  const { error } = await supa.from("fees").insert([payload]);
  if (error) {
    console.error("Fees insert error:", error);
    alert("Fees save error");
    return;
  }

  alert("Fees saved");
}
// ==================================================
// PART 4 : REPORTS + BACKUP + WHATSAPP + INIT
// ==================================================

// ---------------- DASHBOARD ----------------
function renderDashboard() {
  const totalStudents = students.length;
  const totalFee = students.reduce((s, v) => s + Number(v.total_fee || 0), 0);
  const totalPaid = fees.reduce((s, v) => s + Number(v.total_fee || 0), 0);
  const totalDiscount = fees.reduce((s, v) => s + Number(v.discount || 0), 0);
  const balance = totalFee - totalPaid - totalDiscount;

  if ($("dash-total-students"))
    $("dash-total-students").textContent = `Total students: ${totalStudents}`;
  if ($("dash-total-fee"))
    $("dash-total-fee").textContent = `Total fee: ₹${totalFee}`;
  if ($("dash-total-paid"))
    $("dash-total-paid").textContent = `Paid: ₹${totalPaid}`;
  if ($("dash-total-discount"))
    $("dash-total-discount").textContent = `Discount: ₹${totalDiscount}`;
  if ($("dash-total-balance"))
    $("dash-total-balance").textContent = `Balance: ₹${balance}`;
}

// ---------------- REPORTS ----------------
async function generatePaymentReport() {
  await loadFees();
  let html = `<h4>Payment Report</h4><table class="report-table">
  <tr><th>Date</th><th>Student</th><th>Amount</th></tr>`;

  fees.forEach(f => {
    const s = students.find(x => x.id === f.student_id);
    html += `<tr>
      <td>${(f.date || "").slice(0, 10)}</td>
      <td>${escapeHtml(s ? s.name : "-")}</td>
      <td>₹${Number(f.total_fee || 0)}</td>
    </tr>`;
  });

  html += "</table>";
  if ($("report-output")) $("report-output").innerHTML = html;
}

async function generateBalanceReport() {
  await loadFees();
  let html = `<h4>Balance Report</h4><table class="report-table">
  <tr><th>Student</th><th>Course</th><th>Balance</th></tr>`;

  students.forEach(s => {
    const paid = fees
      .filter(f => f.student_id === s.id)
      .reduce((a, b) => a + Number(b.total_fee || 0), 0);
    const balance = Number(s.total_fee || 0) - paid;

    html += `<tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.course_name || "")}</td>
      <td>₹${balance}</td>
    </tr>`;
  });

  html += "</table>";
  if ($("report-output")) $("report-output").innerHTML = html;
}

// ---------------- BACKUP ----------------
function downloadCSV(name, rows) {
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function backupStudents() {
  const rows = ["Name,Course,Mobile"];
  students.forEach(s =>
    rows.push(`"${s.name}","${s.course_name}","${s.mobile}"`)
  );
  downloadCSV("students.csv", rows);
}

function backupCourses() {
  const rows = ["Name,Fee"];
  courses.forEach(c =>
    rows.push(`"${c.name}",${c.fee || 0}`)
  );
  downloadCSV("courses.csv", rows);
}

function backupFees() {
  const rows = ["Student,Amount,Date"];
  fees.forEach(f => {
    const s = students.find(x => x.id === f.student_id);
    rows.push(
      `"${s ? s.name : "-"}",${f.total_fee || 0},"${(f.date || "").slice(0,10)}"`
    );
  });
  downloadCSV("fees.csv", rows);
}

// ---------------- WHATSAPP ----------------
window.sendEnquiryWhatsApp = function (id) {
  const e = enquiries.find(x => x.id === id);
  if (!e) return;

  const mobile = (e.mobile || "").replace(/\D/g, "");
  if (mobile.length !== 10) {
    alert("Valid mobile number नाही");
    return;
  }

  const msg =
    `नमस्कार ${e.name},\n` +
    `आपण ${e.course_name} कोर्स बद्दल enquiry केली होती.\n` +
    `ITCT Computer Education, Nandurbar`;

  const url =
    "https://wa.me/91" +
    mobile +
    "?text=" +
    encodeURIComponent(msg);

  window.open(url, "_blank");
};

// ---------------- INIT (VERY IMPORTANT) ----------------
async function refreshAllData() {
  await Promise.all([
    loadCourses(),
    loadStudents(),
    loadEnquiries(),
    loadFees()
  ]);
  renderCourses();
  renderStudents();
  renderEnquiries();
  renderDashboard();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Login
  if ($("login-btn")) $("login-btn").addEventListener("click", handleLogin);
  if ($("logout-btn")) $("logout-btn").addEventListener("click", handleLogout);

  // Navigation
  if ($("dashboard-btn"))
    $("dashboard-btn").addEventListener("click", () =>
      showSection("dashboard-section")
    );
  if ($("manage-courses-btn"))
    $("manage-courses-btn").addEventListener("click", () =>
      showSection("courses-section")
    );
  if ($("add-student-btn"))
    $("add-student-btn").addEventListener("click", () =>
      showSection("student-form")
    );
  if ($("enquiry-btn"))
    $("enquiry-btn").addEventListener("click", () =>
      showSection("enquiry-section")
    );
  if ($("students-list-btn"))
    $("students-list-btn").addEventListener("click", () =>
      showSection("students-list")
    );
  if ($("reports-btn"))
    $("reports-btn").addEventListener("click", () =>
      showSection("reports-section")
    );
  if ($("backup-btn"))
    $("backup-btn").addEventListener("click", () =>
      showSection("backup-section")
    );

  // Actions
  if ($("save-course-btn"))
    $("save-course-btn").addEventListener("click", saveCourse);
  if ($("save-student-btn"))
    $("save-student-btn").addEventListener("click", saveStudent);
  if ($("save-enquiry-btn"))
    $("save-enquiry-btn").addEventListener("click", saveEnquiry);

  if ($("generate-payment-report"))
    $("generate-payment-report").addEventListener(
      "click",
      generatePaymentReport
    );
  if ($("generate-balance-report"))
    $("generate-balance-report").addEventListener(
      "click",
      generateBalanceReport
    );

  if ($("backup-students"))
    $("backup-students").addEventListener("click", backupStudents);
  if ($("backup-courses"))
    $("backup-courses").addEventListener("click", backupCourses);
  if ($("backup-fees"))
    $("backup-fees").addEventListener("click", backupFees);

  // Auto-login
  tryAutoLogin();
  if (currentUser) await refreshAllData();
});
