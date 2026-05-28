import { Injectable } from '@nestjs/common';

@Injectable()
export class ClassificationService {
  classify(input: { title?: string | null; content?: string | null }) {
    const text = `${input.title ?? ''}\n${input.content ?? ''}`.toLowerCase();

    if (
      this.includesAny(text, ['兑换码', '礼包码', 'cdk', '福利码', '口令码'])
    ) {
      return 'redeem_code';
    }

    if (this.includesAny(text, ['前瞻', '直播', '特别节目', '版本节目'])) {
      return 'preview';
    }

    if (
      this.includesAny(text, [
        '更新公告',
        '版本更新',
        '补丁',
        'patch notes',
        'update notes',
      ])
    ) {
      return 'update';
    }

    if (this.includesAny(text, ['维护', '停服', '补偿'])) {
      return 'maintenance';
    }

    if (this.includesAny(text, ['活动', '限时', '签到', '挑战'])) {
      return 'event';
    }

    if (this.includesAny(text, ['公告', '通知'])) {
      return 'announcement';
    }

    return 'other';
  }

  extractRedeemCodes(input: {
    title?: string | null;
    content?: string | null;
  }) {
    const text = `${input.title ?? ''}\n${input.content ?? ''}`;
    const upperText = text.toUpperCase();
    const candidates = new Set<string>();
    const codePattern = /\b[A-Z0-9][A-Z0-9-]{5,29}\b/g;

    for (const match of upperText.matchAll(codePattern)) {
      const code = match[0].replace(/-+$/, '');

      if (
        this.looksLikeCode(code) &&
        this.hasRedeemCodeContext(upperText, match.index ?? 0)
      ) {
        candidates.add(code);
      }
    }

    return [...candidates];
  }

  private includesAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  private looksLikeCode(code: string) {
    if (code.length < 6 || code.length > 30) {
      return false;
    }

    if (/^\d+$/.test(code)) {
      return false;
    }

    if (!/[A-Z]/.test(code) || !/\d/.test(code)) {
      return false;
    }

    if (/^BV[A-Z0-9]{10}$/.test(code)) {
      return false;
    }

    if (/^IPHONE\d+$/.test(code)) {
      return false;
    }

    const noisyWords = new Set([
      'HTTP',
      'HTTPS',
      'PATCH',
      'STEAM',
      'BILIBILI',
      'WEIBO',
      'VERSION',
      'UPDATE',
    ]);

    return !noisyWords.has(code);
  }

  private hasRedeemCodeContext(text: string, index: number) {
    const start = Math.max(0, index - 160);
    const end = Math.min(text.length, index + 160);
    const context = text.slice(start, end);

    return /兑换码|礼包码|福利码|口令码|CDK|REDEEM|GIFT CODE|PROMO CODE/.test(
      context,
    );
  }
}
