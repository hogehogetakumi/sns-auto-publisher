/**
 * テスト: 環境変数管理 (env.ts)
 *
 * 必須環境変数の存在チェックとXフラグの判定をテストする。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// テスト用に環境変数を保存・復元するヘルパー
const ENV_KEYS = [
    'GDRIVE_CREDENTIALS_JSON', 'GDRIVE_PENDING_FOLDER_ID', 'GDRIVE_DONE_FOLDER_ID',
    'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
    'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REFRESH_TOKEN',
    'IG_ACCESS_TOKEN', 'IG_ACCOUNT_ID',
    'MAIL_USER', 'MAIL_PASS', 'MAIL_TO',
    'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET',
];

// loadConfig を動的にインポートするためのヘルパー
async function importLoadConfig() {
    vi.resetModules();
    const mod = await import('../config/env.js');
    return mod.loadConfig;
}

describe('env.ts - 環境変数管理', () => {
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        // 現在の環境変数を保存してクリア
        for (const key of ENV_KEYS) {
            originalEnv[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        // 環境変数を復元
        for (const key of ENV_KEYS) {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            } else {
                delete process.env[key];
            }
        }
    });

    /**
     * 全必須環境変数をセットするヘルパー
     */
    function setAllRequiredEnvs() {
        process.env.GDRIVE_CREDENTIALS_JSON = '{"type":"service_account"}';
        process.env.GDRIVE_PENDING_FOLDER_ID = 'pending_folder_123';
        process.env.GDRIVE_DONE_FOLDER_ID = 'done_folder_456';
        process.env.YOUTUBE_CLIENT_ID = 'yt_client_id';
        process.env.YOUTUBE_CLIENT_SECRET = 'yt_client_secret';
        process.env.YOUTUBE_REFRESH_TOKEN = 'yt_refresh_token';
        process.env.TIKTOK_CLIENT_KEY = 'tt_client_key';
        process.env.TIKTOK_CLIENT_SECRET = 'tt_client_secret';
        process.env.TIKTOK_REFRESH_TOKEN = 'tt_refresh_token';
        process.env.IG_ACCESS_TOKEN = 'ig_access_token';
        process.env.IG_ACCOUNT_ID = 'ig_account_id';
        process.env.MAIL_USER = 'test@gmail.com';
        process.env.MAIL_PASS = 'mail_pass';
        process.env.MAIL_TO = 'recipient@gmail.com';
    }

    it('全必須環境変数が設定されている場合、正常にconfigを返す', async () => {
        setAllRequiredEnvs();
        const loadConfig = await importLoadConfig();
        const config = loadConfig();

        expect(config.drive.pendingFolderId).toBe('pending_folder_123');
        expect(config.youtube.clientId).toBe('yt_client_id');
        expect(config.tiktok.clientKey).toBe('tt_client_key');
        expect(config.instagram.accessToken).toBe('ig_access_token');
        expect(config.mail.user).toBe('test@gmail.com');
    });

    it('必須環境変数が不足している場合、エラーをスローする', async () => {
        // 全環境変数がクリアされた状態でloadConfig
        const loadConfig = await importLoadConfig();
        expect(() => loadConfig()).toThrow('必須環境変数');
    });

    it('X関連の環境変数が全てある場合、isXEnabled=true になる', async () => {
        setAllRequiredEnvs();
        process.env.X_API_KEY = 'x_api_key';
        process.env.X_API_SECRET = 'x_api_secret';
        process.env.X_ACCESS_TOKEN = 'x_access_token';
        process.env.X_ACCESS_TOKEN_SECRET = 'x_access_token_secret';

        const loadConfig = await importLoadConfig();
        const config = loadConfig();

        expect(config.isXEnabled).toBe(true);
        expect(config.x).not.toBeNull();
        expect(config.x?.apiKey).toBe('x_api_key');
    });

    it('X関連の環境変数が未設定の場合、isXEnabled=false になる', async () => {
        setAllRequiredEnvs();

        const loadConfig = await importLoadConfig();
        const config = loadConfig();

        expect(config.isXEnabled).toBe(false);
        expect(config.x).toBeNull();
    });

    it('X関連の環境変数が一部のみ設定されている場合、isXEnabled=false になる', async () => {
        setAllRequiredEnvs();
        process.env.X_API_KEY = 'x_api_key';
        // X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET は未設定

        const loadConfig = await importLoadConfig();
        const config = loadConfig();

        expect(config.isXEnabled).toBe(false);
        expect(config.x).toBeNull();
    });
});
