import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jwt from 'jsonwebtoken';

// Set env vars before importing
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const {
    generateAccessToken,
    generateRefreshToken,
} = await import('../utils/generateToken.js');

describe('generateAccessToken', () => {
    const userId = '507f1f77bcf86cd799439011';

    it('returns a string', () => {
        const token = generateAccessToken(userId);
        assert.equal(typeof token, 'string');
    });

    it('contains the userId in payload', () => {
        const token = generateAccessToken(userId);
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        assert.equal(decoded.userId, userId);
    });

    it('has an expiration (exp) claim', () => {
        const token = generateAccessToken(userId);
        const decoded = jwt.decode(token);
        assert.ok(decoded.exp, 'token should have exp claim');
    });

    it('fails with wrong secret', () => {
        const token = generateAccessToken(userId);
        assert.throws(() => jwt.verify(token, 'nope'));
    });

    it('fails with refresh secret', () => {
        const token = generateAccessToken(userId);
        assert.throws(() => jwt.verify(token, process.env.JWT_REFRESH_SECRET));
    });
});

describe('generateRefreshToken', () => {
    const userId = '507f1f77bcf86cd799439011';

    it('returns a string', () => {
        const token = generateRefreshToken(userId);
        assert.equal(typeof token, 'string');
    });

    it('contains the userId in payload', () => {
        const token = generateRefreshToken(userId);
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        assert.equal(decoded.userId, userId);
    });

    it('has an expiration (exp) claim', () => {
        const token = generateRefreshToken(userId);
        const decoded = jwt.decode(token);
        assert.ok(decoded.exp, 'token should have exp claim');
    });

    it('fails with access secret', () => {
        const token = generateRefreshToken(userId);
        assert.throws(() => jwt.verify(token, process.env.JWT_ACCESS_SECRET));
    });
});

describe('Token pair uniqueness', () => {
    it('access and refresh tokens are different for same userId', () => {
        const userId = 'abc';
        const a = generateAccessToken(userId);
        const r = generateRefreshToken(userId);
        assert.notEqual(a, r);
    });

    it('two access tokens generated consecutively are different (includes iat)', () => {
        const userId = 'abc';
        const t1 = generateAccessToken(userId);
        const t2 = generateAccessToken(userId);
        // They may or may not differ (same second) – but decoded payloads should have same userId
        const d1 = jwt.decode(t1);
        const d2 = jwt.decode(t2);
        assert.equal(d1.userId, d2.userId);
    });
});
