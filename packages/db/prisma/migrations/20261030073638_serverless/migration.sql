-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "backfillPage" INTEGER;

-- CreateTable
CREATE TABLE "CrawlSkip" (
    "sourceId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlSkip_pkey" PRIMARY KEY ("sourceId","path")
);

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- Bảng mới cũng chặn truy cập qua REST API của Supabase (xem migration enable_rls)
ALTER TABLE "CrawlSkip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rateLimit" ENABLE ROW LEVEL SECURITY;
