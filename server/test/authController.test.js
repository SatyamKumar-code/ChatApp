import assert from 'node:assert/strict';
import test from 'node:test';

import { logoutUser } from '../controllers/authController.js';

test('logout clears both cookies with the configured cookie options', async () => {
    const clearedCookies = [];
    const response = {
        clearCookie(name, options) {
            clearedCookies.push({ name, options });
        },
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };

    await logoutUser({}, response);

    assert.deepEqual(clearedCookies, [
        {
            name: 'accessToken',
            options: {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: 0,
            },
        },
        {
            name: 'refreshToken',
            options: {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: 0,
            },
        },
    ]);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
});
