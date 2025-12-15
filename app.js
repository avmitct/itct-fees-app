
// ================= HELPER =================
function $(id){ return document.getElementById(id); }

function escapeHtml(text){
  if(text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// ================= SUPABASE =================
const supa = window.supabaseClient;

// ================= STATE =================
let currentUser = null;
let students = [];
let courses = [];
let fees = [];

// ================= AUTH =================
async function handleLogin(){
  const u = $("login-username").value.trim();
  const p = $("login-password").value.trim();

  if(!u || !p){ alert("Enter username & password"); return; }

  const { data, error } = await supa
    .from("users")
    .select("*")
    .eq("username", u)
    .eq("password", p)
    .single();

  if(error || !data){
    alert("Invalid login");
    return;
  }

  currentUser = data;
  $("login-section").classList.add("hidden");
  $("app-section").classList.remove("hidden");
  loadAll();
}

function handleLogout(){
  currentUser = null;
  location.reload();
}

// ================= LOAD DATA =================
async function loadAll(){
  const s = await supa.from("students").select("*");
  const c = await supa.from("courses").select("*");
  const f = await supa.from("fees").select("*");

  students = s.data || [];
  courses  = c.data || [];
  fees     = f.data || [];

  renderDashboard();
  renderStudents();
}

// ================= DASHBOARD =================
function renderDashboard(){
  const studentIds = new Set(students.map(s=>s.id));
  const validFees = fees.filter(f=>studentIds.has(f.student_id));

  const totalStudents = students.length;
  const totalFee = students.reduce((s,x)=>s+Number(x.total_fee||0),0);
  const paid = validFees.reduce((s,f)=>s+Number(f.amount||0),0);
  const discount = validFees.reduce((s,f)=>s+Number(f.discount||0),0);
  const balance = totalFee - paid - discount;

  $("dash-total-students").textContent = totalStudents;
  $("dash-total-course-fee").textContent = "₹"+totalFee;
  $("dash-total-paid").textContent = "₹"+paid;
  $("dash-total-discount").textContent = "₹"+discount;
  $("dash-total-balance").textContent = "₹"+balance;
}

// ================= STUDENTS =================
function renderStudents(){
  const box = $("students-list-container");
  if(!box) return;
  box.innerHTML = "";

  students.forEach(st=>{
    const paid = fees.filter(f=>f.student_id===st.id)
      .reduce((s,f)=>s+Number(f.amount||0),0);
    const discount = fees.filter(f=>f.student_id===st.id)
      .reduce((s,f)=>s+Number(f.discount||0),0);

    const total = Number(st.total_fee||0);
    const balance = total - paid - discount;

    const div = document.createElement("div");
    div.className = "student-card";
    div.innerHTML = `
      <h3>${escapeHtml(st.name)}</h3>
      <p>Course: ${escapeHtml(st.course_name||"-")}</p>
      <p>Mobile: ${escapeHtml(st.mobile||"-")}</p>
      <p>
        Fee: ₹${total} |
        Paid: ₹${paid} |
        Discount: ₹${discount} |
        Balance: ₹${balance}
      </p>
    `;
    box.appendChild(div);
  });
}

// ================= DOM INIT =================
document.addEventListener("DOMContentLoaded", ()=>{
  if($("login-btn")) $("login-btn").addEventListener("click", handleLogin);
  if($("logout-btn")) $("logout-btn").addEventListener("click", handleLogout);
});
