/*
  Warnings:

  - You are about to drop the column `savingCategoryId` on the `savings` table. All the data in the column will be lost.
  - Added the required column `status` to the `savings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."savings" DROP CONSTRAINT "savings_savingCategoryId_fkey";

-- AlterTable
ALTER TABLE "public"."savings" DROP COLUMN "savingCategoryId",
ADD COLUMN     "status" "public"."SavingStatus" NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."savings" ADD CONSTRAINT "savings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."savings_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
