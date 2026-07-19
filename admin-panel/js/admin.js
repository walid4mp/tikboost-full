/* TikBoost Admin Panel — Vanilla JS + Chart.js
   Talks to the same /api/admin/* endpoints the mobile app uses (JWT).
*/
const API = (() => {
  // Reads ?api= override or defaults to current origin.
  const params = new URLSearchParams(location.search);
  const base = (params.get('api') || location.origin + '/api').replace(/\/+$/,'');
  return { base };
})();

const store = {
  get access()  { return localStorage.getItem('tb_access');  },
  set access(v) { localStorage.setItem('tb_access', v); },
  get refresh() { return localStorage.getItem('tb_refresh'); },
  set refresh(v){ localStorage.setItem('tb_refresh', v); },
  get me()      { try { return JSON.parse(localStorage.getItem('tb_me')||'{}'); } catch { return {}; } },
  set me(v)     { localStorage.setItem('tb_me', JSON.stringify(v)); },
  clear()       { ['tb_access','tb_refresh','tb_me'].forEach(k => localStorage.removeItem(k)); },
};

async function api(path, opts={}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    opts.headers || {},
  );
  const access = store.access;
  if (access) headers['Authorization'] = 'Bearer ' + access;

  const res = await fetch(API.base + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  // Try silent refresh once on 401
  if (res.status === 401 && store.refresh && !path.startsWith('/admin-panel/login')) {
    const r = await fetch(API.base + '/admin-panel/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), // not used; we'll use a refresh path instead
    }).catch(() => null);
    // (intentionally not implemented here because the admin endpoint set already covers auth via JWT)
  }

  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.message) || `HTTP ${res.status}`);
    err.status = res.status; err.data = data; throw err;
  }
  return data;
}

// ===== Toast =====
const elToast = document.getElementById('toast');
let toastTimer = null;
function toast(msg, type='') {
  elToast.textContent = msg;
  elToast.classList.remove('hidden', 'success', 'err');
  if (type) elToast.classList.add(type);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.add('hidden'), 3000);
}

// ===== Login =====
const loginPage = document.getElementById('loginPage');
const loginForm = document.getElementById('loginForm');
const loginErr  = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErr.textContent = '';
  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'جاري الدخول...';
  try {
    // login via /api/admin-panel/login (role-checked)
    const r = await fetch(API.base + '/admin-panel/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(data.message || 'فشل الدخول');
    store.access  = data.accessToken;
    store.refresh = data.refreshToken;
    store.me      = data.admin;
    enterApp();
    toast('مرحباً ' + (data.admin.name || 'Admin'), 'success');
  } catch (err) {
    loginErr.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'دخول';
  }
});

// ===== App navigation =====
const sidebar = document.getElementById('sidebar');
const main    = document.getElementById('main');
const logoutBtn = document.getElementById('logoutBtn');

function enterApp() {
  loginPage.classList.add('hidden');
  sidebar.classList.remove('hidden');
  main.classList.remove('hidden');
  document.getElementById('meBox').querySelector('span').textContent =
    `${store.me.name || ''} (${store.me.role || ''}) • ${store.me.email || ''}`;
  loadDashboard();
}
logoutBtn.addEventListener('click', () => { store.clear(); location.reload(); });

document.querySelectorAll('.nav-btn').forEach(btn =>
  btn.addEventListener('click', () => switchPage(btn.dataset.page)));

document.getElementById('toggleSidebar').addEventListener('click', () =>
  sidebar.classList.toggle('open'));

function switchPage(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('hidden', p.dataset.page !== name));
  document.getElementById('pageTitle').textContent = ({
    dashboard: 'الإحصائيات', users: 'المستخدمون', campaigns: 'الحملات',
    purchases: 'المدفوعات', reports: 'البلاغات', notify: 'إرسال إشعار',
    logs: 'سجلات الإدارة', packages: 'الباقات',
  })[name] || '';
  ({ dashboard: loadDashboard, users: loadUsers, campaigns: loadCampaigns,
     purchases: loadPurchases, reports: loadReports, notify: loadNotify,
     logs: loadLogs, packages: loadPackages })[name]?.();
}

if (store.access && store.me && store.me.role) enterApp();

// ===== Dashboard =====
let chartActivity;
async function loadDashboard() {
  try {
    const stats = await api('/admin/stats');
    const top   = await api('/admin/stats/top-users');
    const series= await api('/admin/stats/chart?days=14');

    document.getElementById('kpiUsers').textContent     = stats.stats.users;
    document.getElementById('kpiCampaigns').textContent = stats.stats.campaigns;
    document.getElementById('kpiTasks').textContent     = stats.stats.tasksDone;
    document.getElementById('kpiRevenue').textContent   =
      '$' + (stats.stats.revenueCents/100).toFixed(2);

    const labels = series.series.map(d => d.date.slice(5));
    const sS = series.series.map(d => d.signups);
    const sT = series.series.map(d => d.tasks);
    const ctx = document.getElementById('chartActivity').getContext('2d');
    if (chartActivity) chartActivity.destroy();
    chartActivity = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'تسجيلات', data: sS, tension: .35, borderColor: '#FF3B5C', backgroundColor: 'rgba(255,59,92,0.2)', fill: true },
          { label: 'مهام',    data: sT, tension: .35, borderColor: '#2D7BFF', backgroundColor: 'rgba(45,123,255,0.2)', fill: true },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: '#F2F2F5' } } },
        scales: {
          x: { ticks: { color: '#8C8C99' }, grid: { color: '#26262F' } },
          y: { ticks: { color: '#8C8C99' }, grid: { color: '#26262F' }, beginAtZero: true },
        },
      },
    });

    const topEl = document.getElementById('topUsers');
    topEl.innerHTML = '';
    (top.items || []).forEach((u, i) => {
      topEl.insertAdjacentHTML('beforeend', `
        <div class="row">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(255,59,92,0.15);color:#FF3B5C;display:grid;place-items:center;font-weight:900">${i+1}</div>
          <div style="flex:1">
            <div><b>${esc(u.name||'')}</b></div>
            <div style="color:var(--muted);font-size:11px">${esc(u.email||'')}</div>
          </div>
          <div><b>${u.totalEarned}</b> نقطة</div>
        </div>
      `);
    });
  } catch (e) { toast(e.message, 'err'); }
}

// ===== Users =====
const userState = { page: 1, limit: 20, q: '', role: '', status: '', total: 0 };

async function loadUsers() {
  const q = document.getElementById('userQuery').value.trim();
  userState.q = q; userState.role = document.getElementById('userRole').value;
  userState.status = document.getElementById('userStatus').value; userState.page = 1;
  await fetchUsersPage();
}

document.getElementById('usersRefresh').addEventListener('click', loadUsers);
document.getElementById('userQuery')  .addEventListener('input', debounce(loadUsers, 350));
document.getElementById('usersPrev').addEventListener('click', () => { if (userState.page>1) { userState.page--; fetchUsersPage(); } });
document.getElementById('usersNext').addEventListener('click', () => { if (userState.page*userState.limit < userState.total) { userState.page++; fetchUsersPage(); } });

async function fetchUsersPage() {
  try {
    const params = new URLSearchParams({
      page: userState.page, limit: userState.limit,
      q: userState.q, role: userState.role, status: userState.status,
    });
    const data = await api('/admin/users?' + params.toString());
    userState.total = data.total;
    document.getElementById('usersPageInfo').textContent = `صفحة ${data.page} / ${Math.max(1, Math.ceil(data.total/data.limit))}`;
    const tbody = document.querySelector('#usersTable tbody');
    tbody.innerHTML = '';
    data.items.forEach(u => {
      const roleBadge = { USER:'gray', MODERATOR:'blue', FINANCE:'blue', ADMIN:'warn', SUPER_ADMIN:'red' }[u.role] || 'gray';
      const stBadge   = { ACTIVE:'green', FROZEN:'warn', BANNED:'red' }[u.status] || 'gray';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><a href="#" data-user="${u.id}" class="row-link">${esc(u.name||'')}</a></td>
          <td>${esc(u.email||'')}</td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td><span class="badge ${stBadge}">${u.status}</span></td>
          <td><b>${u.points}</b></td>
          <td>${esc(u.referralCode||'')}</td>
          <td>${new Date(u.createdAt).toLocaleDateString()}</td>
          <td>
            <button class="act" data-act="points" data-id="${u.id}">+نقاط</button>
            <button class="act warn" data-act="freeze" data-id="${u.id}">تجميد</button>
            <button class="act warn" data-act="unfreeze" data-id="${u.id}">فك</button>
            <button class="act danger" data-act="ban" data-id="${u.id}">حظر</button>
            <button class="act danger" data-act="delete" data-id="${u.id}">حذف</button>
          </td>
        </tr>
      `);
    });
    bindUserRowActions();
  } catch (e) { toast(e.message, 'err'); }
}

function bindUserRowActions() {
  document.querySelectorAll('#usersTable .act').forEach(b => b.addEventListener('click', () => userAction(b.dataset.act, b.dataset.id)));
  document.querySelectorAll('#usersTable .row-link').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault(); openUser(b.dataset.user);
  }));
}

async function userAction(act, id) {
  try {
    if (act === 'points') {
      const amt = parseInt(prompt('أدخل قيمة النقاط (موجب للإضافة، سالب للخصم) مثل: 5000 أو -1500', '5000') || '0', 10);
      if (!amt) return;
      await api(`/admin/users/${id}/grant-points`, { method: 'POST', body: { amount: amt, note: 'من لوحة الإدارة' } });
      toast('تم تعديل الرصيد', 'success');
    }
    if (act === 'freeze')   { await api(`/admin/users/${id}/freeze`,   { method: 'POST' }); toast('تم تجميد الحساب', 'success'); }
    if (act === 'unfreeze') { await api(`/admin/users/${id}/unfreeze`, { method: 'POST' }); toast('تم فك التجميد', 'success'); }
    if (act === 'ban') {
      const reason = prompt('سبب الحظر:', 'مخالفة الشروط') || 'مخالفة';
      await api(`/admin/users/${id}/ban`, { method: 'POST', body: { reason } });
      toast('تم حظر المستخدم', 'success');
    }
    if (act === 'delete') {
      if (!confirm('تأكيد الحذف النهائي؟')) return;
      await api(`/admin/users/${id}`, { method: 'DELETE' });
      toast('تم حذف المستخدم', 'success');
    }
    fetchUsersPage();
  } catch (e) { toast(e.message, 'err'); }
}

async function openUser(id) {
  try {
    const data = await api('/admin/users/' + id);
    const u = data.user;
    const modal = document.getElementById('userModal');
    document.getElementById('userModalTitle').textContent = u.name + ' • ' + u.email;
    const body = document.getElementById('userModalBody');
    body.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div><b>المعرّف:</b> ${u.id}</div>
          <div><b>الدور:</b> ${u.role}  <b>الحالة:</b> ${u.status}</div>
          <div><b>النقاط:</b> ${u.points}  <b>إجمالي مكتسب:</b> ${u.totalEarned}</div>
          <div><b>إجمالي منفق:</b> ${u.totalSpent}</div>
          <div><b>كود الإحالة:</b> ${u.referralCode}</div>
          <div><b>IP:</b> ${u.lastIp||'-'}</div>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="act" id="promoteMod">ترقية لـ MODERATOR</button>
            <button class="act" id="promoteFin">ترقية لـ FINANCE</button>
            <button class="act danger" id="demoteUser">إرجاع لـ USER</button>
          </div>
        </div>
        <div class="card">
          <h3>آخر العمليات (سجل النقاط)</h3>
          <div style="max-height:300px;overflow:auto">
            ${(data.logs||[]).map(l => `
              <div class="row" style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border)">
                <div style="font-size:12px;color:var(--muted)">${esc(l.reason)}</div>
                <div><b style="color:${Number(l.delta)>=0?'var(--green)':'var(--red)'}">${l.delta}</b> • ${esc(l.createdAt.slice(0,16).replace('T',' '))}</div>
              </div>`).join('') || '<div style="color:var(--muted)">لا توجد عمليات</div>'}
          </div>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
    document.getElementById('promoteMod').onclick = () => changeRole(id, 'MODERATOR', body);
    document.getElementById('promoteFin').onclick = () => changeRole(id, 'FINANCE',   body);
    document.getElementById('demoteUser').onclick= () => changeRole(id, 'USER',      body);
  } catch (e) { toast(e.message, 'err'); }
}

async function changeRole(id, role, container) {
  try {
    await api(`/admin/users/${id}/role`, { method: 'PUT', body: { role } });
    toast('تم تغيير الدور', 'success');
    openUser(id);
  } catch (e) { toast(e.message, 'err'); }
}

document.querySelectorAll('#userModal [data-close]').forEach(b =>
  b.addEventListener('click', () => document.getElementById('userModal').classList.add('hidden')));

// ===== Campaigns =====
async function loadCampaigns() {
  try {
    const data = await api('/admin/campaigns?limit=100');
    const tbody = document.querySelector('#campaignsTable tbody');
    tbody.innerHTML = '';
    data.items.forEach(c => {
      const prog = Math.round((c.completed/c.quantity)*100)||0;
      const stBadge = { ACTIVE:'green', PAUSED:'warn', COMPLETED:'blue', CANCELLED:'red' }[c.status] || 'gray';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${c.type}</td>
          <td>${esc(c.owner?.name||'')}<br><small style="color:var(--muted)">${esc(c.owner?.email||'')}</small></td>
          <td><span class="badge ${stBadge}">${c.status}</span></td>
          <td><div style="background:var(--card);border:1px solid var(--border);border-radius:8px;height:8px;width:140px;overflow:hidden">
            <div style="background:var(--red);height:100%;width:${prog}%"></div>
          </div><small>${c.completed}/${c.quantity} (${prog}%)</small></td>
          <td>${c.quantity}</td>
          <td><b>${c.pointsCost}</b></td>
          <td>${new Date(c.createdAt).toLocaleDateString()}</td>
          <td>
            ${c.status==='ACTIVE' ? '<button class="act warn" data-act="pause" data-id="'+c.id+'">إيقاف</button>' : ''}
            ${c.status==='PAUSED' ? '<button class="act success" data-act="resume" data-id="'+c.id+'">تشغيل</button>' : ''}
            ${['ACTIVE','PAUSED'].includes(c.status) ? '<button class="act danger" data-act="cancel" data-id="'+c.id+'">إلغاء</button>' : ''}
          </td>
        </tr>
      `);
    });
    document.querySelectorAll('#campaignsTable .act').forEach(b =>
      b.addEventListener('click', async () => {
        try { await api(`/admin/campaigns/${b.dataset.id}/action`, { method:'POST', body:{ action: b.dataset.act }}); toast('تم تحديث الحملة','success'); loadCampaigns(); }
        catch (e) { toast(e.message,'err'); }
      }));
  } catch (e) { toast(e.message, 'err'); }
}

// ===== Purchases =====
async function loadPurchases() {
  const status = document.getElementById('purchaseStatus').value;
  const data = await api(`/admin/purchases?limit=100${status?'&status='+status:''}`);
  const tbody = document.querySelector('#purchasesTable tbody');
  tbody.innerHTML = '';
  data.items.forEach(p => {
    const stBadge = { PENDING:'warn', APPROVED:'green', REJECTED:'red', REFUNDED:'gray' }[p.status] || 'gray';
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${esc(p.user?.name||'')}<br><small style="color:var(--muted)">${esc(p.user?.email||'')}</small></td>
        <td>${esc(p.package?.name||'')}</td>
        <td>${p.pointsGiven}</td>
        <td><b>$${(p.priceCents/100).toFixed(2)}</b></td>
        <td><span class="badge ${stBadge}">${p.status}</span></td>
        <td>${new Date(p.createdAt).toLocaleString()}</td>
        <td>
          ${p.status==='PENDING' ? `
            <button class="act success" data-act="approve" data-id="${p.id}">اعتماد</button>
            <button class="act danger"  data-act="reject"  data-id="${p.id}">رفض</button>
          ` : '-'}
        </td>
      </tr>
    `);
  });
  document.querySelectorAll('#purchasesTable .act').forEach(b =>
    b.addEventListener('click', async () => {
      try {
        if (b.dataset.act === 'approve') await api(`/admin/purchases/${b.dataset.id}/approve`, { method:'POST' });
        else { const reason = prompt('سبب الرفض', 'تحقق غير مكتمل') || 'Rejected';
               await api(`/admin/purchases/${b.dataset.id}/reject`, { method:'POST', body:{ reason }});}
        toast('تم','success'); loadPurchases();
      } catch (e) { toast(e.message,'err'); }
    }));
}
document.getElementById('purchasesRefresh').addEventListener('click', loadPurchases);

// ===== Reports =====
async function loadReports() {
  const data = await api('/admin/reports?limit=100');
  const tbody = document.querySelector('#reportsTable tbody');
  tbody.innerHTML = '';
  data.items.forEach(r => {
    const stBadge = { OPEN:'warn', REVIEWED:'green', DISMISSED:'gray' }[r.status] || 'gray';
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${esc(r.reporter?.name||'')}</td>
        <td>${esc(r.reported?.name||'')}</td>
        <td>${esc(r.reason||'')}<br><small style="color:var(--muted)">${esc(r.description||'')}</small></td>
        <td><span class="badge ${stBadge}">${r.status}</span></td>
        <td>${new Date(r.createdAt).toLocaleString()}</td>
        <td>
          ${r.status==='OPEN' ? `
            <button class="act success" data-act="REVIEWED" data-id="${r.id}">تم المعالجة</button>
            <button class="act danger"  data-act="DISMISSED" data-id="${r.id}">رفض البلاغ</button>
          ` : '-'}
        </td>
      </tr>
    `);
  });
  document.querySelectorAll('#reportsTable .act').forEach(b =>
    b.addEventListener('click', async () => {
      try { await api(`/admin/reports/${b.dataset.id}/resolve`, { method:'POST', body:{ decision: b.dataset.act }});
            toast('تم','success'); loadReports(); }
      catch (e) { toast(e.message,'err'); }
    }));
}

// ===== Notify =====
async function loadNotify() {
  try {
    const data = await api('/admin/users?limit=100');
    const sel = document.getElementById('notifyTarget');
    sel.innerHTML = '<option value="">جميع المستخدمين (Broadcast)</option>' +
      (data.items||[]).map(u => `<option value="${u.id}">${esc(u.name||'')} • ${esc(u.email||'')}</option>`).join('');
  } catch (e) { /* ignore */ }
}
document.getElementById('notifySend').addEventListener('click', async () => {
  try {
    await api('/admin/notifications/send', { method:'POST', body: {
      userId: document.getElementById('notifyTarget').value || null,
      title:  document.getElementById('notifyTitle').value,
      body:   document.getElementById('notifyBody').value,
      type:   document.getElementById('notifyType').value,
    }});
    toast('تم إرسال الإشعار', 'success');
  } catch (e) { toast(e.message,'err'); }
});

// ===== Logs =====
async function loadLogs() {
  const data = await api('/admin/logs?limit=100');
  const tbody = document.querySelector('#logsTable tbody');
  tbody.innerHTML = '';
  data.items.forEach(l => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${esc(l.actor?.name||'')}<br><small style="color:var(--muted)">${l.actor?.role||''}</small></td>
        <td><span class="badge blue">${l.action}</span></td>
        <td><small>${esc(l.target||'-')}</small></td>
        <td><small style="color:var(--muted)">${esc(JSON.stringify(l.details||{}))}</small></td>
        <td>${new Date(l.createdAt).toLocaleString()}</td>
      </tr>
    `);
  });
}

// ===== Packages =====
const PACKAGES = [
  { name: 'Starter', points: '100,000',   price: 1,  featured: false, color: '#2D7BFF' },
  { name: 'Basic',   points: '500,000',   price: 5,  featured: false, color: '#22C55E' },
  { name: 'Pro',     points: '1,000,000', price: 10, featured: true,  color: '#FF3B5C' },
  { name: 'Elite',   points: '2,800,000', price: 25, featured: false, color: '#A855F7' },
  { name: 'VIP',     points: '6,000,000', price: 50, featured: false, color: '#F59E0B' },
];
async function loadPackages() {
  let real = [];
  try { real = (await api('/packages')).packages || []; } catch (_) {}
  const wrap = document.getElementById('packagesList');
  wrap.innerHTML = '';
  PACKAGES.forEach((p, i) => {
    const live = real[i] || {};
    const card = document.createElement('div');
    card.className = 'pkg-card' + (p.featured ? ' featured' : '');
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3>${p.name}</h3>
        ${p.featured ? '<span class="badge red">الأكثر مبيعاً</span>' : ''}
      </div>
      <div class="pkg-price" style="color:${p.featured?'#fff':p.color}">$${p.price}</div>
      <div class="pkg-points">${p.points} نقطة</div>
      ${live.bonusPoints && Number(live.bonusPoints) > 0 ? `<div class="badge green">+${live.bonusPoints} هدية</div>` : ''}
      <div style="margin-top:14px;color:${p.featured?'#fff':'var(--muted)'};font-size:12px">
        الحالة: ${live.isActive !== false ? 'مفعّل' : 'معطّل'}
      </div>
    `;
    wrap.appendChild(card);
  });
}

// ===== Utils =====
function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
