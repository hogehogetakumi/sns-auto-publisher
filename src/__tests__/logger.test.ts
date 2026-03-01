/**
 * テスト: ログユーティリティ (logger.ts)
 */

import { describe, it, expect, vi } from 'vitest';
import { logger } from '../utils/logger.js';

describe('logger.ts - ログユーティリティ', () => {
    it('info: コンソールにINFOラベル付きでログ出力される', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        logger.info('テストメッセージ');

        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0]).toContain('[INFO]');
        expect(spy.mock.calls[0][0]).toContain('テストメッセージ');
        spy.mockRestore();
    });

    it('warn: コンソールにWARNラベル付きで警告出力される', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        logger.warn('警告メッセージ');

        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0]).toContain('[WARN]');
        expect(spy.mock.calls[0][0]).toContain('警告メッセージ');
        spy.mockRestore();
    });

    it('error: コンソールにERRORラベル付きでエラー出力される', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        logger.error('エラーメッセージ');

        expect(spy).toHaveBeenCalled();
        expect(spy.mock.calls[0][0]).toContain('[ERROR]');
        expect(spy.mock.calls[0][0]).toContain('エラーメッセージ');
        spy.mockRestore();
    });

    it('error: Errorオブジェクトを渡した場合、詳細が出力される', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        logger.error('エラー発生', new Error('詳細エラー'));

        expect(spy).toHaveBeenCalledTimes(3); // メッセージ + 詳細 + スタック
        expect(spy.mock.calls[1][0]).toContain('詳細エラー');
        spy.mockRestore();
    });

    it('success: コンソールにSUCCESSラベル付きでログ出力される', () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => { });
        logger.success('成功メッセージ');

        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0]).toContain('[SUCCESS]');
        expect(spy.mock.calls[0][0]).toContain('成功メッセージ');
        spy.mockRestore();
    });
});
