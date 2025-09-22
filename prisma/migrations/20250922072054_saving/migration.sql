/*
  Warnings:

  - Added the required column `rank` to the `member` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."SavingType" AS ENUM ('QUICK', 'COOPERATIVE');

-- AlterTable
ALTER TABLE "public"."member" ADD COLUMN     "rank" "public"."Rank" NOT NULL;

-- AlterTable
ALTER TABLE "public"."savings" ADD COLUMN     "savingCategoryId" TEXT;

-- CreateTable
CREATE TABLE "public"."savings_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."SavingType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "savings_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "savings_category_name_key" ON "public"."savings_category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "savings_category_type_key" ON "public"."savings_category"("type");

-- AddForeignKey
ALTER TABLE "public"."savings" ADD CONSTRAINT "savings_savingCategoryId_fkey" FOREIGN KEY ("savingCategoryId") REFERENCES "public"."savings_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
