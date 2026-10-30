-- Index tìm kiếm trigram trên Story.searchText cần extension này
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "StoryType" AS ENUM ('NOVEL', 'COMIC');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('ONGOING', 'COMPLETED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TakedownStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Source" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StoryType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "rateLimitMs" INTEGER NOT NULL DEFAULT 500,
    "lastCrawledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Author" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "altTitles" TEXT[],
    "type" "StoryType" NOT NULL,
    "status" "StoryStatus" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "coverUrl" TEXT,
    "authorId" INTEGER,
    "searchText" TEXT NOT NULL DEFAULT '',
    "matchKey" TEXT NOT NULL,
    "chapterCount" INTEGER NOT NULL DEFAULT 0,
    "latestChapterAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "followCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryGenre" (
    "storyId" INTEGER NOT NULL,
    "genreId" INTEGER NOT NULL,

    CONSTRAINT "StoryGenre_pkey" PRIMARY KEY ("storyId","genreId")
);

-- CreateTable
CREATE TABLE "StorySource" (
    "id" SERIAL NOT NULL,
    "storyId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "chapterCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" SERIAL NOT NULL,
    "storyId" INTEGER NOT NULL,
    "number" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterSource" (
    "id" SERIAL NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "storySourceId" INTEGER NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "ChapterSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterContent" (
    "chapterId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "text" TEXT,
    "images" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterContent_pkey" PRIMARY KEY ("chapterId")
);

-- CreateTable
CREATE TABLE "CrawlRun" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER,
    "job" TEXT NOT NULL,
    "target" TEXT,
    "status" "CrawlStatus" NOT NULL DEFAULT 'RUNNING',
    "stats" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakedownRequest" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "urls" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "TakedownStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TakedownRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_key_key" ON "Source"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Author_slug_key" ON "Author"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Story_type_hidden_latestChapterAt_idx" ON "Story"("type", "hidden", "latestChapterAt" DESC);

-- CreateIndex
CREATE INDEX "Story_type_hidden_viewCount_idx" ON "Story"("type", "hidden", "viewCount" DESC);

-- CreateIndex
CREATE INDEX "Story_matchKey_type_idx" ON "Story"("matchKey", "type");

-- CreateIndex
CREATE INDEX "Story_authorId_idx" ON "Story"("authorId");

-- CreateIndex
CREATE INDEX "Story_searchText_idx" ON "Story" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "StoryGenre_genreId_idx" ON "StoryGenre"("genreId");

-- CreateIndex
CREATE INDEX "StorySource_storyId_idx" ON "StorySource"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "StorySource_sourceId_path_key" ON "StorySource"("sourceId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_storyId_number_key" ON "Chapter"("storyId", "number");

-- CreateIndex
CREATE INDEX "ChapterSource_chapterId_idx" ON "ChapterSource"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterSource_storySourceId_path_key" ON "ChapterSource"("storySourceId", "path");

-- CreateIndex
CREATE INDEX "CrawlRun_startedAt_idx" ON "CrawlRun"("startedAt" DESC);

-- CreateIndex
CREATE INDEX "CrawlRun_sourceId_startedAt_idx" ON "CrawlRun"("sourceId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryGenre" ADD CONSTRAINT "StoryGenre_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryGenre" ADD CONSTRAINT "StoryGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySource" ADD CONSTRAINT "StorySource_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorySource" ADD CONSTRAINT "StorySource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterSource" ADD CONSTRAINT "ChapterSource_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterSource" ADD CONSTRAINT "ChapterSource_storySourceId_fkey" FOREIGN KEY ("storySourceId") REFERENCES "StorySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterContent" ADD CONSTRAINT "ChapterContent_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlRun" ADD CONSTRAINT "CrawlRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
