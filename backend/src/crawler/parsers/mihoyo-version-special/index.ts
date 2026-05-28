/**
 * mihoyo 版本前瞻专题 parser 的统一入口。根据 source URL 的 host + 路径
 * dispatch 到对应游戏的 parser。
 *
 *   zzz.mihoyo.com                   → nap（绝区零，详见 nap.ts 注释）
 *   act.mihoyo.com/puzzle/zzz/...    → nap
 *   act.mihoyo.com/puzzle/hkrpg/...  → hkrpg（崩坏：星穹铁道）
 *   其他                              → hkrpg（兜底，沿用既有星穹铁道 source 的行为）
 */
import { ParsedVersionPlan } from './shared';
import { parseHkrpgVersionSpecial } from './hkrpg';
import { parseNapVersionSpecial } from './nap';

export type MihoyoVersionGame = 'hkrpg' | 'nap';

export function detectMihoyoVersionGame(landingUrl: string): MihoyoVersionGame {
  let url: URL;
  try {
    url = new URL(landingUrl);
  } catch {
    return 'hkrpg';
  }

  const host = url.host.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (host === 'zzz.mihoyo.com' || host.endsWith('.zzz.mihoyo.com')) {
    return 'nap';
  }
  if (pathname.startsWith('/puzzle/zzz/') || pathname.startsWith('/zzz/')) {
    return 'nap';
  }
  if (pathname.startsWith('/puzzle/hkrpg/') || pathname.startsWith('/hkrpg/')) {
    return 'hkrpg';
  }
  return 'hkrpg';
}

export async function parseMihoyoVersionSpecial(
  landingUrl: string,
): Promise<ParsedVersionPlan> {
  const game = detectMihoyoVersionGame(landingUrl);
  if (game === 'nap') {
    return parseNapVersionSpecial(landingUrl);
  }
  return parseHkrpgVersionSpecial(landingUrl);
}

export type {
  ParsedVersionBanner,
  ParsedVersionEvent,
  ParsedVersionPlan,
} from './shared';
