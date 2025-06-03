// Check if running in Electron
let safeIpcRenderer = undefined;

try {
  if (typeof window !== "undefined" && window.require) {
    const electron = window.require("electron");
    safeIpcRenderer = electron.ipcRenderer;
  }
} catch (e) {
  console.warn("Not running in Electron, ipcRenderer disabled.");
}

// Safe fallback object for browser
const safeContextBridge = {
  ipcRenderer: {
    invoke: (..._args: unknown[]) => {
      console.warn("invoke called in browser – no effect.");
      return Promise.resolve(null);
    },
    on: (..._args: unknown[]) => {
      console.warn("on called in browser – no effect.");
    },
    removeAllListeners: (..._args: unknown[]) => {
      console.warn("removeAllListeners called in browser – no effect.");
    },
    removeListener: (..._args: unknown[]) => {
      console.warn("removeListener called in browser – no effect.");
    },
  },
};

// Expose dummy interface in browser or real one in Electron
window.electron = {
  ipcRenderer: safeIpcRenderer ? {
    invoke: (channel, ...args) => {
      return safeIpcRenderer.invoke(channel, ...args);
    },
    on: (channel, listener) => {
      safeIpcRenderer.on(channel, (_event, ...args) => listener(...args));
    },
    removeAllListeners: (channel) => {
      safeIpcRenderer.removeAllListeners(channel);
    },
    removeListener: (channel, listener) => {
      safeIpcRenderer.removeListener(channel, listener);
    },
  } : safeContextBridge.ipcRenderer
};
if (typeof contextBridge !== "undefined") {
  contextBridge.exposeInMainWorld("electron", window.electron || safeContextBridge);
}


