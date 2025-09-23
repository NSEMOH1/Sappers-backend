/*
  Warnings:

  - The values [ARCHIVED] on the enum `NotificationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."NotificationStatus_new" AS ENUM ('UNREAD', 'READ');
ALTER TABLE "public"."notifications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."notifications" ALTER COLUMN "status" TYPE "public"."NotificationStatus_new" USING ("status"::text::"public"."NotificationStatus_new");
ALTER TYPE "public"."NotificationStatus" RENAME TO "NotificationStatus_old";
ALTER TYPE "public"."NotificationStatus_new" RENAME TO "NotificationStatus";
DROP TYPE "public"."NotificationStatus_old";
ALTER TABLE "public"."notifications" ALTER COLUMN "status" SET DEFAULT 'UNREAD';
COMMIT;
