/**
 * Local File Registry Service
 * Persistent offline storage using IndexedDB & File System Access API
 * Manages sender's local copies in ChatApp/Send/ and receiver's local copies in ChatApp/Received/
 * Categorized into:
 * - ChatApp_image
 * - ChatApp_video
 * - ChatApp_document
 */

import {
  getLogicalPath,
  getDeviceLogicalPath,
  MOBILE_DEFAULT_ROOT,
  PC_DEFAULT_ROOT,
  getDefaultStorageRoot,
  isMobileDevice,
  getFileCategory,
  getCategorySubfolder,
  sanitizeFileName,
  saveFileToDiskWithApi,
  triggerBrowserDownload,
  isFileSystemAccessSupported,
} from "./fileSystemStorage.js";

export { MOBILE_DEFAULT_ROOT, PC_DEFAULT_ROOT, getDefaultStorageRoot, isMobileDevice };

const DB_NAME = "ChatApp_LocalFiles_v1";
const STORE_NAME = "files";

let cachedDb = null;
let dbPromise = null;
const urlCache = new Map();

export const getDB = () => {
  if (cachedDb) return Promise.resolve(cachedDb);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        dbPromise = null;
        return resolve(null);
      }
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "fileId" });
          store.createIndex("messageId", "messageId", { unique: false });
          store.createIndex("fileType", "fileType", { unique: false });
          store.createIndex("isSenderOriginal", "isSenderOriginal", { unique: false });
          store.createIndex("direction", "direction", { unique: false });
        }
      };

      request.onsuccess = () => {
        cachedDb = request.result;
        cachedDb.onversionchange = () => {
          try { cachedDb.close(); } catch {}
          cachedDb = null;
          dbPromise = null;
        };
        cachedDb.onclose = () => {
          cachedDb = null;
          dbPromise = null;
        };
        resolve(cachedDb);
      };
      request.onerror = (e) => {
        console.warn("[LocalRegistry] getDB error:", e?.target?.error);
        dbPromise = null;
        resolve(null);
      };
      request.onblocked = () => {
        console.warn("[LocalRegistry] getDB upgrade blocked");
        dbPromise = null;
        resolve(null);
      };
    } catch (err) {
      console.warn("[LocalRegistry] getDB exception:", err);
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
};

/**
 * Get virtual/logical local storage path for PC:
 * ChatApp/<Send|Received>/ChatApp_<image|video|document>/<fileName>
 */
export const getLocalPCPath = (fileName, fileType, direction = "Received") => {
  return getLogicalPath({ fileName, fileType, direction });
};

/**
 * Get device-specific local storage path:
 * Mobile: /storage/emulated/0/ChatApp/<Send|Received>/ChatApp_<image|video|document>/<fileName>
 * PC: C:\Users\satya\Downloads\ChatApp\<Send|Received>\<ChatApp_subfolder>\<fileName>
 */
export const getLocalDevicePath = (fileName, fileType, direction = "Received") => {
  return getDeviceLogicalPath({ fileName, fileType, direction });
};

/**
 * Save a file (Blob or File) to the local IndexedDB registry & native disk if permitted
 */
export const saveLocalFile = async ({
  fileId,
  messageId = "",
  blob,
  fileName,
  fileType = "",
  mimeType = "",
  fileSize = 0,
  isSenderOriginal = false,
  direction = null,
}) => {
  if (!fileId || !blob) return null;

  try {
    const effectiveDirection = direction || (isSenderOriginal ? "Send" : "Received");
    const safeName = sanitizeFileName(fileName);
    const category = getFileCategory(fileType, mimeType || blob.type, safeName);
    const localPath = getLocalPCPath(safeName, category, effectiveDirection);

    // 1. Attempt writing to physical disk via File System Access API if permission is granted
    let diskResult = null;
    try {
      diskResult = await saveFileToDiskWithApi({
        blob,
        fileName: safeName,
        fileType: category,
        mimeType: mimeType || blob.type,
        direction: effectiveDirection,
      });
    } catch (diskErr) {
      console.warn("[LocalFileRegistry] Direct disk save skipped or failed:", diskErr);
    }

    const finalPath = diskResult?.localPath || localPath;
    const finalFileName = diskResult?.fileName || safeName;

    const record = {
      fileId,
      messageId: messageId ? messageId.toString() : "",
      blob,
      fileName: finalFileName,
      fileType: category,
      mimeType: mimeType || blob.type || "application/octet-stream",
      fileSize: fileSize || blob.size || 0,
      localPath: finalPath,
      direction: effectiveDirection,
      isSenderOriginal: Boolean(isSenderOriginal),
      savedToDisk: Boolean(diskResult?.savedToDisk),
      savedAt: Date.now(),
    };

    const db = await Promise.race([
      getDB(),
      new Promise((r) => setTimeout(() => r(null), 500)),
    ]);
    if (db && db.objectStoreNames.contains(STORE_NAME)) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(record);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }

    // Update URL cache
    if (urlCache.has(fileId)) {
      try { URL.revokeObjectURL(urlCache.get(fileId)); } catch {}
    }
    const objectUrl = URL.createObjectURL(blob);
    urlCache.set(fileId, objectUrl);

    return { ...record, objectUrl };
  } catch (err) {
    console.error("[LocalFileRegistry] Error saving file:", err);
    return null;
  }
};

/**
 * Check if a file is present in the local registry
 */
export const hasLocalFile = async (fileId) => {
  if (!fileId) return false;
  try {
    const db = await getDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(fileId);
        req.onsuccess = () => resolve(Boolean(req.result && req.result.blob));
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
};

/**
 * Retrieve a file from the local registry
 */
export const getLocalFile = async (fileId) => {
  if (!fileId) return null;

  // Return cached ObjectURL if already available
  if (urlCache.has(fileId)) {
    const cachedUrl = urlCache.get(fileId);
    try {
      const db = await getDB();
      if (!db || !db.objectStoreNames.contains(STORE_NAME)) {
        return { fileId, objectUrl: cachedUrl };
      }
      const record = await new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(fileId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
      return {
        ...(record || { fileId }),
        objectUrl: cachedUrl,
      };
    } catch {
      return { fileId, objectUrl: cachedUrl };
    }
  }

  try {
    const db = await getDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(fileId);
        req.onsuccess = () => {
          const result = req.result;
          if (result && result.blob) {
            const objectUrl = URL.createObjectURL(result.blob);
            urlCache.set(fileId, objectUrl);
            resolve({
              ...result,
              objectUrl,
            });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch (err) {
    console.error("[LocalFileRegistry] Error retrieving file:", err);
    return null;
  }
};

/**
 * Save sender's original file for recovery redownload requests
 * Stored locally into ChatApp/Send/ChatApp_<type>/
 */
export const saveSenderOriginal = async (fileId, file, meta = {}) => {
  const mime = file.type || meta.mimeType || "";
  const name = file.name || meta.fileName || "original_file";
  const category = getFileCategory(meta.fileType, mime, name);

  return saveLocalFile({
    fileId,
    blob: file,
    fileName: name,
    fileType: category,
    mimeType: mime || "application/octet-stream",
    fileSize: file.size || meta.fileSize || 0,
    isSenderOriginal: true,
    direction: "Send",
  });
};

/**
 * Retrieve sender's original file for auto re-upload
 */
export const getSenderOriginal = async (fileId) => {
  const item = await getLocalFile(fileId);
  return item ? item.blob : null;
};

/**
 * Trigger standard browser download to device disk
 */
export const triggerDeviceDownload = (blob, fileName, fileType, direction = "Received") => {
  return triggerBrowserDownload(blob, fileName);
};

/**
 * Get all files stored in the local registry
 */
export const getAllLocalFiles = async () => {
  try {
    const db = await getDB();
    if (!db || !db.objectStoreNames.contains(STORE_NAME)) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
};

/**
 * Get summary storage statistics for the Settings modal
 */
export const getLocalFileStats = async () => {
  try {
    const files = await getAllLocalFiles();
    let totalBytes = 0;
    const stats = {
      totalFiles: files.length,
      totalBytes: 0,
      send: { image: 0, video: 0, document: 0, count: 0 },
      received: { image: 0, video: 0, document: 0, count: 0 },
    };

    for (const f of files) {
      const size = f.fileSize || f.blob?.size || 0;
      totalBytes += size;
      const dirKey = f.direction === "Send" || f.isSenderOriginal ? "send" : "received";
      const catKey = f.fileType === "image" ? "image" : f.fileType === "video" ? "video" : "document";
      stats[dirKey].count++;
      stats[dirKey][catKey]++;
    }
    stats.totalBytes = totalBytes;
    return stats;
  } catch {
    return {
      totalFiles: 0,
      totalBytes: 0,
      send: { image: 0, video: 0, document: 0, count: 0 },
      received: { image: 0, video: 0, document: 0, count: 0 },
    };
  }
};
