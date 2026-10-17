# TikBoost fixes – 2026-09-26

## Notifications
- Marking a notification as read is idempotent.
- The backend returns the authoritative unread count after marking it read.
- Flutter uses that server count instead of blindly decrementing a local counter.
- Opening an FCM push marks the matching inbox notification as read.
- Push payloads now contain the stored notification ID.

## Device account / welcome reward protection
- Flutter sends a stable Android/iOS device identity to signup/login/Google signup.
- `User.deviceId` is no longer unique, so two accounts can belong to the same device.
- Signup requests for the same device are serialized with a PostgreSQL advisory transaction lock.
- The first two accounts on a device are eligible for the signup welcome reward.
- A third or later account can be created but receives no signup welcome reward.
- Referral rewards associated with a non-eligible third+ account are also not issued.
- The rule is stored/enforced on the backend, so deleting and reinstalling the app does not reset the device's reward count.

## Database
Apply Prisma migrations during deployment. The included migration removes the old unique
constraint on `User.deviceId` and adds a normal index.
