/* Browser-local file registrations; drawings remain in their original files. */
(() => {
  "use strict";
  function create({ indexedDB, crypto }) {
    function transaction(mode, action) {
      return new Promise((resolve, reject) => {
        if (!indexedDB) { reject(new Error("File registration storage is unavailable")); return; }
        const request = indexedDB.open("jot2d.document-bookmarks", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("File registration storage is blocked"));
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction("files", mode);
          let result;
          tx.oncomplete = () => { database.close(); resolve(result); };
          tx.onabort = () => { database.close(); reject(tx.error || new Error("File registration failed")); };
          try {
            const operation = action(tx.objectStore("files"));
            operation.onsuccess = () => { result = operation.result; };
          } catch (error) { tx.abort(); reject(error); }
        };
      });
    }
    async function register(handle) {
      const files = await transaction("readonly", store => store.getAll());
      for (const file of files) {
        if (await handle.isSameEntry(file.handle)) return file.id;
      }
      const id = crypto.randomUUID();
      await transaction("readwrite", store => store.put({ id, handle }));
      return id;
    }
    return Object.freeze({ register, get: id => transaction("readonly", store => store.get(id)) });
  }
  window.DocumentBookmarks = Object.freeze({ create });
})();
