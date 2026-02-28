/**
 * SNS自動投稿バッチシステム - X (Twitter) サービス
 *
 * X API v2を使用して動画付きポストを投稿する。
 * 環境変数にAPIキーが設定されている場合のみ実行される（条件付き実行）。
 * twitter-api-v2ライブラリを使用。
 */

import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs';
import type { XConfig, PostMetadata, UploadResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Xへ動画付きポストを投稿する
 *
 * isXEnabledがfalseの場合、処理をスキップする。
 */
export async function uploadToX(
    config: XConfig | null,
    isXEnabled: boolean,
    videoPath: string,
    metadata: PostMetadata
): Promise<UploadResult> {
    const platform = 'x' as const;

    // X投稿が無効の場合はスキップ
    if (!isXEnabled || !config) {
        logger.info('X: APIキーが未設定のためスキップします。');
        return { platform, success: false, skipped: true };
    }

    // 既にアップロード済みの場合はスキップ
    if (metadata.upload_status.x) {
        logger.info('X: 既にアップロード済みのためスキップします。');
        return { platform, success: true, skipped: true };
    }

    try {
        logger.info('X: 投稿処理を開始します...');

        // Twitter APIクライアントの初期化
        const client = new TwitterApi({
            appKey: config.apiKey,
            appSecret: config.apiSecret,
            accessToken: config.accessToken,
            accessSecret: config.accessTokenSecret,
        });

        // メディアアップロード用のv1クライアント
        const v1Client = client.v1;
        // ツイート投稿用のv2クライアント
        const v2Client = client.v2;

        // Step 1: 動画ファイルをアップロード
        logger.info('X: 動画をアップロード中...');
        const mediaId = await v1Client.uploadMedia(videoPath, {
            mimeType: 'video/mp4',
            type: 'longvideo', // 動画ファイル用
        });

        logger.info(`X: メディアアップロード完了 (Media ID: ${mediaId})`);

        // Step 2: 動画付きツイートを投稿
        const tweetText = `${metadata.title}\n\n${metadata.description}`;
        // テキストが280文字を超える場合は切り詰める
        const truncatedText = tweetText.length > 280 ? tweetText.substring(0, 277) + '...' : tweetText;

        logger.info('X: ツイートを投稿中...');
        const tweetResponse = await v2Client.tweet(truncatedText, {
            media: {
                media_ids: [mediaId],
            },
        });

        const tweetId = tweetResponse.data.id;
        logger.success(`X: 投稿成功 (Tweet ID: ${tweetId})`);
        logger.info(`X: https://x.com/i/status/${tweetId}`);

        return { platform, success: true, skipped: false };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('X: 投稿失敗', error);
        return { platform, success: false, skipped: false, error: errorMessage };
    }
}
