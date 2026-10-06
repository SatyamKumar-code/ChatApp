import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getOS,
  getDeviceLabel,
  getBrowserName,
  isStandaloneMode,
} from '../utils/deviceDetect.js';

describe('Device, Browser & Platform Detection', () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  describe('getDeviceLabel formatting', () => {
    it('returns correct device labels for each OS', () => {
      expect(getDeviceLabel('windows')).toBe('Windows PC');
      expect(getDeviceLabel('mac')).toBe('Mac');
      expect(getDeviceLabel('android')).toBe('Android');
      expect(getDeviceLabel('ios')).toBe('iPhone / iPad');
      expect(getDeviceLabel('linux')).toBe('Linux PC');
      expect(getDeviceLabel('unknown_os')).toBe('PC / Desktop');
    });
  });

  describe('getBrowserName detection', () => {
    it('detects Chrome browser correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        configurable: true,
      });
      expect(getBrowserName()).toBe('chrome');
    });

    it('detects Edge browser correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Edg/120.0.0.0',
        configurable: true,
      });
      expect(getBrowserName()).toBe('edge');
    });

    it('detects Firefox browser correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        configurable: true,
      });
      expect(getBrowserName()).toBe('firefox');
    });
  });

  describe('isStandaloneMode check', () => {
    it('returns false by default in regular browser mode', () => {
      localStorage.removeItem('chatapp_pwa_installed');
      expect(isStandaloneMode()).toBe(false);
    });

    it('returns true when stored flag is true in localStorage', () => {
      localStorage.setItem('chatapp_pwa_installed', 'true');
      expect(isStandaloneMode()).toBe(true);
      localStorage.removeItem('chatapp_pwa_installed');
    });
  });
});
