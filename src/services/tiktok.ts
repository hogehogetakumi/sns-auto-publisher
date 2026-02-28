/**
 * SNS自動投稿バッチシステム - TikTok サービス
 *
 * TikTok Content Posting API (Direct Post) を使用して動画をアップロードする。
 * リフレッシュトークンを使用してアクセストークンを取得する。
 */

import axios from 'axios';
import fs from 'fs';
import type { TikTokConfig, PostMetadata, UploadResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

const TIKTOK_AUTH_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_PUBLISH_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const TIKTOK_UPLOAD_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

/**
 * リフレッシュトークンを使用してアクセストークンを取得する
 */
async function getAccessToken(config: TikTokConfig): Promise<string> {
    logger.info('TikTok: アクセストークンを取得中...');

    const response = await axios.post(
        TIKTOK_AUTH_URL,
        new URLSearchParams({
            client_key: config.clientKey,
            client_secret: config.clientSecret,
            grant_type: 'refresh_token',
            refresh_token: config.refreshToken,
        }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }
    );

    if (response.data.access_token) {
        logger.info('TikTok: アクセストークン取得成功');
        return response.data.access_token;
    }

    throw new Error(`TikTok: アクセストークン取得失敗 - ${JSON.stringify(response.data)}`);
}

/**
 * TikTokへ動画をアップロードする (Direct Post方式)
 */
export async function uploadToTikTok(
    config: TikTokConfig,
    videoPath: string,
    metadata: PostMetadata
): Promise<UploadResult> {
    const platform = 'tiktok' as const;

    // 既にアップロード済みの場合はスキップ
    if (metadata.upload_status.tiktok) {
        logger.info('TikTok: 既にアップロード済みのためスキップします。');
        return { platform, success: true, skipped: true };
    }

    try {
        logger.info('TikTok: アップロード処理を開始します...');

        const accessToken = await getAccessToken(config);

        // ファイルサイズを取得
        const fileStats = fs.statSync(videoPath);
        const fileSize = fileStats.size;
        const videoData = fs.readFileSync(videoPath);

        // Step 1: Direct Post の初期化（FILE_UPLOAD方式）
        logger.info('TikTok: Direct Post を初期化中...');
        const initResponse = await axios.post(
            TIKTOK_PUBLISH_URL,
            {
                post_info: {
                    title: metadata.title,
                    privacy_level: 'PUBLIC_TO_EVERYONE',
                    disable_duet: false,
                    disable_comment: false,
                    disable_stitch: false,
                    video_cover_timestamp_ms: 0,
                },
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: fileSize,
                    chunk_size: fileSize,
                    total_chunk_count: 1,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
            }
        );

        if (initResponse.data.error?.code !== 'ok') {
            throw new Error(`TikTok初期化失敗: ${JSON.stringify(initResponse.data.error)}`);
        }

        const publishId = initResponse.data.data.publish_id;
        const uploadUrl = initResponse.data.data.upload_url;

        logger.info(`TikTok: PublishID=${publishId}, 動画アップロード中...`);

        // Step 2: 動画バイナリをアップロード
        await axios.put(uploadUrl, videoData, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': fileSize.toString(),
                'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
            },
        });

        logger.success(`TikTok: アップロード成功 (Publish ID: ${publishId})`);
        return { platform, success: true, skipped: false };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('TikTok: アップロード失敗', error);
        return { platform, success: false, skipped: false, error: errorMessage };
    }
}
