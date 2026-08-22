/* TikBoost Admin Panel — Vanilla JS + Chart.js
   Talks to the same /api/admin/* endpoints the mobile app uses (JWT).
*/
const API = (() => {
  // Reads ?api= override or defaults to current origin.
  const params = new URLSearchParams(location.search);
  const base = (params.get('api') || location.origin + '/api').replace(/\/+$/,'');
  return { base };
})();

let adminSocket = null;

function connectAdminNotifications() {
  if (!window.io || !store.access) return;
  try {
    adminSocket?.disconnect();
    const socketOrigin = API.base.replace(/\/api\/?$/, '');
    adminSocket = window.io(socketOrigin, {
      transports: ['websocket', 'polling'],
      auth: { token: store.access },
      withCredentials: true,
    });
    adminSocket.on('notification', (n) => {
      const title = String(n?.title || 'TikBoost');
      const body = String(n?.body || '');
      toast(`🔔 ${title}${body ? ' — ' + body : ''}`, 'success');
      if ('Notification' in window) {
        if (Notification.permission === 'granted') new Notification(title, { body });
        else if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      }
      if (String(n?.data?.event || '').startsWith('VIP_')) loadVip?.();
    });
  } catch (_) {}
}

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
  if (access) headers.Authorization = 'Bearer ' + access;

  const res = await fetch(API.base + path, {
    method: opts.method || 'GET',
    headers,
    credentials: 'include',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (res.status === 401 && store.refresh && !opts._retry && !path.startsWith('/admin-panel/login') && !path.startsWith('/auth/refresh')) {
    try {
      const refreshRes = await fetch(API.base + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: store.refresh }),
      });
      const refreshData = await refreshRes.json().catch(() => null);
      if (refreshRes.ok && refreshData?.accessToken && refreshData?.refreshToken) {
        store.access = refreshData.accessToken;
        store.refresh = refreshData.refreshToken;
        return api(path, { ...opts, _retry: true });
      }
    } catch {}
    store.clear();
    location.reload();
    throw new Error('انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.');
  }

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
      credentials: 'include',
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
    connectAdminNotifications();
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
    logs: 'سجلات الإدارة', rewards: 'الإعلانات والمكافآت', packages: 'الباقات', offers: 'العروض', adAnalytics: 'إحصائيات الإعلانات', vip: 'VIP PRO', admins: 'إدارة المدراء', passwordResets: 'استعادة كلمات المرور',
  })[name] || '';
  ({ dashboard: loadDashboard, users: loadUsers, campaigns: loadCampaigns,
     purchases: loadPurchases, reports: loadReports, notify: loadNotify,
     logs: loadLogs, rewards: loadRewardsAdmin, packages: loadPackages, offers: loadOffers, adAnalytics: loadAdAnalytics, vip: loadVip, admins: loadAdmins, passwordResets: loadPasswordResets })[name]?.();
  if (window.innerWidth <= 980) sidebar.classList.remove('open');
}

function applyAdminNavPermissions() {
  const role = store.me?.role;
  const permissions = Array.isArray(store.me?.adminPermissions) ? store.me.adminPermissions : [];
  if (role === 'SUPER_ADMIN' || permissions.length === 0 || permissions.includes('*')) return;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const page = btn.dataset.page;
    if (page === 'passwordResets' && !permissions.includes('users')) btn.classList.add('hidden');
    else if (page === 'adAnalytics' && !permissions.includes('analytics')) btn.classList.add('hidden');
    else if (page === 'vip' && !permissions.includes('rewards')) btn.classList.add('hidden');
    else if (page === 'admins') btn.classList.add('hidden');
    else if (!permissions.includes(page) && !['dashboard'].includes(page)) btn.classList.add('hidden');
  });
}

if (store.access && store.me && store.me.role) { applyAdminNavPermissions(); enterApp(); connectAdminNotifications(); }

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
          <td>${c.targetGender === 'MALE' ? 'ذكور' : c.targetGender === 'FEMALE' ? 'إناث' : 'الجميع'}<br><small style="color:var(--muted)">${c.targetCountry === 'WORLDWIDE' ? 'جميع الدول' : esc(c.targetCountry || 'WORLDWIDE')}</small></td>
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
    const data = await api('/admin/users?limit=200');
    const sel = document.getElementById('notifyTarget');
    sel.innerHTML = (data.items||[]).map(u => `<option value=\"${u.id}\">${esc(u.name||'')} • ${esc(u.email||'')}</option>`).join('');
    updateNotifyAudienceUI();
  } catch (e) { toast(e.message, 'err'); }
}

function updateNotifyAudienceUI() {
  const audience = document.getElementById('notifyAudience')?.value || 'ALL';
  document.getElementById('notifyTargetWrap')?.classList.toggle('hidden', audience !== 'SELECTED');
  const info = document.getElementById('notifyAudienceInfo');
  if (info) info.textContent = audience === 'ALL'
    ? 'سيتم إرسال الإشعار لجميع المستخدمين.'
    : audience === 'VIP_PRO'
      ? 'سيتم إرسال الإشعار تلقائياً إلى المستخدمين الذين لديهم VIP PRO فعال الآن.'
      : 'اختر مستخدماً أو أكثر من القائمة أدناه.';
}

document.getElementById('notifyAudience')?.addEventListener('change', updateNotifyAudienceUI);
document.getElementById('notifySend').addEventListener('click', async () => {
  try {
    const audience = document.getElementById('notifyAudience').value;
    const selected = Array.from(document.getElementById('notifyTarget').selectedOptions).map(o => o.value).filter(Boolean);
    if (audience === 'SELECTED' && !selected.length) throw new Error('اختر مستخدماً واحداً على الأقل');
    const btn = document.getElementById('notifySend');
    btn.disabled = true;
    const result = await api('/admin/notifications/send', { method:'POST', body: {
      audience, userIds: selected,
      title: document.getElementById('notifyTitle').value.trim(),
      body: document.getElementById('notifyBody').value.trim(),
      type: document.getElementById('notifyType').value,
    }});
    toast(`تم إرسال الإشعار (${result.count === 'all' ? 'للجميع' : result.count + ' مستخدم'})`, 'success');
  } catch (e) { toast(e.message, 'err'); }
  finally { document.getElementById('notifySend').disabled = false; }
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
async function loadPackages() {
  try {
    const data = await api('/admin/packages');
    const items = data.packages || data.items || [];
    const tbody = document.querySelector('#packagesTable tbody');
    tbody.innerHTML = '';
    items.forEach(p => {
      tbody.insertAdjacentHTML('beforeend', `<tr>
        <td>${esc(p.name)}</td><td>${(Number(p.priceCents||0)/100).toFixed(2)} ${esc(p.currency||'USD')}</td>
        <td>${esc(p.points)}</td><td>${esc(p.bonusPoints)}</td><td>${p.isActive ? 'مفعّلة' : 'معطّلة'}</td>
        <td><button class="act success package-edit" data-id="${p.id}">تعديل</button> <button class="act danger package-delete" data-id="${p.id}">حذف</button></td>
      </tr>`);
    });
    window._packages = items;
    document.querySelectorAll('.package-edit').forEach(b => b.addEventListener('click', () => editPackage(b.dataset.id)));
    document.querySelectorAll('.package-delete').forEach(b => b.addEventListener('click', () => deletePackage(b.dataset.id)));
  } catch (e) { toast(e.message, 'err'); }
}

function editPackage(id) {
  const p = (window._packages || []).find(x => x.id === id); if (!p) return;
  document.getElementById('packageId').value = p.id;
  document.getElementById('packageName').value = p.name || '';
  document.getElementById('packageSlug').value = p.slug || '';
  document.getElementById('packagePrice').value = (Number(p.priceCents || 0) / 100).toFixed(2);
  document.getElementById('packageCurrency').value = p.currency || 'USD';
  document.getElementById('packagePoints').value = p.points || 0;
  document.getElementById('packageBonus').value = p.bonusPoints || 0;
  document.getElementById('packageSort').value = p.sortOrder || 0;
  document.getElementById('packageActive').checked = p.isActive !== false;
}

function clearPackageForm() {
  ['packageId','packageName','packageSlug','packagePrice','packagePoints','packageBonus'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('packageCurrency').value = 'USD';
  document.getElementById('packageSort').value = 0;
  document.getElementById('packageActive').checked = true;
}

async function savePackage() {
  try {
    const id = document.getElementById('packageId').value;
    const body = { name: document.getElementById('packageName').value.trim(), slug: document.getElementById('packageSlug').value.trim(), priceCents: Math.round(Number(document.getElementById('packagePrice').value || 0) * 100), currency: document.getElementById('packageCurrency').value.trim().toUpperCase() || 'USD', points: document.getElementById('packagePoints').value || 0, bonusPoints: document.getElementById('packageBonus').value || 0, sortOrder: Number(document.getElementById('packageSort').value || 0), isActive: document.getElementById('packageActive').checked };
    await api(id ? `/admin/packages/${id}` : '/admin/packages', { method: id ? 'PUT' : 'POST', body });
    toast('تم حفظ الباقة', 'success'); clearPackageForm(); loadPackages();
  } catch (e) { toast(e.message, 'err'); }
}

async function deletePackage(id) {
  if (!confirm('حذف هذه الباقة؟ إذا كانت لها عمليات شراء سابقة سيتم تعطيلها بدلاً من حذف سجل المشتريات.')) return;
  try {
    const result = await api(`/admin/packages/${id}`, {method:'DELETE'});
    toast(result.deactivated ? 'تم تعطيل الباقة للحفاظ على سجل المشتريات' : 'تم حذف الباقة نهائياً', 'success');
    loadPackages();
  } catch(e) { toast(e.message, 'err'); }
}


// ===== Ad analytics =====
async function loadAdAnalytics() {
  try {
    const days = Number(document.getElementById('adAnalyticsDays')?.value || 30);
    const data = await api(`/admin/analytics/ads?days=${days}`);
    const t = data.totals || {};
    ['Total','BannerTotal','InterstitialTotal','RewardedTotal'].forEach(() => {});
    document.getElementById('adTotal').textContent = t.total || 0;
    document.getElementById('adBannerTotal').textContent = t.banner || 0;
    document.getElementById('adInterstitialTotal').textContent = t.interstitial || 0;
    document.getElementById('adRewardedTotal').textContent = t.rewarded || 0;
    document.getElementById('adUniqueViewers').textContent = t.uniqueViewers || 0;
    const tbody = document.querySelector('#adAnalyticsTable tbody');
    tbody.innerHTML = (data.items || []).map(u => `<tr>
      <td>${esc(u.name||'')}<br><small>${esc(u.email||'')}</small></td><td>${esc(u.role||'USER')}</td>
      <td>${esc(u.gender||'-')}</td><td>${esc(u.countryCode||'-')}</td><td>${u.banner||0}</td><td>${u.interstitial||0}</td><td>${u.rewarded||0}</td><td>${u.native||0}</td><td>${u.customBanner||0}</td><td><b>${u.total||0}</b></td>
    </tr>`).join('') || '<tr><td colspan="9">لا توجد مشاهدات</td></tr>';
  } catch(e) { toast(e.message,'err'); }
}

// ===== Admin management =====
async function loadAdmins() {
  try {
    const data = await api('/admin/admins');
    const tbody = document.querySelector('#adminsTable tbody');
    tbody.innerHTML = (data.items||[]).map(a => `<tr>
      <td>${esc(a.name)}</td><td>${esc(a.email)}</td><td>${esc(a.role)}</td><td>${a.status==='ACTIVE'?'✅ نشط':'⛔ '+esc(a.status)}</td>
      <td><small>${Array.isArray(a.adminPermissions)&&a.adminPermissions.length ? esc(a.adminPermissions.join(', ')) : 'كل الصلاحيات'}</small></td>
      <td>${a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : '-'}</td>
      <td>${a.email==='admin1@tikboost.app' ? '<b>محمي</b>' : `<button class="act" data-admin-act="edit" data-id="${a.id}">صلاحيات</button> <button class="act" data-admin-act="freeze" data-id="${a.id}">${a.status==='FROZEN'?'تفعيل':'تعطيل'}</button> <button class="act danger" data-admin-act="delete" data-id="${a.id}">حذف</button>`}</td>
    </tr>`).join('') || '<tr><td colspan="7">لا يوجد مديرون</td></tr>';
    document.querySelectorAll('[data-admin-act]').forEach(b => b.addEventListener('click', async () => {
      try {
        const row = (data.items||[]).find(x=>x.id===b.dataset.id);
        if (b.dataset.adminAct === 'delete') { if (!confirm('حذف المدير؟')) return; await api(`/admin/admins/${b.dataset.id}`, {method:'DELETE'}); }
        else if (b.dataset.adminAct === 'freeze') { await api(`/admin/admins/${b.dataset.id}`, {method:'PUT', body:{status:row?.status==='FROZEN'?'ACTIVE':'FROZEN'}}); }
        else if (b.dataset.adminAct === 'edit') {
          const raw = prompt('أدخل الصلاحيات مفصولة بفاصلة. مثال: users,ads,analytics', Array.isArray(row?.adminPermissions) ? row.adminPermissions.join(',') : '*');
          if (raw === null) return;
          const permissions = raw.split(',').map(x=>x.trim()).filter(Boolean);
          await api(`/admin/admins/${b.dataset.id}`, {method:'PUT', body:{permissions}});
        }
        toast('تم','success'); loadAdmins();
      } catch(e) { toast(e.message,'err'); }
    }));
  } catch(e) { toast(e.message,'err'); }
}

async function createAdmin() {
  try {
    const permissions = Array.from(document.getElementById('adminPermissions')?.selectedOptions||[]).map(o=>o.value);
    await api('/admin/admins',{method:'POST',body:{name:document.getElementById('adminName').value.trim(),email:document.getElementById('adminEmail').value.trim(),password:document.getElementById('adminPassword').value,role:document.getElementById('adminRole').value,permissions}});
    toast('تم إنشاء المدير','success'); ['adminName','adminEmail','adminPassword'].forEach(id=>document.getElementById(id).value=''); loadAdmins();
  } catch(e) { toast(e.message,'err'); }
}

async function saveReferralSettings() {
  try {
    await api('/admin/settings/rewards',{method:'PUT',body:{rewards:{signupBonusPoints:Number(document.getElementById('signupBonusPoints').value||0),referralBonusPoints:Number(document.getElementById('referralBonusPoints').value||0),referralNewUserBonusPoints:Number(document.getElementById('referralNewUserBonusPoints').value||0)}}});
    toast('تم حفظ مكافآت الإحالة والترحيب','success');
  } catch(e){ toast(e.message,'err'); }
}
async function saveAppDownloadUrl() {
  try { await api('/admin/settings/app',{method:'PUT',body:{downloadUrl:document.getElementById('appDownloadUrl').value.trim()}}); toast('تم حفظ رابط التحميل','success'); }
  catch(e){ toast(e.message,'err'); }
}

// ===== Utils =====
function esc(s){ return (s??'').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

// ===== Rewards / Ads =====
async function loadRewardsAdmin() {
  try {
    const [settingsData, adData, wheelData, appData, pricingData] = await Promise.all([
      api('/admin/settings/rewards'),
      api('/admin/settings/ads'),
      api('/admin/wheel/prizes'),
      api('/admin/settings/app'),
      api('/admin/settings/pricing'),
    ]);

    const settings = settingsData.settings || {};
    const rewards = settings.rewards || {};
    const wheel = settings.wheel || {};
    const ads = adData.ads || {};
    const app = appData.app || {};
    const campaignPricing = pricingData.campaignPricing || {};
    const campaignRewards = pricingData.campaignRewards || {};
    const campaignRules = pricingData.campaignRules || {};

    document.getElementById('adsBannerEnabled').checked = !!ads.bannerEnabled;
    document.getElementById('adsInterstitialEnabled').checked = !!ads.interstitialEnabled;
    document.getElementById('adsRewardedEnabled').checked = !!ads.rewardedEnabled;
    document.getElementById('adsNativeEnabled').checked = !!ads.nativeEnabled;
    document.getElementById('adsBannerUnitId').value = ads.bannerUnitId || '';
    document.getElementById('adsInterstitialUnitId').value = ads.interstitialUnitId || '';
    document.getElementById('adsRewardedUnitId').value = ads.rewardedUnitId || '';
    document.getElementById('adsNativeUnitId').value = ads.nativeUnitId || '';
    document.getElementById('adsAutoInterstitialEnabled').checked = ads.autoInterstitialEnabled !== false;
    document.getElementById('adsInterstitialIntervalMinutes').value = ads.interstitialIntervalMinutes ?? 20;
    document.getElementById('adsCustomBannerEnabled').checked = !!ads.customBannerEnabled;
    document.getElementById('adsCustomBannerImageUrl').value = ads.customBannerImageUrl || '';
    document.getElementById('adsCustomBannerLinkUrl').value = ads.customBannerLinkUrl || '';
    document.getElementById('adsCustomBannerLabel').value = ads.customBannerLabel || 'إعلان';
    await loadExcludedAdUsers(ads.excludedUserIds || []);

    document.getElementById('rewardDailyLimit').value = rewards.dailyRewardAdsLimit ?? 10;
    document.getElementById('rewardPointsPerAd').value = rewards.pointsPerRewardedAd ?? 20;
    document.getElementById('rewardSessionExpiry').value = rewards.rewardSessionExpiryMinutes ?? 15;
    document.getElementById('wheelDailySpinsLimit').value = wheel.dailySpinsLimit ?? 1;
    document.getElementById('wheelMaxExtraSpins').value = wheel.maxExtraSpinsPerDay ?? 3;
    document.getElementById('wheelConfettiThreshold').value = wheel.confettiThreshold ?? 250;
    document.getElementById('contactWhatsapp').value = app.whatsapp || '';
    document.getElementById('contactInstagram').value = app.instagramUrl || '';
    document.getElementById('contactFacebook').value = app.facebookUrl || '';
    document.getElementById('contactEmail').value = app.supportEmail || '';
    renderContactLinksEditor(app.contactLinks || []);
    document.getElementById('signupBonusPoints').value = rewards.signupBonusPoints ?? 5000;
    document.getElementById('referralBonusPoints').value = rewards.referralBonusPoints ?? 2500;
    document.getElementById('referralNewUserBonusPoints').value = rewards.referralNewUserBonusPoints ?? 0;
    document.getElementById('appDownloadUrl').value = app.downloadUrl || '';
    document.getElementById('priceFollowers').value = campaignPricing.FOLLOWERS ?? 100;
    document.getElementById('priceLikes').value = campaignPricing.LIKES ?? 20;
    document.getElementById('priceViews').value = campaignPricing.VIEWS ?? 5;
    document.getElementById('priceComments').value = campaignPricing.COMMENTS ?? 50;
    document.getElementById('rewardFollowers').value = campaignRewards.FOLLOWERS ?? 80;
    document.getElementById('rewardLikes').value = campaignRewards.LIKES ?? 16;
    document.getElementById('rewardViews').value = campaignRewards.VIEWS ?? 4;
    document.getElementById('rewardComments').value = campaignRewards.COMMENTS ?? 40;
    document.getElementById('minCampaignQuantity').value = campaignRules.minQuantity ?? 10;
    document.getElementById('maxCampaignQuantity').value = campaignRules.maxQuantity ?? 100000;
    const vipCfg = settings.vipPro || {};
    document.getElementById('vipEnabled').checked = vipCfg.enabled !== false;
    document.getElementById('vipPrice').value = Number(vipCfg.monthlyPriceCents ?? 1000) / 100;
    document.getElementById('vipBonusPerTask').value = vipCfg.bonusPerTask ?? 5;
    document.getElementById('vipPriority').checked = vipCfg.priorityBoost !== false;
    const notifCfg = settings.notifications || {};
    document.getElementById('reviewPromptEnabled').checked = notifCfg.reviewPromptEnabled !== false;
    document.getElementById('reviewUrl').value = notifCfg.reviewUrl || '';
    document.getElementById('reviewReward').value = notifCfg.reviewRewardPoints ?? 250;
    document.getElementById('reminderHours').value = notifCfg.reminderAfterHours ?? 24;
    const engagement = settings.engagement || {};
    document.getElementById('streakRewards').value = (engagement.streakRewards || []).join(',');
    document.getElementById('comebackReward').value = engagement.comebackRewardPoints ?? 120;
    document.getElementById('comebackDays').value = engagement.comebackAfterDays ?? 3;
    document.getElementById('weeklyEnabled').checked = engagement.weeklyEnabled !== false;
    document.getElementById('dailyTasksJson').value = JSON.stringify(settings.dailyTasks?.items || [], null, 2);
    document.getElementById('weeklyChallengesJson').value = JSON.stringify(engagement.weeklyChallenges || [], null, 2);
    document.getElementById('achievementsJson').value = JSON.stringify(settings.achievements?.items || [], null, 2);

    const tbody = document.querySelector('#wheelPrizesTable tbody');
    tbody.innerHTML = '';
    (wheelData.items || []).forEach((prize) => {
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><input data-field="sortOrder" data-id="${prize.id}" type="number" value="${prize.sortOrder}" style="width:80px" /></td>
          <td><input data-field="label" data-id="${prize.id}" value="${esc(prize.label)}" /></td>
          <td><input data-field="points" data-id="${prize.id}" type="number" value="${prize.points}" style="width:120px" /></td>
          <td><input data-field="weight" data-id="${prize.id}" type="number" value="${prize.weight}" style="width:90px" /></td>
          <td><input data-field="color" data-id="${prize.id}" value="${esc(prize.color)}" style="width:120px" /></td>
          <td><input data-field="isActive" data-id="${prize.id}" type="checkbox" ${prize.isActive ? 'checked' : ''} /></td>
          <td><button class="act success wheel-save" data-id="${prize.id}">حفظ</button></td>
        </tr>
      `);
    });
    document.querySelectorAll('.wheel-save').forEach((button) => {
      button.addEventListener('click', () => saveWheelPrize(button.dataset.id));
    });
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function loadExcludedAdUsers(selectedIds) {
  try {
    const data = await api('/admin/users?limit=200&page=1');
    const select = document.getElementById('adsExcludedUsers');
    if (!select) return;
    const selected = new Set((selectedIds || []).map(String));
    select.innerHTML = '';
    (data.items || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name || '-'} — ${u.email || ''}`;
      opt.selected = selected.has(String(u.id));
      select.appendChild(opt);
    });
  } catch (e) { toast('تعذر تحميل الحسابات: ' + e.message, 'err'); }
}

async function saveExcludedAdUsers() {
  try {
    const ids = Array.from(document.getElementById('adsExcludedUsers')?.selectedOptions || []).map(o => o.value);
    await api('/admin/settings/ads', { method:'PUT', body:{ excludedUserIds: ids } });
    toast('تم حفظ الحسابات المستثناة من الإعلانات', 'success');
  } catch (e) { toast(e.message, 'err'); }
}

async function saveAdSettings() {
  try {
    await api('/admin/settings/ads', {
      method: 'PUT',
      body: {
        bannerEnabled: document.getElementById('adsBannerEnabled').checked,
        interstitialEnabled: document.getElementById('adsInterstitialEnabled').checked,
        rewardedEnabled: document.getElementById('adsRewardedEnabled').checked,
        nativeEnabled: document.getElementById('adsNativeEnabled').checked,
        bannerUnitId: document.getElementById('adsBannerUnitId').value.trim(),
        interstitialUnitId: document.getElementById('adsInterstitialUnitId').value.trim(),
        rewardedUnitId: document.getElementById('adsRewardedUnitId').value.trim(),
        nativeUnitId: document.getElementById('adsNativeUnitId').value.trim(),
        autoInterstitialEnabled: document.getElementById('adsAutoInterstitialEnabled').checked,
        interstitialIntervalMinutes: Number(document.getElementById('adsInterstitialIntervalMinutes').value || 20),
        customBannerEnabled: document.getElementById('adsCustomBannerEnabled').checked,
        customBannerImageUrl: document.getElementById('adsCustomBannerImageUrl').value.trim(),
        customBannerLinkUrl: document.getElementById('adsCustomBannerLinkUrl').value.trim(),
        customBannerLabel: document.getElementById('adsCustomBannerLabel').value.trim() || 'إعلان',
      },
    });
    toast('تم حفظ إعدادات الإعلانات', 'success');
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function saveRewardSettings() {
  try {
    await api('/admin/settings/rewards', {
      method: 'PUT',
      body: {
        rewards: {
          dailyRewardAdsLimit: Number(document.getElementById('rewardDailyLimit').value || 10),
          pointsPerRewardedAd: Number(document.getElementById('rewardPointsPerAd').value || 20),
          rewardSessionExpiryMinutes: Number(document.getElementById('rewardSessionExpiry').value || 15),
          signupBonusPoints: Number(document.getElementById('signupBonusPoints').value || 0),
          referralBonusPoints: Number(document.getElementById('referralBonusPoints').value || 0),
          referralNewUserBonusPoints: Number(document.getElementById('referralNewUserBonusPoints').value || 0),
        },
        wheel: {
          dailySpinsLimit: Number(document.getElementById('wheelDailySpinsLimit').value || 1),
          maxExtraSpinsPerDay: Number(document.getElementById('wheelMaxExtraSpins').value || 3),
          confettiThreshold: Number(document.getElementById('wheelConfettiThreshold').value || 250),
        },
        engagement: {
          streakRewards: document.getElementById('streakRewards').value.split(',').map(x=>Number(x.trim())).filter(Number.isFinite),
          comebackRewardPoints: Number(document.getElementById('comebackReward').value || 120),
          comebackAfterDays: Number(document.getElementById('comebackDays').value || 3),
          weeklyEnabled: document.getElementById('weeklyEnabled').checked,
          weeklyChallenges: JSON.parse(document.getElementById('weeklyChallengesJson').value || '[]'),
        },
        dailyTasks: { items: JSON.parse(document.getElementById('dailyTasksJson').value || '[]') },
        achievements: { items: JSON.parse(document.getElementById('achievementsJson').value || '[]') },
      },
    });
    toast('تم حفظ إعدادات المكافآت', 'success');
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function saveActivitySettings(){
  try {
    await saveRewardSettings();
    toast('تم حفظ مركز النشاط والمهام والجوائز','success');
  } catch(e){ toast(e.message,'err'); }
}

async function savePricingSettings() {
  try {
    await api('/admin/settings/pricing', {
      method: 'PUT',
      body: {
        campaignPricing: {
          FOLLOWERS: Number(document.getElementById('priceFollowers').value || 100),
          LIKES: Number(document.getElementById('priceLikes').value || 20),
          VIEWS: Number(document.getElementById('priceViews').value || 5),
          COMMENTS: Number(document.getElementById('priceComments').value || 50),
        },
        campaignRewards: {
          FOLLOWERS: Number(document.getElementById('rewardFollowers').value || 80),
          LIKES: Number(document.getElementById('rewardLikes').value || 16),
          VIEWS: Number(document.getElementById('rewardViews').value || 4),
          COMMENTS: Number(document.getElementById('rewardComments').value || 40),
        },
        campaignRules: {
          minQuantity: Number(document.getElementById('minCampaignQuantity').value || 10),
          maxQuantity: Number(document.getElementById('maxCampaignQuantity').value || 100000),
        },
      },
    });
    toast('تم حفظ إعدادات التسعير', 'success');
  } catch (e) {
    toast(e.message, 'err');
  }
}

async function saveVipSettings() {
  try { await api('/admin/settings/rewards',{method:'PUT',body:{vipPro:{enabled:document.getElementById('vipEnabled').checked,monthlyPriceCents:Math.round(Number(document.getElementById('vipPrice').value||10)*100),bonusPerTask:Number(document.getElementById('vipBonusPerTask').value||0),priorityBoost:document.getElementById('vipPriority').checked}}}); toast('تم حفظ إعدادات VIP PRO','success'); } catch(e){toast(e.message,'err');}
}
async function saveReviewSettings() {
  try { await api('/admin/settings/rewards',{method:'PUT',body:{notifications:{reviewPromptEnabled:document.getElementById('reviewPromptEnabled').checked,reviewUrl:document.getElementById('reviewUrl').value.trim(),reviewRewardPoints:Number(document.getElementById('reviewReward').value||0),reminderAfterHours:Number(document.getElementById('reminderHours').value||24)}}}); toast('تم حفظ التقييم والتذكيرات','success'); } catch(e){toast(e.message,'err');}
}
async function loadVip() {
  try {
    const [data, settingsData, usersData] = await Promise.all([
      api('/admin/vip/subscriptions'),
      api('/admin/settings/rewards'),
      api('/admin/users?limit=200&page=1'),
    ]);
    const tbody=document.querySelector('#vipTable tbody');
    tbody.innerHTML='';
    (data.items||[]).forEach(x=>tbody.insertAdjacentHTML('beforeend',`<tr><td>${esc(x.user?.name||'-')}<br><small>${esc(x.user?.email||'')}</small></td><td>$${(Number(x.priceCents||0)/100).toFixed(2)}</td><td>${esc(x.method||'-')}</td><td>${esc(x.status)}</td><td>${new Date(x.createdAt).toLocaleString()}</td><td>${x.status==='PENDING'?`<button class="act success vip-action" data-id="${x.id}" data-decision="APPROVED">تفعيل</button> <button class="act danger vip-action" data-id="${x.id}" data-decision="REJECTED">رفض</button>`:'—'}</td></tr>`));
    document.querySelectorAll('.vip-action').forEach(b=>b.onclick=async()=>{try{await api(`/admin/vip/subscriptions/${b.dataset.id}/action`,{method:'POST',body:{decision:b.dataset.decision}});toast('تم تحديث الطلب','success');loadVip();}catch(e){toast(e.message,'err');}});
    const select=document.getElementById('vipGrantUser');
    if(select){ select.innerHTML='<option value="">اختر مستخدماً</option>'+(usersData.items||[]).filter(u=>u.role==='USER').map(u=>`<option value="${u.id}">${esc(u.name)} — ${esc(u.email)}</option>`).join(''); }
    renderVipPlans(settingsData.settings?.vipPro?.plans || []);
  } catch(e){toast(e.message,'err');}
}

function renderVipPlans(plans){
  const box=document.getElementById('vipPlansEditor'); if(!box) return;
  box.innerHTML='';
  (plans.length?plans:[{key:'vip_monthly',name:'VIP PRO 30 يوم',priceCents:1000,durationDays:30,bonusPerTask:5,enabled:true,sortOrder:0}]).forEach((p,i)=>{
    const row=document.createElement('div'); row.className='card vip-plan-row'; row.style.cssText='padding:10px;margin-bottom:8px;display:grid;grid-template-columns:1.2fr .9fr .8fr .8fr auto auto;gap:8px;align-items:center';
    row.innerHTML=`<input class="vip-plan-key" value="${esc(p.key||`vip_${i+1}`)}" placeholder="المعرف"/><input class="vip-plan-name" value="${esc(p.name||'VIP PRO')}" placeholder="الاسم"/><input class="vip-plan-price" type="number" min="0" step="0.01" value="${Number(p.priceCents||0)/100}"/><input class="vip-plan-days" type="number" min="1" value="${p.durationDays||30}"/><label><input class="vip-plan-enabled" type="checkbox" ${p.enabled!==false?'checked':''}/> مفعّل</label><button type="button" class="act danger vip-plan-delete">حذف</button>`;
    row.querySelector('.vip-plan-delete').onclick=()=>row.remove(); box.appendChild(row);
  });
}

function collectVipPlans(){
  return Array.from(document.querySelectorAll('#vipPlansEditor .vip-plan-row')).map((row,i)=>({
    key:row.querySelector('.vip-plan-key')?.value.trim()||`vip_${i+1}`,
    name:row.querySelector('.vip-plan-name')?.value.trim()||`VIP PRO ${i+1}`,
    priceCents:Math.round(Number(row.querySelector('.vip-plan-price')?.value||0)*100),
    durationDays:Number(row.querySelector('.vip-plan-days')?.value||30),
    bonusPerTask:Number(document.getElementById('vipBonusPerTask')?.value||5),
    enabled:!!row.querySelector('.vip-plan-enabled')?.checked,
    sortOrder:i,
  }));
}

async function saveVipPlans(){
  try{ const plans=collectVipPlans(); if(!plans.length) throw new Error('أضف باقة VIP واحدة على الأقل'); await api('/admin/vip/plans',{method:'PUT',body:{plans}}); toast('تم حفظ باقات VIP','success'); loadVip(); }catch(e){toast(e.message,'err');}
}

async function grantVip(){
  try{
    const userId=document.getElementById('vipGrantUser').value; if(!userId) throw new Error('اختر مستخدماً');
    await api('/admin/vip/grant',{method:'POST',body:{userId,durationDays:Number(document.getElementById('vipGrantDays').value||30),priceCents:Math.round(Number(document.getElementById('vipGrantPrice').value||0)*100),note:document.getElementById('vipGrantNote').value.trim()}});
    toast('تم منح VIP PRO للمستخدم','success');
    document.getElementById('vipGrantNote').value=''; loadVip();
  }catch(e){toast(e.message,'err');}
}

async function saveWheelPrize(id) {
  try {
    const getField = (field) => document.querySelector(`#wheelPrizesTable [data-field="${field}"][data-id="${id}"]`);
    await api(`/admin/wheel/prizes/${id}`, {
      method: 'PUT',
      body: {
        sortOrder: Number(getField('sortOrder').value || 0),
        label: getField('label').value.trim(),
        points: Number(getField('points').value || 0),
        weight: Number(getField('weight').value || 0),
        color: getField('color').value.trim(),
        isActive: getField('isActive').checked,
      },
    });
    toast('تم حفظ الجائزة', 'success');
    loadRewardsAdmin();
  } catch (e) {
    toast(e.message, 'err');
  }
}



function renderContactLinksEditor(links = []) {
  const box = document.getElementById('contactLinksEditor');
  if (!box) return;
  const list = Array.isArray(links) ? links : [];
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<div class="muted" style="padding:10px;border:1px dashed var(--border);border-radius:10px">لا توجد أزرار إضافية. اضغط «إضافة زر».</div>';
    return;
  }
  list.slice(0, 30).forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'card';
    row.style.cssText = 'padding:10px;margin-bottom:8px;display:grid;grid-template-columns:1fr 2fr 3fr auto auto;gap:8px;align-items:center';
    row.innerHTML = `
      <input class="contact-link-key" value="${esc(item.key || `contact_${index+1}`)}" placeholder="المعرّف" />
      <input class="contact-link-label" value="${esc(item.label || '')}" placeholder="اسم الزر" />
      <input class="contact-link-value" value="${esc(item.value || '')}" placeholder="https://..." />
      <label style="white-space:nowrap"><input class="contact-link-enabled" type="checkbox" ${item.enabled !== false ? 'checked' : ''}/> مفعّل</label>
      <button type="button" class="contact-link-delete">حذف</button>`;
    row.querySelector('.contact-link-delete').addEventListener('click', () => row.remove());
    box.appendChild(row);
  });
}

function collectContactLinks() {
  return Array.from(document.querySelectorAll('#contactLinksEditor .card')).map((row, index) => ({
    key: row.querySelector('.contact-link-key')?.value.trim() || `contact_${index + 1}`,
    label: row.querySelector('.contact-link-label')?.value.trim() || `رابط ${index + 1}`,
    value: row.querySelector('.contact-link-value')?.value.trim() || '',
    enabled: !!row.querySelector('.contact-link-enabled')?.checked,
  })).filter((x) => x.value);
}

document.getElementById('contactLinkAdd')?.addEventListener('click', () => {
  const current = collectContactLinks();
  current.push({ key: `contact_${current.length + 1}`, label: '', value: '', enabled: true });
  renderContactLinksEditor(current);
});

async function saveContactSettings() {
  try {
    await api('/admin/settings/app', {
      method: 'PUT',
      body: {
        whatsapp: document.getElementById('contactWhatsapp').value.trim(),
        instagramUrl: document.getElementById('contactInstagram').value.trim(),
        facebookUrl: document.getElementById('contactFacebook').value.trim(),
        supportEmail: document.getElementById('contactEmail').value.trim(),
        contactLinks: collectContactLinks(),
      },
    });
    toast('تم حفظ إعدادات التواصل', 'success');
    loadRewardsAdmin();
  } catch (e) {
    toast(e.message, 'err');
  }
}

document.getElementById('adsSave')?.addEventListener('click', saveAdSettings);
document.getElementById('adsExcludedUsersSave')?.addEventListener('click', saveExcludedAdUsers);
document.getElementById('packageSave')?.addEventListener('click', savePackage);
document.getElementById('packageNew')?.addEventListener('click', clearPackageForm);
document.getElementById('packagesRefresh')?.addEventListener('click', loadPackages);
document.getElementById('rewardSettingsSave')?.addEventListener('click', saveRewardSettings);
document.getElementById('activitySettingsSave')?.addEventListener('click', saveActivitySettings);
document.getElementById('pricingSettingsSave')?.addEventListener('click', savePricingSettings);
document.getElementById('contactSettingsSave')?.addEventListener('click', saveContactSettings);
document.getElementById('wheelRefresh')?.addEventListener('click', loadRewardsAdmin);
document.getElementById('vipSettingsSave')?.addEventListener('click', saveVipSettings);
document.getElementById('reviewSettingsSave')?.addEventListener('click', saveReviewSettings);
document.getElementById('vipRefresh')?.addEventListener('click', loadVip);
document.getElementById('vipPlanAdd')?.addEventListener('click',()=>{ const plans=collectVipPlans(); plans.push({key:`vip_${plans.length+1}`,name:'VIP PRO',priceCents:1000,durationDays:30,bonusPerTask:5,enabled:true,sortOrder:plans.length}); renderVipPlans(plans); });
document.getElementById('vipPlansSave')?.addEventListener('click',saveVipPlans);
document.getElementById('vipGrantSave')?.addEventListener('click',grantVip);
document.getElementById('adAnalyticsRefresh')?.addEventListener('click', loadAdAnalytics);
document.getElementById('adAnalyticsDays')?.addEventListener('change', loadAdAnalytics);
document.getElementById('adminCreate')?.addEventListener('click', createAdmin);
document.getElementById('referralSettingsSave')?.addEventListener('click', saveReferralSettings);
document.getElementById('appDownloadSave')?.addEventListener('click', saveAppDownloadUrl);

// ===== OFFERS =====
// Convert API ISO dates to the browser's local datetime input and back.
function toDateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDateTimeLocal(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function loadOffers() {
  const tbody = document.querySelector('#offersTable tbody');
  try {
    const [pkgData, usersData] = await Promise.all([api('/admin/packages'), api('/admin/users?limit=200&page=1&role=USER')]);
    const targetSelect = document.getElementById('offerTargetUser');
    if (targetSelect) {
      const currentTarget = targetSelect.value;
      targetSelect.innerHTML = '<option value="">بدون مستخدم محدد</option>' + (usersData.items || []).map(u => `<option value="${u.id}">${esc(u.name || '-')} — ${esc(u.email || '')}</option>`).join('');
      if (currentTarget) targetSelect.value = currentTarget;
    }
    const select = document.getElementById('offerPackageId');
    if (select) {
      const current = select.value;
      select.innerHTML = '<option value="">بدون باقة</option>' + (pkgData.items || []).map(p => `<option value="${p.id}">${esc(p.name)} — ${(Number(p.priceCents||0)/100).toFixed(2)} ${esc(p.currency||'USD')}</option>`).join('');
      if (current) select.value = current;
    }
  } catch (_) {}
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7">جارٍ التحميل...</td></tr>';
  try {
    const data = await api('/admin/offers');
    tbody.innerHTML = (data.items || []).map(o => `
      <tr>
        <td>${o.title}</td>
        <td>${o.oldPrice ? `<s>${o.oldPrice}</s> ` : ''}${o.newPrice} ${o.currency}</td>
        <td>${o.discountPct ?? '-'}</td>
        <td>${o.targetGender}</td>
        <td>${o.targetCountry}</td>
        <td>${o.isActive ? '✅' : '⛔'}</td>
        <td>
          <button class="act offer-edit" data-id="${o.id}">تعديل</button>
          <button class="act offer-del" data-id="${o.id}">حذف</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7">لا توجد عروض</td></tr>';
    document.querySelectorAll('.offer-edit').forEach(b => b.addEventListener('click', () => editOffer(b.dataset.id)));
    document.querySelectorAll('.offer-del').forEach(b => b.addEventListener('click', () => deleteOffer(b.dataset.id)));
    window._offers = data.items || [];
  } catch (e) { tbody.innerHTML = `<tr><td colspan="7">${e.message}</td></tr>`; }
}

function editOffer(id) {
  const o = (window._offers || []).find(x => x.id === id);
  if (!o) return;
  document.getElementById('offerId').value = o.id;
  document.getElementById('offerTitle').value = o.title || '';
  document.getElementById('offerCurrency').value = o.currency || 'USD';
  document.getElementById('offerOldPrice').value = o.oldPrice || '';
  document.getElementById('offerNewPrice').value = o.newPrice || 0;
  document.getElementById('offerDiscount').value = o.discountPct ?? '';
  document.getElementById('offerPackageId').value = o.packageId || '';
  document.getElementById('offerSort').value = o.sortOrder || 0;
  document.getElementById('offerGender').value = o.targetGender || 'ALL';
  document.getElementById('offerAudience').value = o.audience || 'ALL';
  document.getElementById('offerTargetUser').value = o.targetUserId || '';
  document.getElementById('offerStart').value = toDateTimeLocal(o.startsAt);
  document.getElementById('offerEnd').value = toDateTimeLocal(o.endsAt);
  document.getElementById('offerMinTasks').value = o.minTasks || 0;
  document.getElementById('offerMaxTasks').value = o.maxTasks ?? '';
  document.getElementById('offerPoints').value = o.pointsOverride ?? '';
  document.getElementById('offerMaxClaims').value = o.maxClaimsPerUser ?? 1;
  document.getElementById('offerNotify').checked = o.showNotification !== false;
  document.getElementById('offerCountry').value = o.targetCountry || 'WORLDWIDE';
  document.getElementById('offerActive').checked = !!o.isActive;
  document.getElementById('offerDesc').value = o.description || '';
}

async function saveOffer() {
  const id = document.getElementById('offerId').value;
  const body = {
    title: document.getElementById('offerTitle').value.trim(),
    description: document.getElementById('offerDesc').value.trim(),
    currency: document.getElementById('offerCurrency').value.trim() || 'USD',
    oldPriceCents: Math.round((parseFloat(document.getElementById('offerOldPrice').value) || 0) * 100) || null,
    newPriceCents: Math.round((parseFloat(document.getElementById('offerNewPrice').value) || 0) * 100),
    discountPct: document.getElementById('offerDiscount').value ? parseInt(document.getElementById('offerDiscount').value, 10) : null,
    packageId: document.getElementById('offerPackageId').value || null,
    sortOrder: parseInt(document.getElementById('offerSort').value, 10) || 0,
    targetGender: document.getElementById('offerGender').value,
    targetCountry: document.getElementById('offerCountry').value.trim() || 'WORLDWIDE',
    audience: document.getElementById('offerAudience').value,
    targetUserId: document.getElementById('offerTargetUser').value.trim() || null,
    minTasks: Number(document.getElementById('offerMinTasks').value || 0),
    maxTasks: document.getElementById('offerMaxTasks').value ? Number(document.getElementById('offerMaxTasks').value) : null,
    pointsOverride: document.getElementById('offerPoints').value ? Number(document.getElementById('offerPoints').value) : null,
    maxClaimsPerUser: document.getElementById('offerMaxClaims').value ? Number(document.getElementById('offerMaxClaims').value) : 1,
    showNotification: document.getElementById('offerNotify').checked,
    startsAt: fromDateTimeLocal(document.getElementById('offerStart').value),
    endsAt: fromDateTimeLocal(document.getElementById('offerEnd').value),
    isActive: document.getElementById('offerActive').checked,
  };
  try {
    if (id) await api(`/admin/offers/${id}`, { method: 'PUT', body });
    else await api('/admin/offers', { method: 'POST', body });
    toast('تم حفظ العرض', 'success');
    document.getElementById('offerId').value = '';
    loadOffers();
  } catch (e) { toast(e.message, 'err'); }
}

async function deleteOffer(id) {
  if (!confirm('حذف هذا العرض؟')) return;
  try { await api(`/admin/offers/${id}`, { method: 'DELETE' }); toast('تم الحذف', 'success'); loadOffers(); }
  catch (e) { toast(e.message, 'err'); }
}

document.getElementById('offerSave')?.addEventListener('click', saveOffer);
document.getElementById('offerNew')?.addEventListener('click', () => {
  document.getElementById('offerId').value = '';
  ['offerTitle','offerDesc','offerOldPrice','offerNewPrice','offerDiscount','offerStart','offerEnd'].forEach(i => document.getElementById(i).value = '');
});
document.getElementById('offersRefresh')?.addEventListener('click', loadOffers);



// ===== Manual password reset requests =====
async function loadPasswordResets() {
  try {
    const data = await api('/admin/password-reset-requests?status=PENDING');
    const tbody = document.querySelector('#passwordResetsTable tbody');
    tbody.innerHTML = '';
    (data.items || []).forEach(r => {
      const expired = new Date(r.expiresAt) <= new Date();
      const status = expired && r.status === 'PENDING' ? 'EXPIRED' : r.status;
      const statusLabel = { PENDING: 'قيد الانتظار', USED: 'مستخدم', LOCKED: 'مقفل', EXPIRED: 'منتهي' }[status] || status;
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><b>${esc(r.user?.name || '')}</b><br><small>${esc(r.user?.email || '')}</small></td>
          <td>${statusLabel}</td>
          <td>${r.attempts}/5</td>
          <td>${fmtDate(r.createdAt)}</td>
          <td>${fmtDate(r.expiresAt)}</td>
          <td><span id="reset-code-${r.id}" class="muted">••••••</span></td>
          <td>
            ${status === 'PENDING' && !expired ? `<button class="primary" onclick="revealResetCode('${r.id}')">إظهار الرمز</button> <button class="act success" onclick="regenerateResetCode('${r.id}')">رمز جديد</button>` : ''}
            ${status === 'PENDING' ? `<button onclick="cancelReset('${r.id}')">إلغاء</button>` : ''}
          </td>
        </tr>`);
    });
  } catch (e) { toast(e.message, 'err'); }
}

async function regenerateResetCode(id) {
  if (!confirm('إنشاء رمز جديد؟ سيتم إلغاء الرمز السابق.')) return;
  try {
    const data = await api('/admin/password-reset-requests/' + encodeURIComponent(id) + '/regenerate', { method: 'POST' });
    const code = String(data.code || '').trim();
    if (!/^\d{6}$/.test(code)) throw new Error('لم يتم استلام رمز صالح.');
    const cell = document.getElementById('reset-code-' + id);
    if (cell) cell.innerHTML = `<span class="reset-code-value">${esc(code)}</span> <button class="act" type="button" onclick="copyText('${code}')">نسخ</button> <button class="act success" type="button" onclick="shareResetCode('${code}')">مشاركة</button>`;
    toast(data.delivered ? 'تم إنشاء رمز جديد وإرساله للبريد' : 'تم إنشاء رمز جديد. أرسله للمستخدم يدويًا.', 'success');
  } catch (e) { toast(e.message, 'err'); }
}

async function revealResetCode(id) {
  try {
    const data = await api('/admin/password-reset-requests/' + encodeURIComponent(id) + '/reveal', { method: 'POST' });
    const code = String(data.code || '').trim();
    const el = document.getElementById('reset-code-' + id);
    if (!el || !/^\d{6}$/.test(code)) throw new Error('لم يتم استلام رمز صالح من الخادم.');
    el.innerHTML = `<span class="reset-code-value">${esc(code)}</span>
      <button class="act" type="button" data-copy-reset>نسخ</button>
      <button class="act success" type="button" data-share-reset>مشاركة</button>`;
    el.querySelector('[data-copy-reset]')?.addEventListener('click', () => copyText(code));
    el.querySelector('[data-share-reset]')?.addEventListener('click', () => shareResetCode(code));
  } catch (e) { toast(e.message, 'err'); }
}

async function copyText(value) {
  const text = String(value ?? '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast('تم نسخ الرمز', 'success');
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('copy failed');
    toast('تم نسخ الرمز', 'success');
  } catch {
    toast('تعذر النسخ تلقائيًا، يمكنك تحديد الرمز ونسخه يدويًا.', 'err');
  }
}

async function shareResetCode(code) {
  const text = `رمز استعادة كلمة مرور TikBoost: ${String(code)}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'رمز استعادة كلمة المرور', text });
      toast('تم فتح المشاركة', 'success');
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  await copyText(code);
  toast('المشاركة غير متاحة في هذا المتصفح؛ تم نسخ الرمز بدلًا منها.', 'success');
}

async function cancelReset(id) {
  if (!confirm('إلغاء طلب الاستعادة؟')) return;
  try {
    await api('/admin/password-reset-requests/' + encodeURIComponent(id) + '/cancel', { method: 'POST' });
    toast('تم إلغاء الطلب', 'success');
    loadPasswordResets();
  } catch (e) { toast(e.message, 'err'); }
}

function fmtDate(value) {
  try { return new Date(value).toLocaleString('ar-DZ'); } catch { return value || '—'; }
}

document.getElementById('passwordResetsRefresh')?.addEventListener('click', loadPasswordResets);
let passwordResetPoll = null;


let passwordResetPollStarted = false;
function startPasswordResetPolling() {
  if (passwordResetPollStarted) return;
  passwordResetPollStarted = true;
  passwordResetPoll = setInterval(() => {
    const page = document.querySelector('.page[data-page=\"passwordResets\"]');
    if (page && !page.classList.contains('hidden') && store.access) loadPasswordResets();
  }, 15000);
}
startPasswordResetPolling();
