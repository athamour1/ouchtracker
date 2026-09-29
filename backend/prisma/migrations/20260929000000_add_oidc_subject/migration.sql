-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN     "oidcSubject" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_oidcSubject_key" ON "users"("oidcSubject");
