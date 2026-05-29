/**
 * 码源（聚合页、B站评论等）统一产出的兑换码结构。
 *
 * 和"文章顺带提码"那条老路不同，码源没有 Article，直接吐一串码。crawler 把
 * 这些 ParsedRedeemCode 交给 persistRedeemCodes 落库（去重 upsert）。
 */
export interface ParsedRedeemCode {
  /** 码本身（统一大写）。 */
  code: string;
  /** 奖励文案，聚合页常带（如 "Stellar Jade ×100"）。 */
  reward?: string | null;
  /** 说明/出处，比如 B站评论的作者或文章标题。 */
  description?: string | null;
  /** 过期时间，能解析到就带。 */
  expiredAt?: Date | null;
  /** 'unused'（有效）| 'expired'（聚合页明确归到过期区）。缺省按 unused 落。 */
  status?: string;
  /**
   * 置信度（可选）。评论源用点赞数当信号——高赞码更可信，未来可用于排序/过滤。
   */
  confidence?: number;
}
