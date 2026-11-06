ALTER TABLE "User" ADD COLUMN "fcmToken" TEXT;
CREATE UNIQUE INDEX "User_fcmToken_key" ON "User"("fcmToken");
