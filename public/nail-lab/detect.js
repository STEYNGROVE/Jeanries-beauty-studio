import { photoDetector } from '/playground/photo-detector.js';

export const detectNails = photoDetector(new URL('./detection/worker.js', import.meta.url), {type:'module'});
