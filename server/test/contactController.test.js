import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
    addContact,
} = await import('../controllers/contactController.js');

function buildReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: { _id: 'user_current_123', phone: '9876543210' },
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

describe('contactController – Contacts Functionality', () => {
    describe('addContact validation', () => {
        it('returns 400 when phone number is missing or empty', async () => {
            const req = buildReq({ body: { name: 'Bob' } });
            const res = buildRes();

            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Phone number is required/i);
        });

        it('returns 400 when phone number format is invalid (< 10 digits)', async () => {
            const req = buildReq({ body: { phone: '12345' } });
            const res = buildRes();

            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Invalid phone number format/i);
        });

        it('returns 400 when phone starts with digit < 6', async () => {
            const req = buildReq({ body: { phone: '5123456789' } });
            const res = buildRes();

            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Invalid phone number format/i);
        });

        it('returns 400 when attempting to add user own phone number', async () => {
            const req = buildReq({ body: { phone: '9876543210' } });
            const res = buildRes();

            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /cannot add your own number/i);
        });
    });
});
