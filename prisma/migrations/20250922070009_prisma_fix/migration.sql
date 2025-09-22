-- CreateEnum
CREATE TYPE "public"."LoanName" AS ENUM ('EMERGENCY', 'HOME', 'COMMODITY', 'REGULAR', 'HOUSING');

-- AlterTable
ALTER TABLE "public"."transactions" ADD COLUMN     "loanId" TEXT;

-- CreateTable
CREATE TABLE "public"."loans" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "approvedAmount" DECIMAL(15,2) NOT NULL,
    "status" "public"."LoanStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "interestRate" INTEGER NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "otp" VARCHAR(6),
    "otpExpiresAt" TIMESTAMP(3),
    "transferredAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."repayments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."RepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_category" (
    "id" TEXT NOT NULL,
    "name" "public"."LoanName" NOT NULL,
    "description" TEXT,
    "interestRate" DECIMAL(5,2),
    "minAmount" DECIMAL(15,2),
    "maxAmount" DECIMAL(15,2),
    "minDuration" INTEGER,
    "maxDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loans_memberId_idx" ON "public"."loans"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "loan_category_name_key" ON "public"."loan_category"("name");

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."loan_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."repayments" ADD CONSTRAINT "repayments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "public"."loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
