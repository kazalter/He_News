/**
 * 码源分发器：按 source.type 路由到具体的码源 parser。
 *
 * 码源和普通文章源（rss/html/mihoyo-content-v2）走的是另一条管线——它们直接
 * 产出 ParsedRedeemCode[]，由 crawler 的 persistRedeemCodes 去重落库，不经过
 * Article。
 */
import type { Source } from '@prisma/client';
import { parseGame8Codes } from './game8';
import { ParsedRedeemCode } from './types';

/** 走"码源管线"（直接出码、不产文章）的 source.type 集合。 */
export const REDEEM_CODE_SOURCE_TYPES = new Set<string>(['game8-codes']);

export function isRedeemCodeSource(type: string): boolean {
  return REDEEM_CODE_SOURCE_TYPES.has(type.toLowerCase());
}

export async function parseRedeemCodeSource(
  source: Source,
): Promise<ParsedRedeemCode[]> {
  switch (source.type.toLowerCase()) {
    case 'game8-codes':
      return parseGame8Codes(source.url);
    default:
      throw new Error(`Unsupported redeem-code source type: ${source.type}`);
  }
}

export type { ParsedRedeemCode } from './types';
