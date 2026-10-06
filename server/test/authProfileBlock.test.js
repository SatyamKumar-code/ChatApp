import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Set environment variables before module evaluation
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'development';

const {
    updateProfile,
    searchUsers,
    toggleBlockUser,
    getBlockedUsers,
    setOffline,
} = await import('../controllers/authController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        cookies: {},
        params: {},
        query: {},
        user: { _id: 'user_current_123', blockedUsers: [] },
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

describe('authController – Profile, Search & Block Functionality', () => {
    describe('updateProfile validation', () => {
        it('returns 400 when name is provided but empty string', async () => {
            const req = buildReq({ body: { name: '   ' } });
            const res = buildRes();

            await updateProfile(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Name cannot be empty/i);
        });

        it('returns 400 when name is missing or empty in updateProfile', async () => {
            const req = buildReq({ body: { name: '' } });
            const res = buildRes();

            await updateProfile(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Name cannot be empty/i);
        });
    });

    describe('searchUsers validation', () => {
        it('returns empty array when search query is missing or whitespace', async () => {
            const req = buildReq({ query: { search: '   ' } });
            const res = buildRes();

            await searchUsers(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.deepEqual(res.body.users, []);
        });

        it('returns empty array when search query parameter is undefined', async () => {
            const req = buildReq({ query: {} });
            const res = buildRes();

            await searchUsers(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.deepEqual(res.body.users, []);
        });
    });

    describe('toggleBlockUser validation', () => {
        it('returns 400 when trying to block oneself', async () => {
            const req = buildReq({
                params: { userId: 'user_current_123' },
                user: { _id: 'user_current_123' },
            });
            const res = buildRes();

            await toggleBlockUser(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /cannot block yourself/i);
        });
    });

    describe('setOffline handler', () => {
        it('returns 200 with boolean success status', async () => {
            const req = buildReq({ user: null, body: {}, app: { get: () => null } });
            const res = buildRes();

            await setOffline(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
        });
    });
});
