-- AlterTable
ALTER TABLE "ChapterContent" ADD COLUMN     "adCheckedAt" TIMESTAMP(3),
ADD COLUMN     "adIndexes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "AdFingerprint" (
    "id" SERIAL NOT NULL,
    "hash" TEXT NOT NULL,
    "label" TEXT,
    "sampleUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseAd" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseAd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdFingerprint_hash_key" ON "AdFingerprint"("hash");
