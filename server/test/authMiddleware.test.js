import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

// Set env vars before importing
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'development';

const { default: protect } = await import('../middleware/authMiddleware.js');

function buildReq(overrides = {}) {
    return { body: {}, cookies: {}, ...overrides };
}

function buildRes() {
    return {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
    };
}

describe('authMiddleware – protect', () => {
    it('401 – no accessToken cookie', async () => {
        const req = buildReq();
        const res = buildRes();
        let called = false;
        await protect(req, res, () => { called = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Access token not found/i);
        assert.equal(called, false);
    });

    it('401 – garbage token', async () => {
        const req = buildReq({ cookies: { accessToken: 'xyz' } });
        const res = buildRes();
        let called = false;
        await protect(req, res, () => { called = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Invalid access token/i);
        assert.equal(called, false);
    });

    it('401 – expired token', async () => {
        const token = jwt.sign(
            { userId: 'abc123' },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '-1h' }
        );
        const req = buildReq({ cookies: { accessToken: token } });
        const res = buildRes();
        let called = false;
        await protect(req, res, () => { called = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /expired/i);
        assert.equal(called, false);
    });

    it('401 – token signed with wrong secret', async () => {
        const token = jwt.sign({ userId: 'abc123' }, 'wrong', { expiresIn: '1h' });
        const req = buildReq({ cookies: { accessToken: token } });
        const res = buildRes();
        let called = false;
        await protect(req, res, () => { called = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Invalid access token/i);
        assert.equal(called, false);
    });

    it('all error responses have { message, success, error } shape', async () => {
        const req = buildReq();
        const res = buildRes();
        await protect(req, res, () => {});

        assert.ok('message' in res.body);
        assert.ok('success' in res.body);
        assert.ok('error' in res.body);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error, true);
    });
});
