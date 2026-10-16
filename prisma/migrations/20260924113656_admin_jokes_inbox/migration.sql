-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Joke" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Joke_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Joke_slug_key" ON "Joke"("slug");

-- CreateIndex
CREATE INDEX "Joke_active_idx" ON "Joke"("active");
