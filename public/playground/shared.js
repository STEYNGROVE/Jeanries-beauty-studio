import { designStore, blobFromCanvas } from '/nail-lab/storage.js';

export const phone = '27822265134';
export const looks = {
  'muse': {name:'Modern Muse', colour:'#9c506c', accent:'#d9a5b5', pattern:'colourFrench', finish:'Glossy', makeup:'muse'},
  'garden': {name:'Secret Garden', colour:'#657855', accent:'#f7f0e9', pattern:'floral', finish:'Matte', makeup:'garden'},
  'champagne': {name:'Champagne Glow', colour:'#b78956', accent:'#fff0c6', pattern:'stars', finish:'Shimmer', makeup:'champagne'},
  'midnight': {name:'Midnight Drama', colour:'#34264d', accent:'#d5b4ef', pattern:'geometric', finish:'Chrome', makeup:'midnight'},
  'berry': {name:'Berry Crush', colour:'#84344d', accent:'#f8c9db', pattern:'hearts', finish:'Glossy', makeup:'berry'},
  'peach': {name:'Peach Daydream', colour:'#dc987d', accent:'#f7e5cf', pattern:'ombre', finish:'Glossy', makeup:'peach'},
};

export function wa(text) {
  return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(text);
}

export async function savedLooks(kind) {
  const results = await designStore('readonly', store => store.getAll());
  return results.filter(record => !kind || (record.kind || 'nail') === kind)
    .sort((a,b) => b.updated-a.updated);
}

export function savedLook(id) {
  return designStore('readonly', store => store.get(id));
}

export function putLook(record) {
  return designStore('readwrite', store => store.put(record));
}

export function deleteLook(id) {
  return designStore('readwrite', store => store.delete(id));
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function shareCanvas(canvas, title, filename) {
  const image = new File([await blobFromCanvas(canvas, 'image/png')], filename, {type:'image/png'});
  if (navigator.canShare?.({files:[image]})) {
    await navigator.share({files:[image], title});
    return 'Image shared.';
  }
  download(image, filename);
  return 'Image downloaded. Attach it in your messaging app to share.';
}

export function styleParams() {
  const query = new URLSearchParams(location.search);
  const key = query.get('look');
  const tint = query.get('tint'), colour = query.get('colour'), apply = query.get('apply');
  return {
    look: key && Object.hasOwn(looks,key) ? looks[key] : null,
    tint: /^#[0-9a-f]{6}$/i.test(tint || '') ? tint : null,
    colour: /^#[0-9a-f]{6}$/i.test(colour || '') ? colour : null,
    layer: ['lips','eyes','cheeks'].includes(query.get('layer')) ? query.get('layer') : 'lips',
    apply: ['all','selected'].includes(apply) ? apply : null,
  };
}

export function studioLinks(key, tint) {
  const query = new URLSearchParams({look:key});
  if (tint) query.set('tint',tint);
  return {nail:'/nail-lab/?'+query, makeup:'/makeup-studio/?'+query};
}
