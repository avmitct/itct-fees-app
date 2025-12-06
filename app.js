// ITCT Fees App - Phase 1 features
// - Dashboard
// - Discount in payments
// - Balance report + CSV export
// - WhatsApp / SMS reminders
// - Courses, settings, backup/restore

const DEFAULT_PASS = '1234';
const STORAGE_KEYS = {
  students: 'students_v2',
  courses:  'courses_v2',
  admin:    'admin_v2'
};

const $ = id => document.getElementById(id);
const { jsPDF } = window.jspdf || {};

// Load data (with fallback from older key if any)
let students = [];
let courses  = [];
let admin    = { pass: DEFAULT_PASS };

try {
  const s2 = localStorage.getItem(STORAGE_KEYS.students);
  const s1 = localStorage.getItem('students'); // old key fallback
  students = s2 ? JSON.parse(s2) : (s1 ? JSON.parse(s1) : []);
} catch(e){ students = []; }

try {
  const c2 = localStorage.getItem(STORAGE_KEYS.courses);
  courses = c2 ? JSON.parse(c2) : [];
} catch(e){ courses = []; }

try {
  const a2 = localStorage.getItem(STORAGE_KEYS.admin);
  admin = a2 ? JSON.parse(a2) : { pass: DEFAULT_PASS };
} catch(e){ admin = { pass: DEFAULT_PASS }; }

function saveAll(){
  localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students));
  localStorage.setItem(STORAGE_KEYS.courses,  JSON.stringify(courses));
  localStorage.setItem(STORAGE_KEYS.admin,    JSON.stringify(admin));
}

function fmt(n){ return Number(n || 0).toFixed(2); }
function findCourseByName(name){
  return courses.find(c => c.name === name) || null;
}

// Show sections helper
function showOnly(sectionId){
  ['dashboard-section','courses-section','student-form','students-list','reports-section','settings-section']
    .forEach(id => {
      const el = $(id);
      if(!el) return;
      if(id === sectionId) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
}

// LOGIN
$('login-btn').addEventListener('click', tryLogin);
$('admin-pass').addEventListener('keydown', e => {
  if(e.key === 'Enter') tryLogin();
});

function tryLogin(){
  const p = $('admin-pass').value;
  const currentPass = admin.pass || DEFAULT_PASS;
  if(p === currentPass){
    $('login-section').classList.add('hidden');
    $('app-section').classList.remove('hidden');
    renderCourses();
    renderCourseSelect();
    renderStudents();
    renderReportCourseOptions();
    calcStats();
  } else {
    alert('चुकीचा पासवर्ड');
  }
}

// Toolbar button actions
$('dashboard-btn').addEventListener('click', ()=>{
  showOnly('dashboard-section');
  calcStats();
});
$('manage-courses-btn').addEventListener('click', ()=>{
  showOnly('courses-section');
  renderCourses();
});
$('add-student-btn').addEventListener('click', ()=>{
  showOnly('student-form');
  renderCourseSelect();
  $('save-student-btn').dataset.editId = ''; // future use for editing
});
$('reports-btn').addEventListener('click', ()=>{
  showOnly('reports-section');
  renderReportCourseOptions();
});
$('settings-btn').addEventListener('click', ()=>{
  showOnly('settings-section');
});
$('backup-btn').addEventListener('click', exportBackup);
$('restore-btn').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', handleImport);

// Dashboard calculation
function calcStats(){
  let totalStudents = students.length;
  let totalFee = 0, totalPaid = 0, totalDiscount = 0;

  students.forEach(s => {
    const fee = Number(s.courseFee || 0);
    const paid = s.fees ? s.fees.reduce((a,b)=>a + Number(b.amount||0), 0) : 0;
    const disc = s.fees ? s.fees.reduce((a,b)=>a + Number(b.discount||0), 0) : 0;
    totalFee += fee;
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

// COURSE MANAGEMENT
$('add-course-btn').addEventListener('click', ()=>{
  const name = $('course-name').value.trim();
  const fee  = parseFloat($('course-fee').value || '0');
  if(!name || isNaN(fee)){
    alert('Course name आणि योग्य fee टाका');
    return;
  }
  courses.unshift({ name, fee });
  $('course-name').value = '';
  $('course-fee').value  = '';
  saveAll();
  renderCourses();
  renderCourseSelect();
  renderReportCourseOptions();
});

function renderCourses(){
  const list = $('courses-list');
  list.innerHTML = '';
  courses.forEach((c, idx) => {
    const li = document.createElement('li');
    li.textContent = `${c.name} — ₹${fmt(c.fee)}`;
    const btn = document.createElement('button');
    btn.textContent = 'Delete';
    btn.className = 'secondary';
    btn.style.marginLeft = '0.5rem';
    btn.addEventListener('click', ()=>{
      if(confirm('हा कोर्स delete करायचा?')){
        courses.splice(idx,1);
        saveAll();
        renderCourses();
        renderCourseSelect();
        renderReportCourseOptions();
      }
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function renderCourseSelect(){
  const sel = $('course-select');
  sel.innerHTML = '';
  if(courses.length === 0){
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '-- No courses added --';
    sel.appendChild(o);
    return;
  }
  courses.forEach(c =>{
    const o = document.createElement('option');
    o.value = c.name;
    o.textContent = `${c.name} — ₹${fmt(c.fee)}`;
    sel.appendChild(o);
  });
}

// STUDENT FORM
$('cancel-student-btn').addEventListener('click', ()=>{
  showOnly('students-list');
});

$('save-student-btn').addEventListener('click', ()=>{
  const s = {
    id: Date.now(),
    name: $('name').value.trim(),
    dob: $('dob').value.trim(),
    age: $('age').value.trim(),
    address: $('address').value.trim(),
    course: $('course-select').value,
    mobile: $('mobile').value.trim(),
    idproof: $('idproof').value.trim(),
    courseFee: 0,
    fees: []
  };

  if(!s.name || !s.course || !s.mobile){
    alert('कृपया * आवश्यक फील्ड भरा');
    return;
  }

  const selectedCourse = findCourseByName(s.course);
  s.courseFee = selectedCourse ? Number(selectedCourse.fee) : 0;

  students.unshift(s);
  saveAll();
  clearStudentForm();
  renderStudents();
  calcStats();
  showOnly('students-list');
});

function clearStudentForm(){
  ['name','dob','age','address','mobile','idproof'].forEach(id => $(id).value = '');
}

// STUDENTS LIST
$('search').addEventListener('input', e => renderStudents(e.target.value));

function renderStudents(filter = ''){
  const tpl = $('student-item-tpl');
  const list = $('list');
  list.innerHTML = '';

  const data = students.filter(s => (
    (s.name + ' ' + s.course + ' ' + s.mobile).toLowerCase()
      .includes(filter.toLowerCase())
  ));

  data.forEach(s => {
    const node = tpl.content.cloneNode(true);
    const nameEl = node.querySelector('.s-name');
    const metaEl = node.querySelector('.s-meta');

    const fee  = Number(s.courseFee || 0);
    const paid = s.fees ? s.fees.reduce((a,b)=>a + Number(b.amount||0),0) : 0;
    const disc = s.fees ? s.fees.reduce((a,b)=>a + Number(b.discount||0),0) : 0;
    const bal  = fee - paid - disc;

    nameEl.textContent = `${s.name} — ${s.course}`;
    metaEl.textContent = `मोबाईल: ${s.mobile} | Fee: ₹${fmt(fee)} | Paid: ₹${fmt(paid)} | Discount: ₹${fmt(disc)} | Balance: ₹${fmt(bal)}`;

    const li = node.querySelector('li');
    li.querySelector('.pay-btn').addEventListener('click', ()=> openPay(s.id));
    li.querySelector('.view-btn').addEventListener('click', ()=> viewStudent(s.id));
    li.querySelector('.delete-btn').addEventListener('click', ()=>{
      if(confirm('हा विद्यार्थी delete करायचा?')){
        students = students.filter(x => x.id !== s.id);
        saveAll();
        renderStudents();
        calcStats();
      }
    });

    list.appendChild(li);
  });
}

// PAYMENTS (with discount)
function openPay(id){
  const s = students.find(x => x.id === id);
  const fee  = Number(s.courseFee || 0);
  const paid = s.fees ? s.fees.reduce((a,b)=>a + Number(b.amount||0),0) : 0;
  const disc = s.fees ? s.fees.reduce((a,b)=>a + Number(b.discount||0),0) : 0;
  const bal  = fee - paid - disc;

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>फीस भरा — ${s.name}</h3>
      <p>Course: ${s.course}</p>
      <p>Total Fee: ₹${fmt(fee)} | Paid: ₹${fmt(paid)} | Discount: ₹${fmt(disc)} | Balance: ₹${fmt(bal)}</p>
      <input id="pay-amount" placeholder="रक्कम (Received)">
      <input id="pay-discount" placeholder="Discount (सवलत)">
      <input id="pay-note" placeholder="टीप">
      <div style="margin-top:.5rem;">
        <button id="confirm-pay">पुष्टी करा</button>
        <button id="close-modal" class="secondary">रद्द</button>
      </div>
    </div>
  `;
  showModal(html);

  $('confirm-pay').addEventListener('click', ()=>{
    const amt = parseFloat($('pay-amount').value || '0');
    const dsc = parseFloat($('pay-discount').value || '0');
    const note = $('pay-note').value;

    if((isNaN(amt) || amt <= 0) && (isNaN(dsc) || dsc <= 0)){
      alert('किमान Received किंवा Discount काहीतरी टाका');
      return;
    }

    if(!s.fees) s.fees = [];
    s.fees.push({
      id: Date.now(),
      amount: isNaN(amt) ? 0 : amt,
      discount: isNaN(dsc) ? 0 : dsc,
      note,
      date: new Date().toISOString()
    });

    saveAll();
    renderStudents();
    calcStats();
    closeModal();
    generateReceiptPDF(s, amt, dsc, note);
  });

  $('close-modal').addEventListener('click', closeModal);
}

// View student + Reminder buttons
function viewStudent(id){
  const s = students.find(x => x.id === id);
  const fee  = Number(s.courseFee || 0);
  const paid = s.fees ? s.fees.reduce((a,b)=>a + Number(b.amount||0),0) : 0;
  const disc = s.fees ? s.fees.reduce((a,b)=>a + Number(b.discount||0),0) : 0;
  const bal  = fee - paid - disc;

  const feesHtml = (s.fees || []).map(f => `
    <li>${new Date(f.date).toLocaleString()} — ₹${fmt(f.amount)} (Disc: ₹${fmt(f.discount||0)}) — ${f.note || ''}</li>
  `).join('') || '<li>रेकॉर्ड नाही</li>';

  const msg = 
`Namaskar ${s.name},
ITCT Fees Reminder
Course: ${s.course}
Total Fee: ₹${fmt(fee)}
Paid: ₹${fmt(paid)}
Discount: ₹${fmt(disc)}
Balance: ₹${fmt(bal)}
Please pay as early as possible.`;

  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>${s.name}</h3>
      <p>Course: ${s.course} | Fee: ₹${fmt(fee)}</p>
      <p>मोबाईल: ${s.mobile}</p>
      <p>पत्ता: ${s.address || '-'}</p>
      <h4>फीस रेकॉर्ड</h4>
      <ul>${feesHtml}</ul>
      <div style="margin-top:.5rem;">
        <button id="wa-remind">WhatsApp Reminder</button>
        <button id="sms-remind">SMS Reminder</button>
        <button id="close-modal" class="secondary">बंद</button>
      </div>
    </div>
  `;
  showModal(html);

  $('wa-remind').addEventListener('click', ()=>{
    const url = `https://wa.me/91${s.mobile}?text=` + encodeURIComponent(msg);
    window.open(url, '_blank');
  });

  $('sms-remind').addEventListener('click', ()=>{
    const url = `sms:${s.mobile}?body=` + encodeURIComponent(msg);
    window.location.href = url;
  });

  $('close-modal').addEventListener('click', closeModal);
}

// Modal helpers
function showModal(html){
  const m = $('modal');
  m.innerHTML = html;
  m.classList.remove('hidden');
  m.setAttribute('aria-hidden','false');
  const firstInput = m.querySelector('input,button,[tabindex]');
  if(firstInput) firstInput.focus();
}
function closeModal(){
  const m = $('modal');
  m.classList.add('hidden');
  m.innerHTML = '';
  m.setAttribute('aria-hidden','true');
}

// PDF Receipts
function generateReceiptPDF(student, amount, discount, note){
  const fee  = Number(student.courseFee || 0);
  const paid = student.fees.reduce((a,b)=>a + Number(b.amount||0),0);
  const disc = student.fees.reduce((a,b)=>a + Number(b.discount||0),0);
  const bal  = fee - paid - disc;
  const now  = new Date().toLocaleString();

  const content = 
`ITCT Computer Education, Nandurbar

Receipt

Student: ${student.name}
Course: ${student.course}

Total Fee : ₹${fmt(fee)}
Received  : ₹${fmt(amount || 0)}
Discount  : ₹${fmt(discount || 0)}
Paid Till : ₹${fmt(paid)}
Balance   : ₹${fmt(bal)}

Note: ${note || ''}
Date: ${now}`;

  if(typeof jsPDF !== 'undefined'){
    const doc = new jsPDF();
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(content, 170);
    doc.text(lines, 10, 10);
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `receipt_${student.id}_${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const w = window.open('', '_blank');
    w.document.write('<pre>'+content+'</pre>');
    w.document.close();
    w.print();
  }
}

// REPORTS
function renderReportCourseOptions(){
  const sel = $('report-course');
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
  const from = $('report-from').value;
  const to   = $('report-to').value;

  const rows = [];
  students.forEach(s=>{
    (s.fees || []).forEach(f=>{
      const d = (f.date || '').slice(0,10);
      if(course && s.course !== course) return;
      if(from && d < from) return;
      if(to   && d > to  ) return;
      rows.push({
        type: 'payment',
        date: d,
        student: s.name,
        course: s.course,
        amount: Number(f.amount||0),
        discount: Number(f.discount||0),
        note: f.note || '',
        mobile: s.mobile
      });
    });
  });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r => `<div>${r.date} — ${r.student} (${r.course}) — Rec: ₹${fmt(r.amount)} (Disc: ₹${fmt(r.discount)}) — ${r.note}</div>`).join('')
    : '<div>No records</div>';
  $('report-output').innerHTML = out;
});

$('generate-balance-report').addEventListener('click', ()=>{
  const course = $('report-course').value;

  const rows = students
    .filter(s => !course || s.course === course)
    .map(s=>{
      const fee  = Number(s.courseFee || 0);
      const paid = s.fees ? s.fees.reduce((a,b)=>a + Number(b.amount||0),0) : 0;
      const disc = s.fees ? s.fees.reduce((a,b)=>a + Number(b.discount||0),0) : 0;
      const bal  = fee - paid - disc;
      return {
        type: 'balance',
        student: s.name,
        course: s.course,
        fee,
        paid,
        discount: disc,
        balance: bal,
        mobile: s.mobile
      };
    });

  window._lastReport = rows;
  const out = rows.length
    ? rows.map(r => `<div>${r.student} (${r.course}) — Fee: ₹${fmt(r.fee)} | Paid: ₹${fmt(r.paid)} | Disc: ₹${fmt(r.discount)} | Balance: ₹${fmt(r.balance)}</div>`).join('')
    : '<div>No records</div>';
  $('report-output').innerHTML = out;
});

// CSV Export (Excel)
$('export-csv').addEventListener('click', ()=>{
  const rows = window._lastReport || [];
  if(!rows.length){
    alert('Report रिकामी आहे');
    return;
  }

  let header;
  if(rows[0].type === 'payment'){
    header = 'Date,Student,Course,Amount,Discount,Note,Mobile';
  } else {
    header = 'Student,Course,TotalFee,Paid,Discount,Balance,Mobile';
  }

  const csvLines = [header];

  rows.forEach(r=>{
    if(r.type === 'payment'){
      csvLines.push(
        `${r.date},"${r.student}","${r.course}",${fmt(r.amount)},${fmt(r.discount)},"${(r.note||'').replace(/"/g,'""')}",${r.mobile}`
      );
    } else {
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

// SETTINGS - Change admin password
$('change-pass-btn').addEventListener('click', ()=>{
  const np = $('new-pass').value;
  if(!np){
    alert('New password टाका');
    return;
  }
  admin.pass = np;
  saveAll();
  $('new-pass').value = '';
  alert('Password बदलला');
});

// BACKUP / RESTORE
function exportBackup(){
  const data = { students, courses, admin };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'itct-fees-backup.json';
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
      if(data.students && data.courses){
        students = data.students;
        courses  = data.courses;
        admin    = data.admin || admin;
        saveAll();
        alert('Backup import पूर्ण');
        renderCourses();
        renderCourseSelect();
        renderStudents();
        renderReportCourseOptions();
        calcStats();
      } else {
        alert('अवैध backup फाईल');
      }
    } catch(err){
      alert('फाईल वाचता आली नाही');
    }
  };
  reader.readAsText(f);
}

// Initial dashboard update if already logged (typically not, but safe)
document.addEventListener('DOMContentLoaded', ()=>{
  // nothing special; login नंतर सगळं run होईल
});
