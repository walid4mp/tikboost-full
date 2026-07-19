# TikBoost — Full-Stack Real Production App

Complete, deployable application for TikTok engagement exchange via a points system.

## Stack (Locked)

| Layer | Tech |
|---|---|
| **Backend** | Node.js 18+ · Express 4 · Prisma 5 · **PostgreSQL** · Socket.io 4 · JWT + bcrypt · helmet · express-rate-limit |
| **Mobile** | Flutter 3.x · Riverpod 2 · go_router · Dio · socket_io_client · flutter_secure_storage · Cairo font |
| **Web Admin Panel** | Vanilla HTML/CSS/JS + Chart.js (no build step) |
| **Real-time** | Socket.io rooms `user:{id}` and `campaign:{id}` |
| **DB Constraints** | UNIQUE `(campaign_id, executor_id)` → enforces one-task-per-account at DB level |

---

## Project Structure

```
tikboost-full/
├─ backend/               # Node.js API + Socket.io
│  ├─ src/
│  │  ├─ server.js        # entry
│  │  ├─ app.js           # Express app
│  │  ├─ config/{env,db}.js
│  │  ├─ middleware/{auth,error,rateLimit,validate}.js
│  │  ├─ utils/{errors,jwt,helpers}.js
│  │  ├─ services/{points.service, notifications.service}.js
│  │  ├─ sockets/io.js
│  │  ├─ controllers/     # auth, user, campaign, task, package, wheel, referral, notification, contact, admin
│  │  └─ routes/          # mirroring controllers
│  ├─ prisma/schema.prisma  # ORM schema
│  ├─ sql/schema.sql        # raw SQL (100% equivalent)
│  ├─ scripts/seed.js       # seeds admin + packages + wheel
│  ├─ .env.example
│  └─ package.json
├─ admin-panel/           # Web admin panel (mounts at /admin)
│  ├─ index.html · css/admin.css · js/admin.js
├─ flutter-app/           # Flutter mobile client
│  ├─ lib/{config, services, providers, screens, ...}
│  └─ pubspec.yaml
└─ README.md
```

---

## Features Delivered

### Mobile (`flutter-app`)
- Splash with TikBoost logo + tagline
- Login (Google demo + email + signup + forgot password)
- Home (balance card, start earning, create campaign, last campaigns)
- Earn (task feed with tabs: Followers, Likes, Views, Comments)
- Create Campaign (type, target URL, qty, live cost)
- Shop (5 card packages: Starter → VIP)
- Referrals (link, friends, points earned)
- Notifications (real-time via socket)
- Profile (user card, campaigns list, point history)
- Settings (dark mode, language, privacy, logout)
- My Campaigns (pause/cancel + progress bar)
- Lucky Wheel (animated, weighted prizes, 12h cooldown)
- Contact (WhatsApp + email cards)
- Bottom navigation · dark mode · RTL Arabic · branded icons / gradients / shadows

### Backend API (`/api/...`)
| Endpoint | Method | Notes |
|---|---|---|
| `/auth/signup` `/auth/login` `/auth/google` `/auth/refresh` `/auth/forgot` `/auth/logout` `/auth/me` | * | JWT access (15m) + refresh (30d), bcrypt cost 10 |
| `/user/profile` `/user/points/history` `/user/stats` | * | me + ledger |
| `/campaigns` `/campaigns/mine` `/campaigns/:id/pause` `/campaigns/:id/cancel` | * | points auto-deducted on create, refunded on cancel |
| `/tasks/feed` `/tasks/execute` `/tasks/mine` | * | enforces 8s cooldown + DB unique on (campaign,executor) |
| `/packages` `/packages/buy` `/packages/mine` | * | manual transfer + admin approval |
| `/wheel/prizes` `/wheel/spin` | * | weighted random + 12h cooldown |
| `/referrals` | GET | link + referred users + total bonus |
| `/notifications` `/notifications/:id/read` | * | unread badge + socket push |
| `/contact` | POST | opens ticket via Report table |
| `/admin/users` `/admin/users/:id` (PUT/DELETE) `/admin/users/:id/freeze` `/admin/users/:id/unfreeze` `/admin/users/:id/ban` `/admin/users/:id/grant-points` `/admin/users/:id/role` | * | full moderation |
| `/admin/campaigns` `/admin/campaigns/:id/action` | * | pause/resume/cancel/complete |
| `/admin/purchases` `/admin/purchases/:id/approve` `/admin/purchases/:id/reject` | * | grants points on approve |
| `/admin/reports` `/admin/reports/:id/resolve` | * | REVIEWED / DISMISSED |
| `/admin/notifications/send` | POST | broadcast or per user |
| `/admin/stats` `/admin/stats/top-users` `/admin/stats/chart` | GET | KPIs + 14-day series |
| `/admin/logs` | GET | every admin action recorded |
| `/admin-panel/login` | POST | distinct JWT for panel |

### Web Admin Panel (`admin-panel/`)
- KPI cards (users / campaigns / tasks / revenue)
- Activity line chart (signups + tasks × 14 days)
- Top users leaderboard
- Users: search (id/name/email/refCode), filter role/status, paginate
- User detail modal: profile + point history + role management
- Per-user actions: grant/deduct points (any amount), freeze, unfreeze, ban, delete
- Campaigns: pause/resume/cancel inline
- Purchases: approve (auto grants points) / reject
- Reports: review / dismiss
- Notifications: one-click broadcast to all or to specific user
- Logs: every admin action
- Packages: live read of point packages

### Security
- bcrypt password hashing (cost 10)
- JWT access (15 min) + refresh token stored server-side + revocable
- helmet, CORS, rate-limit (120 req/min)
- DB-level UNIQUE: `tasks(campaign_id, executor_id)` → one user cannot redeem the same campaign twice (anti-cheat enforced by Postgres, not just app code)
- Cooldown between any two task executions by the same user
- Device id + IP captured for audit
- Every admin action persisted in `admin_logs`

---

## Install & Run

### 1. PostgreSQL
Install Postgres 14+. Create database:
```bash
createdb tikboost
```

### 2. Backend
```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL + JWT secrets
npm install
npx prisma generate
npx prisma db push             # creates all tables from prisma/schema.prisma
# OR alternatively:
psql -U postgres -d tikboost -f sql/schema.sql
npm run seed                   # creates admin + 5 packages + 8 wheel prizes
npm run dev                    # http://localhost:4000
```

Default admin (after seed): `admin@tikboost.app` / `Admin@123456`

### 3. Web Admin Panel
Served from same backend at `http://localhost:4000/admin/`
(or open `admin-panel/index.html` directly — no build needed; pass `?api=https://your-host/api` to point to a remote backend)

### 4. Flutter App
```bash
cd flutter-app
flutter pub get
# edit lib/config/app_config.dart → apiBaseUrl & socketUrl
flutter run
```
- Android emulator: use `http://10.0.2.2:4000/api`
- iOS simulator: use `http://localhost:4000/api`
- Real device: use `http://YOUR_LAN_IP:4000/api`

### 5. Build Flutter release
```bash
flutter build apk --release        # Android
flutter build ipa --release        # iOS
```

---

## Environment Variables (`backend/.env`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tikboost
PORT=4000
NODE_ENV=production
JWT_ACCESS_SECRET=<long_random>
JWT_REFRESH_SECRET=<long_random>
BCRYPT_ROUNDS=10
SEED_ADMIN_EMAIL=admin@tikboost.app
SEED_ADMIN_PASSWORD=Admin@123456
TASK_COOLDOWN_SECONDS=8
MAX_CAMPAIGNS_PER_USER=20
FREEZE_DURATION_MIN=60
SOCKET_CORS_ORIGIN=*
```

---

## Real-time Events (Socket.io)

| Event | Direction | Payload |
|---|---|---|
| `identity` | client→server | `userId` (joins room `user:{id}`) |
| `campaign:join` | client→server | `campaignId` (joins room `campaign:{id}`) |
| `campaign:progress` | server→client | `{campaignId, completed, quantity}` |
| `campaign:update`   | server→client | full campaign object |
| `notification`      | server→client | full Notification object |

---

## Database Tables

`users · refresh_tokens · campaigns · tasks · point_packages · purchases · point_logs · notifications · reports · admin_logs · wheel_prizes · spin_logs`

All enums (`UserRole`, `UserStatus`, `CampaignType`, `CampaignStatus`, `PurchaseStatus`, `PointReason`, `ReportStatus`) and triggers (`updated_at`) included in both `prisma/schema.prisma` and `sql/schema.sql`.

---

## Deploy on Render

Render supports deploying Node apps via a web service and wiring `DATABASE_URL` from a Render Postgres database through `render.yaml` Blueprints. Render also supports generated secret env vars and a `preDeployCommand`, which is useful for Prisma schema sync and seeding. [Render](https://render.com/docs/blueprint-spec) [render.com](https://render.com/docs/deploy-prisma-orm)

### Included in this repo
- Root `render.yaml` that provisions:
  - a web service named `tikboost-api`
  - a PostgreSQL database named `tikboost-db`
- Build command: `cd backend && npm run render:build`
- Pre-deploy command: `cd backend && npm run render:predeploy`
- Start command: `cd backend && npm start`
- Health check path: `/health`
- `DATABASE_URL` is wired from the Render Postgres connection string via `fromDatabase` [Render](https://render.com/docs/blueprint-spec)
- JWT secrets are auto-generated via `generateValue: true` [Render](https://render.com/docs/blueprint-spec)
- `APP_URL` can fall back to Render's default `RENDER_EXTERNAL_URL` env var at runtime [Render](https://render.com/docs/environment-variables)

### Render notes
- The repo is configured to run `prisma db push` and then seed the database during deploy.
- Default web/database plans in `render.yaml` are set to `free` for easiest first deploy. Render documents free web services and free Postgres availability, though free Postgres instances have limits and expiry behavior. [Render](https://render.com/docs/free)
- Change `SEED_ADMIN_PASSWORD` after first deploy.

## License
MIT — free to use, modify, and deploy.
