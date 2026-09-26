# TikBoost UI / Notifications / Lucky Wheel update

- Redesigned the in-app notifications inbox with unread styling and a full-detail bottom sheet. Opening an unread notification marks it as read immediately, removing the red unread dot/count.
- Broadcast notifications are now stored per active user, so each user can independently mark a broadcast as read.
- Admin purchase rejection already sends the rejection reason to the affected user; the admin UI now explicitly documents that behaviour.
- Redesigned the Lucky Wheel with a glossy segmented wheel, lighting, rim bulbs, shadows, a central spin control and a result dialog.
- Removed prize-weight/probability text from the user-facing wheel.
- Added two configurable no-win outcomes to the seed data: `حاول مجددًا` and `لم تربح شيئًا`, both with zero points.
- Wheel probabilities remain editable from Admin through the existing weight controls.
- Improved wheel audio by using a small player pool so tick sounds overlap naturally instead of stopping each other and feeling like vibration.
- Existing Firebase/FCM push flow remains in place for notifications while the app is backgrounded/closed.
