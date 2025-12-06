// ITCT Fees App - Phase 2.2
// - Multi-user (admin + data-entry)
// - Admin: user list + delete (except main admin)
// - Multiple courses per student + due date
// - Mobile1 + Mobile2 (10-digit validation, at least one required)
// - Fees payments: amount, discount, note, receiptNo, receiptDate
// - Fees records can be edited (admin + user)
// - NO PDF receipt (only stored records)
// - Reports: payment, balance, due/overdue, CSV export
// - WhatsApp / SMS reminders
// - Backup / Restore

const STORAGE_KEYS = {
  students: 'students_v3',
  courses : 'courses_v2',
  adminOld: 'admin_v2',
  users   : 'itct_users_v1'
};

const DEFAULT_ADMIN = {
  username: 'admin',
  password: '1234',
  role: 'admin'
};

const $ = id => document.getElementById(id);

// ---------- HELPERS ----------

function fmt(n){ return Number(n || 0).toFixed(2); }

function calcAgeFromDob(dobStr){
  if(!dobStr) return '';
  const d = new Date(dobStr);
  if(isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age >= 0 ? age : '';
}

function updateAgeFromDob(){
  const dobVal = $('dob').value;
  const age = calcAgeFromDob(dobVal);
  $('age').value = age !== '' ? String(age) : '';
}

function normalizeMobile(str){
  return (str || '').replace(/\D/g,'');
}
function validateMobiles(m1, m2){
  const a = normalizeMobile(m1);
  const b = normalizeMobile(m2);
  if(!a && !b){
    return { ok:false, msg:'किमान एक मोबाईल नंबर आवश्यक आहे' };
  }
  if(a && a.length !== 10) return { ok:false, msg:'Mobile 1 साठी 10 digits आवश्यक आहेत' };
  if(b && b.length !== 10) return { ok:false, msg:'Mobile 2 साठी 10 digits आवश्यक आहेत' };
  return { ok:true, m1:a, m2:b };
}

function primaryMobile(s){
  return s.mobile || s.mobile2 || '';
}

function findCourseMaster(name){
  return courses.find(c=>c.name === name) || null;
}
function isAdmin(){
  return currentUser && currentUser.role === 'admin';
}
function showOnly(sectionId){
  [
    'dashboard-section',
    'courses-section',
    'student-form',
    'students-list',
    'reports-section',
    'settings-section'
  ].forEach(id=>{
    const el = $(id);
    if(!el) return;
    if(id === sectionId) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

// ---------- DATA ----------

let students = [];
let courses  = [];
let users    = [];
let currentUser = null;

// ---------- LOAD & MIGRATE ----------

function loadData(){
  // Courses
  try{
    const c = localStorage.getItem(STORAGE_KEYS.courses);
    courses = c ? JSON.parse(c) : [];
  }catch(e){ courses = []; }

  // Users
  try{
    const u = localStorage.getItem(STORAGE_KEYS.users);
    users = u ? JSON.parse(u) : [];
  }catch(e){ users = []; }

  // Default admin if no users
  if(!Array.isArray(users) || users.length === 0){
    let pass = DEFAULT_ADMIN.password;
    try{
      const oldAdmin = localStorage.getItem(STORAGE_KEYS.adminOld);
      if(oldAdmin){
        const a = JSON.parse(oldAdmin);
        if(a && a.pass) pass = a.pass;
      }
    }catch(e){}
    users = [{
      id: Date.now(),
      username: DEFAULT_ADMIN.username,
      password: pass,
      role: 'admin'
    }];
    saveUsers();
  }

  // Students
  try{
    const s = localStorage.getItem(STORAGE_KEYS.students);
    if(s){
      students = JSON.parse(s);
    }else{
      const s2 = localStorage.getItem('students_v2') || localStorage.getItem('students');
      students = s2 ? JSON.parse(s2) : [];
      students = migrateOldStudents(students);
      saveStudents();
    }
  }catch(e){
    students = [];
  }
}

function migrateOldStudents(old){
  if(!Array.isArray(old)) return [];
  return old.map(s=>{
    if(Array.isArray(s.courses)) {
      // ensure mobile2 exists
      s.mobile2 = s.mobile2 || '';
      return s;
    }
    const fee = Number(s.courseFee || 0);
    const courseName = s.course || 'Course';
    const fees = Array.isArray(s.fees) ? s.fees : [];
    const courseObj = {
      id: Date.now() + Math.random(),
      courseName,
      totalFee: fee,
      dueDate: '',
      fees
    };
    return {
      id: s.id || (Date.now() + Math.random()),
      name: s.name || '',
      dob : s.dob  || '',
      age : s.age  || '',
      address: s.address || '',
      mobile : s.mobile  || '',
      mobile2: s.mobile2 || '',
      courses: [courseObj]
    };
  });
}

function saveStudents(){
  localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
}
function saveCourses(){
  localStorage.setItem(STORAGE_KEYS.courses, JSON.stringify(courses));
}
function saveUsers(){
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

// ---------- LOGIN ----------

$('login-btn').addEventListener('click', tryLogin);
$('login-password').addEventListener('keydown', e=>{
  if(e.key === 'Enter') tryLogin();
});

function tryLogin(){
  const uname = $('login-username').value.trim() || 'admin';
  const pass  = $('login-password').value;

  const u = users.find(x=>x.username === uname && x.password === pass);
  if(!u){
    alert('चुकीचा username किंवा password');
    return;
  }
  currentUser = u;
  afterLogin();
}

function afterLogin(){
  $('login-section').classList.add('hidden');
  $('app-section').classList.remove('hidden');

  $('current-user-name').textContent = currentUser.username;
  $('current-user-role').textContent = currentUser.role;

  applyRoleUI();

  renderCourses();
  renderCourseSelect();
  renderStudents();
  renderReportCourseOptions();
  calcStats();

  if(isAdmin()){
    showOnly('dashboard-section');
    renderUsersList();
  } else {
    showOnly('students-list'); // data-entry ला थेट यादी
  }
}
// ---------- LOGOUT ----------

const logoutBtn = $('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    // currentUser reset
    currentUser = null;

    // Modal बंद करा (असल्यास)
    const m = $('modal');
    if (m) {
      m.classList.add('hidden');
      m.innerHTML = '';
      m.setAttribute('aria-hidden', 'true');
    }

    // App section hide, login section show
    $('app-section').classList.add('hidden');
    $('login-section').classList.remove('hidden');

    // login fields clear करा
    $('login-username').value = '';
    $('login-password').value = '';

    // optional: focus on username
    $('login-username').focus();
  });
}

function applyRoleUI(){
  const adminButtons = [
    'manage-courses-btn',
    'backup-btn',
    'restore-btn',
    'settings-btn'
  ];
  adminButtons.forEach(id=>{
    const el = $(id);
    if(!el) return;
    if(isAdmin()) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  const dbBtn = $('dashboard-btn');
  if(dbBtn){
    if(isAdmin()) dbBtn.classList.remove('hidden');
    else dbBtn.classList.add('hidden');
  }
}

// ---------- DASHBOARD ----------

function calcStats(){
  let totalStudents = students.length;
  let totalFee = 0, totalPaid = 0, totalDiscount = 0;

  students.forEach(s=>{
    (s.courses || []).forEach(c=>{
      const fee  = Number(c.totalFee || 0);
      const paid = (c.fees || []).reduce((a,b)=>a + Number(b.amount||0),0);
      const disc = (c.fees || []).reduce((a,b)=>a + Number(b.discount||0),0);
      totalFee += fee;
      totalPaid += paid;
      totalDiscount += disc;
    });
  });

  const totalBalance = totalFee - totalPaid - totalDiscount;

  $('dash-total-students').textContent = 'Total students: ' + totalStudents;
  $('dash-total-fee').textContent      = 'Total course fee: ₹' + fmt(totalFee);
  $('dash-total-paid').textContent     = 'Total paid: ₹' + fmt(totalPaid);
  $('dash-total-discount').textContent = 'Total discount: ₹' + fmt(totalDiscount);
  $('dash-total-balance').textContent  = 'Total balance: ₹' + fmt(totalBalance);
}

// Toolbar
$('dashboard-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('Dashboard फक्त admin साठी आहे.');
    return;
  }
  showOnly('dashboard-section');
  calcStats();
});
$('manage-courses-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('Courses manage करण्याची परवानगी केवळ admin ला आहे.');
    return;
  }
  showOnly('courses-section');
  renderCourses();
});
$('add-student-btn').addEventListener('click', ()=>{
  showOnly('student-form');
  renderCourseSelect();
  clearStudentForm();
});
$('reports-btn').addEventListener('click', ()=>{
  showOnly('reports-section');
  renderReportCourseOptions();
});
$('settings-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('Settings फक्त admin साठी आहेत.');
    return;
  }
  showOnly('settings-section');
  renderUsersList();
});
$('backup-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('Backup केवळ admin करू शकतो.');
    return;
  }
  exportBackup();
});
$('restore-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('Restore केवळ admin करू शकतो.');
    return;
  }
  $('file-input').click();
});
$('file-input').addEventListener('change', handleImport);

// ---------- COURSES (MASTER) ----------

$('add-course-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('Courses add करण्याची परवानगी केवळ admin ला आहे.');
    return;
  }
  const name = $('course-name').value.trim();
  const fee  = parseFloat($('course-fee').value || '0');
  if(!name || isNaN(fee)){
    alert('Course name आणि योग्य fee टाका');
    return;
  }
  courses.unshift({ name, fee });
  $('course-name').value = '';
  $('course-fee').value  = '';
  saveCourses();
  renderCourses();
  renderCourseSelect();
  renderReportCourseOptions();
});

function renderCourses(){
  const list = $('courses-list');
  if(!list) return;
  list.innerHTML = '';
  courses.forEach((c, idx)=>{
    const li = document.createElement('li');
    li.textContent = `${c.name} — ₹${fmt(c.fee)}`;
    if(isAdmin()){
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'secondary';
      btn.style.marginLeft = '0.5rem';
      btn.addEventListener('click', ()=>{
        if(confirm('हा course delete करायचा?')){
          courses.splice(idx,1);
          saveCourses();
          renderCourses();
          renderCourseSelect();
          renderReportCourseOptions();
        }
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  });
}

function renderCourseSelect(){
  const sel = $('course-select');
  if(!sel) return;
  sel.innerHTML = '';
  if(courses.length === 0){
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '-- No courses added --';
    sel.appendChild(o);
    return;
  }
  courses.forEach(c=>{
    const o = document.createElement('option');
    o.value = c.name;
    o.textContent = `${c.name} — ₹${fmt(c.fee)}`;
    sel.appendChild(o);
  });
}

// ---------- STUDENT FORM ----------

$('cancel-student-btn').addEventListener('click', ()=>{
  showOnly('students-list');
});

$('save-student-btn').addEventListener('click', ()=>{
  const name    = $('name').value.trim();
  const dob     = $('dob').value.trim();
  const age     = $('age').value.trim();
  const address = $('address').value.trim();
  const m1Raw   = $('mobile').value.trim();
  const m2Raw   = $('mobile2').value.trim();
  const courseName = $('course-select').value;
  const dueDate    = $('course-duedate').value;

  if(!name || !courseName){
    alert('नाव आणि course निवडणे आवश्यक आहे');
    return;
  }

  const mobCheck = validateMobiles(m1Raw, m2Raw);
  if(!mobCheck.ok){
    alert(mobCheck.msg);
    return;
  }

  const master = findCourseMaster(courseName);
  const totalFee = master ? Number(master.fee) : 0;

  const courseObj = {
    id: Date.now() + Math.random(),
    courseName,
    totalFee,
    dueDate,
    fees: []
  };

  const student = {
    id: Date.now(),
    name,
    dob,
    age,
    address,
    mobile : mobCheck.m1 || '',
    mobile2: mobCheck.m2 || '',
    courses: [courseObj]
  };

  students.unshift(student);
  saveStudents();
  clearStudentForm();
  renderStudents();
  calcStats();
  showOnly('students-list');
});

function clearStudentForm(){
  ['name','dob','age','address','mobile','mobile2','course-duedate']
    .forEach(id => { if($(id)) $(id).value = ''; });
}

// ---------- STUDENT LIST ----------

$('search').addEventListener('input', e => renderStudents(e.target.value));

function renderStudents(filter = ''){
  const tpl  = $('student-item-tpl');
  const list = $('list');
  if(!tpl || !list) return;
  list.innerHTML = '';

  const data = students.filter(s=>{
    const text = (
      s.name + ' ' +
      (s.courses || []).map(c=>c.courseName).join(' ') + ' ' +
      s.mobile + ' ' + (s.mobile2 || '')
    ).toLowerCase();
    return text.includes(filter.toLowerCase());
  });

  data.forEach(s=>{
    const node   = tpl.content.cloneNode(true);
    const nameEl = node.querySelector('.s-name');
    const metaEl = node.querySelector('.s-meta');

    let totalFee = 0, totalPaid = 0, totalDiscount = 0;
    (s.courses || []).forEach(c=>{
      const fee  = Number(c.totalFee || 0);
      const paid = (c.fees || []).reduce((a,b)=>a + Number(b.amount||0),0);
      const disc = (c.fees || []).reduce((a,b)=>a + Number(b.discount||0),0);
      totalFee      += fee;
      totalPaid     += paid;
      totalDiscount += disc;
    });
    const totalBalance = totalFee - totalPaid - totalDiscount;
    const courseNames = (s.courses || []).map(c=>c.courseName).join(', ');

    nameEl.textContent = s.name;
    metaEl.textContent =
      `Courses: ${courseNames || '-'} | ` +
      `मोबाईल1: ${s.mobile || '-'} | मोबाईल2: ${s.mobile2 || '-'} | ` +
      `Fee: ₹${fmt(totalFee)} | Paid: ₹${fmt(totalPaid)} | Disc: ₹${fmt(totalDiscount)} | Balance: ₹${fmt(totalBalance)}`;

    const li = node.querySelector('li');
    li.querySelector('.pay-btn').addEventListener('click', ()=> openPay(s.id));
    li.querySelector('.view-btn').addEventListener('click', ()=> viewStudent(s.id));

    const delBtn = li.querySelector('.delete-btn');
    if(isAdmin()){
      delBtn.addEventListener('click', ()=>{
        if(confirm('हा विद्यार्थी delete करायचा?')){
          students = students.filter(x => x.id !== s.id);
          saveStudents();
          renderStudents();
          calcStats();
        }
      });
    } else {
      delBtn.style.display = 'none';
    }

    list.appendChild(li);
  });
}

// ---------- PAYMENTS (ADD) ----------

function openPay(studentId){
  const s = students.find(x => x.id === studentId);
  if(!s || !Array.isArray(s.courses) || s.courses.length === 0){
    alert('या विद्यार्थ्याला कोणताही course जोडलेला नाही.');
    return;
  }

  let optionsHtml = '';
  s.courses.forEach(c=>{
    const fee  = Number(c.totalFee || 0);
    const paid = (c.fees || []).reduce((a,b)=>a+Number(b.amount||0),0);
    const disc = (c.fees || []).reduce((a,b)=>a+Number(b.discount||0),0);
    const bal  = fee - paid - disc;
    optionsHtml += `<option value="${c.id}">${c.courseName} (Balance: ₹${fmt(bal)})</option>`;
  });

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>फीस भरा — ${s.name}</h3>
      <label>Course:</label>
      <select id="pay-course-select">
        ${optionsHtml}
      </select>
      <input id="pay-amount" placeholder="रक्कम (Received)">
      <input id="pay-discount" placeholder="Discount (सवलत)">
      <input id="pay-receipt-no" placeholder="Receipt No">
      <input id="pay-receipt-date" type="date" placeholder="Receipt Date">
      <input id="pay-note" placeholder="टीप">
      <div style="margin-top:.5rem;">
        <button id="confirm-pay">पुष्टी करा</button>
        <button id="close-modal" class="secondary">रद्द</button>
      </div>
    </div>
  `;
  showModal(html);

  $('confirm-pay').addEventListener('click', ()=>{
    const courseId = $('pay-course-select').value;
    const amt = parseFloat($('pay-amount').value || '0');
    const dsc = parseFloat($('pay-discount').value || '0');
    const note = $('pay-note').value;
    const rno  = $('pay-receipt-no').value.trim();
    const rdt  = $('pay-receipt-date').value;

    if((isNaN(amt) || amt <= 0) && (isNaN(dsc) || dsc <= 0)){
      alert('किमान Received किंवा Discount काहीतरी टाका');
      return;
    }

    const c = (s.courses || []).find(c=> String(c.id) === String(courseId));
    if(!c){
      alert('Course निवडण्यात त्रुटी');
      return;
    }
    if(!Array.isArray(c.fees)) c.fees = [];

    c.fees.push({
      id: Date.now(),
      amount: isNaN(amt) ? 0 : amt,
      discount: isNaN(dsc) ? 0 : dsc,
      note,
      date: new Date().toISOString(),
      receiptNo: rno,
      receiptDate: rdt
    });

    saveStudents();
    renderStudents();
    calcStats();
    closeModal();
    // ❌ No PDF generation now
  });

  $('close-modal').addEventListener('click', closeModal);
}

// ---------- VIEW STUDENT + REMINDERS + EDIT FEES ----------

function viewStudent(id){
  const s = students.find(x => x.id === id);
  if(!s) return;

  let coursesHtml = '';
  let totalFee=0,totalPaid=0,totalDisc=0;

  (s.courses || []).forEach(c=>{
    const fee  = Number(c.totalFee || 0);
    const paid = (c.fees || []).reduce((a,b)=>a + Number(b.amount||0),0);
    const disc = (c.fees || []).reduce((a,b)=>a + Number(b.discount||0),0);
    const bal  = fee - paid - disc;
    totalFee += fee; totalPaid += paid; totalDisc += disc;

    const feesHtml = (c.fees || []).map(f=>`
      <li>
        ${new Date(f.date).toLocaleString()} —
        ₹${fmt(f.amount)} (Disc: ₹${fmt(f.discount||0)}) —
        ${f.note||''}
        ${f.receiptNo ? ` | Rec#: ${f.receiptNo}` : '' }
        ${f.receiptDate ? ` | R.Date: ${f.receiptDate}` : '' }
        <button onclick="editFee('${s.id}','${c.id}','${f.id}')">Edit</button>
      </li>
    `).join('') || '<li>रेकॉर्ड नाही</li>';

    coursesHtml += `
      <div style="margin-bottom:.5rem;">
        <strong>${c.courseName}</strong>
        <div>Total: ₹${fmt(fee)} | Paid: ₹${fmt(paid)} | Disc: ₹${fmt(disc)} | Balance: ₹${fmt(bal)}</div>
        <div>Due date: ${c.dueDate || '-'}</div>
        <ul>${feesHtml}</ul>
      </div>
    `;
  });

  const totalBal = totalFee - totalPaid - totalDisc;
  const pm = primaryMobile(s);
  const msg =
`Namaskar ${s.name},
ITCT Fees Reminder
Total Fee: ₹${fmt(totalFee)}
Paid: ₹${fmt(totalPaid)}
Discount: ₹${fmt(totalDisc)}
Balance: ₹${fmt(totalBal)}
Please pay as early as possible.`;

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>${s.name}</h3>
      <p>मोबाईल1: ${s.mobile || '-'} | मोबाईल2: ${s.mobile2 || '-'}</p>
      <p>पत्ता: ${s.address || '-'}</p>
      <p>Total Fee: ₹${fmt(totalFee)} | Paid: ₹${fmt(totalPaid)} | Disc: ₹${fmt(totalDisc)} | Balance: ₹${fmt(totalBal)}</p>
      <h4>Courses</h4>
      ${coursesHtml}
      <div style="margin-top:.5rem;">
        <button id="wa-remind">WhatsApp Reminder</button>
        <button id="sms-remind">SMS Reminder</button>
        <button id="close-modal" class="secondary">बंद</button>
      </div>
    </div>
  `;
  showModal(html);

  $('wa-remind').addEventListener('click', ()=>{
    if(!pm){
      alert('मोबाईल क्रमांक उपलब्ध नाही');
      return;
    }
    const url = `https://wa.me/91${pm}?text=` + encodeURIComponent(msg);
    window.open(url, '_blank');
  });
  $('sms-remind').addEventListener('click', ()=>{
    if(!pm){
      alert('मोबाईल क्रमांक उपलब्ध नाही');
      return;
    }
    const url = `sms:${pm}?body=` + encodeURIComponent(msg);
    window.location.href = url;
  });
  $('close-modal').addEventListener('click', closeModal);
}

// ---------- EDIT FEE RECORD ----------

function editFee(studentId, courseId, feeId){
  const s = students.find(x => String(x.id) === String(studentId));
  if(!s) return;
  const c = (s.courses || []).find(x => String(x.id) === String(courseId));
  if(!c) return;
  const f = (c.fees || []).find(x => String(x.id) === String(feeId));
  if(!f) return;

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>Edit Fee — ${s.name} (${c.courseName})</h3>
      <input id="edit-amount" placeholder="रक्कम (Received)" value="${f.amount || 0}">
      <input id="edit-discount" placeholder="Discount (सवलत)" value="${f.discount || 0}">
      <input id="edit-receipt-no" placeholder="Receipt No" value="${f.receiptNo || ''}">
      <input id="edit-receipt-date" type="date" placeholder="Receipt Date" value="${f.receiptDate || ''}">
      <input id="edit-note" placeholder="टीप" value="${f.note || ''}">
      <div style="margin-top:.5rem;">
        <button id="save-edit-fee">Save</button>
        <button id="cancel-edit-fee" class="secondary">Cancel</button>
      </div>
    </div>
  `;
  showModal(html);

  $('save-edit-fee').addEventListener('click', ()=>{
    const amt = parseFloat($('edit-amount').value || '0');
    const dsc = parseFloat($('edit-discount').value || '0');
    const rno = $('edit-receipt-no').value.trim();
    const rdt = $('edit-receipt-date').value;
    const note = $('edit-note').value;

    f.amount    = isNaN(amt) ? 0 : amt;
    f.discount  = isNaN(dsc) ? 0 : dsc;
    f.receiptNo = rno;
    f.receiptDate = rdt;
    f.note      = note;

    saveStudents();
    renderStudents();
    calcStats();
    viewStudent(s.id); // पुन्हा detail view दाखवा
  });

  $('cancel-edit-fee').addEventListener('click', ()=>{
    viewStudent(s.id);
  });
}

// make editFee global for inline onclick
window.editFee = editFee;

// ---------- MODAL HELPERS ----------

function showModal(html){
  const m = $('modal');
  m.innerHTML = html;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden','false');
  const first = m.querySelector('input,button,select,[tabindex]');
  if(first) first.focus();
}
function closeModal(){
  const m = $('modal');
  m.classList.add('hidden');
  m.innerHTML = '';
  m.setAttribute('aria-hidden','true');
}

// ---------- REPORTS ----------

function renderReportCourseOptions(){
  const sel = $('report-course');
  if(!sel) return;
  sel.innerHTML = '<option value="">-- सर्व कोर्स --</option>';
  courses.forEach(c=>{
    const o = document.createElement('option');
    o.value = c.name;
    o.textContent = c.name;
    sel.appendChild(o);
  });
}

$('generate-payment-report').addEventListener('click', ()=>{
  const course = $('report-course').value;
  const from   = $('report-from').value;
  const to     = $('report-to').value;

  const rows = [];
  students.forEach(s=>{
    (s.courses || []).forEach(c=>{
      (c.fees || []).forEach(f=>{
        const d = (f.date || '').slice(0,10);
        if(course && c.courseName !== course) return;
        if(from && d < from) return;
        if(to   && d > to  ) return;
        rows.push({
          type: 'payment',
          date: d,
          student: s.name,
          course: c.courseName,
          amount: Number(f.amount||0),
          discount: Number(f.discount||0),
          note: f.note || '',
          mobile: primaryMobile(s),
          receiptNo: f.receiptNo || '',
          receiptDate: f.receiptDate || ''
        });
      });
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r =>
        `<div>${r.date} — ${r.student} (${r.course}) — Rec: ₹${fmt(r.amount)} (Disc: ₹${fmt(r.discount)}) — ${r.note} ` +
        `${r.receiptNo ? ' | Rec#: '+r.receiptNo : ''}` +
        `${r.receiptDate ? ' | R.Date: '+r.receiptDate : ''}</div>`
      ).join('')
    : '<div>No records</div>';
  $('report-output').innerHTML = out;
});

$('generate-balance-report').addEventListener('click', ()=>{
  const course = $('report-course').value;
  const rows = [];
  students.forEach(s=>{
    (s.courses || []).forEach(c=>{
      if(course && c.courseName !== course) return;
      const fee  = Number(c.totalFee || 0);
      const paid = (c.fees || []).reduce((a,b)=>a + Number(b.amount||0),0);
      const disc = (c.fees || []).reduce((a,b)=>a + Number(b.discount||0),0);
      const bal  = fee - paid - disc;
      rows.push({
        type: 'balance',
        student: s.name,
        course: c.courseName,
        fee,
        paid,
        discount: disc,
        balance: bal,
        mobile: primaryMobile(s)
      });
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r => `<div>${r.student} (${r.course}) — Fee: ₹${fmt(r.fee)} | Paid: ₹${fmt(r.paid)} | Disc: ₹${fmt(r.discount)} | Balance: ₹${fmt(r.balance)}</div>`).join('')
    : '<div>No records</div>';
  $('report-output').innerHTML = out;
});

$('generate-due-report').addEventListener('click', ()=>{
  const today = new Date().toISOString().slice(0,10);
  const rows = [];

  students.forEach(s=>{
    (s.courses || []).forEach(c=>{
      if(!c.dueDate) return;
      const fee  = Number(c.totalFee || 0);
      const paid = (c.fees || []).reduce((a,b)=>a + Number(b.amount||0),0);
      const disc = (c.fees || []).reduce((a,b)=>a + Number(b.discount||0),0);
      const bal  = fee - paid - disc;
      if(bal <= 0) return;
      if(c.dueDate > today) return;
      rows.push({
        type: 'due',
        student: s.name,
        course: c.courseName,
        dueDate: c.dueDate,
        fee,
        paid,
        discount: disc,
        balance: bal,
        mobile: primaryMobile(s)
      });
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r => `<div>${r.dueDate} — ${r.student} (${r.course}) — Balance: ₹${fmt(r.balance)} | Mobile: ${r.mobile}</div>`).join('')
    : '<div>No due / overdue records</div>';
  $('report-output').innerHTML = out;
});

// CSV Export
$('export-csv').addEventListener('click', ()=>{
  const rows = window._lastReport || [];
  if(!rows.length){
    alert('Report रिकामी आहे');
    return;
  }

  let header;
  if(rows[0].type === 'payment'){
    header = 'Date,Student,Course,Amount,Discount,ReceiptNo,ReceiptDate,Note,Mobile';
  }else if(rows[0].type === 'due'){
    header = 'DueDate,Student,Course,TotalFee,Paid,Discount,Balance,Mobile';
  }else{
    header = 'Student,Course,TotalFee,Paid,Discount,Balance,Mobile';
  }

  const csvLines = [header];
  rows.forEach(r=>{
    if(r.type === 'payment'){
      csvLines.push(
        `${r.date},"${r.student}","${r.course}",${fmt(r.amount)},${fmt(r.discount)},"${(r.receiptNo||'').replace(/"/g,'""')}","${(r.receiptDate||'').replace(/"/g,'""')}","${(r.note||'').replace(/"/g,'""')}",${r.mobile}`
      );
    }else if(r.type === 'due'){
      csvLines.push(
        `${r.dueDate},"${r.student}","${r.course}",${fmt(r.fee)},${fmt(r.paid)},${fmt(r.discount)},${fmt(r.balance)},${r.mobile}`
      );
    }else{
      csvLines.push(
        `"${r.student}","${r.course}",${fmt(r.fee)},${fmt(r.paid)},${fmt(r.discount)},${fmt(r.balance)},${r.mobile}`
      );
    }
  });

  const blob = new Blob([csvLines.join('\n')], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'itct-fees-report.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- SETTINGS: PASSWORD + USERS ----------

$('change-pass-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('केवळ admin password बदलू शकतो.');
    return;
  }
  const np = $('new-pass').value;
  if(!np){
    alert('New password टाका');
    return;
  }
  const adminUser = users.find(u=>u.username === 'admin' && u.role === 'admin');
  if(adminUser){
    adminUser.password = np;
    saveUsers();
    $('new-pass').value = '';
    alert('Admin password बदलला.');
  }else{
    alert('"admin" user सापडला नाही.');
  }
});

$('add-user-btn').addEventListener('click', ()=>{
  if(!isAdmin()){
    alert('नवीन user add करण्याची परवानगी केवळ admin ला आहे.');
    return;
  }
  const uname = $('new-user-username').value.trim();
  const pass  = $('new-user-password').value;
  const role  = $('new-user-role').value;

  if(!uname || !pass){
    alert('Username आणि Password टाका');
    return;
  }
  if(users.some(u=>u.username === uname)){
    alert('हा username आधीपासून अस्तित्वात आहे.');
    return;
  }

  users.push({
    id: Date.now(),
    username: uname,
    password: pass,
    role
  });
  saveUsers();

  $('new-user-username').value = '';
  $('new-user-password').value = '';
  $('new-user-role').value = 'data-entry';
  alert('User जतन झाला.');
  renderUsersList();
});

function renderUsersList(){
  if(!isAdmin()) return;
  const list = $('users-list');
  if(!list) return;

  list.innerHTML = '';
  users.forEach(u=>{
    const li = document.createElement('li');
    li.textContent = `${u.username} (${u.role})`;

    if(!(u.username === 'admin' && u.role === 'admin')){
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'secondary';
      btn.style.marginLeft = '0.5rem';
      btn.addEventListener('click', ()=>{
        if(confirm(`User "${u.username}" delete करायचा?`)){
          users = users.filter(x => x.id !== u.id);
          saveUsers();
          renderUsersList();
        }
      });
      li.appendChild(btn);
    }

    list.appendChild(li);
  });
}

// ---------- BACKUP / RESTORE ----------

function exportBackup(){
  const data = { students, courses, users };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'itct-fees-backup-v2.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(e){
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(data.students && data.courses && data.users){
        students = data.students;
        courses  = data.courses;
        users    = data.users;
        saveStudents();
        saveCourses();
        saveUsers();
        alert('Backup import पूर्ण');
        renderCourses();
        renderCourseSelect();
        renderStudents();
        renderReportCourseOptions();
        calcStats();
        if(isAdmin()) renderUsersList();
      }else{
        alert('अवैध backup फाईल');
      }
    }catch(err){
      alert('फाईल वाचता आली नाही');
    }
  };
  reader.readAsText(f);
}

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', ()=>{
  loadData();

  const dobInput = $('dob');
  if(dobInput){
    dobInput.addEventListener('change', updateAgeFromDob);
    dobInput.addEventListener('blur', updateAgeFromDob);
  }
});
