import { describe, it, expect } from 'vitest';
import { getLocalPCPath } from '../services/localFileRegistry.js';
import {
  sanitizeFileName,
  getFileCategory,
  getCategorySubfolder,
  getLogicalPath,
  getDeviceLogicalPath,
  MOBILE_DEFAULT_ROOT,
  PC_DEFAULT_ROOT,
  resolveUniqueFileName,
} from '../services/fileSystemStorage.js';

describe('Local File Registry & File System Storage Service', () => {
  describe('Send folder routing (ChatApp/Send/)', () => {
    it('routes sent documents to ChatApp/Send/ChatApp_document/', () => {
      const path = getLocalPCPath('report.pdf', 'document', 'Send');
      expect(path).toBe('ChatApp/Send/ChatApp_document/report.pdf');
    });

    it('routes sent images to ChatApp/Send/ChatApp_image/', () => {
      const path = getLocalPCPath('photo.jpg', 'image', 'Send');
      expect(path).toBe('ChatApp/Send/ChatApp_image/photo.jpg');
    });

    it('routes sent videos to ChatApp/Send/ChatApp_video/', () => {
      const path = getLocalPCPath('clip.mp4', 'video', 'Send');
      expect(path).toBe('ChatApp/Send/ChatApp_video/clip.mp4');
    });
  });

  describe('Received folder routing (ChatApp/Received/)', () => {
    it('routes received documents to ChatApp/Received/ChatApp_document/', () => {
      const path = getLocalPCPath('invoice.pdf', 'document', 'Received');
      expect(path).toBe('ChatApp/Received/ChatApp_document/invoice.pdf');
    });

    it('routes received images to ChatApp/Received/ChatApp_image/', () => {
      const path = getLocalPCPath('avatar.png', 'image', 'Received');
      expect(path).toBe('ChatApp/Received/ChatApp_image/avatar.png');
    });

    it('routes received videos to ChatApp/Received/ChatApp_video/', () => {
      const path = getLocalPCPath('tutorial.webm', 'video', 'Received');
      expect(path).toBe('ChatApp/Received/ChatApp_video/tutorial.webm');
    });
  });

  describe('Category detection & subfolder mapping', () => {
    it('correctly maps images and extensions to ChatApp_image', () => {
      expect(getFileCategory('image', 'image/jpeg', 'photo.jpg')).toBe('image');
      expect(getFileCategory('', 'image/png', 'img.png')).toBe('image');
      expect(getCategorySubfolder('image')).toBe('ChatApp_image');
    });

    it('correctly maps videos and extensions to ChatApp_video', () => {
      expect(getFileCategory('video', 'video/mp4', 'clip.mp4')).toBe('video');
      expect(getFileCategory('', 'video/webm', 'vid.webm')).toBe('video');
      expect(getCategorySubfolder('video')).toBe('ChatApp_video');
    });

    it('correctly maps documents and other files to ChatApp_document', () => {
      expect(getFileCategory('document', 'application/pdf', 'doc.pdf')).toBe('document');
      expect(getFileCategory('', 'text/plain', 'notes.txt')).toBe('document');
      expect(getCategorySubfolder('document')).toBe('ChatApp_document');
    });
  });

  describe('Security & Path Traversal Prevention', () => {
    it('strips path traversal sequences such as ../', () => {
      const clean = sanitizeFileName('../../etc/passwd.pdf');
      expect(clean).not.toContain('..');
      expect(clean).not.toContain('/');
      expect(clean).toBe('etc_passwd.pdf');
    });

    it('sanitizes illegal Windows characters', () => {
      const clean = sanitizeFileName('bad<name>:file|test?.pdf');
      expect(clean).toBe('bad_name__file_test_.pdf');
    });

    it('handles empty or missing filenames safely', () => {
      expect(sanitizeFileName('')).toBe('attachment');
      expect(sanitizeFileName(null)).toBe('attachment');
    });
  });

  describe('Collision resolution', () => {
    it('generates unique filename when a collision is detected in directory', async () => {
      const existingFiles = new Set(['photo.jpg', 'photo (1).jpg']);
      const mockDirHandle = {
        getFileHandle: async (name) => {
          if (existingFiles.has(name)) {
            return {}; // file exists
          }
          const err = new Error('Not found');
          err.name = 'NotFoundError';
          throw err;
        },
      };

      const resolved = await resolveUniqueFileName(mockDirHandle, 'photo.jpg');
      expect(resolved).toBe('photo (2).jpg');
    });

    it('keeps original name if no collision exists', async () => {
      const mockDirHandle = {
        getFileHandle: async () => {
          const err = new Error('Not found');
          err.name = 'NotFoundError';
          throw err;
        },
      };

      const resolved = await resolveUniqueFileName(mockDirHandle, 'unique_doc.pdf');
      expect(resolved).toBe('unique_doc.pdf');
    });
  });

  describe('Device-specific default storage roots (Mobile vs PC)', () => {
    it('defines /storage/emulated/0/ChatApp as default Mobile storage root', () => {
      expect(MOBILE_DEFAULT_ROOT).toBe('/storage/emulated/0/ChatApp');
    });

    it('defines C:\\Users\\satya\\Downloads\\ChatApp as default PC storage root', () => {
      expect(PC_DEFAULT_ROOT).toBe('C:\\Users\\satya\\Downloads\\ChatApp');
    });

    it('resolves correct device logical path for mobile', () => {
      const origUa = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
        configurable: true,
      });

      const path = getDeviceLogicalPath({
        fileName: 'vacation.jpg',
        fileType: 'image',
        direction: 'Received',
      });
      expect(path).toBe('/storage/emulated/0/ChatApp/Received/ChatApp_image/vacation.jpg');

      Object.defineProperty(navigator, 'userAgent', {
        value: origUa,
        configurable: true,
      });
    });

    it('resolves correct device logical path for PC desktop', () => {
      const origUa = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        configurable: true,
      });

      const path = getDeviceLogicalPath({
        fileName: 'report.pdf',
        fileType: 'document',
        direction: 'Send',
      });
      expect(path).toBe('C:\\Users\\satya\\Downloads\\ChatApp/Send/ChatApp_document/report.pdf');

      Object.defineProperty(navigator, 'userAgent', {
        value: origUa,
        configurable: true,
      });
    });
  });
});
