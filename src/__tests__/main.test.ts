/**
 * TikTok アップロード機能テスト
 *
 * TikTok Content Posting API (Direct Post) を使用した
 * 動画アップロード機能の動作確認テスト。
 */

import { describe, it, expect, vi } from 'vitest';
import type { PostMetadata, TikTokConfig } from '../types/index.js';

// --- 外部モジュールをモック ---

// axios モック（TikTok APIレスポンスを模擬）
vi.mock('axios', () => ({
    default: {
        post: vi.fn().mockImplementation((url: string) => {
            // TikTok OAuth トークン取得
            if (url.includes('oauth/token')) {
                return Promise.resolve({
                    data: {
                        access_token: 'mock_tiktok_access_token',
                        refresh_token: 'mock_tiktok_refresh_token_new',
                        open_id: 'mock_open_id',
                        scope: 'video.upload,video.publish',
                    },
                });
            }
            // TikTok Direct Post 初期化
            if (url.includes('publish/video/init')) {
                return Promise.resolve({
                    data: {
                        error: { code: 'ok', message: 'success' },
                        data: {
                            publish_id: 'mock_publish_id_001',
                            upload_url: 'https://open-upload.tiktokapis.com/video/?upload_id=mock',
                        },
                    },
                });
            }
            return Promise.resolve({ data: {} });
        }),
        put: vi.fn().mockResolvedValue({ status: 200, data: {} }),
    },
}));

// fs モック
vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    return {
        ...actual,
        default: {
            ...actual,
            statSync: vi.fn().mockReturnValue({ size: 5242880 }), // 5MB
            readFileSync: vi.fn().mockReturnValue(Buffer.alloc(1024)),
        },
    };
});

// テスト用のTikTok設定
const tiktokConfig: TikTokConfig = {
    clientKey: 'mock_tiktok_client_key',
    clientSecret: 'mock_tiktok_client_secret',
    refreshToken: 'mock_tiktok_refresh_token',
};

// テスト用メタデータ
function createMockMetadata(overrides: Partial<PostMetadata> = {}): PostMetadata {
    return {
        title: 'テスト動画 - TikTokアップロードテスト',
        description: 'TikTok Content Posting APIのテスト投稿です。 #テスト #TikTok',
        tags: ['テスト', 'TikTok', '動画'],
        upload_status: {
            youtube: false,
            tiktok: false,
            instagram: false,
            x: false,
        },
        ...overrides,
    };
}

// --- テスト ---

describe('TikTok Content Posting API - アップロードテスト', () => {
    it('TikTokへの動画アップロードが正常に成功する', async () => {
        const { uploadToTikTok } = await import('../services/tiktok.js');
        const metadata = createMockMetadata();

        const result = await uploadToTikTok(tiktokConfig, '/tmp/test_video.mp4', metadata);

        expect(result.platform).toBe('tiktok');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(false);
        expect(result.error).toBeUndefined();
    });

    it('既にTikTokへアップロード済みの場合はスキップする', async () => {
        const { uploadToTikTok } = await import('../services/tiktok.js');
        const metadata = createMockMetadata({
            upload_status: { youtube: false, tiktok: true, instagram: false, x: false },
        });

        const result = await uploadToTikTok(tiktokConfig, '/tmp/test_video.mp4', metadata);

        expect(result.platform).toBe('tiktok');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });

    it('APIエラー時に適切なエラー情報を返す', async () => {
        // axios.postをエラーにする
        const axios = (await import('axios')).default;
        vi.mocked(axios.post).mockRejectedValueOnce(new Error('TikTok API rate limit exceeded'));

        const { uploadToTikTok } = await import('../services/tiktok.js');
        const metadata = createMockMetadata();

        const result = await uploadToTikTok(tiktokConfig, '/tmp/test_video.mp4', metadata);

        expect(result.platform).toBe('tiktok');
        expect(result.success).toBe(false);
        expect(result.skipped).toBe(false);
        expect(result.error).toContain('TikTok API rate limit exceeded');
    });
});
