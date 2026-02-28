/**
 * SNS自動投稿バッチシステム - Instagram サービス
 *
 * Instagram Graph APIを使用して、Instagram Reelsとして動画をアップロードする。
 * 長期アクセストークンを使用して認証を行う。
 * アップロード手順: コンテナ作成 → ステータス確認 → 公開の3段階。
 */

import axios from 'axios';
import type { InstagramConfig, PostMetadata, UploadResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

const IG_GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * アップロードステータスの確認間隔（ミリ秒）
 */
const STATUS_CHECK_INTERVAL = 5000;

/**
 * アップロードステータスの最大確認回数
 */
const MAX_STATUS_CHECKS = 60; // 最大5分

/**
 * 指定時間待機する
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Instagram Reelsへ動画をアップロードする
 *
 * Instagram Graph APIではローカルファイルを直接アップロードできないため、
 * 公開アクセス可能な動画URLが必要。Google Driveの共有リンクを使用する。
 */
export async function uploadToInstagram(
    config: InstagramConfig,
    videoUrl: string,
    metadata: PostMetadata
): Promise<UploadResult> {
    const platform = 'instagram' as const;

    // 既にアップロード済みの場合はスキップ
    if (metadata.upload_status.instagram) {
        logger.info('Instagram: 既にアップロード済みのためスキップします。');
        return { platform, success: true, skipped: true };
    }

    try {
        logger.info('Instagram: Reelsアップロード処理を開始します...');

        // Step 1: Reelsメディアコンテナを作成
        logger.info('Instagram: メディアコンテナを作成中...');
        const caption = `${metadata.title}\n\n${metadata.description}`;

        const containerResponse = await axios.post(
            `${IG_GRAPH_API_BASE}/${config.accountId}/media`,
            {
                media_type: 'REELS',
                video_url: videoUrl,
                caption,
                share_to_feed: true,
                access_token: config.accessToken,
            }
        );

        const containerId = containerResponse.data.id;
        logger.info(`Instagram: コンテナ作成成功 (Container ID: ${containerId})`);

        // Step 2: アップロードステータスを確認（完了まで待機）
        logger.info('Instagram: 動画の処理完了を待機中...');
        let isReady = false;

        for (let i = 0; i < MAX_STATUS_CHECKS; i++) {
            await sleep(STATUS_CHECK_INTERVAL);

            const statusResponse = await axios.get(
                `${IG_GRAPH_API_BASE}/${containerId}`,
                {
                    params: {
                        fields: 'status_code',
                        access_token: config.accessToken,
                    },
                }
            );

            const statusCode = statusResponse.data.status_code;
            logger.info(`Instagram: ステータス確認 (${i + 1}/${MAX_STATUS_CHECKS}): ${statusCode}`);

            if (statusCode === 'FINISHED') {
                isReady = true;
                break;
            } else if (statusCode === 'ERROR') {
                throw new Error('Instagram: メディアコンテナの処理中にエラーが発生しました。');
            }
        }

        if (!isReady) {
            throw new Error('Instagram: メディアコンテナの処理がタイムアウトしました。');
        }

        // Step 3: メディアを公開
        logger.info('Instagram: メディアを公開中...');
        const publishResponse = await axios.post(
            `${IG_GRAPH_API_BASE}/${config.accountId}/media_publish`,
            {
                creation_id: containerId,
                access_token: config.accessToken,
            }
        );

        const mediaId = publishResponse.data.id;
        logger.success(`Instagram: 公開成功 (Media ID: ${mediaId})`);

        return { platform, success: true, skipped: false };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Instagram: アップロード失敗', error);
        return { platform, success: false, skipped: false, error: errorMessage };
    }
}
