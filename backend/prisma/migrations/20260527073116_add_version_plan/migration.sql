-- CreateTable
CREATE TABLE "VersionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "subtitle" TEXT,
    "releaseAt" DATETIME,
    "coverUrl" TEXT,
    "officialUrl" TEXT,
    "provider" TEXT NOT NULL,
    "providerUrl" TEXT,
    "raw" TEXT,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VersionPlan_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VersionPlanBanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "poolIndex" INTEGER NOT NULL,
    "poolName" TEXT,
    "characterName" TEXT,
    "characterRarity" INTEGER,
    "characterPath" TEXT,
    "characterElement" TEXT,
    "isNewCharacter" BOOLEAN NOT NULL DEFAULT false,
    "lightConeName" TEXT,
    "lightConeRarity" INTEGER,
    "isNewLightCone" BOOLEAN NOT NULL DEFAULT false,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "rawTime" TEXT,
    "rawRoleInfo" TEXT,
    "rawConeInfo" TEXT,
    CONSTRAINT "VersionPlanBanner_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VersionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VersionPlanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "info" TEXT,
    "startAt" DATETIME,
    "endAt" DATETIME,
    "imageUrl" TEXT,
    CONSTRAINT "VersionPlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "VersionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VersionPlan_gameId_idx" ON "VersionPlan"("gameId");

-- CreateIndex
CREATE INDEX "VersionPlan_releaseAt_idx" ON "VersionPlan"("releaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "VersionPlan_gameId_version_key" ON "VersionPlan"("gameId", "version");

-- CreateIndex
CREATE INDEX "VersionPlanBanner_planId_idx" ON "VersionPlanBanner"("planId");

-- CreateIndex
CREATE INDEX "VersionPlanBanner_phase_idx" ON "VersionPlanBanner"("phase");

-- CreateIndex
CREATE INDEX "VersionPlanEvent_planId_idx" ON "VersionPlanEvent"("planId");

-- CreateIndex
CREATE INDEX "VersionPlanEvent_category_idx" ON "VersionPlanEvent"("category");
