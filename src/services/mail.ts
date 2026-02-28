/**
 * SNS自動投稿バッチシステム - メール通知サービス
 *
 * nodemailerを使用してGmail SMTP経由で処理結果の通知メールを送信する。
 * 成功/スキップ/エラーのサマリーをHTML形式で送信する。
 */

import nodemailer from 'nodemailer';
import type { MailConfig, BatchResult, UploadResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * ステータスバッジのHTMLを生成する
 */
function getStatusBadge(result: UploadResult): string {
    if (result.skipped) {
        return '<span style="background-color: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">SKIPPED</span>';
    }
    if (result.success) {
        return '<span style="background-color: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">SUCCESS</span>';
    }
    return '<span style="background-color: #dc3545; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">FAILED</span>';
}

/**
 * プラットフォーム名の表示用変換
 */
function getPlatformDisplayName(platform: string): string {
    const names: Record<string, string> = {
        youtube: 'YouTube',
        tiktok: 'TikTok',
        instagram: 'Instagram',
        x: 'X (Twitter)',
    };
    return names[platform] ?? platform;
}

/**
 * 処理結果のHTMLメール本文を生成する
 */
function buildEmailHtml(batchResult: BatchResult): string {
    const { filePair, results, allSuccess, isXEnabled } = batchResult;
    const overallStatus = allSuccess ? '✅ 全投稿成功' : '⚠️ 一部エラーあり';
    const overallColor = allSuccess ? '#28a745' : '#dc3545';

    const resultRows = results
        .map(
            (r) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${getPlatformDisplayName(r.platform)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${getStatusBadge(r)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #666; font-size: 13px;">${r.error ?? '-'}</td>
        </tr>`
        )
        .join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background-color: ${overallColor}; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">${overallStatus}</h2>
    <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">SNS自動投稿バッチ 処理結果レポート</p>
  </div>

  <div style="background-color: #f8f9fa; padding: 16px 20px; border: 1px solid #e9ecef; border-top: none;">
    <h3 style="margin: 0 0 8px; font-size: 14px; color: #666;">対象ファイル</h3>
    <p style="margin: 0; font-size: 15px;">
      🎬 <strong>${filePair.videoFileName}</strong><br>
      📄 ${filePair.jsonFileName}
    </p>
    <p style="margin: 8px 0 0; font-size: 14px; color: #666;">
      タイトル: <strong>${filePair.metadata.title}</strong>
    </p>
  </div>

  <div style="padding: 16px 20px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
    <h3 style="margin: 0 0 12px; font-size: 14px; color: #666;">投稿結果</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f1f3f5;">
          <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #666;">プラットフォーム</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #666;">ステータス</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 13px; color: #666;">詳細</th>
        </tr>
      </thead>
      <tbody>
        ${resultRows}
      </tbody>
    </table>
    ${!isXEnabled ? '<p style="margin: 12px 0 0; font-size: 12px; color: #999;">※ X (Twitter) はAPIキー未設定のためスキップされました。</p>' : ''}
  </div>

  <p style="margin: 20px 0 0; font-size: 12px; color: #999; text-align: center;">
    このメールはSNS自動投稿バッチシステムにより自動送信されました。
  </p>
</body>
</html>`;
}

/**
 * 処理結果の通知メールを送信する
 */
export async function sendResultEmail(
    config: MailConfig,
    batchResult: BatchResult
): Promise<void> {
    try {
        logger.info('メール通知: 送信準備中...');

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });

        const subject = batchResult.allSuccess
            ? `✅ [SNS投稿完了] ${batchResult.filePair.metadata.title}`
            : `⚠️ [SNS投稿エラー] ${batchResult.filePair.metadata.title}`;

        await transporter.sendMail({
            from: `"SNS Auto Publisher" <${config.user}>`,
            to: config.to,
            subject,
            html: buildEmailHtml(batchResult),
        });

        logger.success(`メール通知: 送信完了 → ${config.to}`);
    } catch (error) {
        logger.error('メール通知: 送信失敗', error);
        // メール送信失敗はバッチ全体を停止させない
    }
}
