// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getServerPort: async () => {
    console.log('Calling get-server-port via IPC');
    const result = await ipcRenderer.invoke('get-server-port');
    //console.log('IPC result:', result);
    return result;
  },
  getServerUrl: async () => {
    console.log('Calling get-server-url via IPC');
    const result = await ipcRenderer.invoke('get-server-url');
    //console.log('IPC result:', result);
    return result;
  },
  requestMicrophoneAccess: async () => {
    console.log('Requesting microphone access via IPC');
    const result = await ipcRenderer.invoke('request-microphone-access');
    console.log('Microphone access result:', result);
    return result;
  },
  test: () => 'electronAPI is working!'
});