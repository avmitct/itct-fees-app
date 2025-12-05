
// Features added: courses, balance calc, PDF receipts, change password
const DEFAULT_PASS = '1234';
const STORAGE_KEYS = {students: 'students_v2', courses: 'courses_v2', admin: 'admin_v2'};
const { jsPDF } = window.jspdf || {};

const $ = id => document.getElementById(id);

let students = JSON.parse(localStorage.getItem(STORAGE_KEYS.students) || '[]');
let courses = JSON.parse(localStorage.getItem(STORAGE_KEYS.courses) || '[]');
let admin = JSON.parse(localStorage.getItem(STORAGE_KEYS.admin) || JSON.stringify({pass: DEFAULT_PASS}));
admin = typeof admin === 'string' ? JSON.parse(admin) : admin;

// helpers
function saveAll(){ localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(students)); localStorage.setItem(STORAGE_KEYS.courses, JSON.stringify(courses)); localStorage.setItem(STORAGE_KEYS.admin, JSON.stringify(admin)); }
function fmt(n){ return Number(n||0).toFixed(2); }
function findCourseByName(name){ return courses.find(c=>c.name===name) || null; }

// UI navigation
function showSection(id){ ['courses-section','student-form','students-list','reports-section','settings-section'].forEach(s=>document.getElementById(s).classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }

// initial render
document.getElementById('login-btn').addEventListener('click', tryLogin);
document.getElementById('admin-pass').addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); });

function tryLogin(){
  const p = $('admin-pass').value;
  const currentPass = admin.pass || DEFAULT_PASS;
  if(p === currentPass){ $('login-section').classList.add('hidden'); $('app-section').classList.remove('hidden'); renderCourses(); renderStudents(); renderReportCourseOptions(); } else alert('चुकीचा पासवर्ड');
}

// toolbar buttons
$('manage-courses-btn').addEventListener('click', ()=>{ showSection('courses-section'); renderCourses(); });
$('add-student-btn').addEventListener('click', ()=>{ renderCourseSelect(); showSection('student-form'); $('save-student-btn').dataset.editIndex=''; });
$('reports-btn').addEventListener('click', ()=>{ showSection('reports-section'); renderReportCourseOptions(); });
$('settings-btn').addEventListener('click', ()=>{ showSection('settings-section'); });
$('backup-btn').addEventListener('click', exportBackup);
$('restore-btn').addEventListener('click', ()=>$('file-input').click());
$('file-input').addEventListener('change', handleImport);

// Course management
$('add-course-btn').addEventListener('click', ()=>{
  const name = $('course-name').value.trim(); const fee = parseFloat($('course-fee').value);
  if(!name || isNaN(fee)){ alert('Course name and valid fee required'); return; }
  courses.unshift({name, fee}); saveAll(); $('course-name').value=''; $('course-fee').value=''; renderCourses(); renderCourseSelect(); renderReportCourseOptions();
});
function renderCourses(){
  const list = $('courses-list'); list.innerHTML='';
  courses.forEach((c, idx)=>{
    const li = document.createElement('li'); li.textContent = c.name + ' — ₹' + fmt(c.fee);
    const del = document.createElement('button'); del.textContent='Delete'; del.className='secondary'; del.addEventListener('click', ()=>{ if(confirm('Delete course?')){ courses.splice(idx,1); saveAll(); renderCourses(); renderCourseSelect(); renderReportCourseOptions(); } });
    li.appendChild(del); list.appendChild(li);
  });
}

// Student form
$('cancel-student-btn').addEventListener('click', ()=>{ showSection('students-list'); });
$('save-student-btn').addEventListener('click', ()=>{
  const s = { id: Date.now(), name: $('name').value.trim(), dob: $('dob').value.trim(), age: $('age').value.trim(), address: $('address').value.trim(), course: $('course-select').value, mobile: $('mobile').value.trim(), idproof: $('idproof').value.trim(), fees: [] };
  if(!s.name || !s.course || !s.mobile){ alert('Please fill required fields'); return; }
  const selectedCourse = findCourseByName(s.course);
  s.courseFee = selectedCourse ? Number(selectedCourse.fee) : 0;
  students.unshift(s); saveAll(); clearForm(); renderStudents(); showSection('students-list');
});
function clearForm(){ ['name','dob','age','address','mobile','idproof'].forEach(id=>$(id).value=''); }

function renderCourseSelect(){
  const sel = $('course-select'); sel.innerHTML=''; courses.forEach(c=>{ const o = document.createElement('option'); o.value=c.name; o.textContent=c.name + ' — ₹' + fmt(c.fee); sel.appendChild(o); });
  if(courses.length===0){ const o=document.createElement('option'); o.value=''; o.textContent='-- No courses added --'; sel.appendChild(o); }
}

// Students list & actions
$('search').addEventListener('input',(e)=>renderStudents(e.target.value));
function renderStudents(filter=''){
  const tpl = document.getElementById('student-item-tpl'); const list = $('list'); list.innerHTML='';
  const data = students.filter(s=> (s.name+s.course+s.mobile).toLowerCase().includes(filter.toLowerCase()));
  data.forEach(s=>{
    const node = tpl.content.cloneNode(true);
    node.querySelector('.s-name').textContent = s.name + ' — ' + s.course;
    const paid = s.fees.reduce((a,b)=>a+b.amount,0); const bal = (s.courseFee || 0) - paid;
    node.querySelector('.s-meta').textContent = 'मोबाईल: '+s.mobile + ' | Fees: ₹' + fmt(s.courseFee || 0) + ' | Paid: ₹' + fmt(paid) + ' | Balance: ₹' + fmt(bal);
    const li = node.querySelector('li');
    li.querySelector('.pay-btn').addEventListener('click', ()=>openPay(s.id));
    li.querySelector('.view-btn').addEventListener('click', ()=>viewStudent(s.id));
    li.querySelector('.delete-btn').addEventListener('click', ()=>{ if(confirm('Delete student?')){ students = students.filter(x=>x.id!==s.id); saveAll(); renderStudents(); }});
    list.appendChild(li);
  });
}

// Payments
function openPay(id){
  const s = students.find(x=>x.id===id);
  const html = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <h3>फीस भरा — ${s.name}</h3>
      <p>Course: ${s.course} | Fee: ₹${fmt(s.courseFee||0)}</p>
      <input id="pay-amount" placeholder="रक्कम">
      <input id="pay-note" placeholder="टीप">
      <div style="margin-top:.5rem;">
        <button id="confirm-pay">पुष्टी करा</button>
        <button id="close-modal" class="secondary">रद्द</button>
      </div>
    </div>
  `;
  showModal(html);
  document.getElementById('confirm-pay').addEventListener('click', ()=>{
    const amt = parseFloat(document.getElementById('pay-amount').value); const note = document.getElementById('pay-note').value;
    if(!amt || isNaN(amt)){ alert('योग्य रक्कम टाका'); return; }
    s.fees.push({id: Date.now(), amount: amt, note: note, date: new Date().toISOString()});
    saveAll(); renderStudents(); closeModal(); generateReceiptPDF(s, amt, note);
  });
  document.getElementById('close-modal').addEventListener('click', closeModal);
}

function viewStudent(id){
  const s = students.find(x=>x.id===id);
  const feesHtml = s.fees.map(f=>`<li>${new Date(f.date).toLocaleString()} — ₹${fmt(f.amount)} — ${f.note||''}</li>`).join('');
  const html = `<div class="modal-card" role="dialog" aria-modal="true">
    <h3>${s.name}</h3>
    <p>Course: ${s.course} | Fee: ₹${fmt(s.courseFee||0)}</p>
    <p>मोबाईल: ${s.mobile}</p>
    <p>पत्ता: ${s.address||'-'}</p>
    <h4>फीस रेकॉर्ड</h4><ul>${feesHtml||'<li>नाही</li>'}</ul>
    <div style="margin-top:.5rem;"><button id="close-modal">बंद</button></div>
  </div>`;
  showModal(html);
  document.getElementById('close-modal').addEventListener('click', closeModal);
}

// Modal helpers
function showModal(html){
  const m=$('modal'); m.innerHTML = html; m.classList.remove('hidden'); m.setAttribute('aria-hidden','false');
  const firstInput = m.querySelector('input, button, [tabindex]'); if(firstInput) firstInput.focus();
}
function closeModal(){ const m=$('modal'); m.classList.add('hidden'); m.innerHTML=''; m.setAttribute('aria-hidden','true'); }

// Receipt generation (PDF using jsPDF if available, else open printable window)
function generateReceiptPDF(student, amt, note){
  const paid = student.fees.reduce((a,b)=>a+b.amount,0);
  const bal = (student.courseFee || 0) - paid;
  const now = new Date().toLocaleString();
  const content = `Receipt\nITCT Computer Education, Nandurbar\n\nStudent: ${student.name}\nCourse: ${student.course}\nAmount: ₹${fmt(amt)}\nPaid Till Now: ₹${fmt(paid)}\nBalance: ₹${fmt(bal)}\nNote: ${note||''}\nDate: ${now}`;
  if(typeof jsPDF !== 'undefined'){
    const doc = new jsPDF(); doc.setFontSize(12); const lines = doc.splitTextToSize(content, 170); doc.text(lines, 10, 10); const blob = doc.output('blob'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `receipt_${student.id}_${Date.now()}.pdf`; a.click(); URL.revokeObjectURL(url);
  } else {
    const w = window.open('', '_blank'); w.document.write('<pre>'+content+'</pre>'); w.document.close(); w.print();
  }
}

// Reports: by course and date range
function renderReportCourseOptions(){
  const sel = $('report-course'); sel.innerHTML = '<option value="">-- सर्व --</option>'; courses.forEach(c=>{ const o=document.createElement('option'); o.value=c.name; o.textContent=c.name; sel.appendChild(o); });
}
$('generate-report').addEventListener('click', ()=>{
  const course = $('report-course').value; const from = $('report-from').value; const to = $('report-to').value;
  const rows = [];
  students.forEach(s=>{
    s.fees.forEach(f=>{
      const d = f.date.slice(0,10);
      if(course && s.course!==course) return;
      if(from && d < from) return;
      if(to && d > to) return;
      rows.push({student: s.name, course: s.course, amount: f.amount, date: d, note: f.note||''});
    });
  });
  const out = rows.map(r=>`<div>${r.date} — ${r.student} — ${r.course} — ₹${fmt(r.amount)} — ${r.note}</div>`).join('') || '<div>No records</div>';
  $('report-output').innerHTML = out;
  window._lastReport = rows;
});
$('export-csv').addEventListener('click', ()=>{
  const rows = window._lastReport || []; if(!rows.length){ alert('No report to export'); return; }
  const csv = ['Date,Student,Course,Amount,Note', ...rows.map(r=>`${r.date},"${r.student}","${r.course}",${r.amount},"${(r.note||'').replace(/"/g,'""')}"`)].join('\n');
  const blob = new Blob([csv], {type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='report.csv'; a.click(); URL.revokeObjectURL(url);
});
$('export-pdf').addEventListener('click', ()=>{
  const rows = window._lastReport || []; if(!rows.length){ alert('No report to export'); return; }
  const content = rows.map(r=>`${r.date} - ${r.student} - ${r.course} - ₹${fmt(r.amount)} - ${r.note}`).join('\n');
  if(typeof jsPDF !== 'undefined'){ const doc = new jsPDF(); doc.setFontSize(11); doc.text(doc.splitTextToSize(content, 170), 10, 10); const blob = doc.output('blob'); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='report.pdf'; a.click(); URL.revokeObjectURL(url); } else { const w=window.open(''); w.document.write('<pre>'+content+'</pre>'); w.document.close(); w.print(); }
});

// Settings: change admin password
$('change-pass-btn').addEventListener('click', ()=>{
  const np = $('new-pass').value; if(!np){ alert('Enter new password'); return; } admin.pass = np; saveAll(); $('new-pass').value=''; alert('Password changed');
});

// Backup import/export
function exportBackup(){ const data = {students, courses, admin}; const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'fees-backup.json'; a.click(); URL.revokeObjectURL(url); }
function handleImport(e){ const f = e.target.files[0]; if(!f) return; const reader = new FileReader(); reader.onload = ()=>{ try{ const data = JSON.parse(reader.result); if(data.students && data.courses){ students = data.students; courses = data.courses; admin = data.admin || admin; saveAll(); alert('Backup imported'); renderCourses(); renderStudents(); renderReportCourseOptions(); } else alert('Invalid backup file'); } catch(err){ alert('Cannot read file'); } }; reader.readAsText(f); }

// initial render on load (if logged in already)
document.addEventListener('DOMContentLoaded', ()=>{ renderCourses(); renderStudents(); renderReportCourseOptions(); });
