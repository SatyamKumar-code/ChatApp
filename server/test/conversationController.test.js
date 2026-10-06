import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
    getOrCreateConversation,
    createGroupConversation,
    togglePinConversation,
    deleteConversation,
} = await import('../controllers/conversationController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: { _id: 'user_current_123', name: 'Tester' },
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

describe('conversationController – Conversations Functionality', () => {
    describe('getOrCreateConversation validation', () => {
        it('returns 400 when userId is missing', async () => {
            const req = buildReq({ body: {} });
            const res = buildRes();

            await getOrCreateConversation(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /User ID is required/i);
        });

        it('returns 400 when trying to create conversation with oneself', async () => {
            const req = buildReq({
                body: { userId: 'user_current_123' },
                user: { _id: 'user_current_123' },
            });
            const res = buildRes();

            await getOrCreateConversation(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /cannot chat with yourself/i);
        });
    });

    describe('createGroupConversation validation', () => {
        it('returns 400 when groupName is missing or whitespace', async () => {
            const req = buildReq({
                body: { groupName: '   ', participants: ['user_other_1'] },
            });
            const res = buildRes();

            await createGroupConversation(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Group name is required/i);
        });

        it('returns 400 when group has fewer than 2 total members', async () => {
            const req = buildReq({
                body: { groupName: 'Solo Club', participants: [] },
                user: { _id: 'user_current_123' },
            });
            const res = buildRes();

            await createGroupConversation(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /at least 2 members/i);
        });
    });

    describe('togglePinConversation & deleteConversation graceful error handling', () => {
        it('handles non-existent conversation in togglePinConversation', async () => {
            const req = buildReq({ params: { conversationId: 'c_none' } });
            const res = buildRes();

            await togglePinConversation(req, res);
            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });

        it('handles non-existent conversation in deleteConversation', async () => {
            const req = buildReq({ params: { id: 'c_none' } });
            const res = buildRes();

            await deleteConversation(req, res);
            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });
    });
});
