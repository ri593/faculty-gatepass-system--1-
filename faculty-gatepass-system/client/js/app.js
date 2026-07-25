let currentUser = null;
let currentView = null;

/* ===================== HELPERS ===================== */
function toast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.style.display = 'flex';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => (t.style.display = 'none'), 3200);
}
function statusClass(s) { return 'status-' + s.replace(/\s+/g, '-'); }
function esc(s) { return (s || '').toString().replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
function roleLabel(role) {
  return { faculty: 'Faculty', hod: 'HOD', dean: 'Dean', student: 'Student', registrar: 'Registrar', security: 'Security', admin: 'Admin' }[role] || role;
}

const RNTU_PROGRAMS = [
  'B.Tech In Computer Science & Engineering',
  'B.Tech In Civil Engineering',
  'Bachelor Of Education',
  'B.Tech In Mechanical Engineering',
  'B.Tech In Electronics And Communication Engineering',
  'B.Sc. In Information Technology',
  'Bachelor Of Computer Application',
  'Bachelor Of Arts In Journalism And Mass Communication',
  'Bachelor Of Library Science',
  'B.Com.(Bachelor OF Commerce)',
  'Bachelor Of Arts',
  'Bachelor Of Business Administration',
  'Bachelor Of Arts And Bachelor Of Legislative Law',
  'Bachelor Of Legislative Law',
  'B. Tech In Electrical & Electronics Engineering',
  'Bsc In Nursing',
  'Bachelor Of Science In Yoga',
  'Bachelor Of Physiotherapy',
  'Bachelor In Medical Lab Technician',
  'Bachelor Of Science In Physics',
  'Bachelor Of Science In Chemistry',
  'Bachelor Of Science In Mathematics',
  'Bachelor Of Science In Forensic Sciences',
  'B.Sc. In Botany',
  'B.Sc. In Biotechnology',
  'B.Sc. In Microbiology',
  'B.Sc. In Zoology',
  'Bachelor Of Education (Part Time)',
  'Bachelor Of Physical Education',
  'Bachelor Of Physical Education And Sports',
  'Bachelor Of Pharmacy',
  'B.Sc. In Computer Science',
  'B.Sc. In Data Science',
  'Bachelor Of Science (Honours) Agriculture',
  'Post Basic B.Sc. Nursing Programme (2-Year Programme For Diploma Nurses)',
  'B.Tech In Computer Science Engineering (AI/ML)',
  'B.Tech In Computer Science Engineering (Data Science)',
  'BBA In Hospital Administration',
  'BBA (Business Analytics) SAMATRIX',
  'B.Tech (M.E.) (Digital Manufacturing Using AI And CPS)',
  'B.Tech (EEE) (Smart Semiconductor Device & Sustainable Power Engineering With AI Integration)',
  'B.Tech. (E.C.E.) (Semi-Conductor Design Framework For Industrial ICs)',
  'BCA Full Stack Web Development (Java)',
  'BCA AIML In Collaboration With Samatrix',
  'B Sc DS AIML In Collaboration With IBM',
  'B Sc CS AIML In Collaboration With IBM',
  'B Sc IT AIML In Collaboration With IBM',
  'B.Tech.(CSE) (Data Science) With Samatrix.io',
  'B.Tech. (CSE) (Full Stack Web Development) With L&T',
  'B.Tech AIML With SAMATRIX',
  'B.Com Banking & Finance In Collaboration With IIBF',
  'B.Com Practitioner Approach To Finance Essentials',
];

function fallbackDepartmentOptions() {
  return RNTU_PROGRAMS.map((name, index) => `<option value="offline-${index + 1}">${esc(name)}</option>`).join('');
}

/* ===================== LOGIN ===================== */
function showAuthMode(mode) {
  document.getElementById('loginForm').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = mode === 'register' ? 'block' : 'none';
  if (mode === 'register') loadRegisterDepartments();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setSession(data.token, data.user);
    enterApp(data.user);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';
  const body = {
    name: document.getElementById('regName').value.trim(),
    employeeId: document.getElementById('regEmployeeId').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    password: document.getElementById('regPassword').value,
    role: document.getElementById('regRole').value,
    departmentId: document.getElementById('regDepartment').value,
    phone: document.getElementById('regPhone').value.trim(),
  };
  if (String(body.departmentId).startsWith('offline-')) {
    errEl.textContent = 'Departments are loaded offline right now. Start the API server, then reopen Create account so the real database departments load.';
    return;
  }
  try {
    const res = await api('/auth/register', { method: 'POST', body });
    toast(res.message);
    document.getElementById('loginEmail').value = body.email;
    document.getElementById('registerForm').reset();
    showAuthMode('login');
  } catch (err) {
    errEl.textContent = err.message;
  }
});

async function loadRegisterDepartments() {
  const select = document.getElementById('regDepartment');
  if (select.dataset.loaded === 'true' && select.dataset.source !== 'fallback') return;
  select.innerHTML = '<option value="">Loading departments...</option>';
  try {
    const rows = await api('/auth/departments');
    select.innerHTML = rows.map(d => `<option value="${d.id}">${esc(d.department_name)} (${esc(d.dept_code)})</option>`).join('');
    select.dataset.loaded = 'true';
    select.dataset.source = 'api';
    document.getElementById('registerError').textContent = '';
  } catch (err) {
    select.innerHTML = fallbackDepartmentOptions();
    select.dataset.loaded = 'true';
    select.dataset.source = 'fallback';
    document.getElementById('registerError').textContent = 'Using offline RNTU program list. Start the API server to create and save accounts.';
  }
}

function enterApp(user) {
  currentUser = user;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('frame').style.display = 'flex';
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoRole').textContent = roleLabel(user.role);
  renderSidebar();
}
function logout() {
  clearSession();
  currentUser = null;
  currentView = null;
  document.getElementById('frame').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginForm').reset();
  showAuthMode('login');
}

/* Check the API is actually reachable before the person even tries to log in --
   turns "Failed to fetch" into a plain-language banner instead of a login error. */
(async function checkApiStatus() {
  const el = document.getElementById('apiStatus');
  if (!el) return;
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('bad status');
    el.className = 'api-status show good';
    el.innerHTML = `<span class="dot2"></span><span>Connected to API at ${API_BASE.replace('/api', '')}</span>`;
    setTimeout(() => { el.classList.remove('show'); }, 2500);
  } catch (err) {
    el.className = 'api-status show bad';
    el.innerHTML = `<span class="dot2"></span><span>Can't reach the API at ${API_BASE.replace('/api', '')}. Start it with <code>npm start</code> in /server, or check CLIENT_ORIGIN in server/.env matches this page's origin (${window.location.origin}).</span>`;
  }
})();

/* ===================== SIDEBAR / ROUTING ===================== */
const NAV = {
  faculty:   [['dashboard','🏠 Dashboard'],['create','➕ New Gate Pass'],['history','📋 My Pass History']],
  dean:      [['dashboard','🏠 Dashboard'],['create','📝 Apply Leave'],['my-history','📋 My Leave History'],['history','🏛️ Department History']],
  student:   [['dashboard','🏠 Dashboard'],['create','📝 Apply Leave'],['history','📋 My Leave History']],
  hod:       [['dashboard','🏠 Dashboard'],['create','📝 Apply Leave'],['my-history','📋 My Leave History'],['history','🏛️ Department History']],
  registrar: [['dashboard','🏠 Dashboard'],['pending','⏳ Pending Approval'],['history','📂 All Passes']],
  security:  [['dashboard','🔍 Scan Gate Pass'],['history','📊 Exit / Entry Log']],
  admin:     [['dashboard','📊 Overview'],['users','👥 Users'],['departments','🏢 Departments'],['reports','📈 Reports']],
};
function renderSidebar() {
  const items = NAV[currentUser.role];
  if (!items) {
    toast(`No menu configured for role: ${currentUser.role}`);
    logout();
    return;
  }

  const sb = document.getElementById('sidebar');

  sb.innerHTML = items.map(([key, label]) =>
    `<button data-key="${key}" onclick="goTo('${key}')">${label}</button>`
  ).join('');

  goTo(items[0][0]);
}
function goTo(key) {
  currentView = key;
  document.querySelectorAll('#sidebar button').forEach(b => b.classList.toggle('active', b.dataset.key === key));
  const renderers = { faculty: renderFaculty, dean: renderDean, student: renderFaculty, hod: renderHod, registrar: renderRegistrar, security: renderSecurity, admin: renderAdmin };
  renderers[currentUser.role](key);
}
function loading() { document.getElementById('main').innerHTML = `<div class="loading">Loading…</div>`; }

/* Resume session after route constants exist, otherwise renderSidebar can read
   NAV before its const binding has been initialized. */
(function tryResume() {
  const token = getToken();
  const user = getUser();
  if (token && user) enterApp(user);
})();

/* ===================== SHARED: PASS CARD ===================== */
function passCard(p, actionsHtml, showQr) {
  const requesterMeta = [
    p.requester_role ? roleLabel(p.requester_role) : null,
    p.department_name ? `${p.department_name} Department` : null,
    p.employee_id || null,
  ].filter(Boolean).map(esc).join(' · ');
  return `
  <div class="pass-card">
    <div class="pass-main">
      <div class="pass-id">${p.pass_code} · ${p.pass_date}</div>
      <div class="pass-name">${esc(p.faculty_name)}</div>
      <div class="pass-dept">${requesterMeta}</div>
      <div class="pass-grid">
        <div><div class="k">Purpose</div><div class="v">${esc(p.purpose)}</div></div>
        <div><div class="k">Out Time</div><div class="v">${esc(p.out_time)}</div></div>
        <div><div class="k">Expected Return</div><div class="v">${esc(p.expected_return)}</div></div>
        ${p.actual_exit ? `<div><div class="k">Actual Exit</div><div class="v">${p.actual_exit}</div></div>` : ''}
        ${p.actual_return ? `<div><div class="k">Actual Return</div><div class="v">${p.actual_return}</div></div>` : ''}
      </div>
      ${actionsHtml ? `<div class="pass-actions">${actionsHtml}</div>` : ''}
    </div>
    <div class="pass-stub">
      <span class="status-chip ${statusClass(p.status)}">${p.status}</span>
      ${showQr && p.qr_code_path ? `<div class="qr-mini"><img src="${fileUrl(p.qr_code_path)}" alt="QR for ${p.pass_code}"></div>` : ''}
      ${showQr && p.pdf_path ? `<a href="${fileUrl(p.pdf_path)}" target="_blank" style="font-size:11px; margin-top:8px; color:var(--steel); text-decoration:underline;">Download PDF</a>` : ''}
    </div>
  </div>`;
}

function downloadActions(pass) {
  // QR and PDF are only generated when the Registrar gives final approval.
  // Do NOT show download buttons for any other status.
  const isApprovedOrCompleted = pass.status === 'Approved' || pass.status === 'Completed';
  if (!isApprovedOrCompleted) return '';
  const links = [];
  if (pass.qr_code_path) {
    links.push(`<a class="btn btn-secondary" href="${fileUrl(pass.qr_code_path)}" target="_blank" download>Download QR</a>`);
  }
  if (pass.pdf_path) {
    links.push(`<a class="btn btn-primary" href="${fileUrl(pass.pdf_path)}" target="_blank" download>Download PDF</a>`);
  }
  return links.join('');
}

/* ===================== FACULTY VIEW ===================== */
async function renderFaculty(key) {
  const main = document.getElementById('main');
  if (key === 'dashboard') {
    loading();
    try {
      const { totals, recent } = await api('/faculty/dashboard');
      main.innerHTML = `
        <h2 class="pagetitle">${roleLabel(currentUser.role)} Dashboard</h2>
        <div class="subtle">Welcome back, ${esc(currentUser.name)}. Here's the status of your leave requests.</div>
        <div class="stats">
          <div class="stat"><div class="n">${totals.total}</div><div class="l">Total requests</div></div>
          <div class="stat"><div class="n">${totals.pending}</div><div class="l">Awaiting approval</div></div>
          <div class="stat"><div class="n">${totals.approved}</div><div class="l">Approved / completed</div></div>
        </div>
        <div id="passList"></div>`;
      const list = document.getElementById('passList');
      list.innerHTML = recent.length
        ? recent.map(p => passCard(p, '', p.status === 'Approved' || p.status === 'Completed')).join('')
        : `<div class="empty">No leave requests yet. Create one from "${currentUser.role === 'faculty' ? 'New Gate Pass' : 'Apply Leave'}".</div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  if (key === 'create') {
    main.innerHTML = `
      <h2 class="pagetitle">${currentUser.role === 'faculty' ? 'New Gate Pass Request' : 'Apply for Leave'}</h2>
      <div class="subtle">${currentUser.role === 'student' ? 'Student leave is approved only by your HOD.' : 'Your request will route to your HOD, then the Registrar.'}</div>
      <div class="formcard">
        <div class="field"><label>Purpose</label><input id="f_purpose" placeholder="e.g. Bank Work, Medical Appointment"></div>
        <div class="row2">
          <div class="field"><label>Out Time</label><input id="f_out" placeholder="e.g. 11:00 AM"></div>
          <div class="field"><label>Expected Return</label><input id="f_return" placeholder="e.g. 2:00 PM"></div>
        </div>
        <div class="field"><label>Date</label><input id="f_date" type="date"></div>
        <div class="field"><label>Remarks (optional)</label><textarea id="f_remarks" rows="3" placeholder="Additional context for your HOD"></textarea></div>
        <button class="btn btn-primary" id="submitBtn" onclick="submitPass()">Submit request</button>
      </div>`;
    document.getElementById('f_date').valueAsDate = new Date();
  }
  if (key === 'history') {
    loading();
    try {
      const mine = await api('/faculty/history');
      main.innerHTML = `
        <h2 class="pagetitle">My Leave History</h2>
        <div class="subtle">Full record of every request you've submitted.</div>
        <table>
          <thead><tr><th>Pass ID</th><th>Date</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${mine.map(p => `<tr>
              <td><b>${p.pass_code}</b></td>
              <td>${p.pass_date}</td>
              <td>${esc(p.purpose)}</td>
              <td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td>
              <td>${downloadActions(p) || '—'}</td>
            </tr>`).join('') || '<tr><td colspan="5">No records yet.</td></tr>'}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
}
async function submitPass() {
  const purpose = document.getElementById('f_purpose').value.trim();
  const outTime = document.getElementById('f_out').value.trim();
  const expectedReturn = document.getElementById('f_return').value.trim();
  const date = document.getElementById('f_date').value;
  const remarks = document.getElementById('f_remarks').value.trim();
  if (!purpose || !outTime || !expectedReturn || !date) { toast('Please fill in purpose, date, out time and expected return.'); return; }
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const res = await api('/faculty/create-pass', { method: 'POST', body: { purpose, outTime, expectedReturn, date, remarks } });
    toast(res.message);
    goTo((currentUser.role === 'hod' || currentUser.role === 'dean') ? 'my-history' : 'dashboard');
  } catch (err) {
    toast(err.message);
    btn.disabled = false; btn.textContent = 'Submit request';
  }
}

/* ===================== HOD VIEW ===================== */
async function renderHod(key) {
  const main = document.getElementById('main');
  if (key === 'create') return renderFaculty('create');
  if (key === 'my-history') return renderFaculty('history');
  if (key === 'dashboard') {
    loading();
    try {
      const [pending, myPassesData] = await Promise.all([
        api('/hod/pending'),
        api('/faculty/dashboard').catch(() => ({ totals: { total: 0 }, recent: [] }))
      ]);
      const myRecent = myPassesData.recent || [];

      main.innerHTML = `
        <h2 class="pagetitle">HOD Dashboard</h2>
        <div class="subtle">Department gate pass management for ${esc(currentUser.department || 'your department')}.</div>

        ${myRecent.length ? `
          <div style="margin-bottom:30px;">
            <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">My Applied Gate Passes &amp; QR Codes</h3>
            <div id="myPassList">
              ${myRecent.map(p => passCard(p, downloadActions(p), p.status === 'Approved' || p.status === 'Completed')).join('')}
            </div>
          </div>
        ` : ''}

        <div>
          <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">Pending Department Approvals (${pending.length})</h3>
          <div id="passList">
            ${pending.length
              ? pending.map(p => passCard(p, `
                  <button class="btn btn-approve" onclick="hodDecision(${p.id},'approve')">Approve</button>
                  <button class="btn btn-reject" onclick="hodDecision(${p.id},'reject')">Reject</button>
                  ${downloadActions(p)}`, false)).join('')
              : `<div class="empty">No pending requests in your department right now.</div>`}
          </div>
        </div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  if (key === 'history') {
    loading();
    try {
      const rows = await api('/hod/history');
      main.innerHTML = `
        <h2 class="pagetitle">Department History</h2>
        <div class="subtle">All gate pass activity within ${esc(currentUser.department || 'your department')}.</div>
        <table>
          <thead><tr><th>Pass ID</th><th>Requester</th><th>Date</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(p => `<tr><td>${p.pass_code}</td><td>${esc(p.faculty_name)}</td><td>${p.pass_date}</td><td>${esc(p.purpose)}</td><td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td><td>${downloadActions(p) || '—'}</td></tr>`).join('') || '<tr><td colspan="6">No records yet.</td></tr>'}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
}
async function hodDecision(id, action) {
  try {
    const res = await api(`/hod/${action}/${id}`, { method: 'PUT', body: {} });
    toast(res.message);
    goTo('dashboard');
  } catch (err) { toast(err.message); }
}

/* ===================== DEAN VIEW ===================== */
async function renderDean(key) {
  const main = document.getElementById('main');
  if (key === 'create') return renderFaculty('create');
  if (key === 'my-history') return renderFaculty('history');
  if (key === 'dashboard') {
    loading();
    try {
      const [pending, myPassesData] = await Promise.all([
        api('/dean/pending'),
        api('/faculty/dashboard').catch(() => ({ totals: { total: 0 }, recent: [] }))
      ]);
      const myRecent = myPassesData.recent || [];

      main.innerHTML = `
        <h2 class="pagetitle">Dean Dashboard</h2>
        <div class="subtle">Department sign-off panel for ${esc(currentUser.department || 'your department')}.</div>

        ${myRecent.length ? `
          <div style="margin-bottom:30px;">
            <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">My Applied Gate Passes &amp; QR Codes</h3>
            <div id="myPassList">
              ${myRecent.map(p => passCard(p, downloadActions(p), p.status === 'Approved' || p.status === 'Completed')).join('')}
            </div>
          </div>
        ` : ''}

        <div>
          <h3 style="font-size:16px; font-weight:700; margin-bottom:12px;">Pending Dean Approvals (${pending.length})</h3>
          <div id="passList">
            ${pending.length
              ? pending.map(p => passCard(p, `
                  <button class="btn btn-approve" onclick="deanDecision(${p.id},'approve')">Approve</button>
                  <button class="btn btn-reject" onclick="deanDecision(${p.id},'reject')">Reject</button>
                  ${downloadActions(p)}`, false)).join('')
              : `<div class="empty">No pending requests for your department right now.</div>`}
          </div>
        </div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  } else if (key === 'history') {
    loading();
    try {
      const rows = await api('/dean/history');
      main.innerHTML = `
        <h2 class="pagetitle">Department History</h2>
        <div class="subtle">All gate pass activity within ${esc(currentUser.department || 'your department')}.</div>
        <table>
          <thead><tr><th>Pass ID</th><th>Requester</th><th>Date</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.map(p => `<tr><td>${p.pass_code}</td><td>${esc(p.faculty_name)}</td><td>${p.pass_date}</td><td>${esc(p.purpose)}</td><td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td><td>${downloadActions(p) || '—'}</td></tr>`).join('') || '<tr><td colspan="6">No records yet.</td></tr>'}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
}
async function deanDecision(id, action) {
  try {
    const res = await api(`/dean/${action}/${id}`, { method: 'PUT', body: {} });
    toast(res.message);
    goTo('dashboard');
  } catch (err) { toast(err.message); }
}

/* ===================== REGISTRAR VIEW ===================== */
async function renderRegistrar(key) {
  const main = document.getElementById('main');

  /* ── DASHBOARD ─────────────────────────────────────────── */
  if (key === 'dashboard') {
    loading();
    try {
      const [{ totals, recent }, pending] = await Promise.all([
        api('/registrar/stats'),
        api('/registrar/pending'),
      ]);

      const statCards = [
        { label: 'Total Passes',      n: totals.total,     cls: '',       icon: '📋' },
        { label: 'Awaiting My Sign-off', n: totals.pending, cls: 'sky',   icon: '⏳' },
        { label: 'Approved',          n: totals.approved,  cls: 'teal',   icon: '✅' },
        { label: 'Completed',         n: totals.completed, cls: 'violet', icon: '🏁' },
        { label: 'Rejected',          n: totals.rejected,  cls: 'clay',   icon: '❌' },
        { label: 'Submitted Today',   n: totals.today,     cls: '',       icon: '📅' },
      ];

      main.innerHTML = `
        <h2 class="pagetitle">Registrar Dashboard</h2>
        <div class="subtle">Final approval authority for all faculty gate passes across the institution.</div>

        <div class="stats">
          ${statCards.map(s => `
            <div class="stat ${s.cls}">
              <div class="stat-icon">${s.icon}</div>
              <div class="n">${s.n ?? 0}</div>
              <div class="l">${s.label}</div>
            </div>`).join('')}
        </div>

        ${pending.length ? `
          <div class="section-head">
            <h3>⏳ Awaiting Your Approval (${pending.length})</h3>
          </div>
          <div id="pendingList">
            ${pending.map(p => passCard(p, `
              <button class="btn btn-reject"  onclick="regDecision(${p.id},'reject')">✕ Reject</button>
              <button class="btn btn-amber"   onclick="regDecision(${p.id},'approve')">✔ Approve &amp; Generate Pass</button>
            `, false)).join('')}
          </div>
        ` : `
          <div class="section-head"><h3>⏳ Awaiting Your Approval</h3></div>
          <div class="empty" style="margin-bottom:28px;">Nothing pending final approval right now.</div>
        `}

        <div class="recent-activity">
          <div class="ra-header"><span class="ra-dot"></span> Recent Pass Activity</div>
          <table>
            <thead><tr><th>Pass ID</th><th>Requester</th><th>Department</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              ${recent.length
                ? recent.map(p => `<tr>
                    <td><b style="font-family:var(--mono)">${p.pass_code}</b></td>
                    <td>${esc(p.faculty_name)}</td>
                    <td style="font-size:12px;color:var(--steel)">${esc(p.department_name)}</td>
                    <td>${p.pass_date}</td>
                    <td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td>
                  </tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center;color:var(--steel)">No pass activity yet.</td></tr>'}
            </tbody>
          </table>
        </div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }

  /* ── PENDING APPROVAL ──────────────────────────────────── */
  if (key === 'pending') {
    loading();
    try {
      const pending = await api('/registrar/pending');
      main.innerHTML = `
        <h2 class="pagetitle">Pending Final Approval</h2>
        <div class="subtle">${pending.length} request(s) with HOD/Dean approval, awaiting your final sign-off.</div>
        <div id="passList"></div>`;
      const list = document.getElementById('passList');
      list.innerHTML = pending.length
        ? pending.map(p => passCard(p, `
            <button class="btn btn-reject" onclick="regDecision(${p.id},'reject')">✕ Reject</button>
            <button class="btn btn-amber"  onclick="regDecision(${p.id},'approve')">✔ Approve &amp; Generate Pass</button>
          `, false)).join('')
        : `<div class="empty">Nothing pending final approval.</div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }

  /* ── ALL PASSES HISTORY ─────────────────────────────────── */
  if (key === 'history') {
    loading();
    try {
      const rows = await api('/registrar/all');
      main.innerHTML = `
        <h2 class="pagetitle">All Passes</h2>
        <div class="subtle">Complete record across every department — ${rows.length} total.</div>
        <table>
          <thead><tr><th>Pass ID</th><th>Requester</th><th>Department</th><th>Date</th><th>Status</th><th>Downloads</th></tr></thead>
          <tbody>
            ${rows.map(p => `<tr>
              <td><b style="font-family:var(--mono)">${p.pass_code}</b></td>
              <td>${esc(p.faculty_name)}</td>
              <td style="font-size:12px;color:var(--steel)">${esc(p.department_name)}</td>
              <td>${p.pass_date}</td>
              <td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td>
              <td>${downloadActions(p) || '—'}</td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--steel)">No records yet.</td></tr>'}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
}

async function regDecision(id, action) {
  try {
    const res = await api(`/registrar/${action}/${id}`, { method: 'PUT', body: {} });
    toast(res.message);
    goTo('dashboard');
  } catch (err) { toast(err.message); }
}


/* ===================== SECURITY VIEW ===================== */
async function renderSecurity(key) {
  const main = document.getElementById('main');
  if (key === 'dashboard') {
    loading();
    try {
      const active = await api('/security/active');
      main.innerHTML = `
        <h2 class="pagetitle">Scan Gate Pass</h2>
        <div class="subtle">Enter a pass code to record exit or entry at the gate.</div>
        <div class="scan-box">
          <div style="font-family:var(--mono); font-size:11px; letter-spacing:.14em; color:var(--amber); text-transform:uppercase;">Live scanner</div>
          <input id="scanInput" placeholder="e.g. GP-1001" onkeydown="if(event.key==='Enter') doScan()">
          <div style="display:flex; gap:10px; margin-top:14px; justify-content:center;">
            <button class="btn btn-amber" onclick="doScan()">Verify pass</button>
          </div>
        </div>
        <div style="height:22px;"></div>
        <div class="subtle" style="margin-bottom:10px;">Approved passes ready for gate movement today</div>
        <div id="passList"></div>`;
      const list = document.getElementById('passList');
      list.innerHTML = active.length
        ? active.map(p => passCard(p, `<button class="btn btn-ghost" onclick="quickScan('${p.pass_code}')">Scan this pass</button>`, true)).join('')
        : `<div class="empty">No approved passes awaiting gate movement.</div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  if (key === 'history') {
    loading();
    try {
      const rows = await api('/security/log');
      main.innerHTML = `
        <h2 class="pagetitle">Exit / Entry Log</h2>
        <div class="subtle">Record of gate movements verified by security.</div>
        <table>
          <thead><tr><th>Pass ID</th><th>Requester</th><th>Exit</th><th>Return</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(p => `<tr><td>${p.pass_code}</td><td>${esc(p.faculty_name)}</td><td>${p.actual_exit || '—'}</td><td>${p.actual_return || '—'}</td><td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td></tr>`).join('') || '<tr><td colspan="5">No gate movements recorded yet.</td></tr>'}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
}
function quickScan(code) { document.getElementById('scanInput').value = code; doScan(); }
async function doScan() {
  const code = document.getElementById('scanInput').value.trim().toUpperCase();
  if (!code) return;
  try {
    const { pass, nextAction, valid } = await api('/security/scan', { method: 'POST', body: { passCode: code } });
    if (!valid) { toast(`${code} is not approved for gate movement (status: ${pass.status}).`); return; }
    if (nextAction === 'exit') {
      const res = await api('/security/exit', { method: 'PUT', body: { passCode: code } });
      toast(res.message);
    } else if (nextAction === 'entry') {
      const res = await api('/security/entry', { method: 'PUT', body: { passCode: code } });
      toast(res.message);
    } else {
      toast(`${code} has already completed its full gate cycle.`);
    }
    goTo('dashboard');
  } catch (err) { toast(err.message); }
}

/* ===================== ADMIN VIEW ===================== */
async function renderAdmin(key) {
  const main = document.getElementById('main');
  if (key === 'dashboard') {
    loading();
    try {
      const [users, departments, r] = await Promise.all([api('/admin/users'), api('/admin/departments'), api('/admin/reports')]);
      const total = r.byStatus.reduce((s, x) => s + Number(x.count), 0);
      const completed = r.byStatus.find(x => x.status === 'Completed')?.count || 0;
      main.innerHTML = `
        <h2 class="pagetitle">System Overview</h2>
        <div class="subtle">Snapshot of gate pass activity across the college.</div>
        <div class="stats">
          <div class="stat"><div class="n">${total}</div><div class="l">Total passes</div></div>
          <div class="stat"><div class="n">${users.length}</div><div class="l">Registered users</div></div>
          <div class="stat"><div class="n">${departments.length}</div><div class="l">Departments</div></div>
          <div class="stat"><div class="n">${completed}</div><div class="l">Completed cycles</div></div>
        </div>
        <div class="formcard" style="max-width:520px;">
          <div style="font-family:var(--disp); font-weight:700; margin-bottom:14px;">Requests by status</div>
          ${r.byStatus.map(s => `
            <div class="bar-row">
              <div class="bar-label">${s.status}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round(s.count / total * 100)}%"></div></div>
              <div class="bar-num">${s.count}</div>
            </div>`).join('')}
        </div>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  if (key === 'users') {
    loading();
    try {
      const rows = await api('/admin/users');
      main.innerHTML = `
        <h2 class="pagetitle">Users</h2>
        <div class="subtle">Everyone with access to the gate pass system.</div>
        <table>
          <thead><tr><th>Name</th><th>Employee ID</th><th>Department</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(u => `<tr><td>${esc(u.name)}</td><td>${u.employee_id}</td><td>${esc(u.department_name || '—')}</td><td>${roleLabel(u.role)}</td><td><span class="status-chip status-Approved">${u.status}</span></td></tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  if (key === 'departments') {
    loading();
    try {
      const rows = await api('/admin/departments');
      main.innerHTML = `
        <h2 class="pagetitle">Departments</h2>
        <div class="subtle">Departments configured in the system and their HODs.</div>
        <table>
          <thead><tr><th>Code</th><th>Department</th><th>HOD</th></tr></thead>
          <tbody>
            ${rows.map(d => `<tr><td>${d.dept_code}</td><td>${esc(d.department_name)}</td><td>${esc(d.hod_name || '—')}</td></tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  if (key === 'reports') {
    loading();
    try {
      const r = await api('/admin/reports');
      const rejected = r.byStatus.find(x => x.status === 'Rejected')?.count || 0;
      main.innerHTML = `
        <h2 class="pagetitle">Reports</h2>
        <div class="subtle">Quick analytics for review or export into your project report.</div>
        <div class="stats">
          <div class="stat"><div class="n">${rejected}</div><div class="l">Rejected requests</div></div>
          <div class="stat"><div class="n">${r.avgApprovalMinutes != null ? r.avgApprovalMinutes + 'm' : '—'}</div><div class="l">Avg. approval time</div></div>
          <div class="stat"><div class="n">${r.byDept.length}</div><div class="l">Depts. covered</div></div>
        </div>
        <table>
          <thead><tr><th>Pass ID</th><th>Requester</th><th>Dept</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>
            ${r.recent.map(p => `<tr><td>${p.pass_code}</td><td>${esc(p.faculty_name)}</td><td>${esc(p.department_name)}</td><td><span class="status-chip ${statusClass(p.status)}">${p.status}</span></td><td>${p.created_at}</td></tr>`).join('')}
          </tbody>
        </table>`;
    } catch (err) { main.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
}
