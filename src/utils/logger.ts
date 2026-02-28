/**
 * SNS自動投稿バッチシステム - ログユーティリティ
 *
 * タイムスタンプ付きの統一ログ出力を提供する。
 */

/**
 * JSTタイムスタンプ文字列を生成する
 */
function getTimestamp(): string {
    return new Date().toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

/**
 * フォーマット済みのログメッセージを生成する
 */
function formatMessage(level: string, message: string): string {
    return `[${getTimestamp()}] [${level}] ${message}`;
}

export const logger = {
    /**
     * 情報レベルのログ出力
     */
    info(message: string): void {
        console.log(formatMessage('INFO', message));
    },

    /**
     * 警告レベルのログ出力
     */
    warn(message: string): void {
        console.warn(formatMessage('WARN', message));
    },

    /**
     * エラーレベルのログ出力
     */
    error(message: string, error?: unknown): void {
        console.error(formatMessage('ERROR', message));
        if (error instanceof Error) {
            console.error(`  → 詳細: ${error.message}`);
            if (error.stack) {
                console.error(`  → スタック: ${error.stack}`);
            }
        } else if (error !== undefined) {
            console.error(`  → 詳細: ${String(error)}`);
        }
    },

    /**
     * 成功レベルのログ出力
     */
    success(message: string): void {
        console.log(formatMessage('SUCCESS', message));
    },
};
