# TikBoost — Full-Stack Real Production App

Complete, deployable application for TikTok engagement exchange via a points system.

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 18+ · Express 4 · Prisma 5 · PostgreSQL · Socket.io 4 |
| Mobile | Flutter 3.x · Riverpod 2 · go_router · Dio · flutter_secure_storage |
| Ads / Rewards | Google Mobile Ads · rewarded ads · daily rewards · extra wheel spins |
| Admin Panel | Vanilla HTML/CSS/JS + Chart.js |
| CI/CD | GitHub Actions builds APK and publishes GitHub Releases |

---

## Project Structure

```text
tikboost-full/
├─ .github/workflows/android-apk.yml
├─ admin-panel/
├─ backend/
│  ├─ prisma/
│  ├─ src/
│  └─ package.json
├─ flutter-app/
└─ README.md
```

---

## Main Features

### Mobile App
- Authentication: signup, login, refresh, logout, forgot password
- Campaign creation for followers / likes / views / comments
- Earn screen with live task feed and execution flow
- Referrals, notifications, profile, settings, contact
- Lucky wheel with daily spins, extra spins, and reward status
- Rewarded ads for daily bonus points and extra wheel spins
- AdMob banner / native / rewarded integration
- Arabic RTL interface and dark mode

### Backend API
- `/api/auth/*`
- `/api/user/*`
- `/api/campaigns/*`
- `/api/tasks/*`
- `/api/packages/*`
- `/api/referrals`
- `/api/notifications/*`
- `/api/contact`
- `/api/wheel/*`
- `/api/rewards/*`
- `/api/admin/*`
- `/api/admin-panel/login`

### Admin Panel
- Login for admin roles
- Users management
- Campaigns moderation
- Purchases / reports / notifications / logs
- Reward settings and wheel prize management through admin API

---

## Local Setup

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm run seed
npm start
```

Health check:
```bash
GET http://localhost:4000/health
```

Admin panel:
```bash
http://localhost:4000/admin/
```

### Flutter
```bash
cd flutter-app
flutter pub get
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000/api \
  --dart-define=SOCKET_URL=http://10.0.2.2:4000
```

### Build Release APK locally
```bash
cd flutter-app
flutter build apk --release \
  --dart-define=API_BASE_URL=https://tikboost-api-v2.onrender.com/api \
  --dart-define=SOCKET_URL=https://tikboost-api-v2.onrender.com \
  --dart-define=ENABLE_GOOGLE_LOGIN=false \
  --dart-define=ALLOW_LEGACY_PASSWORD_RESET=false
```

---

## Prisma and Database

Useful commands:
```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:push
npm run seed
npm run check:syntax
```

The schema includes:
- User
- Campaign
- Task
- PointPackage
- Purchase
- PointLog
- Notification
- Report
- AdminLog
- WheelPrize
- SpinLog
- AppSetting
- RewardSession
- DailyUsage

---

## Ads and Rewards

- Daily rewarded ads grant bonus points.
- Rewarded ads can also grant extra wheel spins.
- Wheel prizes are weighted.
- Daily limits and confetti threshold are stored in app settings.
- Reward status is returned by `/api/rewards/status` and `/api/wheel/prizes`.

---

## GitHub Actions Build and Release

Workflow file: `.github/workflows/android-apk.yml`

What it does:
1. Starts PostgreSQL in CI.
2. Runs Prisma generate + migrate deploy + seed.
3. Runs backend syntax checks.
4. Installs Flutter.
5. Runs `flutter analyze` and `flutter test`.
6. Builds `app-release.apk`.
7. Uploads the APK as an artifact.
8. On tags starting with `v`, creates a GitHub Release and attaches the APK.

### Release flow
```bash
git tag v1.1.0
git push origin main --tags
```

---

## Deployment Notes

### Render
- Build command: `cd backend && npm run render:build`
- Pre-deploy command: `cd backend && npm run render:predeploy`
- Start command: `cd backend && npm start`
- Health check path: `/health`

### Android Manifest
The Android app includes:
- internet permission
- Google Mobile Ads application id metadata

---

## License
MIT
