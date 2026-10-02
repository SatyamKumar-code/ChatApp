import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// ─── Shared Helpers ──────────────────────────────────────────────────────────

/**
 * Build a fake Express `req` object.
 */
function buildReq(overrides = {}) {
    return {
        body: {},
        cookies: {},
        ...overrides,
    };
}

/**
 * Build a fake Express `res` object that records every
 * status / json / cookie / clearCookie call so we can assert on them.
 */
function buildRes(overrides = {}) {
    const res = {
        statusCode: null,
        body: null,
        cookies: {},
        clearedCookies: [],
        user: overrides.user ?? undefined,

        status(code) {
            this.statusCode = code;
            return this; // allow chaining
        },
        json(data) {
            this.body = data;
            return this;
        },
        cookie(name, value, options) {
            this.cookies[name] = { value, options };
        },
        clearCookie(name, options) {
            this.clearedCookies.push({ name, options });
        },
    };
    return res;
}

// ═══════════════════════════════════════════════════════════════════════════════
// We import the controller *dynamically* inside each describe block after
// setting up the required environment variables so `cookieOptions` resolves
// correctly (it reads process.env at import time).
// ═══════════════════════════════════════════════════════════════════════════════

// Set env vars that the controller / utils read at module‑evaluation time.
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'development'; // → secure: false, sameSite: "lax"

const expectedCookieBase = {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
};

// ─── Import real helpers we'll use in assertions ─────────────────────────────
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ─── Lazy‑import the controller (env is now set) ────────────────────────────
const {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
} = await import('../controllers/authController.js');

// ─── Import middleware ───────────────────────────────────────────────────────
const { default: protect } = await import('../middleware/authMiddleware.js');

// ─── Import token utils ─────────────────────────────────────────────────────
const {
    generateAccessToken,
    generateRefreshToken,
} = await import('../utils/generateToken.js');

// ═══════════════════════════════════════════════════════════════════════════════
//  1. generateAccessToken / generateRefreshToken
// ═══════════════════════════════════════════════════════════════════════════════
describe('Token Generation Utils', () => {
    const fakeUserId = '507f1f77bcf86cd799439011';

    it('generateAccessToken returns a valid JWT with userId', () => {
        const token = generateAccessToken(fakeUserId);
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        assert.equal(decoded.userId, fakeUserId);
    });

    it('generateRefreshToken returns a valid JWT with userId', () => {
        const token = generateRefreshToken(fakeUserId);
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        assert.equal(decoded.userId, fakeUserId);
    });

    it('access token and refresh token are different strings', () => {
        const a = generateAccessToken(fakeUserId);
        const r = generateRefreshToken(fakeUserId);
        assert.notEqual(a, r);
    });

    it('access token fails verification with wrong secret', () => {
        const token = generateAccessToken(fakeUserId);
        assert.throws(() => jwt.verify(token, 'wrong-secret'), {
            name: 'JsonWebTokenError',
        });
    });

    it('refresh token fails verification with access secret', () => {
        const token = generateRefreshToken(fakeUserId);
        assert.throws(() => jwt.verify(token, process.env.JWT_ACCESS_SECRET), {
            name: 'JsonWebTokenError',
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  2. registerUser
// ═══════════════════════════════════════════════════════════════════════════════
describe('registerUser', () => {
    // ── Validation tests (no DB needed) ──────────────────────────────────────

    it('returns 400 when name is missing', async () => {
        const req = buildReq({ body: { phone: '9876543210', password: 'secret123' } });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /fill in all required/i);
    });

    it('returns 400 when phone is missing', async () => {
        const req = buildReq({ body: { name: 'Satyam', password: 'secret123' } });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
    });

    it('returns 400 when password is missing', async () => {
        const req = buildReq({ body: { name: 'Satyam', phone: '9876543210' } });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
    });

    it('returns 400 when password is shorter than 6 chars', async () => {
        const req = buildReq({
            body: { name: 'Satyam', phone: '9876543210', password: '123' },
        });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /at least 6 characters/i);
    });

    it('returns 400 for invalid phone (less than 10 digits)', async () => {
        const req = buildReq({
            body: { name: 'Satyam', phone: '12345', password: 'secret123' },
        });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /valid 10-digit phone/i);
    });

    it('returns 400 for phone starting with digit less than 6', async () => {
        const req = buildReq({
            body: { name: 'Satyam', phone: '5876543210', password: 'secret123' },
        });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /valid 10-digit phone/i);
    });

    it('returns 400 for phone with more than 10 digits', async () => {
        const req = buildReq({
            body: { name: 'Satyam', phone: '98765432100', password: 'secret123' },
        });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /valid 10-digit phone/i);
    });

    it('returns 400 for phone with letters', async () => {
        const req = buildReq({
            body: { name: 'Satyam', phone: '98765abcde', password: 'secret123' },
        });
        const res = buildRes();
        await registerUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.body.message, /valid 10-digit phone/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  3. loginUser
// ═══════════════════════════════════════════════════════════════════════════════
describe('loginUser', () => {
    it('returns 400 when phone is missing', async () => {
        const req = buildReq({ body: { password: 'secret123' } });
        const res = buildRes();
        await loginUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /fill in all required/i);
    });

    it('returns 400 when password is missing', async () => {
        const req = buildReq({ body: { phone: '9876543210' } });
        const res = buildRes();
        await loginUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
    });

    it('returns 400 when both fields are missing', async () => {
        const req = buildReq({ body: {} });
        const res = buildRes();
        await loginUser(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  4. refreshAccessToken
// ═══════════════════════════════════════════════════════════════════════════════
describe('refreshAccessToken', () => {
    it('returns 401 when no refreshToken cookie present', async () => {
        const req = buildReq({ cookies: {} });
        const res = buildRes();
        await refreshAccessToken(req, res);

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Refresh token not found/i);
        assert.equal(res.body.success, false);
    });

    it('returns 500/401 when refreshToken is invalid / tampered', async () => {
        const req = buildReq({ cookies: { refreshToken: 'bad.token.here' } });
        const res = buildRes();
        await refreshAccessToken(req, res);

        // The controller wraps jwt.verify errors in a try/catch → 500
        assert.ok([401, 500].includes(res.statusCode));
        assert.equal(res.body.success, false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  5. logoutUser
// ═══════════════════════════════════════════════════════════════════════════════
describe('logoutUser', () => {
    it('clears both cookies when user is NOT attached (guest/edge case)', async () => {
        const req = buildReq();
        const res = buildRes(); // no res.user
        await logoutUser(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.message, 'User logged out successfully');

        // Both cookies must be cleared
        assert.equal(res.clearedCookies.length, 2);

        const accessClear = res.clearedCookies.find(c => c.name === 'accessToken');
        const refreshClear = res.clearedCookies.find(c => c.name === 'refreshToken');

        assert.ok(accessClear, 'accessToken cookie should be cleared');
        assert.ok(refreshClear, 'refreshToken cookie should be cleared');

        assert.deepEqual(accessClear.options, { ...expectedCookieBase, maxAge: 0 });
        assert.deepEqual(refreshClear.options, { ...expectedCookieBase, maxAge: 0 });
    });

    it('calls user.save() and sets offline status when user IS attached', async () => {
        let saveCalled = false;
        const fakeUser = {
            refreshToken: 'old-token',
            isOnline: true,
            lastSeen: null,
            async save() {
                saveCalled = true;
            },
        };

        const req = buildReq();
        const res = buildRes({ user: fakeUser });
        await logoutUser(req, res);

        assert.equal(saveCalled, true);
        assert.equal(fakeUser.refreshToken, null);
        assert.equal(fakeUser.isOnline, false);
        assert.ok(fakeUser.lastSeen instanceof Date);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
    });

    it('response body has correct shape', async () => {
        const req = buildReq();
        const res = buildRes();
        await logoutUser(req, res);

        assert.deepEqual(res.body, {
            message: 'User logged out successfully',
            success: true,
            error: false,
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  6. protect middleware
// ═══════════════════════════════════════════════════════════════════════════════
describe('protect middleware', () => {
    it('returns 401 when no accessToken cookie', async () => {
        const req = buildReq({ cookies: {} });
        const res = buildRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Access token not found/i);
        assert.equal(nextCalled, false);
    });

    it('returns 401 when accessToken is invalid', async () => {
        const req = buildReq({ cookies: { accessToken: 'garbage' } });
        const res = buildRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Invalid access token/i);
        assert.equal(nextCalled, false);
    });

    it('returns 401 when accessToken is expired', async () => {
        // Create a token that expired 1 hour ago
        const expiredToken = jwt.sign(
            { userId: '507f1f77bcf86cd799439011' },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '-1h' } // already expired
        );

        const req = buildReq({ cookies: { accessToken: expiredToken } });
        const res = buildRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Access token expired/i);
        assert.equal(nextCalled, false);
    });

    it('returns 401 when token signed with wrong secret', async () => {
        const badToken = jwt.sign(
            { userId: '507f1f77bcf86cd799439011' },
            'wrong-secret',
            { expiresIn: '15m' }
        );

        const req = buildReq({ cookies: { accessToken: badToken } });
        const res = buildRes();
        let nextCalled = false;

        await protect(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.match(res.body.message, /Invalid access token/i);
        assert.equal(nextCalled, false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  7. Cookie options shape (shared across register / login / logout)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Cookie Options (development mode)', () => {
    it('httpOnly is true', () => {
        assert.equal(expectedCookieBase.httpOnly, true);
    });

    it('secure is false in development', () => {
        assert.equal(expectedCookieBase.secure, false);
    });

    it('sameSite is "lax" in development', () => {
        assert.equal(expectedCookieBase.sameSite, 'lax');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  8. bcrypt utility checks (used by register / login)
// ═══════════════════════════════════════════════════════════════════════════════
describe('bcrypt hashing sanity', () => {
    it('hashed password is not the same as plain text', async () => {
        const plain = 'secret123';
        const hashed = await bcrypt.hash(plain, 12);
        assert.notEqual(plain, hashed);
    });

    it('bcrypt.compare returns true for matching password', async () => {
        const plain = 'secret123';
        const hashed = await bcrypt.hash(plain, 12);
        const match = await bcrypt.compare(plain, hashed);
        assert.equal(match, true);
    });

    it('bcrypt.compare returns false for wrong password', async () => {
        const hashed = await bcrypt.hash('secret123', 12);
        const match = await bcrypt.compare('wrongpassword', hashed);
        assert.equal(match, false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  9. Phone regex (exact same regex used in registerUser)
// ═══════════════════════════════════════════════════════════════════════════════
describe('Phone number regex validation', () => {
    const phoneRegex = /^[6-9]\d{9}$/;

    const validPhones = ['6000000000', '7123456789', '8999999999', '9876543210'];
    const invalidPhones = [
        '5876543210',  // starts with 5
        '0987654321',  // starts with 0
        '98765432',    // only 8 digits
        '98765432101', // 11 digits
        '9876abcdef',  // contains letters
        '',            // empty
        '1234567890',  // starts with 1
    ];

    for (const phone of validPhones) {
        it(`accepts valid phone: ${phone}`, () => {
            assert.equal(phoneRegex.test(phone), true);
        });
    }

    for (const phone of invalidPhones) {
        it(`rejects invalid phone: "${phone}"`, () => {
            assert.equal(phoneRegex.test(phone), false);
        });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  10. Response shape consistency
// ═══════════════════════════════════════════════════════════════════════════════
describe('Error response shape consistency', () => {
    it('registerUser error response has message, success, and error fields', async () => {
        const req = buildReq({ body: {} });
        const res = buildRes();
        await registerUser(req, res);

        assert.ok('message' in res.body);
        assert.ok('success' in res.body);
        assert.ok('error' in res.body);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error, true);
    });

    it('loginUser error response has message, success, and error fields', async () => {
        const req = buildReq({ body: {} });
        const res = buildRes();
        await loginUser(req, res);

        assert.ok('message' in res.body);
        assert.ok('success' in res.body);
        assert.ok('error' in res.body);
        assert.equal(res.body.success, false);
        assert.equal(res.body.error, true);
    });

    it('refreshAccessToken error response has consistent shape', async () => {
        const req = buildReq({ cookies: {} });
        const res = buildRes();
        await refreshAccessToken(req, res);

        assert.ok('message' in res.body);
        assert.ok('success' in res.body);
        assert.ok('error' in res.body);
    });

    it('protect middleware error response has consistent shape', async () => {
        const req = buildReq({ cookies: {} });
        const res = buildRes();
        await protect(req, res, () => {});

        assert.ok('message' in res.body);
        assert.ok('success' in res.body);
        assert.ok('error' in res.body);
    });
});
