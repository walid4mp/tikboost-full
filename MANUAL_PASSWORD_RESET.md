# Manual Password Reset

The forgot-password flow is intentionally manual.

1. User submits email to `/api/auth/forgot`.
2. Backend creates a 6-digit OTP valid for 10 minutes.
3. OTP is encrypted at rest with `RESET_OTP_ENCRYPTION_KEY`; the API response and logs never contain it.
4. Admin opens **Password Reset Requests** and reveals/copies the OTP.
5. Admin sends it to the user manually.
6. User submits email + OTP + new password + confirmation to `/api/auth/reset`.
7. Maximum 5 wrong attempts; request becomes `LOCKED`.
8. A new request invalidates the previous pending request.
9. The same email/IP must wait at least 60 seconds before creating another request.

Resend/SMTP is not used by the forgot-password flow. Email providers remain available for unrelated application email features.

Render should have `RESET_OTP_ENCRYPTION_KEY` configured as a secret. The included `render.yaml` uses `generateValue: true`.
