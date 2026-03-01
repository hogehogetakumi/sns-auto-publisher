/**
 * テスト: 各SNSサービス（モック版）
 *
 * 外部API呼び出しはすべてモック化し、
 * 各サービスの分岐ロジック（スキップ判定、成功/失敗）をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PostMetadata, YouTubeConfig, TikTokConfig, InstagramConfig, XConfig } from '../types/index.js';

// --- 外部モジュールをモック ---

// googleapis モック
vi.mock('googleapis', () => {
    const mockVideosInsert = vi.fn().mockResolvedValue({ data: { id: 'mock_video_id_123' } });
    return {
        google: {
            auth: {
                OAuth2: class MockOAuth2 {
                    setCredentials = vi.fn();
                },
            },
            youtube: vi.fn().mockReturnValue({
                videos: { insert: mockVideosInsert },
            }),
        },
    };
});

// axios モック
vi.mock('axios', () => ({
    default: {
        post: vi.fn().mockImplementation((url: string) => {
            // TikTok トークン取得
            if (url.includes('oauth/token')) {
                return Promise.resolve({ data: { access_token: 'mock_tiktok_token' } });
            }
            // TikTok Direct Post 初期化
            if (url.includes('publish/video/init')) {
                return Promise.resolve({
                    data: {
                        error: { code: 'ok' },
                        data: { publish_id: 'mock_publish_id', upload_url: 'https://mock-upload.tiktok.com' },
                    },
                });
            }
            // Instagram メディア公開
            if (url.includes('/media_publish')) {
                return Promise.resolve({ data: { id: 'mock_media_id' } });
            }
            // Instagram メディアコンテナ作成（/media にマッチ - media_publishの後に判定）
            if (url.includes('/media')) {
                return Promise.resolve({ data: { id: 'mock_container_id' } });
            }
            return Promise.resolve({ data: {} });
        }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn().mockResolvedValue({ data: { status_code: 'FINISHED' } }),
    },
}));

// twitter-api-v2 モック
vi.mock('twitter-api-v2', () => ({
    TwitterApi: class MockTwitterApi {
        v1 = {
            uploadMedia: vi.fn().mockResolvedValue('mock_media_id_x'),
        };
        v2 = {
            tweet: vi.fn().mockResolvedValue({ data: { id: 'mock_tweet_id' } }),
        };
        constructor() { }
    },
}));

// fs モック（createReadStream, statSync, readFileSync）
vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    return {
        ...actual,
        default: {
            ...actual,
            createReadStream: vi.fn().mockReturnValue('mock_stream'),
            statSync: vi.fn().mockReturnValue({ size: 1024 }),
            readFileSync: vi.fn().mockReturnValue(Buffer.from('mock_video_data')),
        },
    };
});

// テスト用メタデータ
function createMockMetadata(overrides: Partial<PostMetadata> = {}): PostMetadata {
    return {
        title: 'テスト動画タイトル',
        description: 'テスト動画の説明文 #テスト',
        tags: ['テスト', 'モック'],
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

describe('youtube.ts - YouTube サービス', () => {
    const youtubeConfig: YouTubeConfig = {
        clientId: 'mock_yt_client_id',
        clientSecret: 'mock_yt_client_secret',
        refreshToken: 'mock_yt_refresh_token',
    };

    it('正常にアップロードが成功する', async () => {
        const { uploadToYouTube } = await import('../services/youtube.js');
        const metadata = createMockMetadata();
        const result = await uploadToYouTube(youtubeConfig, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('youtube');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(false);
    });

    it('既にアップロード済みの場合はスキップする', async () => {
        const { uploadToYouTube } = await import('../services/youtube.js');
        const metadata = createMockMetadata({
            upload_status: { youtube: true, tiktok: false, instagram: false, x: false },
        });
        const result = await uploadToYouTube(youtubeConfig, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('youtube');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(true);
    });
});

describe('tiktok.ts - TikTok サービス', () => {
    const tiktokConfig: TikTokConfig = {
        clientKey: 'mock_tt_client_key',
        clientSecret: 'mock_tt_client_secret',
        refreshToken: 'mock_tt_refresh_token',
    };

    it('正常にアップロードが成功する', async () => {
        const { uploadToTikTok } = await import('../services/tiktok.js');
        const metadata = createMockMetadata();
        const result = await uploadToTikTok(tiktokConfig, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('tiktok');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(false);
    });

    it('既にアップロード済みの場合はスキップする', async () => {
        const { uploadToTikTok } = await import('../services/tiktok.js');
        const metadata = createMockMetadata({
            upload_status: { youtube: false, tiktok: true, instagram: false, x: false },
        });
        const result = await uploadToTikTok(tiktokConfig, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('tiktok');
        expect(result.skipped).toBe(true);
    });
});

describe('instagram.ts - Instagram サービス', () => {
    const instagramConfig: InstagramConfig = {
        accessToken: 'mock_ig_access_token',
        accountId: 'mock_ig_account_id',
    };

    it('正常にアップロードが成功する', async () => {
        // sleepをモックして高速化
        vi.useFakeTimers();

        const { uploadToInstagram } = await import('../services/instagram.js');
        const metadata = createMockMetadata();

        const resultPromise = uploadToInstagram(
            instagramConfig,
            'https://drive.google.com/uc?export=download&id=mock_file_id',
            metadata
        );

        // sleepの待機を即座に解消
        await vi.advanceTimersByTimeAsync(6000);

        const result = await resultPromise;

        expect(result.platform).toBe('instagram');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(false);

        vi.useRealTimers();
    }, 15000);

    it('既にアップロード済みの場合はスキップする', async () => {
        const { uploadToInstagram } = await import('../services/instagram.js');
        const metadata = createMockMetadata({
            upload_status: { youtube: false, tiktok: false, instagram: true, x: false },
        });
        const result = await uploadToInstagram(instagramConfig, 'https://example.com/video.mp4', metadata);

        expect(result.platform).toBe('instagram');
        expect(result.skipped).toBe(true);
    });
});

describe('x.ts - X (Twitter) サービス', () => {
    const xConfig: XConfig = {
        apiKey: 'mock_x_api_key',
        apiSecret: 'mock_x_api_secret',
        accessToken: 'mock_x_access_token',
        accessTokenSecret: 'mock_x_access_token_secret',
    };

    it('X有効時に正常に投稿が成功する', async () => {
        const { uploadToX } = await import('../services/x.js');
        const metadata = createMockMetadata();
        const result = await uploadToX(xConfig, true, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('x');
        expect(result.success).toBe(true);
        expect(result.skipped).toBe(false);
    });

    it('X無効時（APIキー未設定）はスキップする', async () => {
        const { uploadToX } = await import('../services/x.js');
        const metadata = createMockMetadata();
        const result = await uploadToX(null, false, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('x');
        expect(result.success).toBe(false);
        expect(result.skipped).toBe(true);
    });

    it('既にアップロード済みの場合はスキップする', async () => {
        const { uploadToX } = await import('../services/x.js');
        const metadata = createMockMetadata({
            upload_status: { youtube: false, tiktok: false, instagram: false, x: true },
        });
        const result = await uploadToX(xConfig, true, '/tmp/test.mp4', metadata);

        expect(result.platform).toBe('x');
        expect(result.skipped).toBe(true);
    });
});
