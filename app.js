// ================= Helper $ function =================
function $(id) {
    return document.getElementById(id);
}

// =============== Supabase Init =================
const supa = supabase.createClient(
    "YOUR_SUPABASE_URL",
    "YOUR_SUPABASE_ANON_KEY"
);

// ================ Global State ==================
let currentUser = null;
let courses = [];
let students = [];
let fees = [];
let enquiries = [];
let users = [];

// ================= Utility: Calculate Age ==================
function calcAge(dob) {
    if (!dob) return "";
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
}

// ================== Load All Data ====================
async function loadAll() {
    await loadCourses();
    await loadStudents();
    await loadEnquiries();
    await loadUsers();
    updateDashboard();
}

// ==================== AUTH FUNCTIONS ======================
async function loginUser() {
    const u = $("login-username").value.trim();
    const p = $("login-password").value.trim();
    if (!u || !p) {
        alert("Enter Username and Password");
        return;
    }

    const { data, error } = await supa
        .from("username")
        .select("*")
        .eq("username", u)
        .eq("password", p)
        .limit(1);

    if (error || !data || data.length === 0) {
        alert("Invalid username/password");
        return;
    }

    currentUser = data[0];

    $("login-section").classList.add("hidden");
    $("main-section").classList.remove("hidden");

    $("login-status").innerText = `Logged in as: ${currentUser.username}`;

    applyRoleUI();
    loadAll();
}

function logoutUser() {
    currentUser = null;
    $("main-section").classList.add("hidden");
    $("login-section").classList.remove("hidden");
}

// Check Admin or User
function isAdmin() {
    return currentUser && currentUser.role === "admin";
}

function applyRoleUI() {
    if (!isAdmin()) {
        $("settings-btn").classList.add("hidden");
        $("dashboard-btn").classList.add("hidden");
    } else {
        $("settings-btn").classList.remove("hidden");
        $("dashboard-btn").classList.remove("hidden");
    }
}

// ===================== COURSES ==========================
async function loadCourses() {
    const { data, error } = await supa.from("courses").select("*");
    if (error) return;

    courses = data;

    let html = "";
    data.forEach(c => {
        html += `<div class="list-row">${c.course_name} — ₹${c.amount}</div>`;
    });

    $("course-list").innerHTML = html;

    // fill dropdown
    $("course-select").innerHTML = data
        .map(c => `<option value="${c.id}">${c.course_name} — ₹${c.amount}</option>`)
        .join("");

    $("enq-course").innerHTML = data
        .map(c => `<option value="${c.id}">${c.course_name}</option>`)
        .join("");
}

async function addCourse() {
    const cn = $("new-course-name").value.trim();
    const fee = $("new-course-fee").value.trim();

    if (!cn || !fee) return alert("Enter course details");

    await supa.from("courses").insert([{ course_name: cn, amount: fee }]);
    loadCourses();
    $("new-course-name").value = "";
    $("new-course-fee").value = "";
}

// ===================== STUDENTS =========================
async function loadStudents() {
    const { data, error } = await supa.from("students").select("*");
    if (!error) students = data;
}

async function saveStudent() {
    const nm = $("student-name").value.trim();
    const dob = $("student-dob").value;
    const age = calcAge(dob);
    const addr = $("student-address").value.trim();
    const m1 = $("student-mobile").value.trim();
    const m2 = $("student-mobile2").value.trim();
    const course_id = $("course-select").value;
    const adt = $("admission-date").value;

    if (!nm || !m1) return alert("Name+Mobile Required");

    const { error } = await supa.from("students").insert([{
        name: nm,
        dob,
        age,
        address: addr,
        mobile: m1,
        mobile2: m2,
        course_id,
        admission_date: adt,
        created_by: currentUser.username
    }]);

    if (error) {
        alert("Error saving student");
        return;
    }
    alert("Student Saved");
    loadStudents();
}

// ===================== ENQUIRIES =========================
async function loadEnquiries() {
    const { data, error } = await supa.from("enquiries").select("*");
    if (!error) enquiries = data;
    renderEnquiryList();
}

async function saveEnquiry() {
    const nm = $("enq-name").value.trim();
    const dob = $("enq-dob").value;
    const age = calcAge(dob);
    const m1 = $("enq-mobile").value.trim();
    const m2 = $("enq-mobile2").value.trim();
    const course = $("enq-course").value;

    if (!nm || !m1) return alert("Name + Mobile Required");

    await supa.from("enquiries").insert([{
        name: nm,
        dob,
        age,
        mobile: m1,
        mobile2: m2,
        course_id: course,
        followup_date: null,
        status: "new"
    }]);

    alert("Enquiry Saved");
    loadEnquiries();
}

// Delete Enquiry
async function deleteEnquiry(id) {
    if (!confirm("Delete this enquiry?")) return;

    await supa.from("enquiries").delete().eq("id", id);
    loadEnquiries();
}

// Follow-up Set Today
async function followUpEnquiry(id) {
    const today = new Date().toISOString().split("T")[0];

    await supa.from("enquiries").update({
        followup_date: today
    }).eq("id", id);

    loadEnquiries();
}

// WhatsApp Message
function sendWhatsApp(name, mobile) {
    const msg = `Hello ${name}, Thank you for your enquiry at ITCT Computer Education.`;
    window.open(
        `https://wa.me/91${mobile}?text=${encodeURIComponent(msg)}`
    );
}

// Enquiry Listing
function renderEnquiryList() {
    let html = "";

    enquiries.forEach(e => {
        const cr = courses.find(c => c.id == e.course_id)?.course_name || "";

        html += `
        <div class="list-box">
            <b>${e.name}</b> — ${e.mobile}<br>
            Course: ${cr}<br>
            Age: ${e.age}<br>

            <button class="btn-small green" onclick="sendWhatsApp('${e.name}','${e.mobile}')">
                WhatsApp
            </button>

            <button class="btn-small orange" onclick="followUpEnquiry(${e.id})">
                Follow-up
            </button>

            <button class="btn-small red" onclick="deleteEnquiry(${e.id})">
                Delete
            </button>
        </div>
        `;
    });

    $("enquiry-list").innerHTML = html;
}

// ===================== USERS LOADING ========================
async function loadUsers() {
    const { data } = await supa.from("username").select("*");
    users = data;
}

// ================== DASHBOARD ==========================
function updateDashboard() {
    $("dashboard-content").innerHTML = `
        <div>Total Students: ${students.length}</div>
        <div>Total Courses: ${courses.length}</div>
        <div>Total Enquiries: ${enquiries.length}</div>
    `;
}

// ==================== EVENT BINDINGS ======================
$("login-btn").onclick = loginUser;
$("logout-btn").onclick = logoutUser;
$("add-course-btn").onclick = addCourse;
$("save-student-btn").onclick = saveStudent;
$("save-enquiry-btn").onclick = saveEnquiry;

// Navigation
$("dashboard-btn").onclick = () => showSection("dashboard");
$("courses-btn").onclick = () => showSection("courses");
$("students-btn").onclick = () => showSection("students");
$("reports-btn").onclick = () => showSection("reports");
$("enquiry-btn").onclick = () => showSection("enquiry");

function showSection(name) {
    ["dashboard", "courses", "students", "reports", "enquiry"]
        .forEach(sec => $(sec + "-section").classList.add("hidden"));

    $(name + "-section").classList.remove("hidden");
}
