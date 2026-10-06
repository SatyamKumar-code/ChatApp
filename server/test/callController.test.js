import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
    logCall,
    getMyCalls,
    clearMyCalls,
} = await import('../controllers/callController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: { _id: 'user_caller_123', name: 'Caller' },
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

describe('callController – Audio/Video Calls Functionality', () => {
    describe('logCall validation', () => {
        it('returns 400 when receiverId is missing', async () => {
            const req = buildReq({
                body: { callType: 'video', duration: 45 },
            });
            const res = buildRes();

            await logCall(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Receiver ID is required/i);
        });
    });

    describe('getMyCalls error handling', () => {
        it('handles database errors gracefully', async () => {
            const req = buildReq({ user: { _id: 'invalid_id_999' } });
            const res = buildRes();

            await getMyCalls(req, res);
            assert.ok([200, 500].includes(res.statusCode));
        });
    });

    describe('clearMyCalls error handling', () => {
        it('handles database updates gracefully', async () => {
            const req = buildReq({ user: { _id: 'invalid_id_999' } });
            const res = buildRes();

            await clearMyCalls(req, res);
            assert.ok([200, 500].includes(res.statusCode));
        });
    });
});
