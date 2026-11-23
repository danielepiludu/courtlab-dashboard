/** Salva il file oppure lo condivide (WhatsApp, Drive, email…) se il dispositivo lo permette. */
export async function deliverFile(blob: Blob, name: string, mode: 'download' | 'share'): Promise<'shared' | 'downloaded'> {
  if (mode === 'share') {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return 'shared';
      }
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return 'downloaded';
}
