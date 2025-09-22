/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `status` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN     "status" "public"."UserStatus" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");
