CREATE TABLE "PendingRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "directorFirstName" TEXT NOT NULL,
    "directorLastName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "otpExpiresAt" DATETIME NOT NULL,
    "otpSentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "otpVerifiedAt" DATETIME,
    "consumedAt" DATETIME,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING_OTP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PendingRegistration_email_key" ON "PendingRegistration"("email");
