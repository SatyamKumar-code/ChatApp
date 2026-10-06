import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

const {
    isUserOnline,
    onlineUsers,
} = await import('../socket/socketServer.js');

describe('socketServer – Online Tracking & Socket State', () => {
    beforeEach(() => {
        onlineUsers.clear();
    });

    describe('isUserOnline helper', () => {
        it('returns false for null or undefined user', () => {
            assert.equal(isUserOnline(null), false);
            assert.equal(isUserOnline(undefined), false);
        });

        it('returns false when user is not in onlineUsers map', () => {
            assert.equal(isUserOnline('user_unknown_999'), false);
        });

        it('returns true when user has active socket id in onlineUsers map', () => {
            const userId = 'user_active_123';
            onlineUsers.set(userId, new Set(['socket_abc_1']));

            assert.equal(isUserOnline(userId), true);
        });

        it('handles user passed as object with _id', () => {
            const userId = 'user_obj_456';
            onlineUsers.set(userId, new Set(['socket_xyz_2']));

            assert.equal(isUserOnline({ _id: userId }), true);
        });

        it('returns false when user has an empty Set of sockets', () => {
            const userId = 'user_empty_789';
            onlineUsers.set(userId, new Set());

            assert.equal(isUserOnline(userId), false);
        });
    });
});
