let connection;
export function database() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open('prism-studio', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('projects', { keyPath: 'id' });
      request.result.createObjectStore('scenes');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); connection = null; };
      resolve(request.result);
    };
    request.onerror = () => { connection = null; reject(request.error); };
    request.onblocked = () => { connection = null; reject(new Error('Close other Prism tabs and try again.')); };
  });
  return connection;
}
export async function read(store, key) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store)[key === undefined ? 'getAll' : 'get'](key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function save(project, scene) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'scenes'], 'readwrite');
    tx.objectStore('projects').put(project);
    if (scene !== undefined) tx.objectStore('scenes').put(scene, project.id);
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Local save failed.'));
  });
}
export async function remove(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['projects', 'scenes'], 'readwrite');
    tx.objectStore('projects').delete(id);
    tx.objectStore('scenes').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not delete project.'));
  });
}
