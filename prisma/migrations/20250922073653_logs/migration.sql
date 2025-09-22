-- CreateTable
CREATE TABLE "public"."upload_logs" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadType" TEXT NOT NULL,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "uploadedById" TEXT,
    "processingTime" TIMESTAMP(3),
    "errors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."upload_logs" ADD CONSTRAINT "upload_logs_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
