/**
 * テスト: メインフロー (index.ts) の成功判定ロジック
 *
 * メイン処理全体のモックテストではなく、
 * 成功判定のコアロジックを切り出してテストする。
 */

import { describe, it, expect } from 'vitest';
import type { UploadResult } from '../types/index.js';

/**
 * 全体の成功判定ロジック（index.ts 内のロジックを再現）
 */
function isAllSuccess(results: UploadResult[], isXEnabled: boolean): boolean {
    for (const result of results) {
        if (result.skipped) continue;
        if (result.platform === 'x' && !isXEnabled) continue;
        if (!result.success) return false;
    }
    return true;
}

describe('メインフロー - 成功判定ロジック', () => {
    it('全プラットフォーム成功（X有効）→ 全体成功', () => {
        const results: UploadResult[] = [
            { platform: 'youtube', success: true, skipped: false },
            { platform: 'tiktok', success: true, skipped: false },
            { platform: 'instagram', success: true, skipped: false },
            { platform: 'x', success: true, skipped: false },
        ];
        expect(isAllSuccess(results, true)).toBe(true);
    });

    it('YouTube/TikTok/Instagram成功、X無効（スキップ）→ 全体成功', () => {
        const results: UploadResult[] = [
            { platform: 'youtube', success: true, skipped: false },
            { platform: 'tiktok', success: true, skipped: false },
            { platform: 'instagram', success: true, skipped: false },
            { platform: 'x', success: false, skipped: true },
        ];
        expect(isAllSuccess(results, false)).toBe(true);
    });

    it('TikTokが失敗 → 全体失敗', () => {
        const results: UploadResult[] = [
            { platform: 'youtube', success: true, skipped: false },
            { platform: 'tiktok', success: false, skipped: false, error: 'API Error' },
            { platform: 'instagram', success: true, skipped: false },
            { platform: 'x', success: false, skipped: true },
        ];
        expect(isAllSuccess(results, false)).toBe(false);
    });

    it('X有効でXが失敗 → 全体失敗', () => {
        const results: UploadResult[] = [
            { platform: 'youtube', success: true, skipped: false },
            { platform: 'tiktok', success: true, skipped: false },
            { platform: 'instagram', success: true, skipped: false },
            { platform: 'x', success: false, skipped: false, error: 'Auth Error' },
        ];
        expect(isAllSuccess(results, true)).toBe(false);
    });

    it('一部が既にアップロード済み（スキップ）でも残りが成功 → 全体成功', () => {
        const results: UploadResult[] = [
            { platform: 'youtube', success: true, skipped: true },  // 既にアップロード済み
            { platform: 'tiktok', success: true, skipped: false },
            { platform: 'instagram', success: true, skipped: false },
            { platform: 'x', success: false, skipped: true },
        ];
        expect(isAllSuccess(results, false)).toBe(true);
    });

    it('投稿対象がゼロ（すべてスキップ）→ 全体成功', () => {
        const results: UploadResult[] = [
            { platform: 'youtube', success: true, skipped: true },
            { platform: 'tiktok', success: true, skipped: true },
            { platform: 'instagram', success: true, skipped: true },
            { platform: 'x', success: false, skipped: true },
        ];
        expect(isAllSuccess(results, false)).toBe(true);
    });
});
