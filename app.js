// ================= Helper & Supabase =================
function $(id) { return document.getElementById(id); }
const supa = window.supabaseClient;

// ================= Global State =================
let courses = [];
let students = [];
let currentUser = null;

// ================= Utilities =================
function calcAgeFromDob(dobStr) {
  if (!dobStr) return "";
  const d = new Date(dobStr);
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a >= 0 ? a : "";
}

function validateMobiles(m1, m2) {
  const d1 = m1.replace(/\D/g, "");
  const d2 = m2.replace(/\D/g, "");
  if (!d1 && !d2) return { ok: false, msg: "किमान एक मोबाईल नंबर आवश्यक" };
  if (d1 && d1.length !== 10) return { ok: false, msg: "Mobile 1 चुकीचा आहे" };
  if (d2 && d2.length !== 10) return { ok: false, msg: "Mobile 2 चुकीचा आहे" };
  return { ok: true, m1: d1, m2: d2 };
}

// ================= Courses =================
async function loadCourses() {
  const { data, error } = await supa.from("courses").select("*").order("name");
  if (error) {
    console.error(error);
    courses = [];
  } else {
    courses = data || [];
  }
  renderCourses();
}

function renderCourses() {
  const list = $("courses-list");
  const sel = $("course-select");

  if (list) list.innerHTML = "";
  if (sel) sel.innerHTML = `<option value="">-- Course निवडा --</option>`;

  courses.forEach(c => {
    if (list) {
      const li = document.createElement("li");
      li.textContent = `${c.name} – ₹${c.fee || 0}`;
      list.appendChild(li);
    }
    if (sel) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.name} (₹${c.fee || 0})`;
      sel.appendChild(opt);
    }
  });
}

async function saveCourse() {
  const name = $("course-name").value.trim();
  const fee = $("course-fee").value;

  if (!name) {
    alert("Course नाव आवश्यक आहे");
    return;
  }

  const { data, error } = await supa
    .from("courses")
    .insert([{ name, fee: fee ? Number(fee) : 0 }])
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Course save error");
    return;
  }

  courses.push(data);
  renderCourses();
  $("course-name").value = "";
  $("course-fee").value = "";
  alert("Course add झाला");
}

// ================= Students =================
async function loadStudents() {
  const { data, error } = await supa.from("students").select("*").order("name");
  if (error) {
    console.error(error);
    students = [];
  } else {
    students = data || [];
  }
  renderStudents();
}

function renderStudents() {
  const ul = $("list");
  if (!ul) return;
  ul.innerHTML = "";

  students.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${s.name}</strong><br>
      ${s.course_name} | Mobile: ${s.mobile}${s.mobile2 ? " / " + s.mobile2 : ""}<br>
      Fee: ₹${s.total_fee || 0} ${s.due_date ? "| Due: " + s.due_date : ""}
    `;
    ul.appendChild(li);
  });
}

async function saveStudent() {
  const name = $("name").value.trim();
  const dob = $("dob").value;
  const age = $("age").value;
  const address = $("address").value.trim();
  const m1 = $("mobile").value;
  const m2 = $("mobile2").value;
  const courseId = $("course-select").value;
  const dueDate = $("course-duedate").value;

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
    name,
    dob: dob || null,
    age: age ? Number(age) : null,
    address,
    mobile: mob.m1,
    mobile2: mob.m2,
    course_name: course.name,
    total_fee: Number(course.fee || 0),
    due_date: dueDate || null
  };

  const { data, error } = await supa
    .from("students")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("Student save error");
    return;
  }

  students.push(data);
  renderStudents();
  clearStudentForm();
  alert("Student admission successful");
}

function clearStudentForm() {
  ["name","dob","age","address","mobile","mobile2","course-duedate"].forEach(id => {
    if ($(id)) $(id).value = "";
  });
  $("course-select").selectedIndex = 0;
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", async () => {
  if ($("save-course-btn")) $("save-course-btn").addEventListener("click", saveCourse);
  if ($("save-student-btn")) $("save-student-btn").addEventListener("click", saveStudent);

  if ($("dob")) {
    $("dob").addEventListener("change", () => {
      $("age").value = calcAgeFromDob($("dob").value);
    });
  }

  await loadCourses();
  await loadStudents();
});
