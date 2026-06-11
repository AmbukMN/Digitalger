-- AdminPermission — granular permission (admin бүрд resource тус бүрээр эрх).
CREATE TABLE "AdminPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminPermission_userId_resource_key" ON "AdminPermission"("userId", "resource");
CREATE INDEX "AdminPermission_userId_idx" ON "AdminPermission"("userId");
ALTER TABLE "AdminPermission" ADD CONSTRAINT "AdminPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
