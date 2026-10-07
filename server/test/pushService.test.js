import assert from "node:assert/strict";
import { describe, it } from "node:test";
import dotenv from "dotenv";

dotenv.config();

const {
    sendPushToUser,
    sendPushToMultipleUsers,
    sendMessagePush,
    sendCallPush,
} = await import("../services/pushService.js");

const {
    getVapidPublicKey,
    subscribeUser,
    handleCallRejectFromPush,
} = await import("../controllers/pushController.js");

describe("pushService & pushController – Web Push Functionality", () => {
    describe("sendPushToUser validations", () => {
        it("returns success: false and 0 sent when userId is null", async () => {
            const result = await sendPushToUser(null, { type: "MESSAGE" });
            assert.equal(result.success, false);
            assert.equal(result.sentCount, 0);
        });

        it("sendPushToMultipleUsers returns empty array for empty userIds", async () => {
            const results = await sendPushToMultipleUsers([], { type: "MESSAGE" });
            assert.deepEqual(results, []);
        });

        it("sendMessagePush returns early if recipientIds is empty", async () => {
            const result = await sendMessagePush({
                sender: { name: "Satyam" },
                conversation: { _id: "conv_1" },
                message: { text: "Hello" },
                recipientIds: [],
            });
            assert.equal(result, undefined);
        });
    });

    describe("pushController validations", () => {
        it("getVapidPublicKey returns public key when configured", async () => {
            let jsonOutput = null;
            let statusCode = null;

            const res = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: (data) => {
                            jsonOutput = data;
                        },
                    };
                },
            };

            await getVapidPublicKey({}, res);
            assert.equal(statusCode, 200);
            assert.equal(jsonOutput.success, true);
            assert.ok(jsonOutput.publicKey);
        });

        it("subscribeUser returns 400 when endpoint or keys are missing", async () => {
            let jsonOutput = null;
            let statusCode = null;

            const req = {
                user: { _id: "user_test_1" },
                body: { endpoint: "" },
            };

            const res = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: (data) => {
                            jsonOutput = data;
                        },
                    };
                },
            };

            await subscribeUser(req, res);
            assert.equal(statusCode, 400);
            assert.equal(jsonOutput.success, false);
        });

        it("handleCallRejectFromPush sends decline signal and returns 200", async () => {
            let jsonOutput = null;
            let statusCode = null;

            const req = {
                user: { _id: "receiver_1" },
                body: { callerId: "caller_1", callId: null },
                app: {
                    get: () => ({
                        to: () => ({ emit: () => {} }),
                    }),
                },
            };

            const res = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: (data) => {
                            jsonOutput = data;
                        },
                    };
                },
            };

            await handleCallRejectFromPush(req, res);
            assert.equal(statusCode, 200);
            assert.equal(jsonOutput.success, true);
        });
    });
});
