import { describe, it, expect } from 'vitest';
import {
  getConversationCryptoKey,
  encryptMessage,
  decryptMessage,
  generateSecurityCode,
} from '../utils/e2ee.js';

describe('E2EE – End-to-End Encryption Module', () => {
  const conversationId = 'conv_secret_test_999';

  describe('Key derivation (PBKDF2)', () => {
    it('returns null if conversationId is missing', async () => {
      const key = await getConversationCryptoKey('');
      expect(key).toBeNull();
    });

    it('derives a valid CryptoKey for a conversation', async () => {
      const key = await getConversationCryptoKey(conversationId);
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('caches derived key for same conversationId', async () => {
      const key1 = await getConversationCryptoKey(conversationId);
      const key2 = await getConversationCryptoKey(conversationId);
      expect(key1).toBe(key2);
    });
  });

  describe('Encryption & Decryption (AES-GCM 256-bit)', () => {
    it('returns empty string when input is empty', async () => {
      const enc = await encryptMessage('', conversationId);
      expect(enc).toBe('');
      const dec = await decryptMessage('', conversationId);
      expect(dec).toBe('');
    });

    it('encrypts and successfully decrypts a message', async () => {
      const originalText = 'Hello confidential world! 🚀 12345';
      const encrypted = await encryptMessage(originalText, conversationId);

      expect(encrypted).not.toBe(originalText);
      expect(encrypted.startsWith('enc:v1:')).toBe(true);

      const decrypted = await decryptMessage(encrypted, conversationId);
      expect(decrypted).toBe(originalText);
    });

    it('generates different ciphertexts for the same plain text due to fresh random IV', async () => {
      const text = 'Identical message';
      const enc1 = await encryptMessage(text, conversationId);
      const enc2 = await encryptMessage(text, conversationId);

      expect(enc1).not.toBe(enc2);
      expect(await decryptMessage(enc1, conversationId)).toBe(text);
      expect(await decryptMessage(enc2, conversationId)).toBe(text);
    });

    it('preserves legacy plain text without error', async () => {
      const legacyText = 'This is an unencrypted legacy text';
      const decrypted = await decryptMessage(legacyText, conversationId);
      expect(decrypted).toBe(legacyText);
    });

    it('returns fallback lock message on corrupted ciphertext', async () => {
      const corruptCipher = 'enc:v1:AAAA:BBBB';
      const result = await decryptMessage(corruptCipher, conversationId);
      expect(result).toBe('🔒 [Encrypted Message]');
    });
  });

  describe('Safety Number / Security Code generation', () => {
    it('returns empty string for missing conversationId', async () => {
      const code = await generateSecurityCode('');
      expect(code).toBe('');
    });

    it('generates a 60-digit security code formatted in 12 chunks of 5 digits', async () => {
      const code = await generateSecurityCode(conversationId);
      expect(code).toBeDefined();

      const chunks = code.split(' ');
      expect(chunks.length).toBe(12);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBe(5);
        expect(/^\d{5}$/.test(chunk)).toBe(true);
      });
    });

    it('generates deterministic security code for the same conversation', async () => {
      const code1 = await generateSecurityCode('conv_fixed_123');
      const code2 = await generateSecurityCode('conv_fixed_123');
      expect(code1).toBe(code2);
    });
  });
});
