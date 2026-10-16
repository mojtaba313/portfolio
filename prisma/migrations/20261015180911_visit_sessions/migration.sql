/*
  Warnings:

  - You are about to drop the `Visit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Visit";

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "ips" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "country" TEXT,
    "language" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "owner" BOOLEAN NOT NULL DEFAULT false,
    "client" JSONB,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryPath" TEXT NOT NULL,
    "exitPath" TEXT,
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
    "newVisitor" BOOLEAN NOT NULL DEFAULT false,
    "client" JSONB,

    CONSTRAINT "VisitSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageView" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dwellMs" INTEGER,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Visitor_lastSeen_idx" ON "Visitor"("lastSeen");

-- CreateIndex
CREATE INDEX "Visitor_ip_idx" ON "Visitor"("ip");

-- CreateIndex
CREATE INDEX "Visitor_isBot_lastSeen_idx" ON "Visitor"("isBot", "lastSeen");

-- CreateIndex
CREATE INDEX "VisitSession_startedAt_idx" ON "VisitSession"("startedAt");

-- CreateIndex
CREATE INDEX "VisitSession_visitorId_startedAt_idx" ON "VisitSession"("visitorId", "startedAt");

-- CreateIndex
CREATE INDEX "VisitSession_ip_startedAt_idx" ON "VisitSession"("ip", "startedAt");

-- CreateIndex
CREATE INDEX "VisitSession_isBot_startedAt_idx" ON "VisitSession"("isBot", "startedAt");

-- CreateIndex
CREATE INDEX "PageView_sessionId_viewedAt_idx" ON "PageView"("sessionId", "viewedAt");

-- CreateIndex
CREATE INDEX "PageView_viewedAt_idx" ON "PageView"("viewedAt");

-- AddForeignKey
ALTER TABLE "VisitSession" ADD CONSTRAINT "VisitSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageView" ADD CONSTRAINT "PageView_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VisitSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
