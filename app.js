// ITCT Admission System - Supabase Cloud Version + Backup
// --------------------------------------------------------
// Tables in Supabase:
// users(id uuid, username text unique, password text, role text)
// courses(id uuid, name text unique, fee numeric)
// students(id uuid, name text, dob date, age int, address text,
//          mobile text, mobile2 text, course_name text, total_fee numeric, due_date date, created_by text)
// fees(id uuid, student_id uuid, amount numeric, discount numeric,
//      note text, date timestamptz, receipt_no text, receipt_date date)

const supa = window.supabaseClient;
const $ = id => document.getElementById(id);

// State
let users = [];
let courses = [];
let students = [];
let fees = [];
let currentUser = null;

function fmt(n) { return Number(n || 0).toFixed(2); }

// ---------- Helpers: age & mobiles ----------

function calcAgeFromDob(dobStr) {
  if (!dobStr) return '';
  const d = new Date(dobStr);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 0 ? age : '';
}

function updateAgeFromDob() {
  const dobVal = $('dob').value;
  const age = calcAgeFromDob(dobVal);
  $('age').value = age !== '' ? String(age) : '';
}

function normalizeMobile(str) {
  return (str || '').replace(/\D/g, '');
}

function validateMobiles(m1, m2) {
  const a = normalizeMobile(m1);
  const b = normalizeMobile(m2);
  if (!a && !b) return { ok: false, msg: 'किमान एक मोबाईल नंबर आवश्यक आहे' };
  if (a && a.length !== 10) return { ok: false, msg: 'Mobile 1 साठी 10 digits आवश्यक आहेत' };
  if (b && b.length !== 10) return { ok: false, msg: 'Mobile 2 साठी 10 digits आवश्यक आहेत' };
  return { ok: true, m1: a, m2: b };
}

function primaryMobile(s) {
  return s.mobile || s.mobile2 || '';
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

function showOnly(sectionId) {
  [
    'dashboard-section',
    'courses-section',
    'student-form',
    'students-list',
    'reports-section',
    'settings-section',
    'backup-section'
  ].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (id === sectionId) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });
}

function studentFees(studentId) {
  return fees.filter(f => f.student_id === studentId);
}

function studentTotals(stu) {
  const fs = studentFees(stu.id);
  let paid = 0, disc = 0;
  fs.forEach(f => {
    paid += Number(f.amount || 0);
    disc += Number(f.discount || 0);
  });
  const totalFee = Number(stu.total_fee || 0);
  const balance = totalFee - paid - disc;
  return { totalFee, paid, disc, balance };
}

// ---------- Data loading from Supabase ----------

async function loadUsers() {
  const { data, error } = await supa.from('users').select('*').order('username');
  if (error) {
    console.error(error);
    alert('Error loading users');
    return;
  }
  if (!data || data.length === 0) {
    const { data: created, error: err2 } = await supa
      .from('users')
      .insert({ username: 'admin', password: '1234', role: 'admin' })
      .select();
    if (err2) {
      console.error(err2);
      alert('Cannot create default admin user');
      return;
    }
    users = created;
  } else {
    users = data;
  }
}

async function loadCourses() {
  const { data, error } = await supa.from('courses').select('*').order('name');
  if (error) {
    console.error(error);
    alert('Error loading courses');
    return;
  }
  courses = data || [];
}

async function loadStudents() {
  const { data, error } = await supa.from('students').select('*').order('name');
  if (error) {
    console.error(error);
    alert('Error loading students');
    return;
  }
  students = data || [];
}

async function loadFees() {
  const { data, error } = await supa.from('fees').select('*');
  if (error) {
    console.error(error);
    alert('Error loading fees');
    return;
  }
  fees = data || [];
}

async function loadAllData() {
  await Promise.all([loadUsers(), loadCourses(), loadStudents(), loadFees()]);
}

// ---------- LOGIN ----------

$('login-btn').addEventListener('click', tryLogin);
$('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});

async function tryLogin() {
  const uname = $('login-username').value.trim() || 'admin';
  const pass = $('login-password').value;

  const user = users.find(u => u.username === uname && u.password === pass);
  if (!user) {
    alert('चुकीचा username किंवा password');
    return;
  }
  currentUser = user;
  afterLogin();
}

function afterLogin() {
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

  if (isAdmin()) {
    showOnly('dashboard-section');
    renderUsersList();
  } else {
    showOnly('students-list');
  }
}

// ---------- ROLE UI (admin vs data-entry) ----------

function applyRoleUI() {
  const adminButtons = [
    'manage-courses-btn',
    'settings-btn',
    'backup-btn'
  ];
  adminButtons.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (isAdmin()) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  const dbBtn = $('dashboard-btn');
  if (dbBtn) {
    if (isAdmin()) dbBtn.classList.remove('hidden');
    else dbBtn.classList.add('hidden');
  }
}

// Logout
const logoutBtn = $('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    const m = $('modal');
    if (m) {
      m.classList.add('hidden');
      m.innerHTML = '';
      m.setAttribute('aria-hidden', 'true');
    }
    $('app-section').classList.add('hidden');
    $('login-section').classList.remove('hidden');
    $('login-username').value = '';
    $('login-password').value = '';
    $('login-username').focus();
  });
}

// ---------- DASHBOARD ----------

function calcStats() {
  let totalStudents = students.length;
  let totalFee = 0, totalPaid = 0, totalDiscount = 0;

  students.forEach(s => {
    const { totalFee: tf, paid, disc } = studentTotals(s);
    totalFee += tf;
    totalPaid += paid;
    totalDiscount += disc;
  });

  const totalBalance = totalFee - totalPaid - totalDiscount;

  $('dash-total-students').textContent = 'Total students: ' + totalStudents;
  $('dash-total-fee').textContent      = 'Total course fee: ₹' + fmt(totalFee);
  $('dash-total-paid').textContent     = 'Total paid: ₹' + fmt(totalPaid);
  $('dash-total-discount').textContent = 'Total discount: ₹' + fmt(totalDiscount);
  $('dash-total-balance').textContent  = 'Total balance: ₹' + fmt(totalBalance);
}

// ---------- TOOLBAR NAVIGATION ----------

$('dashboard-btn').addEventListener('click', () => {
  if (!isAdmin()) {
    alert('Dashboard फक्त admin साठी आहे.');
    return;
  }
  showOnly('dashboard-section');
  calcStats();
});

$('manage-courses-btn').addEventListener('click', () => {
  if (!isAdmin()) {
    alert('Courses manage करण्याची परवानगी केवळ admin ला आहे.');
    return;
  }
  showOnly('courses-section');
  renderCourses();
});

$('add-student-btn').addEventListener('click', () => {
  showOnly('student-form');
  renderCourseSelect();
  clearStudentForm();
});

$('students-list-btn').addEventListener('click', () => {
  showOnly('students-list');
  renderStudents();
});

$('reports-btn').addEventListener('click', () => {
  showOnly('reports-section');
  renderReportCourseOptions();
});

$('settings-btn').addEventListener('click', () => {
  if (!isAdmin()) {
    alert('Settings फक्त admin साठी आहेत.');
    return;
  }
  showOnly('settings-section');
  renderUsersList();
});

$('backup-btn').addEventListener('click', () => {
  if (!isAdmin()) {
    alert('Backup option फक्त admin साठी आहे.');
    return;
  }
  showOnly('backup-section');
});

// ---------- COURSES ----------

$('add-course-btn').addEventListener('click', async () => {
  if (!isAdmin()) {
    alert('Courses add करण्याची परवानगी केवळ admin ला आहे.');
    return;
  }
  const name = $('course-name').value.trim();
  const fee = parseFloat($('course-fee').value || '0');
  if (!name || isNaN(fee)) {
    alert('Course name आणि योग्य fee टाका');
    return;
  }
  const { data, error } = await supa
    .from('courses')
    .insert({ name, fee })
    .select()
    .single();
  if (error) {
    alert('Course save करताना त्रुटी (duplicate name?)');
    console.error(error);
    return;
  }
  courses.unshift(data);
  $('course-name').value = '';
  $('course-fee').value = '';
  renderCourses();
  renderCourseSelect();
  renderReportCourseOptions();
});

function renderCourses() {
  const list = $('courses-list');
  if (!list) return;
  list.innerHTML = '';
  courses.forEach(c => {
    const li = document.createElement('li');
    li.textContent = `${c.name} — ₹${fmt(c.fee)}`;
    if (isAdmin()) {
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'secondary';
      btn.style.marginLeft = '0.5rem';
      btn.addEventListener('click', async () => {
        if (!confirm('हा course delete करायचा?')) return;
        const { error } = await supa.from('courses').delete().eq('id', c.id);
        if (error) {
          alert('Course delete झाला नाही (कदाचित students जोडलेले आहेत)');
          console.error(error);
          return;
        }
        courses = courses.filter(x => x.id !== c.id);
        renderCourses();
        renderCourseSelect();
        renderReportCourseOptions();
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  });
}

function renderCourseSelect() {
  const sel = $('course-select');
  if (!sel) return;
  sel.innerHTML = '';
  if (courses.length === 0) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '-- No courses added --';
    sel.appendChild(o);
    return;
  }
  courses.forEach(c => {
    const o = document.createElement('option');
    o.value = c.name;
    o.textContent = `${c.name} — ₹${fmt(c.fee)}`;
    sel.appendChild(o);
  });
}

// ---------- STUDENT FORM ----------

$('cancel-student-btn').addEventListener('click', () => {
  showOnly('students-list');
});

$('save-student-btn').addEventListener('click', async () => {
  const name = $('name').value.trim();
  const dob = $('dob').value.trim();
  const age = $('age').value.trim();
  const address = $('address').value.trim();
  const m1Raw = $('mobile').value.trim();
  const m2Raw = $('mobile2').value.trim();
  const courseName = $('course-select').value;
  const dueDate = $('course-duedate').value;

  if (!name || !courseName) {
    alert('नाव आणि course निवडणे आवश्यक आहे');
    return;
  }

  const mobCheck = validateMobiles(m1Raw, m2Raw);
  if (!mobCheck.ok) {
    alert(mobCheck.msg);
    return;
  }

  const master = courses.find(c => c.name === courseName);
  const totalFee = master ? Number(master.fee) : 0;

  const payload = {
    name,
    dob: dob || null,
    age: age ? Number(age) : null,
    address,
    mobile: mobCheck.m1 || '',
    mobile2: mobCheck.m2 || '',
    course_name: courseName,
    total_fee: totalFee,
    due_date: dueDate || null,
    created_by: currentUser ? currentUser.username : null
  };

  const { data, error } = await supa
    .from('students')
    .insert(payload)
    .select()
    .single();
  if (error) {
    alert('Student save करताना त्रुटी');
    console.error(error);
    return;
  }
  students.unshift(data);
  clearStudentForm();
  renderStudents();
  calcStats();
  showOnly('students-list');
});

function clearStudentForm() {
  ['name','dob','age','address','mobile','mobile2','course-duedate']
    .forEach(id => { if ($(id)) $(id).value = ''; });
}

// ---------- STUDENT LIST ----------

$('search').addEventListener('input', e => renderStudents(e.target.value));

function renderStudents(filter = '') {
  const tpl = $('student-item-tpl');
  const list = $('list');
  if (!tpl || !list) return;
  list.innerHTML = '';

  const data = students.filter(s => {
    const text = (
      s.name + ' ' +
      (s.course_name || '') + ' ' +
      (s.mobile || '') + ' ' +
      (s.mobile2 || '')
    ).toLowerCase();
    return text.includes(filter.toLowerCase());
  });

  data.forEach(s => {
    const node = tpl.content.cloneNode(true);
    const nameEl = node.querySelector('.s-name');
    const metaEl = node.querySelector('.s-meta');

    const { totalFee, paid, disc, balance } = studentTotals(s);

    nameEl.textContent = s.name;

    let metaText =
      `Course: ${s.course_name || '-'} | ` +
      `मोबाईल1: ${s.mobile || '-'} | मोबाईल2: ${s.mobile2 || '-'} | ` +
      `Fee: ₹${fmt(totalFee)} | Paid: ₹${fmt(paid)} | Disc: ₹${fmt(disc)} | Balance: ₹${fmt(balance)}`;

    if (isAdmin()) {
      metaText += ` | Created by: ${s.created_by || '-'}`;
    }

    metaEl.textContent = metaText;

    const li = node.querySelector('li');
    li.querySelector('.pay-btn').addEventListener('click', () => openPay(s.id));
    li.querySelector('.view-btn').addEventListener('click', () => viewStudent(s.id));

    const delBtn = li.querySelector('.delete-btn');
    if (isAdmin()) {
      delBtn.addEventListener('click', async () => {
        if (!confirm('हा विद्यार्थी delete करायचा?')) return;
        const { error: fErr } = await supa.from('fees').delete().eq('student_id', s.id);
        if (fErr) {
          alert('Fees delete करताना त्रुटी');
          console.error(fErr);
          return;
        }
        const { error } = await supa.from('students').delete().eq('id', s.id);
        if (error) {
          alert('Student delete करताना त्रुटी');
          console.error(error);
          return;
        }
        fees = fees.filter(f => f.student_id !== s.id);
        students = students.filter(x => x.id !== s.id);
        renderStudents();
        calcStats();
      });
    } else {
      delBtn.style.display = 'none';
    }

    list.appendChild(li);
  });
}

// ---------- PAYMENTS: ADD ----------

async function openPay(studentId) {
  const s = students.find(x => x.id === studentId);
  if (!s) return;

  const { totalFee, paid, disc, balance } = studentTotals(s);

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>फीस भरा — ${s.name} (${s.course_name || '-'})</h3>
      <p>Total: ₹${fmt(totalFee)} | Paid: ₹${fmt(paid)} | Disc: ₹${fmt(disc)} | Balance: ₹${fmt(balance)}</p>
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

  $('confirm-pay').addEventListener('click', async () => {
    const amt = parseFloat($('pay-amount').value || '0');
    const dsc = parseFloat($('pay-discount').value || '0');
    const note = $('pay-note').value;
    const rno = $('pay-receipt-no').value.trim();
    const rdt = $('pay-receipt-date').value;

    if ((isNaN(amt) || amt <= 0) && (isNaN(dsc) || dsc <= 0)) {
      alert('किमान Received किंवा Discount काहीतरी टाका');
      return;
    }

    const payload = {
      student_id: s.id,
      amount: isNaN(amt) ? 0 : amt,
      discount: isNaN(dsc) ? 0 : dsc,
      note,
      date: new Date().toISOString(),
      receipt_no: rno,
      receipt_date: rdt || null
    };

    const { data, error } = await supa
      .from('fees')
      .insert(payload)
      .select()
      .single();
    if (error) {
      alert('Payment save करताना त्रुटी');
      console.error(error);
      return;
    }
    fees.push(data);
    renderStudents();
    calcStats();
    closeModal();
  });

  $('close-modal').addEventListener('click', closeModal);
}

// ---------- VIEW STUDENT & REMINDERS + EDIT FEES ----------

async function viewStudent(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;

  const fs = studentFees(s.id);
  const { totalFee, paid, disc, balance } = studentTotals(s);

  let feesHtml = fs.map(f => `
    <li>
      ${new Date(f.date).toLocaleString()} —
      ₹${fmt(f.amount)} (Disc: ₹${fmt(f.discount || 0)}) —
      ${f.note || ''}
      ${f.receipt_no ? ` | Rec#: ${f.receipt_no}` : ''}
      ${f.receipt_date ? ` | R.Date: ${f.receipt_date}` : ''}
      <button onclick="editFee('${f.id}')">Edit</button>
    </li>
  `).join('');
  if (!feesHtml) feesHtml = '<li>रेकॉर्ड नाही</li>';

  const msg =
`Namaskar ${s.name},
ITCT Fees Reminder
Course: ${s.course_name || '-'}
Total Fee: ₹${fmt(totalFee)}
Paid: ₹${fmt(paid)}
Discount: ₹${fmt(disc)}
Balance: ₹${fmt(balance)}
Please pay as early as possible.`;

  const pm = primaryMobile(s);

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>${s.name}</h3>
      <p>Course: ${s.course_name || '-'}</p>
      <p>मोबाईल1: ${s.mobile || '-'} | मोबाईल2: ${s.mobile2 || '-'}</p>
      <p>पत्ता: ${s.address || '-'}</p>
      <p>Total Fee: ₹${fmt(totalFee)} | Paid: ₹${fmt(paid)} | Disc: ₹${fmt(disc)} | Balance: ₹${fmt(balance)}</p>
      <h4>Fees History</h4>
      <ul>${feesHtml}</ul>
      <div style="margin-top:.5rem;">
        <button id="wa-remind">WhatsApp Reminder</button>
        <button id="sms-remind">SMS Reminder</button>
        <button id="close-modal" class="secondary">बंद</button>
      </div>
    </div>
  `;
  showModal(html);

  $('wa-remind').addEventListener('click', () => {
    if (!pm) { alert('मोबाईल क्रमांक उपलब्ध नाही'); return; }
    const url = `https://wa.me/91${pm}?text=` + encodeURIComponent(msg);
    window.open(url, '_blank');
  });
  $('sms-remind').addEventListener('click', () => {
    if (!pm) { alert('मोबाईल क्रमांक उपलब्ध नाही'); return; }
    const url = `sms:${pm}?body=` + encodeURIComponent(msg);
    window.location.href = url;
  });
  $('close-modal').addEventListener('click', closeModal);
}

// Edit fee
window.editFee = async function (feeId) {
  const f = fees.find(x => x.id === feeId);
  if (!f) return;

  const s = students.find(x => x.id === f.student_id);
  if (!s) return;

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>Edit Fee — ${s.name}</h3>
      <input id="edit-amount" placeholder="रक्कम (Received)" value="${f.amount || 0}">
      <input id="edit-discount" placeholder="Discount (सवलत)" value="${f.discount || 0}">
      <input id="edit-receipt-no" placeholder="Receipt No" value="${f.receipt_no || ''}">
      <input id="edit-receipt-date" type="date" placeholder="Receipt Date" value="${f.receipt_date || ''}">
      <input id="edit-note" placeholder="टीप" value="${f.note || ''}">
      <div style="margin-top:.5rem;">
        <button id="save-edit-fee">Save</button>
        <button id="cancel-edit-fee" class="secondary">Cancel</button>
      </div>
    </div>
  `;
  showModal(html);

  $('save-edit-fee').addEventListener('click', async () => {
    const amt = parseFloat($('edit-amount').value || '0');
    const dsc = parseFloat($('edit-discount').value || '0');
    const rno = $('edit-receipt-no').value.trim();
    const rdt = $('edit-receipt-date').value;
    const note = $('edit-note').value;

    const payload = {
      amount: isNaN(amt) ? 0 : amt,
      discount: isNaN(dsc) ? 0 : dsc,
      receipt_no: rno,
      receipt_date: rdt || null,
      note
    };

    const { data, error } = await supa
      .from('fees')
      .update(payload)
      .eq('id', f.id)
      .select()
      .single();
    if (error) {
      alert('Fee update करताना त्रुटी');
      console.error(error);
      return;
    }
    const idx = fees.findIndex(x => x.id === f.id);
    if (idx !== -1) fees[idx] = data;

    renderStudents();
    calcStats();
    viewStudent(s.id);
  });

  $('cancel-edit-fee').addEventListener('click', () => {
    viewStudent(s.id);
  });
};

// ---------- Modal helpers ----------

function showModal(html) {
  const m = $('modal');
  m.innerHTML = html;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden', 'false');
  const first = m.querySelector('input,button,select,[tabindex]');
  if (first) first.focus();
}
function closeModal() {
  const m = $('modal');
  m.classList.add('hidden');
  m.innerHTML = '';
  m.setAttribute('aria-hidden', 'true');
}

// ---------- REPORTS ----------

function renderReportCourseOptions() {
  const sel = $('report-course');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- सर्व कोर्स --</option>';
  courses.forEach(c => {
    const o = document.createElement('option');
    o.value = c.name;
    o.textContent = c.name;
    sel.appendChild(o);
  });
}

$('generate-payment-report').addEventListener('click', () => {
  const course = $('report-course').value;
  const from = $('report-from').value;
  const to = $('report-to').value;

  const rows = [];
  students.forEach(s => {
    const fs = studentFees(s.id);
    fs.forEach(f => {
      const d = (f.date || '').slice(0, 10);
      if (course && s.course_name !== course) return;
      if (from && d < from) return;
      if (to && d > to) return;
      rows.push({
        type: 'payment',
        date: d,
        student: s.name,
        course: s.course_name,
        amount: Number(f.amount || 0),
        discount: Number(f.discount || 0),
        note: f.note || '',
        mobile: primaryMobile(s),
        receiptNo: f.receipt_no || '',
        receiptDate: f.receipt_date || ''
      });
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r =>
        `<div>${r.date} — ${r.student} (${r.course}) — Rec: ₹${fmt(r.amount)} (Disc: ₹${fmt(r.discount)}) — ${r.note}` +
        `${r.receiptNo ? ' | Rec#: ' + r.receiptNo : ''}` +
        `${r.receiptDate ? ' | R.Date: ' + r.receiptDate : ''}</div>`
      ).join('')
    : '<div>No records</div>';
  $('report-output').innerHTML = out;
});

$('generate-balance-report').addEventListener('click', () => {
  const course = $('report-course').value;
  const rows = [];

  students.forEach(s => {
    if (course && s.course_name !== course) return;
    const { totalFee, paid, disc, balance } = studentTotals(s);
    rows.push({
      type: 'balance',
      student: s.name,
      course: s.course_name,
      fee: totalFee,
      paid,
      discount: disc,
      balance,
      mobile: primaryMobile(s)
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r =>
        `<div>${r.student} (${r.course}) — Fee: ₹${fmt(r.fee)} | Paid: ₹${fmt(r.paid)} | Disc: ₹${fmt(r.discount)} | Balance: ₹${fmt(r.balance)}</div>`
      ).join('')
    : '<div>No records</div>';
  $('report-output').innerHTML = out;
});

$('generate-due-report').addEventListener('click', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];

  students.forEach(s => {
    if (!s.due_date) return;
    const { totalFee, paid, disc, balance } = studentTotals(s);
    if (balance <= 0) return;
    if (s.due_date > today) return;
    rows.push({
      type: 'due',
      student: s.name,
      course: s.course_name,
      dueDate: s.due_date,
      fee: totalFee,
      paid,
      discount: disc,
      balance,
      mobile: primaryMobile(s)
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r =>
        `<div>${r.dueDate} — ${r.student} (${r.course}) — Balance: ₹${fmt(r.balance)} | Mobile: ${r.mobile}</div>`
      ).join('')
    : '<div>No due / overdue records</div>';
  $('report-output').innerHTML = out;
});

// CSV export for reports
$('export-csv').addEventListener('click', () => {
  const rows = window._lastReport || [];
  if (!rows.length) {
    alert('Report रिकामी आहे');
    return;
  }

  let header;
  if (rows[0].type === 'payment') {
    header = 'Date,Student,Course,Amount,Discount,ReceiptNo,ReceiptDate,Note,Mobile';
  } else if (rows[0].type === 'due') {
    header = 'DueDate,Student,Course,TotalFee,Paid,Discount,Balance,Mobile';
  } else {
    header = 'Student,Course,TotalFee,Paid,Discount,Balance,Mobile';
  }

  const csvLines = [header];
  rows.forEach(r => {
    if (r.type === 'payment') {
      csvLines.push(
        `${r.date},"${r.student}","${r.course}",${fmt(r.amount)},${fmt(r.discount)},"${(r.receiptNo||'').replace(/"/g,'""')}","${(r.receiptDate||'').replace(/"/g,'""')}","${(r.note||'').replace(/"/g,'""')}",${r.mobile}`
      );
    } else if (r.type === 'due') {
      csvLines.push(
        `${r.dueDate},"${r.student}","${r.course}",${fmt(r.fee)},${fmt(r.paid)},${fmt(r.discount)},${fmt(r.balance)},${r.mobile}`
      );
    } else {
      csvLines.push(
        `"${r.student}","${r.course}",${fmt(r.fee)},${fmt(r.paid)},${fmt(r.discount)},${fmt(r.balance)},${r.mobile}`
      );
    }
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'itct-fees-report.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- SETTINGS: PASSWORD + USERS ----------

$('change-pass-btn').addEventListener('click', async () => {
  if (!isAdmin()) {
    alert('केवळ admin password बदलू शकतो.');
    return;
  }
  const np = $('new-pass').value;
  if (!np) {
    alert('New password टाका');
    return;
  }
  const adminUser = users.find(u => u.username === 'admin' && u.role === 'admin');
  if (!adminUser) {
    alert('"admin" user सापडला नाही.');
    return;
  }

  const { data, error } = await supa
    .from('users')
    .update({ password: np })
    .eq('id', adminUser.id)
    .select()
    .single();
  if (error) {
    alert('Password बदलताना त्रुटी');
    console.error(error);
    return;
  }
  adminUser.password = data.password;
  $('new-pass').value = '';
  alert('Admin password बदलला.');
});

$('add-user-btn').addEventListener('click', async () => {
  if (!isAdmin()) {
    alert('नवीन user add करण्याची परवानगी केवळ admin ला आहे.');
    return;
  }
  const uname = $('new-user-username').value.trim();
  const pass = $('new-user-password').value;
  const role = $('new-user-role').value;

  if (!uname || !pass) {
    alert('Username आणि Password टाका');
    return;
  }
  if (users.some(u => u.username === uname)) {
    alert('हा username आधीपासून अस्तित्वात आहे.');
    return;
  }

  const { data, error } = await supa
    .from('users')
    .insert({ username: uname, password: pass, role })
    .select()
    .single();
  if (error) {
    alert('User जतन झाला नाही');
    console.error(error);
    return;
  }
  users.push(data);
  $('new-user-username').value = '';
  $('new-user-password').value = '';
  $('new-user-role').value = 'data-entry';
  alert('User जतन झाला.');
  renderUsersList();
});

function renderUsersList() {
  if (!isAdmin()) return;
  const list = $('users-list');
  if (!list) return;

  list.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    li.textContent = `${u.username} (${u.role})`;

    if (!(u.username === 'admin' && u.role === 'admin')) {
      const btn = document.createElement('button');
      btn.textContent = 'Delete';
      btn.className = 'secondary';
      btn.style.marginLeft = '0.5rem';
      btn.addEventListener('click', async () => {
        if (!confirm(`User "${u.username}" delete करायचा?`)) return;
        const { error } = await supa.from('users').delete().eq('id', u.id);
        if (error) {
          alert('User delete करताना त्रुटी');
          console.error(error);
          return;
        }
        users = users.filter(x => x.id !== u.id);
        renderUsersList();
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  });
}

// ---------- BACKUP HELPERS & BUTTONS ----------

function downloadCSV(filename, rows) {
  if (!rows || !rows.length) {
    alert('No data found to backup.');
    return;
  }

  const headers = Object.keys(rows[0]).join(',');
  const dataLines = rows.map(row =>
    Object.values(row)
      .map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv = headers + '\n' + dataLines.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Students backup
$('backup-students').addEventListener('click', async () => {
  if (!isAdmin()) {
    alert('Backup फक्त admin साठी आहे.');
    return;
  }
  const { data, error } = await supa.from('students').select('*');
  if (error) {
    console.error(error);
    alert('Error fetching students for backup.');
    return;
  }
  downloadCSV('students_backup.csv', data);
});

// Fees backup
$('backup-fees').addEventListener('click', async () => {
  if (!isAdmin()) {
    alert('Backup फक्त admin साठी आहे.');
    return;
  }
  const { data, error } = await supa.from('fees').select('*');
  if (error) {
    console.error(error);
    alert('Error fetching fees for backup.');
    return;
  }
  downloadCSV('fees_backup.csv', data);
});

// Courses backup
$('backup-courses').addEventListener('click', async () => {
  if (!isAdmin()) {
    alert('Backup फक्त admin साठी आहे.');
    return;
  }
  const { data, error } = await supa.from('courses').select('*');
  if (error) {
    console.error(error);
    alert('Error fetching courses for backup.');
    return;
  }
  downloadCSV('courses_backup.csv', data);
});

// ---------- INIT ----------

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllData();
  } catch (e) {
    console.error(e);
    alert('Supabase वरून data लोड करताना त्रुटी आली.');
  }

  const dobInput = $('dob');
  if (dobInput) {
    dobInput.addEventListener('change', updateAgeFromDob);
    dobInput.addEventListener('blur', updateAgeFromDob);
  }
});
