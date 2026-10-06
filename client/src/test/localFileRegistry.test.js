import { describe, it, expect } from 'vitest';
import { getLocalPCPath } from '../services/localFileRegistry.js';

describe('Local File Registry Service', () => {
  describe('getLocalPCPath destination mapping', () => {
    it('generates correct document folder path', () => {
      const path = getLocalPCPath('report.pdf', 'document');
      expect(path).toBe('Downloads/ChatApp/ChatApp_Document/report.pdf');
    });

    it('generates correct image folder path', () => {
      const path = getLocalPCPath('photo.jpg', 'image');
      expect(path).toBe('Downloads/ChatApp/ChatApp_Image/photo.jpg');
    });

    it('generates correct video folder path', () => {
      const path = getLocalPCPath('clip.mp4', 'video');
      expect(path).toBe('Downloads/ChatApp/ChatApp_Video/clip.mp4');
    });
  });
});
