// Keep the initialized model for subsequent photos. Terminate it if an active
// request fails or is cancelled, including during model startup or inference.
export function photoDetector(url, options) {
  let worker;
  return (photo, signal) => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const deadline = performance.now() + 10000;
    const current = worker ??= new Worker(url, options);
    const cancel = () => finish(signal.reason);
    const timeoutError = () => new DOMException('Detection timed out', 'TimeoutError');
    const timer = setTimeout(() => finish(timeoutError()), 10000);
    function finish(error, result) {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      current.onmessage = current.onerror = current.onmessageerror = null;
      if (error) {
        current.terminate();
        worker = null;
        reject(error);
      } else resolve(result);
    }
    signal.addEventListener('abort', cancel, {once:true});
    current.onerror = current.onmessageerror = () => finish(new Error('Detector could not load'));
    current.onmessage = ({data}) => {
      if (performance.now() >= deadline) finish(timeoutError());
      else finish(data.error ? new Error(data.error) : null, data.result);
    };
    createImageBitmap(photo).then(bitmap => {
      if (signal.aborted || worker !== current) { bitmap.close(); return; }
      try { current.postMessage(bitmap, [bitmap]); }
      catch (error) { bitmap.close(); finish(error); }
    }, error => {
      if (!signal.aborted && worker === current) finish(error);
    });
  });
}

// Let the canvas draw and the browser paint before starting model work.
export function afterPreview() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
