-- CreateTable
CREATE TABLE "CrawlLock" (
    "name" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlLock_pkey" PRIMARY KEY ("name")
);

-- Chặn truy cập qua REST API của Supabase (xem migration enable_rls)
ALTER TABLE "CrawlLock" ENABLE ROW LEVEL SECURITY;
