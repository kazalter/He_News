-- Rename HSR-specific banner weapon columns to game-neutral names.
-- ZZZ stores "音擎" (engines) here, so "lightCone" was misleading.
ALTER TABLE "VersionPlanBanner" RENAME COLUMN "lightConeName" TO "weaponName";
ALTER TABLE "VersionPlanBanner" RENAME COLUMN "lightConeRarity" TO "weaponRarity";
ALTER TABLE "VersionPlanBanner" RENAME COLUMN "isNewLightCone" TO "isNewWeapon";
