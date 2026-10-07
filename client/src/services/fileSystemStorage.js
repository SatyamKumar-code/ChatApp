/**
 * File System Storage Service
 * Handles File System Access API with native directory tree:
 * ChatApp/
 * ├── Send/
 * │   ├── ChatApp_image/
 * │   ├── ChatApp_video/
 * │   └── ChatApp_document/
 * └── Received/
 *     ├── ChatApp_image/
 *     ├── ChatApp_video/
 *     └── ChatApp_document/
 * 
 * Supports automatic collision avoidance, capability detection, and graceful fallbacks.
 */

const DB_NAME = "ChatApp_DirectoryHandles_v1";
const STORE_HANDLES = "directory_handles";
const ROOT_HANDLE_KEY = "chatapp_root_dir_handle";

let cachedHandleDb = null;
let handleDbPromise = null;

/**
 * Check if the File System Access API is supported in current browser
 */
export const isFileSystemAccessSupported = () => {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
};

/**
 * Sanitize filename preventing path traversal, null bytes, and illegal characters
 */
export const sanitizeFileName = (fileName) => {
  if (!fileName || typeof fileName !== "string") return "attachment";
  // Remove directory traversal sequences
  let clean = fileName.replace(/(\.\.[\/\\]|\.\.)/g, "");
  // Replace slashes and path separators
  clean = clean.replace(/[/\\]/g, "_");
  // Replace illegal Windows and Unix filename characters: < > : " / \ | ? *
  clean = clean.replace(/[<>:"|?*]/g, "_");
  // Remove null bytes and ASCII control characters
  clean = clean.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  // Strip leading dots to avoid hidden files and trim whitespace
  clean = clean.trim().replace(/^\.+/, "");
  // Remove trailing dots or spaces
  clean = clean.replace(/[. ]+$/, "");
  if (!clean) clean = "attachment";
  if (clean.length > 200) {
    const extIndex = clean.lastIndexOf(".");
    if (extIndex > -1) {
      const ext = clean.slice(extIndex);
      clean = clean.slice(0, 195 - ext.length) + ext;
    } else {
      clean = clean.slice(0, 200);
    }
  }
  return clean;
};

/**
 * Determine canonical file category: image, video, document
 */
export const getFileCategory = (fileType = "", mimeType = "", fileName = "") => {
  const normType = (fileType || "").toLowerCase();
  const mime = (mimeType || "").toLowerCase();
  const ext = (fileName || "").split(".").pop().toLowerCase();

  const imageExts = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "heic", "tiff"]);
  const videoExts = new Set(["mp4", "webm", "mov", "avi", "mkv", "wmv", "flv", "m4v", "3gp"]);

  if (normType === "image" || mime.startsWith("image/") || imageExts.has(ext)) {
    return "image";
  }
  if (normType === "video" || mime.startsWith("video/") || videoExts.has(ext)) {
    return "video";
  }
  return "document";
};

/**
 * Get category subfolder name matching required naming structure:
 * - ChatApp_image
 * - ChatApp_video
 * - ChatApp_document
 */
export const getCategorySubfolder = (category) => {
  if (category === "image") return "ChatApp_image";
  if (category === "video") return "ChatApp_video";
  return "ChatApp_document";
};

export const MOBILE_DEFAULT_ROOT = "/storage/emulated/0/ChatApp";
export const PC_DEFAULT_ROOT = "C:\\Users\\satya\\Downloads\\ChatApp";

export const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false;
  const ua = (navigator.userAgent || "").toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  return (
    /android|iphone|ipad|ipod/i.test(ua) ||
    /android/i.test(platform) ||
    (platform === "macintel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1)
  );
};

export const getDefaultStorageRoot = () => {
  return isMobileDevice() ? MOBILE_DEFAULT_ROOT : PC_DEFAULT_ROOT;
};

/**
 * Get complete logical path: ChatApp/<Send|Received>/<ChatApp_subfolder>/<fileName>
 */
export const getLogicalPath = ({ fileName, fileType, mimeType, direction = "Received" }) => {
  const safeName = sanitizeFileName(fileName);
  const category = getFileCategory(fileType, mimeType, safeName);
  const subFolder = getCategorySubfolder(category);
  const dir = direction === "Send" ? "Send" : "Received";
  return `ChatApp/${dir}/${subFolder}/${safeName}`;
};

/**
 * Get device-specific logical path:
 * Mobile: /storage/emulated/0/ChatApp/<Send|Received>/<ChatApp_subfolder>/<fileName>
 * PC: C:\Users\satya\Downloads\ChatApp\<Send|Received>\<ChatApp_subfolder>\<fileName>
 */
export const getDeviceLogicalPath = ({ fileName, fileType, mimeType, direction = "Received" }) => {
  const safeName = sanitizeFileName(fileName);
  const category = getFileCategory(fileType, mimeType, safeName);
  const subFolder = getCategorySubfolder(category);
  const dir = direction === "Send" ? "Send" : "Received";
  const root = getDefaultStorageRoot();
  return `${root}/${dir}/${subFolder}/${safeName}`;
};

/**
 * Open directory handle store in IndexedDB
 */
/**
 * Open directory handle store in IndexedDB safely without blocking
 */
const getHandleDB = () => {
  if (cachedHandleDb) return Promise.resolve(cachedHandleDb);
  if (handleDbPromise) return handleDbPromise;

  handleDbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        handleDbPromise = null;
        return resolve(null);
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_HANDLES)) {
          db.createObjectStore(STORE_HANDLES, { keyPath: "key" });
        }
      };
      req.onsuccess = () => {
        cachedHandleDb = req.result;
        cachedHandleDb.onversionchange = () => {
          try { cachedHandleDb.close(); } catch { }
          cachedHandleDb = null;
          handleDbPromise = null;
        };
        cachedHandleDb.onclose = () => {
          cachedHandleDb = null;
          handleDbPromise = null;
        };
        resolve(cachedHandleDb);
      };
      req.onerror = () => {
        handleDbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        handleDbPromise = null;
        resolve(null);
      };
    } catch {
      handleDbPromise = null;
      resolve(null);
    }
  });

  return handleDbPromise;
};

/**
 * Get persisted root directory handle from IndexedDB
 */
export const getStoredDirectoryHandle = async () => {
  try {
    const db = await Promise.race([
      getHandleDB(),
      new Promise((r) => setTimeout(() => r(null), 300)),
    ]);
    if (!db || !db.objectStoreNames.contains(STORE_HANDLES)) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_HANDLES, "readonly");
      const store = tx.objectStore(STORE_HANDLES);
      const req = store.get(ROOT_HANDLE_KEY);
      req.onsuccess = () => {
        resolve(req.result?.handle || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

/**
 * Save root directory handle to IndexedDB
 */
export const saveStoredDirectoryHandle = async (handle) => {
  try {
    const db = await Promise.race([
      getHandleDB(),
      new Promise((r) => setTimeout(() => r(null), 500)),
    ]);
    if (!db || !db.objectStoreNames.contains(STORE_HANDLES)) return false;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HANDLES, "readwrite");
      const store = tx.objectStore(STORE_HANDLES);
      const req = store.put({ key: ROOT_HANDLE_KEY, handle, savedAt: Date.now() });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("[FileSystemStorage] Error saving directory handle:", err);
    return false;
  }
};

/**
 * Clear stored directory handle
 */
export const clearStoredDirectoryHandle = async () => {
  try {
    const db = await Promise.race([
      getHandleDB(),
      new Promise((r) => setTimeout(() => r(null), 500)),
    ]);
    if (!db || !db.objectStoreNames.contains(STORE_HANDLES)) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_HANDLES, "readwrite");
      const store = tx.objectStore(STORE_HANDLES);
      const req = store.delete(ROOT_HANDLE_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
};

/**
 * Verify or query readwrite permission on directory handle
 */
export const verifyPermission = async (fileHandle, readWrite = true) => {
  const options = {};
  if (readWrite) {
    options.mode = "readwrite";
  }
  try {
    if ((await fileHandle.queryPermission(options)) === "granted") {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === "granted") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Automatically create ChatApp and all Send & Received subfolders on disk:
 * ChatApp/
 * ├── Send/
 * │   ├── ChatApp_image/
 * │   ├── ChatApp_video/
 * │   └── ChatApp_document/
 * └── Received/
 *     ├── ChatApp_image/
 *     ├── ChatApp_video/
 *     └── ChatApp_document/
 */
export const ensureChatAppDirectoryTree = async (rootHandle) => {
  if (!rootHandle) return null;
  try {
    let chatAppDir = rootHandle;
    if (rootHandle.name.toLowerCase() !== "chatapp") {
      chatAppDir = await rootHandle.getDirectoryHandle("ChatApp", { create: true });
    }

    // 1. Create Send folder and subfolders
    const sendDir = await chatAppDir.getDirectoryHandle("Send", { create: true });
    await sendDir.getDirectoryHandle("ChatApp_image", { create: true });
    await sendDir.getDirectoryHandle("ChatApp_video", { create: true });
    await sendDir.getDirectoryHandle("ChatApp_document", { create: true });

    // 2. Create Received folder and subfolders
    const recDir = await chatAppDir.getDirectoryHandle("Received", { create: true });
    await recDir.getDirectoryHandle("ChatApp_image", { create: true });
    await recDir.getDirectoryHandle("ChatApp_video", { create: true });
    await recDir.getDirectoryHandle("ChatApp_document", { create: true });

    return chatAppDir;
  } catch (err) {
    console.error("[FileSystemStorage] Error ensuring directory tree:", err);
    return null;
  }
};

/**
 * Check if a directory handle is currently stored
 */
export const hasStoredDirectoryHandle = async () => {
  const handle = await getStoredDirectoryHandle();
  return Boolean(handle);
};

/**
 * Prompt user to select directory for ChatApp storage
 * Starts directly in "downloads" folder on PC and immediately creates the full folder structure.
 */
export const promptSelectChatAppDirectory = async () => {
  if (!isFileSystemAccessSupported()) {
    throw new Error("File System Access API is not supported on this browser");
  }
  try {
    const handle = await window.showDirectoryPicker({
      id: "chatapp-local-storage",
      mode: "readwrite",
      startIn: "downloads",
    });

    const hasPerm = await verifyPermission(handle, true);
    if (!hasPerm) {
      throw new Error("Permission to write to directory was denied");
    }

    // Immediately create ChatApp and all Send / Received subfolders in the selected directory
    await ensureChatAppDirectoryTree(handle);

    await saveStoredDirectoryHandle(handle);
    return handle;
  } catch (err) {
    if (err.name === "AbortError") {
      return null; // User cancelled
    }
    throw err;
  }
};

/**
 * Avoid filename collision by checking if file exists in dirHandle and appending (1), (2), etc.
 */
export const resolveUniqueFileName = async (dirHandle, fileName) => {
  const safeName = sanitizeFileName(fileName);
  let dotIndex = safeName.lastIndexOf(".");
  let baseName = dotIndex > -1 ? safeName.slice(0, dotIndex) : safeName;
  let ext = dotIndex > -1 ? safeName.slice(dotIndex) : "";

  let currentName = safeName;
  let counter = 1;

  while (counter <= 200) {
    try {
      // If getFileHandle succeeds, file already exists
      await dirHandle.getFileHandle(currentName);
      currentName = `${baseName} (${counter})${ext}`;
      counter++;
    } catch (err) {
      // File does not exist: this name is free to use
      if (err.name === "NotFoundError" || err.code === 8) {
        return currentName;
      }
      // Any other error, break and use currentName
      break;
    }
  }
  return currentName;
};

/**
 * Save a Blob or File to disk using File System Access API
 * Follows exact directory hierarchy:
 * ChatApp/
 * ├── Send/ or Received/
 * │   ├── ChatApp_image/ or ChatApp_video/ or ChatApp_document/
 * │   └── <unique_file>
 */
export const saveFileToDiskWithApi = async ({
  blob,
  fileName,
  fileType = "",
  mimeType = "",
  direction = "Received",
  rootHandle = null,
}) => {
  try {
    let handle = rootHandle;
    if (!handle) {
      handle = await getStoredDirectoryHandle();
    }
    if (!handle) return null;

    const hasPerm = await verifyPermission(handle, true);
    if (!hasPerm) return null;

    // 1. Determine base ChatApp directory
    let chatAppDirHandle = handle;
    if (handle.name.toLowerCase() !== "chatapp") {
      chatAppDirHandle = await handle.getDirectoryHandle("ChatApp", { create: true });
    }

    // 2. Get or create Send or Received directory
    const dirName = direction === "Send" ? "Send" : "Received";
    const directionDirHandle = await chatAppDirHandle.getDirectoryHandle(dirName, { create: true });

    // 3. Get or create category subfolder
    const category = getFileCategory(fileType, mimeType, fileName);
    const subFolderName = getCategorySubfolder(category);
    const categoryDirHandle = await directionDirHandle.getDirectoryHandle(subFolderName, { create: true });

    // 4. Resolve unique filename to prevent collisions
    const safeName = sanitizeFileName(fileName);
    const uniqueFileName = await resolveUniqueFileName(categoryDirHandle, safeName);

    // 5. Write file
    const fileHandle = await categoryDirHandle.getFileHandle(uniqueFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    const localPath = `ChatApp/${dirName}/${subFolderName}/${uniqueFileName}`;
    return {
      savedToDisk: true,
      method: "fs-access",
      fileName: uniqueFileName,
      localPath,
    };
  } catch (err) {
    console.error("[FileSystemStorage] Error saving file to disk with API:", err);
    return null;
  }
};

/**
 * Fallback browser download (e.g. mobile or unsupported desktop browsers)
 */
export const triggerBrowserDownload = (blob, fileName) => {
  try {
    const safeName = sanitizeFileName(fileName);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (err) {
    console.error("[FileSystemStorage] Fallback download error:", err);
    return false;
  }
};
