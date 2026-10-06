import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
    sendMessage,
    enrichMessagesWithFiles,
    getMessages,
    reactToMessage,
    deleteMessage,
    toggleStarMessage,
    forwardMessage,
    clearConversationMessages,
} = await import('../controllers/messageController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: { _id: 'user_sender_123', name: 'Alice' },
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

describe('messageController – Messages Functionality', () => {
    describe('sendMessage validation', () => {
        it('returns 400 when conversationId is missing', async () => {
            const req = buildReq({
                body: { text: 'Hello' },
            });
            const res = buildRes();

            await sendMessage(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Conversation ID is required/i);
        });

        it('returns 400 when text is empty and no fileUrl provided', async () => {
            const req = buildReq({
                body: { conversationId: 'conv_123', text: '   ' },
            });
            const res = buildRes();

            await sendMessage(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Message cannot be empty/i);
        });
    });

    describe('enrichMessagesWithFiles helper', () => {
        it('returns empty array when messages input is null or empty', async () => {
            const resEmpty = await enrichMessagesWithFiles([]);
            const resNull = await enrichMessagesWithFiles(null);

            assert.deepEqual(resEmpty, []);
            assert.deepEqual(resNull, []);
        });
    });

    describe('clearConversationMessages validation', () => {
        it('returns 404 or handles missing conversation gracefully', async () => {
            const req = buildReq({
                params: { conversationId: 'invalid_id_999' },
            });
            const res = buildRes();

            await clearConversationMessages(req, res);
            // Since MongoDB mock/db returns not found or cast error
            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });
    });

    describe('forwardMessage validation', () => {
        it('returns 400 when messageId or targetConversationIds missing', async () => {
            const req1 = buildReq({ body: { targetConversationIds: ['c1'] } });
            const res1 = buildRes();
            await forwardMessage(req1, res1);
            assert.equal(res1.statusCode, 400);

            const req2 = buildReq({ body: { messageId: 'm1', targetConversationIds: [] } });
            const res2 = buildRes();
            await forwardMessage(req2, res2);
            assert.equal(res2.statusCode, 400);
        });
    });

    describe('toggleStarMessage validation', () => {
        it('handles non-existent message gracefully', async () => {
            const req = buildReq({ params: { messageId: 'm_missing' } });
            const res = buildRes();

            await toggleStarMessage(req, res);
            assert.ok([404, 500].includes(res.statusCode));
            assert.equal(res.body.success, false);
        });
    });
});
