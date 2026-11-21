const MAX_FILE = 15 * 1024 * 1024;

export async function decodePhoto(file, validate = true) {
  if (validate) {
    if (!file || file.size > MAX_FILE || file.size < 12) throw new Error('Choose a JPG, PNG or WebP up to 15 MB.');
    const bytes = new Uint8Array(await file.slice(0,12).arrayBuffer());
    const prefix = (...values) => values.every((value,i)=>bytes[i]===value);
    const jpeg=prefix(255,216,255), png=prefix(137,80,78,71,13,10,26,10);
    const webp=prefix(82,73,70,70) && String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if (!jpeg && !png && !webp) throw new Error('Unsupported image format. Choose a JPG, PNG or WebP.');
  }
  let source;
  try { source=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch { throw new Error('This photo could not be opened. Try a different image.'); }
  try {
    if(source.width<32||source.height<32||source.width*source.height>48000000) throw new Error('Choose a photo at least 32 × 32 pixels and at most 48 megapixels.');
    const ratio=Math.min(1,1600/Math.max(source.width,source.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(source.width*ratio);canvas.height=Math.round(source.height*ratio);
    canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const blob=await blobFromCanvas(canvas, 'image/webp', .93);
    return {bitmap:await createImageBitmap(canvas),blob};
  } finally { source.close(); }
}

export function blobFromCanvas(canvas,type,quality) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The image could not be exported.')),type,quality));
}

function database() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('jeanrie-nail-lab',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('designs',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function designStore(mode, operation) {
  const db=await database();
  try {
    return await new Promise((resolve,reject)=>{
      const transaction=db.transaction('designs',mode);
      const request=operation(transaction.objectStore('designs'));
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onabort=()=>reject(transaction.error);
      transaction.onerror=()=>reject(transaction.error);
    });
  } finally { db.close(); }
}

export function readList(key) {
  try {
    const value=JSON.parse(localStorage.getItem('jeanrie-nail-'+key));
    return Array.isArray(value)?value.filter(item=>item&&typeof item==='object'):[];
  }
  catch { return []; }
}

export function writeList(key,list) {
  try { localStorage.setItem('jeanrie-nail-'+key,JSON.stringify(list));return true; }
  catch { return false; }
}
