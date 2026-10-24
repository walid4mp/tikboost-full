# Handoff: TikBoost — Landing Page

## Overview
صفحة هبوط تسويقية كاملة لتطبيق **TikBoost** — تطبيق أندرويد لزيادة التفاعل على TikTok (مشاهدات، إعجابات، متابعين، تعليقات) عبر نظام تبادل مهام. الصفحة تدفع المستخدم لتنزيل ملف APK من GitHub Releases، وتشرح آلية العمل، وتعرض قنوات التواصل.

---

## About the Design Files
الملفات المرفقة في هذه الحزمة هي **مراجع تصميم مكتوبة بـ HTML/CSS/JS خالص** — بمثابة نموذج أولي (prototype) يوضح الشكل النهائي والسلوك المرغوب، **وليست بالضرورة الكود الإنتاجي النهائي**.

المطلوب من المطور: **إعادة بناء هذه الصفحة داخل بيئة الكود المستهدفة** (سواء React/Next.js أو Vue/Nuxt أو Astro أو حتى الاحتفاظ بها كـ static HTML كما هي)، مع الاستفادة من الأنماط والمكتبات القائمة في المشروع. إذا لم تكن هناك بيئة قائمة، فإن هذه الملفات **جاهزة للنشر كما هي** على Vercel أو Netlify أو GitHub Pages — لا تحتاج build step.

## Fidelity
**High-fidelity (hifi)** — تصميم مكتمل بالكامل بألوان وطباعة ومسافات وتفاعلات نهائية. يمكن الاعتماد على قيم الـ CSS الموجودة في `styles.css` كمصدر مباشر للحقيقة (source of truth).

---

## Screens / Views

الصفحة عبارة عن **Single Page** مقسمة إلى 9 أقسام (sections) مربوطة بروابط anchor:

### 1. Navigation Bar (`.nav`)
- **Purpose:** تنقل سريع بين الأقسام + زر تحميل بارز
- **Layout:** fixed top, `padding: 14px 0`, full-width
- **Behavior:** يصبح شبه شفاف مع `backdrop-filter: blur(20px)` بعد تمرير > 30px (يُضاف class `.scrolled`)
- **Components:**
  - Brand: أيقونة `fa-bolt` داخل مربع gradient أحمر 40×40px + نص "Tik**Boost**"
  - Links: المميزات · كيف يعمل · الاستخدام · لماذا نحن · الأسئلة
  - CTA: زر أحمر متدرج "حمّل الآن" يشير للـ APK مباشرة
  - Mobile: يظهر hamburger `< 720px`

### 2. Hero (`.hero`)
- **Purpose:** التعريف بالتطبيق + دعوة أساسية للتحميل
- **Layout:** grid 2 columns (`1.1fr 0.9fr`) — النص على اليمين، mockup الهاتف على اليسار. Stack عمودي < 960px.
- **Padding:** `160px 0 100px` (desktop) / `130px 0 70px` (< 720px)
- **Background:** radial gradients أحمر شفاف + grid overlay
- **Components:**
  - Badge أحمر: "الإصدار 1.0.0 — متاح الآن لأندرويد" مع نقطة نبض
  - Title: `clamp(36px, 6vw, 72px)`, `font-weight: 900`, letter-spacing -0.03em, يحتوي gradient على كلمة "TikBoost"
  - Description: `clamp(16px, 1.6vw, 19px)`, `max-width: 620px`
  - Two buttons: Primary (تحميل التطبيق) + Ghost (تعرّف أكثر)
  - Stats: 3 عدّادات (50,000+ مستخدم · 10M+ مشاهدة · 99% رضا) — تتحرك من 0 عند الظهور
  - Phone mockup: بأبعاد 300×610px، radius 44px، shadow ثلاثية الطبقات، يطفو بحركة `floatY` مدتها 6s

### 3. Features (`#features`)
- **Purpose:** 6 مميزات رئيسية للتطبيق
- **Layout:** `grid-template-columns: repeat(auto-fit, minmax(260px, 1fr))`, gap 20px
- **Card structure:** padding 32px 28px, border-radius 24px, transparent gradient bg
- **Interaction:**
  - Hover: `translateY(-6px)` + border يصبح أحمر شفاف + shadow حمراء
  - Glow effect: يتتبع المؤشر عبر `--x`/`--y` CSS variables (يُحدَّث من `pointermove`)
  - Icon: يتحول من fill شفاف إلى gradient أحمر مع rotation عند hover
- **Features:** جمع النقاط · زيادة الإعجابات · زيادة المتابعين · زيادة المشاهدات · زيادة التعليقات · سرعة وأمان

### 4. How it works (`#how`)
- **Purpose:** 4 خطوات مرتّبة
- **Layout:** `grid-template-columns: repeat(4, 1fr)`, gap 20px (2 col < 960px, 1 col < 720px)
- **Steps:**
  1. أنشئ حساباً — icon `fa-user-plus`
  2. اجمع النقاط — icon `fa-coins`
  3. أنشئ حملة — icon `fa-bullhorn`
  4. احصل على التفاعل — icon `fa-chart-line`
- **Arrows:** أسهم `fa-arrow-left` بين الخطوات مع animation `nudge` (تختفي في mobile)

### 5. Usage / Screenshots (`#usage`)
- **Purpose:** 4 لقطات شاشة توضح الاستخدام
- **Layout:** `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`, gap 24px
- **Frame:** `aspect-ratio: 9/16`, border-radius 18px
- **Auto-load behavior (مهم):**
  - كل `<img>` يحمل `data-src="screenshots/screen-N.png"` فقط (بدون src)
  - `script.js` يجرّب تحميل الصورة عبر `new Image()`
  - إذا نجح: يضع `src` ويُضيف class `.loaded` مع fade-in، ويخفي الـ placeholder
  - إذا فشل: يبقى الـ placeholder ظاهرًا (icon + نص "أضف لقطة")

### 6. Why (`#why`)
- **Purpose:** 6 أسباب لاختيار TikBoost
- **Layout:** grid auto-fit minmax 280px, gap 18px
- **Card structure:** flex horizontal — icon 44×44 (أحمر شفاف) + نص
- **Items:** واجهة سهلة · سرعة كبيرة · نظام نقاط عادل · تحديثات مستمرة · دعم فني · مجاني للتجربة

### 7. Latest Version (`#latest`)
- **Purpose:** بطاقة بارزة تعرض معلومات آخر إصدار
- **Layout:** grid 2 columns (`1.4fr 1fr`), gap 40px (stacks < 960px)
- **Background:** glassmorphism — `linear-gradient(135deg, rgba(255,45,71,0.08), rgba(255,255,255,0.02))` + `backdrop-filter: blur(20px)` + red glow في الزاوية
- **Auto-fetch behavior:**
  - `script.js` يستدعي `https://api.github.com/repos/walid4mp/tikboost-full/releases/latest`
  - يستخرج: `tag_name` → عنصر `#latest-version`, `assets[].size` → `#latest-size`, `published_at` → `#latest-date`
  - في حال فشل الطلب (offline/rate limit): يحتفظ بالقيم الافتراضية (v1.0.0, ~12 MB, 2026)

### 8. Download (`#download`)
- **Purpose:** قسم CTA رئيسي للتحميل
- **Layout:** بطاقة مركزية `padding: 60px`, radius 32px، border أحمر شفاف
- **Background:** radial gradients + grid overlay مقنّع بـ radial mask
- **Elements:**
  - Icon Android داخل مربع gradient 84×84
  - Title "📥 حمّل التطبيق الآن"
  - Big red button "Download APK" (padding 18×40, font 17px)
  - Meta chips: Android 8.0+ · Version v1.0.0 · الحجم ~12MB · آخر تحديث · مجاني
  - Secondary link إلى GitHub Releases

### 9. FAQ (`#faq`)
- **Purpose:** الأسئلة الشائعة
- **Layout:** max-width 820px, gap 12px, `<details>/<summary>` semantic
- **Behavior:** فقط واحد مفتوح في نفس الوقت (JS يستمع `toggle`)
- **Style:** أيقونة + / − تدور 180° عند الفتح
- **Questions:** التطبيق مجاني؟ · يحتاج تسجيل؟ · كيف أجمع النقاط؟ · يعمل على جميع هواتف أندرويد؟ · الحساب آمن؟

### 10. Contact (`#contact`)
- **Purpose:** 4 قنوات تواصل بألوان علاماتها التجارية
- **Layout:** grid auto-fit minmax 240px, gap 18px
- **Cards:** كل بطاقة `<a>` كاملة قابلة للضغط، مع circle glow في الزاوية العليا اليمنى
- **Colors per card (--card-color):**
  - WhatsApp: `#25D366`
  - Email: `#EA4335`
  - Facebook: `#1877F2`
  - Instagram: `#E4405F`

### 11. Footer (`.footer`)
- **Layout:** flex row مع space-between → column < 720px
- **Content:** brand + socials icons + "TikBoost © 2026 — Designed with ❤ — جميع الحقوق محفوظة"

---

## Interactions & Behavior

| Interaction | Implementation |
|---|---|
| **Smooth scroll** | `html { scroll-behavior: smooth }` + anchor links |
| **Scroll reveal** | `IntersectionObserver` (threshold 0.12), يضيف class `.in` — نوعان: `.reveal` (element واحد) و `.reveal-stagger` (children مع delays 50–550ms) |
| **Nav shrink** | class `.scrolled` عند `window.scrollY > 30` |
| **Number counters** | `requestAnimationFrame` مع easing `1 - (1-p)^3`، مدة 1600ms |
| **Feature glow tracking** | `pointermove` يحدّث `--x`/`--y` CSS vars → radial gradient يتبع المؤشر |
| **FAQ accordion** | native `<details>` + JS يغلق البقية عند فتح واحد |
| **Scroll-to-top button** | يظهر عند `scrollY > 400`, انتقال smooth |
| **Mobile menu** | toggle class `.mobile-open`، أيقونة تتبدل bars ↔ xmark |
| **Screenshot lazy-probe** | `new Image()` قبل تعيين `src` — يمنع broken images |
| **GitHub Releases API** | fetch عند page load، يحدّث version/size/date DOM nodes |

### Animations (كلها CSS)
| Name | Duration | Applied to |
|---|---|---|
| `float` | 18s / 22s ease-in-out infinite | Background orbs |
| `pulse` | 1.8s | Status dots |
| `floatY` | 6s | Phone mockup |
| `slideIn` | 0.6s cubic-bezier(0.22, 1, 0.36, 1) | Phone tasks (staggered 0/0.15/0.3s) |
| `fillBar` | 2s | Points progress bar |
| `nudge` | 1.5s | Step arrows |
| `beat` | 1.5s | Heart in footer |

### Easing
جميع الانتقالات الرئيسية تستخدم:
```css
--easing: cubic-bezier(0.22, 1, 0.36, 1);
```

### Responsive Breakpoints
| Breakpoint | Changes |
|---|---|
| `≤ 960px` | Hero يصبح عمود واحد، Steps 2 columns، Latest card يصبح stacked |
| `≤ 720px` | Nav links تختفي والـ hamburger يظهر، Steps 1 column، phone mockup 260×530 |
| `≤ 480px` | Hero title 34px، buttons full-width عمودية، container padding 18px |

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

---

## State Management

الصفحة لا تحتاج state management خارجي، فقط 3 حالات محلية:

1. **Nav scrolled** — boolean عبر class `.scrolled` (يديره `onScroll`)
2. **Mobile menu open** — boolean عبر class `.mobile-open`
3. **FAQ open** — boolean per `<details>` native

### Data fetching
طلب واحد فقط عند تحميل الصفحة:
```
GET https://api.github.com/repos/walid4mp/tikboost-full/releases/latest
Accept: application/vnd.github+json
```
لا يحتاج API key. Rate limit عام 60/hour لكل IP — كافٍ للاستخدام العادي.

---

## Design Tokens

### Colors
```css
--bg:            #0a0a0d;   /* Primary background */
--bg-2:          #111116;   /* Slightly elevated */
--surface:       #16161c;   /* Card base */
--surface-2:     #1c1c24;
--border:        rgba(255,255,255,0.08);
--border-strong: rgba(255,255,255,0.14);
--text:          #ffffff;
--text-dim:      #a8a8b3;
--text-mute:     #6b6b78;

--red:           #ff2d47;   /* Primary brand */
--red-2:         #ff4d63;   /* Lighter accent */
--red-deep:      #c8001b;   /* Deep red gradient stop */
--red-glow:      rgba(255,45,71,0.35);
```

### Brand gradients
```css
--grad-red: linear-gradient(135deg, #ff2d47 0%, #ff5f7a 50%, #c8001b 100%);
```

### Contact card brand colors
- WhatsApp: `#25D366`
- Email (Gmail): `#EA4335`
- Facebook: `#1877F2`
- Instagram: `#E4405F`

### Spacing scale
- Container max-width: `1200px`
- Container padding: `24px` → `18px` (< 480px)
- Section padding: `100px 0` → `70px 0` (< 720px)
- Card padding: `24px` – `32px`
- Grid gap: `18px` – `24px`
- Element gap: `8px` – `16px`

### Typography
```css
font-family: 'Cairo', system-ui, -apple-system, 'Segoe UI', sans-serif;
/* Weights loaded: 400, 500, 600, 700, 800, 900 */
```

| Element | Size | Weight |
|---|---|---|
| Hero title | `clamp(36px, 6vw, 72px)` | 900 |
| Section title | `clamp(28px, 4vw, 44px)` | 900 |
| Download title | `clamp(28px, 4vw, 42px)` | 900 |
| Latest title | `clamp(22px, 3vw, 30px)` | 900 |
| Card h3/h4 | `16.5px – 20px` | 800 |
| Body | `14.5px – 17px` | 400–500 |
| Small / meta | `12.5px – 13.5px` | 500–700 |
| Line-height body | `1.65 – 1.75` |
| Letter-spacing headings | `-0.02em to -0.03em` |

### Border Radius
| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 10px | Small buttons, inputs |
| `--radius` | 16px | Standard cards |
| `--radius-lg` | 24px | Feature cards, steps |
| — | 32px | Download card |
| — | 44px | Phone mockup outer |
| — | 100px | Pills / badges |

### Shadows
```css
--shadow-lg: 0 30px 80px -20px rgba(255,45,71,0.25), 0 10px 30px -10px rgba(0,0,0,0.6);
--shadow-sm: 0 4px 24px -6px rgba(0,0,0,0.5);
/* Button primary hover */
box-shadow: 0 18px 40px -10px rgba(255,45,71,0.35), inset 0 1px 0 rgba(255,255,255,0.25);
```

### Glassmorphism recipe
```css
background: rgba(10, 10, 13, 0.72);
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255,255,255,0.08);
```

---

## Assets

الحزمة تعتمد **فقط** على أصول shipped بداخلها + مصدرَين خارجيَين مجانيَّين:

### داخل المشروع
| Asset | مصدر / وصف |
|---|---|
| `favicon.svg` | inline SVG بألوان العلامة (32 سطر) |
| `og-image.svg` | inline SVG 1200×630 للمعاينة على السوشيال ميديا |
| `screenshots/screen-1..4.png` | **placeholders** — على المستخدم إضافتها |

### مصادر خارجية (CDN)
- **Google Fonts — Cairo:** `https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap`
- **Font Awesome 6.5.2:** `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css` (مع SRI hash)

لا توجد أصول مدفوعة أو محمية بحقوق نشر.

### Icons used (Font Awesome classes)
`fa-bolt` · `fa-download` · `fa-circle-play` · `fa-heart` · `fa-user-plus` · `fa-eye` · `fa-comment` · `fa-shield-halved` · `fa-coins` · `fa-bullhorn` · `fa-chart-line` · `fa-arrow-left` · `fa-wand-magic-sparkles` · `fa-scale-balanced` · `fa-rotate` · `fa-headset` · `fa-gift` · `fa-android` (brand) · `fa-github` (brand) · `fa-code-branch` · `fa-file-zipper` · `fa-tag` · `fa-calendar` · `fa-calendar-check` · `fa-weight-hanging` · `fa-cloud-arrow-down` · `fa-envelope` · `fa-whatsapp` (brand) · `fa-facebook-f` (brand) · `fa-instagram` (brand) · `fa-xmark` · `fa-bars` · `fa-arrow-up`

---

## External Integrations

### GitHub Releases (زر التحميل)
- **Download URL (رابط ثابت للأحدث):**
  `https://github.com/walid4mp/tikboost-full/releases/latest/download/app-release.apk`
- **All releases page:**
  `https://github.com/walid4mp/tikboost-full/releases`
- كل الأزرار ذات class `.apk-link` مضبوطة على نفس الرابط. `script.js` يفحصها بعد load ويصلح أي href مكسور.

### Contact links
```
WhatsApp:  https://wa.me/213559658947
Email:     mailto:ww608352@gmail.com
Facebook:  https://www.facebook.com/WHMS5
Instagram: https://www.instagram.com/wh.s.8?igsh=MXczaDR1d3B4c2Zoaw==
```

---

## SEO & Deployment

### Meta tags implemented
- `<title>` + `meta name="description"` + `keywords` + `author` + `robots`
- **Canonical:** `<link rel="canonical" href="https://tikboost.app/">`
- **Open Graph:** type, url, title, description, image, locale (ar_AR), site_name
- **Twitter Card:** summary_large_image + url + title + description + image
- **Structured data:** JSON-LD (`MobileApplication` schema)
- **Theme color:** `#0a0a0d`

### Extra SEO files
- `robots.txt` — يسمح للجميع، يشير لـ sitemap
- `sitemap.xml` — يحتوي `/` + 4 anchor URLs

### Deploy configuration
- **`vercel.json`** — cleanUrls، cache headers، security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- **`netlify.toml`** — نفس الإعدادات بصيغة Netlify
- **`.nojekyll`** — لدعم GitHub Pages
- **`.gitignore`** — يستثني node_modules، .env، artifacts

### Performance notes
- لا JS framework — فقط ~180 سطر vanilla JS
- Fonts محملة بـ `display=swap` + preconnect
- كل الصور `loading="lazy"`
- SVG بدلاً من PNG للأيقونات (favicon, OG)
- Cache-Control للأصول الثابتة `max-age=31536000, immutable`

---

## Files

الملفات الموجودة في هذه الحزمة (نُسخة من الجذر):

| File | Purpose |
|---|---|
| `index.html` | الصفحة الكاملة |
| `styles.css` | كل الأنماط (~840 سطر) |
| `script.js` | كل التفاعلات (~180 سطر) |
| `favicon.svg` | أيقونة الموقع |
| `og-image.svg` | صورة السوشيال ميديا |
| `robots.txt` | تعليمات محركات البحث |
| `sitemap.xml` | خريطة الموقع |
| `vercel.json` | إعدادات Vercel |
| `netlify.toml` | إعدادات Netlify |
| `.gitignore` | ignore rules |
| `README.md` | (الجذر) دليل الاستخدام والنشر |
| `screenshots/README.md` | تعليمات إضافة لقطات الشاشة |

---

## Implementation Checklist for Developer

- [ ] استنسخ المستودع من GitHub (`walid4mp/tikboost-full`)
- [ ] انسخ ملفات الحزمة إلى فرع `main` (أو رفع مباشر)
- [ ] أضف 4 لقطات شاشة داخل مجلد `screenshots/` بالأسماء المحددة
- [ ] تأكد أن أول release في GitHub Releases يحتوي أصلاً باسم `app-release.apk`
- [ ] اربط الريبو بـ Vercel (استيراد → deploy تلقائي، لا build settings مطلوبة)
- [ ] احدث `og:url` / `canonical` / `sitemap.xml` بالدومين النهائي بعد النشر
- [ ] (اختياري) اربط دومين مخصص من إعدادات Vercel

---

**© 2026 TikBoost — Handoff package generated by Genspark Designer.**
