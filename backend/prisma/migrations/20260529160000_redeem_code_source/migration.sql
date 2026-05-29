-- 给 RedeemCode 加来源/奖励字段：码源（聚合页、B站评论等）不产出文章，
-- 需要单独记来源 Source，以及聚合页带的奖励文案。全是可空新列，纯增量，
-- 不动既有数据。
ALTER TABLE "RedeemCode" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "RedeemCode" ADD COLUMN "reward" TEXT;

CREATE INDEX "RedeemCode_sourceId_idx" ON "RedeemCode"("sourceId");
