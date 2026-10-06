/**
 * Local File Registry Service
 * Persistent offline storage using IndexedDB
 * Manages sender's original files and receiver's downloaded files
 * Ensures local storage remains the final permanent storage
 */

const DB_NAME = "ChatApp_LocalRegistry_v2";
const DB_VERSION = 1;
const STORE_NAME = "files";

let dbPromise = null;
const urlCache = new Map();

const getDB = () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "fileId" });
          store.createIndex("messageId", "messageId", { unique: false });
          store.createIndex("fileType", "fileType", { unique: false });
          store.createIndex("isSenderOriginal", "isSenderOriginal", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
};

/**
 * Get virtual local storage path for PC
 */
export const getLocalPCPath = (fileName, fileType) => {
  let subDir = "ChatApp_Document";
  if (fileType === "image") subDir = "ChatApp_Image";
  else if (fileType === "video") subDir = "ChatApp_Video";
  return `Downloads/ChatApp/${subDir}/${fileName}`;
};

/**
 * Save a file (Blob or File) to the local IndexedDB registry
 */
export const saveLocalFile = async ({
  fileId,
  messageId = "",
  blob,
  fileName,
  fileType = "document",
  mimeType = "",
  fileSize = 0,
  isSenderOriginal = false,
}) => {
  if (!fileId || !blob) return null;

  try {
    const db = await getDB();
    const localPath = getLocalPCPath(fileName, fileType);

    const record = {
      fileId,
      messageId: messageId ? messageId.toString() : "",
      blob,
      fileName,
      fileType,
      mimeType: mimeType || blob.type || "application/octet-stream",
      fileSize: fileSize || blob.size || 0,
      localPath,
      isSenderOriginal: Boolean(isSenderOriginal),
      savedAt: Date.now(),
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Update URL cache
    if (urlCache.has(fileId)) {
      URL.revokeObjectURL(urlCache.get(fileId));
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
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(fileId);
      req.onsuccess = () => resolve(Boolean(req.result && req.result.blob));
      req.onerror = () => resolve(false);
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
    try {
      const db = await getDB();
      const record = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(fileId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (record && record.blob) {
        return {
          ...record,
          objectUrl: urlCache.get(fileId),
        };
      }
    } catch {
      // ignore
    }
  }

  try {
    const db = await getDB();
    return new Promise((resolve) => {
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
    });
  } catch (err) {
    console.error("[LocalFileRegistry] Error retrieving file:", err);
    return null;
  }
};

/**
 * Save sender's original file for recovery redownload requests
 */
export const saveSenderOriginal = async (fileId, file, meta = {}) => {
  return saveLocalFile({
    fileId,
    blob: file,
    fileName: file.name || meta.fileName || "original_file",
    fileType: meta.fileType || (file.type?.startsWith("image/") ? "image" : file.type?.startsWith("video/") ? "video" : "document"),
    mimeType: file.type || meta.mimeType || "application/octet-stream",
    fileSize: file.size || meta.fileSize || 0,
    isSenderOriginal: true,
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
 * Trigger standard browser download to PC disk (Downloads/ChatApp/...)
 */
export const triggerDeviceDownload = (blob, fileName, fileType) => {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (err) {
    console.error("[LocalFileRegistry] Error triggering device download:", err);
    return false;
  }
};
