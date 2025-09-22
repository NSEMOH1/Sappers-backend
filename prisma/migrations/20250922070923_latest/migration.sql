-- AlterTable
ALTER TABLE "public"."loans" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "rejectedById" TEXT;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
