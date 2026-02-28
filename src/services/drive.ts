/**
 * SNS自動投稿バッチシステム - Google Drive サービス
 *
 * Google Drive APIを使用して、投稿待ちフォルダから動画とJSONのペアを取得し、
 * 処理完了後にファイルを投稿済みフォルダへ移動する。
 */

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import type { DriveConfig, FilePair, PostMetadata } from '../types/index.js';
import { logger } from '../utils/logger.js';

const TMP_DIR = path.join(process.cwd(), 'tmp');

/**
 * Google Drive APIクライアントを初期化する
 */
function createDriveClient(config: DriveConfig): drive_v3.Drive {
    const credentials = JSON.parse(config.credentialsJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    return google.drive({ version: 'v3', auth });
}

/**
 * 一時ディレクトリを作成する
 */
function ensureTmpDir(): void {
    if (!fs.existsSync(TMP_DIR)) {
        fs.mkdirSync(TMP_DIR, { recursive: true });
    }
}

/**
 * Google Driveからファイルをダウンロードする
 */
async function downloadFile(
    drive: drive_v3.Drive,
    fileId: string,
    destPath: string
): Promise<void> {
    const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(destPath);
        (response.data as NodeJS.ReadableStream)
            .pipe(dest)
            .on('finish', resolve)
            .on('error', reject);
    });
}

/**
 * JSONファイルの内容を取得してパースする
 */
async function fetchJsonContent(
    drive: drive_v3.Drive,
    fileId: string
): Promise<PostMetadata> {
    const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'text' }
    );

    const data = JSON.parse(response.data as string) as PostMetadata;

    // バリデーション
    if (!data.title || typeof data.title !== 'string') {
        throw new Error('JSONフォーマットエラー: "title" が不正です。');
    }
    if (!data.description || typeof data.description !== 'string') {
        throw new Error('JSONフォーマットエラー: "description" が不正です。');
    }
    if (!Array.isArray(data.tags)) {
        throw new Error('JSONフォーマットエラー: "tags" が配列ではありません。');
    }
    if (!data.upload_status || typeof data.upload_status !== 'object') {
        throw new Error('JSONフォーマットエラー: "upload_status" が不正です。');
    }

    return data;
}

/**
 * 投稿待ちフォルダから .mp4 と .json のペアを取得する
 */
export async function fetchFilePairs(config: DriveConfig): Promise<FilePair[]> {
    const drive = createDriveClient(config);
    ensureTmpDir();

    logger.info('投稿待ちフォルダからファイルを検索中...');

    // mp4ファイルを取得
    const mp4Response = await drive.files.list({
        q: `'${config.pendingFolderId}' in parents and mimeType='video/mp4' and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'createdTime asc',
    });

    // jsonファイルを取得
    const jsonResponse = await drive.files.list({
        q: `'${config.pendingFolderId}' in parents and name contains '.json' and trashed=false`,
        fields: 'files(id, name)',
        orderBy: 'createdTime asc',
    });

    const mp4Files = mp4Response.data.files ?? [];
    const jsonFiles = jsonResponse.data.files ?? [];

    logger.info(`検出ファイル: MP4=${mp4Files.length}件, JSON=${jsonFiles.length}件`);

    // ファイル名のベース名でペアを組む
    const filePairs: FilePair[] = [];

    for (const mp4File of mp4Files) {
        const baseName = mp4File.name!.replace(/\.mp4$/i, '');
        const matchingJson = jsonFiles.find(
            (j) => j.name!.replace(/\.json$/i, '') === baseName
        );

        if (matchingJson) {
            logger.info(`ファイルペア発見: ${mp4File.name} ↔ ${matchingJson.name}`);

            // JSONの内容を取得・バリデーション
            const metadata = await fetchJsonContent(drive, matchingJson.id!);

            filePairs.push({
                videoFileId: mp4File.id!,
                jsonFileId: matchingJson.id!,
                videoFileName: mp4File.name!,
                jsonFileName: matchingJson.name!,
                metadata,
            });
        } else {
            logger.warn(`ペアなし（スキップ）: ${mp4File.name} に対応するJSONファイルが見つかりません。`);
        }
    }

    return filePairs;
}

/**
 * 動画ファイルをローカルの一時ディレクトリにダウンロードする
 */
export async function downloadVideo(
    config: DriveConfig,
    filePair: FilePair
): Promise<string> {
    const drive = createDriveClient(config);
    ensureTmpDir();

    const localPath = path.join(TMP_DIR, filePair.videoFileName);
    logger.info(`動画ダウンロード中: ${filePair.videoFileName} → ${localPath}`);
    await downloadFile(drive, filePair.videoFileId, localPath);
    logger.success(`動画ダウンロード完了: ${filePair.videoFileName}`);

    return localPath;
}

/**
 * Google Drive上のJSONファイルのupload_statusを更新する
 */
export async function updateJsonStatus(
    config: DriveConfig,
    filePair: FilePair,
    updatedMetadata: PostMetadata
): Promise<void> {
    const drive = createDriveClient(config);

    const content = JSON.stringify(updatedMetadata, null, 2);
    const media = {
        mimeType: 'application/json',
        body: content,
    };

    // ファイルの内容を直接更新（Streamではなく文字列で）
    await drive.files.update({
        fileId: filePair.jsonFileId,
        media: {
            mimeType: 'application/json',
            body: Buffer.from(content, 'utf-8') as unknown as NodeJS.ReadableStream,
        },
    });

    logger.info(`JSONステータス更新完了: ${filePair.jsonFileName}`);
}

/**
 * ファイルを投稿済みフォルダへ移動する
 */
export async function moveFilesToDone(
    config: DriveConfig,
    filePair: FilePair
): Promise<void> {
    const drive = createDriveClient(config);

    // 動画ファイルの移動
    await drive.files.update({
        fileId: filePair.videoFileId,
        addParents: config.doneFolderId,
        removeParents: config.pendingFolderId,
        fields: 'id, parents',
    });

    // JSONファイルの移動
    await drive.files.update({
        fileId: filePair.jsonFileId,
        addParents: config.doneFolderId,
        removeParents: config.pendingFolderId,
        fields: 'id, parents',
    });

    logger.success(`ファイル移動完了: ${filePair.videoFileName}, ${filePair.jsonFileName} → 投稿済みフォルダ`);
}

/**
 * 一時ファイルを削除する
 */
export function cleanupTmpFiles(): void {
    if (fs.existsSync(TMP_DIR)) {
        fs.rmSync(TMP_DIR, { recursive: true, force: true });
        logger.info('一時ファイルを削除しました。');
    }
}

/**
 * Google Drive上の動画ファイルの共有リンクを取得する（Instagram用）
 */
export async function getVideoShareLink(
    config: DriveConfig,
    fileId: string
): Promise<string> {
    const drive = createDriveClient(config);

    // ファイルを一般公開設定にする
    await drive.permissions.create({
        fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    // 直接ダウンロードリンクを生成
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
