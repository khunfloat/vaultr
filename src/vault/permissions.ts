export function isFsaSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

export async function hasReadWrite(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted'
}

/** Must be called from a user gesture (click). */
export async function requestReadWrite(handle: FileSystemDirectoryHandle): Promise<boolean> {
  if (await hasReadWrite(handle)) return true
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
}

/** Returns null when the user cancels the picker. */
export async function pickVaultDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker!({ id: 'vaultr', mode: 'readwrite', startIn: 'documents' })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null
    throw e
  }
}
