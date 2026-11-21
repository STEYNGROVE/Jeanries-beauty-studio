// Photos stay in the browser. Only model assets are requested from Pages.
export async function detectNails(photo, signal) {
  const bitmap = await createImageBitmap(photo);
  if (signal.aborted) {
    bitmap.close();
    throw new DOMException('Detection cancelled', 'AbortError');
  }
  let worker;
  try {
    worker = new Worker(new URL('./detection/worker.js', import.meta.url), {type: 'module'});
  } catch (error) {
    bitmap.close();
    throw error;
  }
  let cancel, timeout;
  try {
    return await new Promise((resolve, reject) => {
      cancel = () => reject(new DOMException('Detection cancelled', 'AbortError'));
      signal.addEventListener('abort', cancel, {once:true});
      worker.addEventListener('error', () => reject(new Error('Detector could not load')), {once:true});
      worker.addEventListener('message', ({data}) => {
        if (data.error) reject(new Error(data.error));
        else resolve(data.nails);
      }, {once:true});
      timeout = setTimeout(() => reject(new Error('Detection timed out')), 90000);
      worker.postMessage(bitmap, [bitmap]);
    });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    worker.terminate();
  }
}
