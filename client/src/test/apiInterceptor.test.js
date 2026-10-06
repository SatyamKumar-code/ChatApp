import { describe, it, expect } from 'vitest';
import api from '../services/api.js';

describe('API Client & Interceptor Configuration', () => {
  it('has credentials enabled by default for httpOnly cookies', () => {
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('has baseURL configured with /api path', () => {
    expect(api.defaults.baseURL).toContain('/api');
  });

  it('has request and response interceptors registered', () => {
    expect(api.interceptors.request.handlers.length).toBeGreaterThan(0);
    expect(api.interceptors.response.handlers.length).toBeGreaterThan(0);
  });
});
