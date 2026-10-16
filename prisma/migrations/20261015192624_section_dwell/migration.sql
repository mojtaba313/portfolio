-- CreateTable
CREATE TABLE "SectionDwell" (
    "id" TEXT NOT NULL,
    "pageViewId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "dwellMs" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionDwell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectionDwell_path_sectionId_idx" ON "SectionDwell"("path", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionDwell_pageViewId_sectionId_key" ON "SectionDwell"("pageViewId", "sectionId");

-- AddForeignKey
ALTER TABLE "SectionDwell" ADD CONSTRAINT "SectionDwell_pageViewId_fkey" FOREIGN KEY ("pageViewId") REFERENCES "PageView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
