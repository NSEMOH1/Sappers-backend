/*
  Warnings:

  - The values [AVM,AIR_CDRE,GP_CAPT,WG_CDR,SQN_LDR,FLT_LT,FG_OFFR,PLT_OFFR,AWO,FS,ACM] on the enum `Rank` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."Rank_new" AS ENUM ('MG', 'BG', 'COL', 'LT_COL', 'MAJ', 'CAPT', 'LT', 'MWO', 'WO', 'SSGT', 'SGT', 'CPL', 'LCPL', 'SPR');
ALTER TABLE "public"."member" ALTER COLUMN "rank" TYPE "public"."Rank_new" USING ("rank"::text::"public"."Rank_new");
ALTER TYPE "public"."Rank" RENAME TO "Rank_old";
ALTER TYPE "public"."Rank_new" RENAME TO "Rank";
DROP TYPE "public"."Rank_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'STAFF';
