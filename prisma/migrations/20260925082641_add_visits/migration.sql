-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "language" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "owner" BOOLEAN NOT NULL DEFAULT false,
    "visitorId" TEXT,
    "client" JSONB,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visit_createdAt_isBot_idx" ON "Visit"("createdAt", "isBot");

-- CreateIndex
CREATE INDEX "Visit_visitorId_idx" ON "Visit"("visitorId");
