import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Readable } from 'node:stream';
import fs from 'node:fs';

const {
    getRetentionHours,
    calculateExpiresAt,
    saveEncryptedFileStream,
    temporaryFileExists,
    deleteTemporaryFile,
} = await import('../services/fileStorageService.js');

const {
    uploadFile,
    reportReuploadFailed,
    sanitizeFileName,
    detectCanonicalFileType,
} = await import('../controllers/fileController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: { _id: 'user_sender_123' },
        app: { get: () => null },
        ...overrides,
    };
}

function buildRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
    };
}

describe('fileStorageService & fileController – File Storage & Offline Transfers', () => {
    describe('Filename Sanitization & Security', () => {
        it('strips directory traversal ../ and ..\\ patterns', () => {
            const result = sanitizeFileName('../../etc/passwd.jpg');
            assert.ok(!result.includes('..'));
            assert.ok(!result.includes('/'));
            assert.equal(result, 'etc_passwd.jpg');
        });

        it('replaces illegal characters (< > : " / \\ | ? *) with underscore', () => {
            const result = sanitizeFileName('invoice:2026*final?.pdf');
            assert.equal(result, 'invoice_2026_final_.pdf');
        });

        it('strips null bytes and control characters', () => {
            const result = sanitizeFileName('safe\x00file\x1f.png');
            assert.equal(result, 'safefile.png');
        });

        it('defaults to attachment when given empty or null string', () => {
            assert.equal(sanitizeFileName(''), 'attachment');
            assert.equal(sanitizeFileName(null), 'attachment');
            assert.equal(sanitizeFileName(undefined), 'attachment');
        });
    });

    describe('Canonical File Category Detection', () => {
        it('identifies image MIME types and extensions', () => {
            assert.equal(detectCanonicalFileType('image/jpeg', 'photo.jpg'), 'image');
            assert.equal(detectCanonicalFileType('', 'picture.png'), 'image');
            assert.equal(detectCanonicalFileType('image/webp', 'graphic.bin'), 'image');
        });

        it('identifies video MIME types and extensions', () => {
            assert.equal(detectCanonicalFileType('video/mp4', 'clip.mp4'), 'video');
            assert.equal(detectCanonicalFileType('', 'recording.webm'), 'video');
            assert.equal(detectCanonicalFileType('video/quicktime', 'vid.mov'), 'video');
        });

        it('identifies document MIME types and extensions', () => {
            assert.equal(detectCanonicalFileType('application/pdf', 'doc.pdf'), 'document');
            assert.equal(detectCanonicalFileType('text/plain', 'notes.txt'), 'document');
            assert.equal(detectCanonicalFileType('application/zip', 'archive.zip'), 'document');
        });
    });

    describe('Retention period calculation', () => {
        it('returns default 240 hours when FILE_RETENTION_HOURS is unset', () => {
            const original = process.env.FILE_RETENTION_HOURS;
            delete process.env.FILE_RETENTION_HOURS;
            const hours = getRetentionHours();
            assert.equal(hours, 240);
            process.env.FILE_RETENTION_HOURS = original;
        });

        it('calculates expiresAt timestamp in future based on retention', () => {
            const now = new Date();
            const expires = calculateExpiresAt(now);
            assert.ok(expires instanceof Date);
            assert.ok(expires.getTime() > now.getTime());
        });
    });

    describe('Encrypted file streaming to disk (AES-256-GCM)', () => {
        const testFileId = `test_file_${Date.now()}`;

        it('encrypts stream, saves to temp disk, and verifies existence', async () => {
            const plainText = 'Hello secret document payload!';
            const readable = Readable.from(Buffer.from(plainText));

            const result = await saveEncryptedFileStream(testFileId, readable);
            assert.ok(result.filePath);
            assert.ok(result.iv);
            assert.ok(result.authTag);
            assert.equal(temporaryFileExists(testFileId), true);

            // Clean up temporary file
            const deleted = await deleteTemporaryFile(testFileId);
            assert.equal(deleted, true);
            assert.equal(temporaryFileExists(testFileId), false);
        });

        it('returns false when deleting a non-existent file', async () => {
            const deleted = await deleteTemporaryFile('non_existent_file_id_xyz');
            assert.equal(deleted, false);
        });
    });

    describe('uploadFile controller validation', () => {
        it('returns 400 when req.file is missing', async () => {
            const req = buildReq({ body: { conversationId: 'c1' } });
            const res = buildRes();

            await uploadFile(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /No file uploaded/i);
        });

        it('returns 400 when conversationId is missing in body', async () => {
            const req = buildReq({
                file: { path: 'dummy/path', originalname: 'doc.pdf' },
                body: {},
            });
            const res = buildRes();

            await uploadFile(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Conversation ID is required/i);
        });
    });

    describe('reportReuploadFailed error handling', () => {
        it('returns 404 or handles non-existent file delivery record', async () => {
            const req = buildReq({ body: { fileId: 'missing_file_id' } });
            const res = buildRes();

            await reportReuploadFailed(req, res);

            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });
    });
});
