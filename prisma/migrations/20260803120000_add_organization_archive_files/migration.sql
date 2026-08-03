-- CreateTable
CREATE TABLE "ArchiveFile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "description" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "projectId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchiveFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveFile_storageKey_key" ON "ArchiveFile"("storageKey");
CREATE INDEX "ArchiveFile_organizationId_archivedAt_idx" ON "ArchiveFile"("organizationId", "archivedAt");
CREATE INDEX "ArchiveFile_organizationId_name_idx" ON "ArchiveFile"("organizationId", "name");
CREATE INDEX "ArchiveFile_organizationId_deletedAt_archivedAt_idx" ON "ArchiveFile"("organizationId", "deletedAt", "archivedAt");
CREATE INDEX "ArchiveFile_projectId_idx" ON "ArchiveFile"("projectId");
CREATE INDEX "ArchiveFile_uploadedById_idx" ON "ArchiveFile"("uploadedById");

-- AddForeignKey
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ArchiveFile" ADD CONSTRAINT "ArchiveFile_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
