/**
 * SNS自動投稿バッチシステム - メイン処理
 *
 * 全体のフロー制御を行うエントリーポイント。
 * Google Driveからファイルを取得し、各SNSへ直列でアップロードを実行する。
 */

import { loadConfig } from './config/env.js';
import { logger } from './utils/logger.js';
import {
    fetchFilePairs,
    downloadVideo,
    updateJsonStatus,
    moveFilesToDone,
    cleanupTmpFiles,
    getVideoShareLink,
} from './services/drive.js';
import { uploadToYouTube } from './services/youtube.js';
import { uploadToTikTok } from './services/tiktok.js';
import { uploadToInstagram } from './services/instagram.js';
import { uploadToX } from './services/x.js';
import { sendResultEmail } from './services/mail.js';
import type { PostMetadata, UploadResult, BatchResult, Platform } from './types/index.js';

/**
 * 全体の成功判定を行う
 *
 * - Xが無効な場合: YouTube, TikTok, Instagramがすべて成功なら全体成功
 * - Xが有効な場合: 上記に加え、Xも成功なら全体成功
 * - スキップ（既にアップロード済み・X無効）は失敗に含めない
 */
function isAllSuccess(results: UploadResult[], isXEnabled: boolean): boolean {
    for (const result of results) {
        // スキップされた結果は無視
        if (result.skipped) continue;

        // X無効時はXの結果を無視
        if (result.platform === 'x' && !isXEnabled) continue;

        // 失敗があれば全体失敗
        if (!result.success) return false;
    }
    return true;
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
    logger.info('========================================');
    logger.info('SNS自動投稿バッチシステム 開始');
    logger.info('========================================');

    try {
        // -----------------------------------------------
        // Phase 1: 初期化・認証
        // -----------------------------------------------
        logger.info('--- Phase 1: 初期化・認証 ---');
        const config = loadConfig();

        // -----------------------------------------------
        // Phase 2: ファイル取得・バリデーション
        // -----------------------------------------------
        logger.info('--- Phase 2: ファイル取得・バリデーション ---');
        const filePairs = await fetchFilePairs(config.drive);

        if (filePairs.length === 0) {
            logger.info('投稿待ちのファイルペアがありません。処理を終了します。');
            return;
        }

        logger.info(`投稿対象: ${filePairs.length}件のファイルペアを検出`);

        // 各ファイルペアに対して処理を実行
        for (const filePair of filePairs) {
            logger.info('========================================');
            logger.info(`処理開始: ${filePair.videoFileName}`);
            logger.info(`タイトル: ${filePair.metadata.title}`);
            logger.info('========================================');

            let videoPath: string | null = null;

            try {
                // 動画ファイルをダウンロード
                videoPath = await downloadVideo(config.drive, filePair);

                // 現在のメタデータ（upload_statusを逐次更新するため）
                const currentMetadata: PostMetadata = { ...filePair.metadata };
                const results: UploadResult[] = [];

                // -----------------------------------------------
                // Phase 3: アップロード（直列実行）
                // -----------------------------------------------
                logger.info('--- Phase 3: アップロード（直列実行） ---');

                // 3-1: YouTube
                const ytResult = await uploadToYouTube(config.youtube, videoPath, currentMetadata);
                results.push(ytResult);
                if (ytResult.success && !ytResult.skipped) {
                    currentMetadata.upload_status.youtube = true;
                    await updateJsonStatus(config.drive, filePair, currentMetadata);
                }

                // 3-2: TikTok
                const ttResult = await uploadToTikTok(config.tiktok, videoPath, currentMetadata);
                results.push(ttResult);
                if (ttResult.success && !ttResult.skipped) {
                    currentMetadata.upload_status.tiktok = true;
                    await updateJsonStatus(config.drive, filePair, currentMetadata);
                }

                // 3-3: Instagram（動画URLが必要なのでGoogle Driveの共有リンクを使用）
                const videoUrl = await getVideoShareLink(config.drive, filePair.videoFileId);
                const igResult = await uploadToInstagram(config.instagram, videoUrl, currentMetadata);
                results.push(igResult);
                if (igResult.success && !igResult.skipped) {
                    currentMetadata.upload_status.instagram = true;
                    await updateJsonStatus(config.drive, filePair, currentMetadata);
                }

                // 3-4: X (条件付き実行)
                const xResult = await uploadToX(config.x, config.isXEnabled, videoPath, currentMetadata);
                results.push(xResult);
                if (xResult.success && !xResult.skipped) {
                    currentMetadata.upload_status.x = true;
                    await updateJsonStatus(config.drive, filePair, currentMetadata);
                }

                // -----------------------------------------------
                // Phase 4: 後処理・通知
                // -----------------------------------------------
                logger.info('--- Phase 4: 後処理・通知 ---');

                const allSuccess = isAllSuccess(results, config.isXEnabled);
                const batchResult: BatchResult = {
                    filePair: { ...filePair, metadata: currentMetadata },
                    results,
                    allSuccess,
                    isXEnabled: config.isXEnabled,
                };

                // 成功判定に基づくファイル移動
                if (allSuccess) {
                    logger.success('全プラットフォームへの投稿が成功しました。ファイルを投稿済みフォルダへ移動します。');
                    await moveFilesToDone(config.drive, filePair);
                } else {
                    logger.warn('一部プラットフォームでエラーが発生しました。ファイルは元の位置に保持します。');
                }

                // 結果ログの出力
                logger.info('--- 処理結果サマリー ---');
                for (const r of results) {
                    const status = r.skipped ? 'SKIPPED' : r.success ? 'SUCCESS' : 'FAILED';
                    const detail = r.error ? ` (${r.error})` : '';
                    logger.info(`  ${r.platform}: ${status}${detail}`);
                }

                // メール通知
                await sendResultEmail(config.mail, batchResult);

            } catch (error) {
                logger.error(`ファイルペアの処理中にエラーが発生しました: ${filePair.videoFileName}`, error);
            }
        }

        logger.info('========================================');
        logger.info('SNS自動投稿バッチシステム 完了');
        logger.info('========================================');

    } catch (error) {
        logger.error('致命的エラーが発生しました。バッチを停止します。', error);
        process.exit(1);
    } finally {
        // 一時ファイルの削除
        cleanupTmpFiles();
    }
}

// エントリーポイント
main();
