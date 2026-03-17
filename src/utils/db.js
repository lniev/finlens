// IndexedDB 数据库工具

const DB_NAME = 'FinLensDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// 打开数据库
export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('fileName', 'fileName', { unique: false });
      }
    };
  });
};

// 添加录制记录
export const addRecording = async (recording) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(recording);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 获取所有录制记录
export const getAllRecordings = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 获取单个录制记录
export const getRecording = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// 更新录制记录
export const updateRecording = async (id, updates) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const recording = getRequest.result;
      const updatedRecording = { ...recording, ...updates };
      const updateRequest = store.put(updatedRecording);
      updateRequest.onsuccess = () => resolve(updateRequest.result);
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// 删除录制记录
export const deleteRecording = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
