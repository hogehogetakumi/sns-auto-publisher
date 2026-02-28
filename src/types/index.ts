/**
 * SNS自動投稿バッチシステム - 型定義
 */

/**
 * 各SNSプラットフォームのアップロードステータス
 */
export interface UploadStatus {
    youtube: boolean;
    tiktok: boolean;
    instagram: boolean;
    x: boolean;
}

/**
 * Google Drive上のJSONメタデータの型定義
 */
export interface PostMetadata {
    title: string;
    description: string;
    tags: string[];
    upload_status: UploadStatus;
}

/**
 * SNSプラットフォーム識別子
 */
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'x';

/**
 * 個別プラットフォームのアップロード結果
 */
export interface UploadResult {
    platform: Platform;
    success: boolean;
    skipped: boolean;
    error?: string;
}

/**
 * Google Driveから取得したファイルペア
 */
export interface FilePair {
    videoFileId: string;
    jsonFileId: string;
    videoFileName: string;
    jsonFileName: string;
    metadata: PostMetadata;
}

/**
 * バッチ全体の処理結果サマリー
 */
export interface BatchResult {
    filePair: FilePair;
    results: UploadResult[];
    allSuccess: boolean;
    isXEnabled: boolean;
}

/**
 * 環境変数の設定値（Google Drive）
 */
export interface DriveConfig {
    credentialsJson: string;
    pendingFolderId: string;
    doneFolderId: string;
}

/**
 * 環境変数の設定値（YouTube）
 */
export interface YouTubeConfig {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}

/**
 * 環境変数の設定値（TikTok）
 */
export interface TikTokConfig {
    clientKey: string;
    clientSecret: string;
    refreshToken: string;
}

/**
 * 環境変数の設定値（Instagram）
 */
export interface InstagramConfig {
    accessToken: string;
    accountId: string;
}

/**
 * 環境変数の設定値（X / Twitter）
 */
export interface XConfig {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
}

/**
 * 環境変数の設定値（メール通知）
 */
export interface MailConfig {
    user: string;
    pass: string;
    to: string;
}

/**
 * アプリケーション全体の設定
 */
export interface AppConfig {
    drive: DriveConfig;
    youtube: YouTubeConfig;
    tiktok: TikTokConfig;
    instagram: InstagramConfig;
    x: XConfig | null;
    mail: MailConfig;
    isXEnabled: boolean;
}
