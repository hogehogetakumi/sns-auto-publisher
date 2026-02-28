/**
 * SNS自動投稿バッチシステム - YouTube サービス
 *
 * YouTube Data API v3を使用して、YouTube Shortsとして動画をアップロードする。
 * リフレッシュトークンを使用してアクセストークンを取得する。
 */

import { google } from 'googleapis';
import fs from 'fs';
import type { YouTubeConfig, PostMetadata, UploadResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * YouTube OAuth2クライアントを初期化する
 */
function createYouTubeAuth(config: YouTubeConfig) {
    const oauth2Client = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret
    );
    oauth2Client.setCredentials({
        refresh_token: config.refreshToken,
    });
    return oauth2Client;
}

/**
 * YouTubeへ動画をアップロードする
 */
export async function uploadToYouTube(
    config: YouTubeConfig,
    videoPath: string,
    metadata: PostMetadata
): Promise<UploadResult> {
    const platform = 'youtube' as const;

    // 既にアップロード済みの場合はスキップ
    if (metadata.upload_status.youtube) {
        logger.info('YouTube: 既にアップロード済みのためスキップします。');
        return { platform, success: true, skipped: true };
    }

    try {
        logger.info('YouTube: アップロード処理を開始します...');

        const auth = createYouTubeAuth(config);
        const youtube = google.youtube({ version: 'v3', auth });

        // Shorts向けのタイトル設定（#Shorts タグを付与）
        const title = metadata.title;
        const description = metadata.description;
        const tags = metadata.tags;

        const response = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title,
                    description,
                    tags,
                    categoryId: '22', // People & Blogs
                    defaultLanguage: 'ja',
                    defaultAudioLanguage: 'ja',
                },
                status: {
                    privacyStatus: 'public',
                    selfDeclaredMadeForKids: false,
                },
            },
            media: {
                body: fs.createReadStream(videoPath),
            },
        });

        const videoId = response.data.id;
        logger.success(`YouTube: アップロード成功 (Video ID: ${videoId})`);
        logger.info(`YouTube: https://youtube.com/shorts/${videoId}`);

        return { platform, success: true, skipped: false };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`YouTube: アップロード失敗`, error);
        return { platform, success: false, skipped: false, error: errorMessage };
    }
}
