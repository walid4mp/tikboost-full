/* ================================
   TikBoost — interactions
   ================================ */
(function () {
  'use strict';

  const GITHUB_REPO = 'walid4mp/tikboost-full';
  const APK_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/app-release.apk`;

  // ---- Nav scroll state ----
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    if (!nav) return;
    if (window.scrollY > 30) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');

    const st = document.querySelector('.scroll-top');
    if (st) st.classList.toggle('show', window.scrollY > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Mobile menu ----
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('mobile-open');
      const icon = toggle.querySelector('i');
      if (icon) icon.className = links.classList.contains('mobile-open') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    links.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        links.classList.remove('mobile-open');
        const icon = toggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
      })
    );
  }

  // ---- Scroll reveal via IntersectionObserver ----
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
  );
  document.querySelectorAll('.reveal, .reveal-stagger').forEach((el) => io.observe(el));

  // ---- Feature hover glow tracking ----
  document.querySelectorAll('.feature').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--x', ((e.clientX - r.left) / r.width) * 100 + '%');
      card.style.setProperty('--y', ((e.clientY - r.top) / r.height) * 100 + '%');
    });
  });

  // ---- Scroll to top ----
  const st = document.querySelector('.scroll-top');
  if (st) st.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ---- Number counter animation on hero stats ----
  const counters = document.querySelectorAll('[data-count]');
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const dur = 1600;
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.floor(target * eased);
        el.textContent = val.toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      cio.unobserve(el);
    });
  }, { threshold: 0.4 });
  counters.forEach((c) => cio.observe(c));

  // ---- Only-one-FAQ-open behavior ----
  const faqs = document.querySelectorAll('.faq');
  faqs.forEach((f) => {
    f.addEventListener('toggle', () => {
      if (f.open) faqs.forEach((o) => { if (o !== f) o.open = false; });
    });
  });

  /* ================================
     Screenshots — auto-load if present
     ================================ */
  document.querySelectorAll('.usage-card img[data-src]').forEach((img) => {
    const src = img.dataset.src;
    const probe = new Image();
    probe.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      const card = img.closest('.usage-card');
      if (card) card.classList.add('has-image');
    };
    probe.onerror = () => {
      // keep placeholder visible; no console noise
    };
    probe.src = src;
  });

  /* ================================
     GitHub Releases — fetch latest metadata
     ================================ */
  const versionEls = document.querySelectorAll('#apk-version, #latest-version');
  const sizeEls = document.querySelectorAll('#apk-size, #latest-size');
  const dateEls = document.querySelectorAll('#apk-date, #latest-date');

  const fmtSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };
  const fmtDate = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) { return null; }
  };

  fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { 'Accept': 'application/vnd.github+json' }
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      // Version tag
      const tag = data.tag_name || data.name;
      if (tag) versionEls.forEach((el) => (el.textContent = tag));

      // Release date
      const date = fmtDate(data.published_at || data.created_at);
      if (date) dateEls.forEach((el) => (el.textContent = date));

      // Locate the .apk asset for size
      const apk = (data.assets || []).find(
        (a) => (a.name || '').toLowerCase().endsWith('.apk')
      );
      const size = apk ? fmtSize(apk.size) : null;
      if (size) sizeEls.forEach((el) => (el.textContent = size));

      // Update download attribute name to match tag
      if (tag) {
        document.querySelectorAll('a.apk-link').forEach((a) => {
          a.setAttribute('download', `TikBoost-${tag}.apk`);
        });
      }
    })
    .catch(() => { /* offline / rate-limited — keep static defaults */ });

  /* ================================
     Ensure APK links stay pointed at latest
     (guards against any accidental "#" hrefs)
     ================================ */
  document.querySelectorAll('a.apk-link').forEach((a) => {
    if (!a.href || a.getAttribute('href') === '#') a.href = APK_URL;
  });
})();
