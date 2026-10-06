import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
    createStatus,
    viewStatus,
    deleteStatus,
} = await import('../controllers/statusController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: { _id: 'user_tester_123', name: 'Tester', blockedUsers: [] },
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

describe('statusController – Stories/Status Functionality', () => {
    describe('createStatus validation', () => {
        it('returns 400 when text status has empty or whitespace text', async () => {
            const req = buildReq({ body: { type: 'text', text: '   ' } });
            const res = buildRes();

            await createStatus(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Status text cannot be empty/i);
        });

        it('returns 400 when photo status lacks photoUrl', async () => {
            const req = buildReq({ body: { type: 'photo', photoUrl: '' } });
            const res = buildRes();

            await createStatus(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Photo is required/i);
        });
    });

    describe('viewStatus and deleteStatus error handling', () => {
        it('handles non-existent status in viewStatus gracefully', async () => {
            const req = buildReq({ params: { id: 'status_missing' } });
            const res = buildRes();

            await viewStatus(req, res);
            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });

        it('handles non-existent status in deleteStatus gracefully', async () => {
            const req = buildReq({ params: { id: 'status_missing' } });
            const res = buildRes();

            await deleteStatus(req, res);
            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });
    });
});
