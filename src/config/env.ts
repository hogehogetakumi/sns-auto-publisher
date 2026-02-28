/**
 * SNS自動投稿バッチシステム - 環境変数管理
 *
 * 必須キーの存在チェックを行い、欠損があればエラーとする。
 * X関連のキーのみ「存在しない場合は当該処理をスキップする」仕様。
 */

import dotenv from 'dotenv';
import type { AppConfig, DriveConfig, YouTubeConfig, TikTokConfig, InstagramConfig, XConfig, MailConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

// ローカル開発時は .env から読み込み
dotenv.config();

/**
 * 必須の環境変数を取得する。存在しない場合はエラーをスローする。
 */
function getRequiredEnv(key: string): string {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        throw new Error(`[致命的エラー] 必須環境変数 "${key}" が設定されていません。`);
    }
    return value.trim();
}

/**
 * 任意の環境変数を取得する。存在しない場合はundefinedを返す。
 */
function getOptionalEnv(key: string): string | undefined {
    const value = process.env[key];
    if (!value || value.trim() === '') {
        return undefined;
    }
    return value.trim();
}

/**
 * Google Drive設定の読み込み
 */
function loadDriveConfig(): DriveConfig {
    return {
        credentialsJson: getRequiredEnv('GDRIVE_CREDENTIALS_JSON'),
        pendingFolderId: getRequiredEnv('GDRIVE_PENDING_FOLDER_ID'),
        doneFolderId: getRequiredEnv('GDRIVE_DONE_FOLDER_ID'),
    };
}

/**
 * YouTube設定の読み込み
 */
function loadYouTubeConfig(): YouTubeConfig {
    return {
        clientId: getRequiredEnv('YOUTUBE_CLIENT_ID'),
        clientSecret: getRequiredEnv('YOUTUBE_CLIENT_SECRET'),
        refreshToken: getRequiredEnv('YOUTUBE_REFRESH_TOKEN'),
    };
}

/**
 * TikTok設定の読み込み
 */
function loadTikTokConfig(): TikTokConfig {
    return {
        clientKey: getRequiredEnv('TIKTOK_CLIENT_KEY'),
        clientSecret: getRequiredEnv('TIKTOK_CLIENT_SECRET'),
        refreshToken: getRequiredEnv('TIKTOK_REFRESH_TOKEN'),
    };
}

/**
 * Instagram設定の読み込み
 */
function loadInstagramConfig(): InstagramConfig {
    return {
        accessToken: getRequiredEnv('IG_ACCESS_TOKEN'),
        accountId: getRequiredEnv('IG_ACCOUNT_ID'),
    };
}

/**
 * X (Twitter) 設定の読み込み（任意）
 * すべてのキーが揃っている場合のみ設定を返す。
 */
function loadXConfig(): XConfig | null {
    const apiKey = getOptionalEnv('X_API_KEY');
    const apiSecret = getOptionalEnv('X_API_SECRET');
    const accessToken = getOptionalEnv('X_ACCESS_TOKEN');
    const accessTokenSecret = getOptionalEnv('X_ACCESS_TOKEN_SECRET');

    if (apiKey && apiSecret && accessToken && accessTokenSecret) {
        return { apiKey, apiSecret, accessToken, accessTokenSecret };
    }

    // 一部のみ設定されている場合は警告を出す
    const partialKeys = [apiKey, apiSecret, accessToken, accessTokenSecret].filter(Boolean);
    if (partialKeys.length > 0) {
        logger.warn('X (Twitter) のAPIキーが一部のみ設定されています。すべてのキーが必要です。X投稿はスキップされます。');
    }

    return null;
}

/**
 * メール通知設定の読み込み
 */
function loadMailConfig(): MailConfig {
    return {
        user: getRequiredEnv('MAIL_USER'),
        pass: getRequiredEnv('MAIL_PASS'),
        to: getRequiredEnv('MAIL_TO'),
    };
}

/**
 * アプリケーション全体の設定を読み込む
 */
export function loadConfig(): AppConfig {
    logger.info('環境変数の読み込みを開始します...');

    const drive = loadDriveConfig();
    const youtube = loadYouTubeConfig();
    const tiktok = loadTikTokConfig();
    const instagram = loadInstagramConfig();
    const x = loadXConfig();
    const mail = loadMailConfig();
    const isXEnabled = x !== null;

    if (isXEnabled) {
        logger.info('X (Twitter) のAPIキーが検出されました。X投稿が有効です。');
    } else {
        logger.info('X (Twitter) のAPIキーが未設定です。X投稿はスキップされます。');
    }

    logger.info('環境変数の読み込みが完了しました。');

    return { drive, youtube, tiktok, instagram, x, mail, isXEnabled };
}
