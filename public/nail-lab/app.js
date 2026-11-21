import { patterns, centre, rectangle, validQuad, draw } from './paint.js';
import { decodePhoto, blobFromCanvas, designStore, readList, writeList } from './storage.js';

const $=id=>document.getElementById(id);
const on=(id,type,fn)=>$(id).addEventListener(type,fn);
const clone=value=>structuredClone(value);
const say=text=>$('lab-status').textContent=text;
const canvas=$('preview');
const isFoot=area=>/feet|foot/.test(area);
const digits={hand:['Thumb','Index','Middle','Ring','Little finger'],foot:['Big toe','Second toe','Third toe','Fourth toe','Little toe']};
const empty=(area='left-hand')=>({area,turn:0,zoom:1,panX:0,panY:0,crop:'photo',nails:{}});
const limits=(x,min,max)=>Math.max(min,Math.min(max,x));
let state=empty(), photo=null, photoBlob=null, active='', selection=new Set(), place=false, before=false;
let undo=[],redo=[],drag=null,matrix=null,shade=null,previewDraft=false,drawFrame=0,fileVersion=0,loadedId=null;
let recent=readList('recent'),favourites=readList('favourites'),catalogue=[];
const credit=(name,colour,category)=>({name,colour,category,brand:'Custom',finish:'Unspecified'});
const customs=[
  credit('Dusty rose','#d9a5b5','Pink'),credit('Muse plum','#653b60','Purple'),credit('Soft sage','#b8c6a4','Green'),
  credit('Champagne gold','#c4a36a','Gold'),credit('Ivory','#f7f0e9','Cream'),credit('Midnight teal','#225e65','Blue'),
];
for(const [key,name] of Object.entries(patterns)) $('pattern').add(new Option(name,key));

function nailsFor() {
  const kind=isFoot(state.area)?'foot':'hand';
  const sides=state.area.startsWith('both')?['left','right']:[state.area.split('-')[0]];
  return sides.flatMap(side=>digits[kind].map((name,index)=>({
    id:side+'-'+index,name:side[0].toUpperCase()+side.slice(1)+' '+name.toLowerCase(),
  })));
}
function design() {
  return {colour:$('colour').value,accent:$('accent').value,pattern:$('pattern').value,finish:$('finish').value,
    opacity:Number($('opacity').value),scale:Number($('scale').value),offset:Number($('offset').value),shade:shade?clone(shade):null};
}
function editedState() {
  if(!previewDraft||!selection.size)return state;
  const draft=clone(state);
  for(const id of selection) if(draft.nails[id]) draft.nails[id].design=design();
  return draft;
}
function drawPreview() {
  if(drawFrame)return;
  drawFrame=requestAnimationFrame(()=>{
    drawFrame=0;
    if(!photo)return;
    const scale=canvas.width/(canvas.clientWidth||canvas.width);
    matrix=draw(canvas,photo,editedState(),{active,selection:[...selection],before,guides:true,screenScale:scale});
    canvas.style.maxWidth=(70*canvas.width/canvas.height)+'vh';
  });
}
function remember(previous) {
  undo.push(previous); if(undo.length>40)undo.shift();redo=[];
}
function change(mutator) {
  const previous=clone(state);
  mutator();
  if(JSON.stringify(previous)!==JSON.stringify(state)) remember(previous);
  previewDraft=false;refresh();
}
function selectActive(id,select=false) {
  active=id;
  if(select){selection=new Set(state.nails[id]?[id]:[]);}
  previewDraft=false;refresh();
}
function summary() {
  const area=$('area').selectedOptions[0].textContent;
  const names=new Map(nailsFor().map(nail=>[nail.id,nail.name]));
  const lines=Object.entries(state.nails).filter(([,n])=>n.design).map(([id,n])=>{
    const d=n.design,s=d.shade;
    const colour=s&&s.brand!=='Custom'?s.brand+' '+s.name+' ('+s.code+')':(s?.name||'Custom')+' '+d.colour;
    return names.get(id)+': '+colour+', '+patterns[d.pattern]+', '+d.finish;
  });
  const notes=$('notes').value.trim();
  return ['Treatment area: '+area,...(lines.length?lines:['I would like to discuss a design.']),...(notes?['Requests: '+notes]:[])].join('\n');
}
function updateSummary() {
  const text=summary();
  $('summary').value=text;
  $('whatsapp').href='https://wa.me/27822265134?text='+encodeURIComponent(
    'Hello Jeanrie, I would like to enquire about a Nail Lab appointment.\n'+text+'\nPlease confirm availability and pricing.');
}

function updateBoundary() {
  const nail=state.nails[active];
  if (!nail||!photo) return;
  const {points}=nail,c=centre(points),[a,b,,d]=points;
  $('nail-x').value=(100*c.x/photo.width).toFixed(1);$('nail-y').value=(100*c.y/photo.height).toFixed(1);
  $('nail-w').value=(100*Math.hypot(b.x-a.x,b.y-a.y)/photo.width).toFixed(1);
  $('nail-h').value=(100*Math.hypot(d.x-a.x,d.y-a.y)/photo.height).toFixed(1);
  $('nail-angle').value=Math.round(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI);
}
function refresh() {
  const list=nailsFor();
  if(!list.some(nail=>nail.id===active))active=list[0].id;
  const signature=list.map(nail=>nail.id+nail.name).join();
  if($('active-nail').dataset.area!==signature) {
    $('active-nail').replaceChildren(...list.map(nail=>new Option(nail.name,nail.id)));
    $('active-nail').dataset.area=signature;
  }
  $('active-nail').value=active;
  for(const id of selection)if(!state.nails[id])selection.delete(id);
  const grid=$('nail-list');
  if(grid.dataset.area!==signature) {
    grid.replaceChildren();
    for(const nail of list) {
      const label=document.createElement('label'),check=document.createElement('input');
      check.type='checkbox';check.value=nail.id;
      label.append(check,nail.name);grid.append(label);
      check.addEventListener('change',()=>{if(check.checked)selection.add(nail.id);else selection.delete(nail.id);refresh();});
    }
    grid.dataset.area=signature;
  }
  for(const check of grid.querySelectorAll('input')) {
    check.checked=selection.has(check.value);check.disabled=!state.nails[check.value];
  }
  $('area').value=state.area;
  $('zoom').value=state.zoom;$('pan-x').value=state.panX;$('pan-y').value=state.panY;$('crop').value=state.crop;
  $('empty-photo').hidden=!!photo;canvas.hidden=!photo;
  $('place').setAttribute('aria-pressed',String(place));$('before').setAttribute('aria-pressed',String(before));
  $('before').textContent=before?'Show edited design':'Show original photo';
  canvas.classList.toggle('mapping',place||!!state.nails[active]);
  for(const id of ['before','rotate','delete-photo','place','centre','save','save-copy','png','jpg','share','zoom','pan-x','pan-y','crop']) $(id).disabled=!photo;
  for(const id of ['remove-nail','adjust-nail','nail-x','nail-y','nail-w','nail-h','nail-angle']) $(id).disabled=!state.nails[active];
  for(const id of ['apply-all','select-all','select-side','reset-art'])$(id).disabled=!Object.keys(state.nails).length;
  $('select-active').disabled=!state.nails[active];$('apply').disabled=!selection.size;
  $('copy').disabled=!state.nails[active]?.design||!selection.size;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
  updateBoundary();updateSummary();drawPreview();
}

async function load(file) {
  if(!file)return;
  stopCamera();
  const token=++fileVersion;
  say('Opening photo…');
  try {
    const decoded=await decodePhoto(file);
    if(token!==fileVersion){decoded.bitmap.close();return;}
    photo?.close();photo=decoded.bitmap;photoBlob=decoded.blob;loadedId=null;matrix=null;
    state=empty(state.area);undo=[];redo=[];selection.clear();before=false;place=false;previewDraft=false;
    say('Photo ready. Choose a nail and tap Place on photo.');refresh();
  } catch(error){if(token===fileVersion)say(error.message);}
}
for(const id of ['upload','camera']) on(id,'change',event=>{load(event.target.files[0]);event.target.value='';});
let cameraStream=null,cameraRequest=0;
function stopCamera() {
  cameraRequest++;
  cameraStream?.getTracks().forEach(track=>track.stop());
  cameraStream=null;
  $('camera-video').srcObject=null;$('camera-preview').hidden=true;
}
on('camera-open','click',async()=>{
  stopCamera();
  const token=cameraRequest;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(token!==cameraRequest){stream.getTracks().forEach(track=>track.stop());return;}
    cameraStream=stream;$('camera-video').srcObject=stream;$('camera-preview').hidden=false;
    say('Camera is on. Frame your nails and choose Take photo.');
  }catch{if(token===cameraRequest)say('Live camera unavailable. Try Open device camera or Choose photo.');}
});
on('capture','click',async()=>{
  const video=$('camera-video');
  if(!video.videoWidth){say('Wait for the camera preview to load.');return;}
  const frame=document.createElement('canvas');
  frame.width=video.videoWidth;frame.height=video.videoHeight;
  frame.getContext('2d').drawImage(video,0,0);
  stopCamera();
  try{await load(await blobFromCanvas(frame,'image/jpeg',.93));}
  catch{say('Could not capture a photo. Try again.');}
});
on('cancel-camera','click',stopCamera);
window.addEventListener('pagehide',stopCamera);
on('delete-photo','click',()=>{
  stopCamera();fileVersion++;photo?.close();photo=null;photoBlob=null;loadedId=null;
  state=empty(state.area);undo=[];redo=[];selection.clear();place=false;before=false;previewDraft=false;
  say('Current photo deleted. Saved designs can be deleted from the saved list.');refresh();
});
on('before','click',()=>{before=!before;refresh();});
on('rotate','click',()=>change(()=>{state.turn=(state.turn+1)%4;}));
for(const [id,key] of [['zoom','zoom'],['pan-x','panX'],['pan-y','panY']]) {
  let previous;
  on(id,'input',event=>{previous??=clone(state);state[key]=Number(event.target.value);drawPreview();});
  on(id,'change',()=>{if(previous){remember(previous);previous=null;}refresh();});
}
on('crop','change',event=>change(()=>{state.crop=event.target.value;}));
on('area','change',event=>change(()=>{
  const oldFoot=isFoot(state.area);
  state.area=event.target.value;
  const allowed=new Set(nailsFor().map(n=>n.id));
  for(const id of Object.keys(state.nails)) if(oldFoot!==isFoot(state.area)||!allowed.has(id))delete state.nails[id];
  selection.clear();
}));
on('active-nail','change',event=>selectActive(event.target.value));
on('place','click',()=>{place=!place;before=false;say(place?'Tap the centre of the active nail on the photo.':'Placement cancelled.');refresh();});
function add(x,y) {
  const size=Math.min(photo.width,photo.height);
  const points=rectangle(x,y,size*.07,size*.105);
  const id=active;
  change(()=>{state.nails[id]={points,design:state.nails[id]?.design??null};selection=new Set([id]);});
  say('Outline placed. Drag its corners to fit the nail.');
}
on('centre','click',()=>add(photo.width/2,photo.height/2));
on('remove-nail','click',()=>change(()=>{delete state.nails[active];}));
on('adjust-nail','click',()=>{
  const ids=['nail-x','nail-y','nail-w','nail-h','nail-angle'];
  if(ids.some(id=>!$(id).checkValidity()||$(id).value==='')){say('Enter boundary values within the listed limits.');return;}
  const [x,y,w,h,angle]=ids.map(id=>Number($(id).value));
  const points=rectangle(x*photo.width/100,y*photo.height/100,w*photo.width/100,h*photo.height/100,angle*Math.PI/180);
  if(!validQuad(points)){say('Increase the nail width or height.');return;}
  change(()=>{state.nails[active].points=points;});
});

function photoPoint(event) {
  const box=canvas.getBoundingClientRect();
  return matrix.inverse().transformPoint({x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height});
}
const inside=(point,points)=>points.every((a,i)=>{
  const b=points[(i+1)%4];return (b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x)>=0;
});
canvas.addEventListener('pointerdown',event=>{
  if(!matrix||before)return;
  const point=photoPoint(event);
  if(place){place=false;add(limits(point.x,0,photo.width),limits(point.y,0,photo.height));return;}
  const nail=state.nails[active];
  const imageScale=Math.hypot(matrix.a,matrix.b)*canvas.clientWidth/canvas.width;
  const handle=nail?.points.findIndex(p=>Math.hypot(p.x-point.x,p.y-point.y)*imageScale<=16)??-1;
  const id=handle>=0?active:Object.keys(state.nails).reverse().find(key=>inside(point,state.nails[key].points));
  if(!id)return;
  event.preventDefault();
  const current=state.nails[id];
  selectActive(id,true);
  drag={id,point,handle,original:clone(current.points),previous:clone(state)};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  const point=photoPoint(event),dx=point.x-drag.point.x,dy=point.y-drag.point.y;
  const points=drag.original.map((p,i)=>drag.handle<0||drag.handle===i?{x:p.x+dx,y:p.y+dy}:p);
  if(validQuad(points)){state.nails[drag.id].points=points;drawPreview();}
});
function stopDrag() {
  if(!drag)return;
  if(JSON.stringify(drag.previous)!==JSON.stringify(state))remember(drag.previous);
  drag=null;refresh();
}
canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
window.addEventListener('resize',drawPreview);
on('select-active','click',()=>selectActive(active,true));
on('select-side','click',()=>{selection=new Set(Object.keys(state.nails).filter(id=>id.split('-')[0]===active.split('-')[0]));refresh();});
on('select-all','click',()=>{selection=new Set(Object.keys(state.nails));refresh();});
on('copy','click',()=>change(()=>{
  const source=state.nails[active].design;
  for(const id of selection)state.nails[id].design=clone(source);
}));
on('undo','click',()=>{if(undo.length){redo.push(clone(state));state=undo.pop();previewDraft=false;refresh();}});
on('redo','click',()=>{if(redo.length){undo.push(clone(state));state=redo.pop();previewDraft=false;refresh();}});
on('reset-art','click',()=>change(()=>{for(const nail of Object.values(state.nails))nail.design=null;}));
on('clear-design','click',()=>{change(()=>{state=empty(state.area);selection.clear();});say('Current design cleared.');});
on('notes','input',updateSummary);

function showShade() {
  const info=$('shade-info');
  if(!shade){info.textContent='Custom colour · '+$('colour').value;return;}
  info.textContent=[shade.brand,shade.name,shade.code,shade.finish,shade.verifiedOn&&'Verified '+shade.verifiedOn,shade.availability&&'Supplier status: '+shade.availability].filter(Boolean).join(' · ');
  if(shade.source){
    const link=document.createElement('a');link.href=shade.source;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent='Supplier listing';info.append(' · ',link);
  }
}
function shadeKey(item){return item.brand+'|'+(item.code||item.colour);}
function rememberColour(key,item) {
  const list=key==='recent'?recent:favourites;
  const updated=[item,...list.filter(other=>shadeKey(other)!==shadeKey(item))].slice(0,key==='recent'?8:20);
  if(key==='recent')recent=updated;else favourites=updated;
  if(!writeList(key,updated))say('Browser storage is unavailable. Colours are kept for this session only.');
  renderSavedColours();
}
function pick(item) {
  shade=item;$('colour').value=item.colour;before=false;previewDraft=true;
  showShade();rememberColour('recent',item);refresh();
}
function swatch(item) {
  const button=document.createElement('button'),chip=document.createElement('span');
  button.type='button';chip.className='lab-chip';chip.style.backgroundColor=item.colour;chip.setAttribute('aria-hidden','true');
  button.append(chip,item.name+(item.code?' · '+item.code:''));
  button.addEventListener('click',()=>pick(item));return button;
}
function renderSavedColours() {
  $('recent').replaceChildren(...recent.map(swatch));$('favourites').replaceChildren(...favourites.map(swatch));
}
function palette() {
  const brand=$('brand').value,category=$('category').value,finish=$('shade-finish').value,q=$('shade-search').value.trim().toLowerCase();
  const list=[...catalogue,...customs].filter(x=>(!brand||x.brand===brand)&&(!category||x.category===category)
    &&(!finish||x.finish===finish)&&[x.name,x.code,x.brand].join(' ').toLowerCase().includes(q));
  $('shades').replaceChildren(...list.map(swatch));
  if(!list.length)$('shades').textContent='No shades match these filters.';
}
for(const id of ['brand','category','shade-finish','shade-search'])on(id,id==='shade-search'?'input':'change',palette);
function draftChanged() {previewDraft=true;before=false;showShade();refresh();}
on('colour','input',()=>{shade=null;draftChanged();});
for(const id of ['accent','pattern','finish','opacity','scale','offset'])on(id,'input',draftChanged);
on('favourite','click',()=>{rememberColour('favourites',shade||credit('Custom '+$('colour').value,$('colour').value,'Custom'));say('Colour saved to favourites.');});
on('clear-colours','click',()=>{recent=[];favourites=[];writeList('recent',[]);writeList('favourites',[]);renderSavedColours();say('Colour history cleared.');});
function apply(ids) {
  if(!ids.length)return;
  const colour=design();
  change(()=>{for(const id of ids)state.nails[id].design=clone(colour);});
  before=false;say('Applied design to '+ids.length+(ids.length===1?' nail.':' nails.'));refresh();
}
on('apply','click',()=>apply([...selection]));
on('apply-all','click',()=>apply(Object.keys(state.nails)));

const looks={muse:[['#653b60','solid'],['#d9a5b5','floral'],['#b8c6a4','colourFrench']],
  celebrate:[['#653b60','confetti'],['#c4a36a','accent']], garden:[['#456551','leaf'],['#b8c6a4','floral'],['#f7f0e9','dots']]};
document.querySelectorAll('[data-look]').forEach(button=>button.addEventListener('click',()=>{
  if(!selection.size){say('Select mapped nails first.');return;}
  const mix=looks[button.dataset.look];
  change(()=>[...selection].forEach((id,i)=>{
    const [colour,pattern]=mix[i%mix.length];
    state.nails[id].design={...design(),colour,pattern,shade:null};
  }));
  before=false;say('Combination applied to selected nails.');refresh();
}));

async function updateList(selected=loadedId){
  const items=await designStore('readonly',store=>store.getAll());
  items.sort((a,b)=>b.updated-a.updated);
  $('saved').replaceChildren(new Option('Choose a saved design',''),...items.map(item=>new Option(item.name,item.id)));
  $('saved').value=selected||'';
}
async function saveDesign(copy) {
  try {
    const id=(!copy&&loadedId)||crypto.randomUUID(),name=$('design-name').value.trim()||'Nail design '+new Date().toLocaleDateString('en-ZA');
    const record={id,name,updated:Date.now(),state:clone(state),notes:$('notes').value,photo:photoBlob};
    await designStore('readwrite',store=>store.put(record));loadedId=id;await updateList(id);say('Design saved on this device.');
  } catch {say('The design could not be saved. Browser storage may be unavailable or full.');}
}
on('save','click',()=>saveDesign(false));
on('save-copy','click',()=>saveDesign(true));
on('restore','click',async()=>{
  if(!$('saved').value){say('Choose a saved design first.');return;}
  try {
    const token=++fileVersion;
    const record=await designStore('readonly',store=>store.get($('saved').value));
    if(!record)throw Error();
    const bitmap=await createImageBitmap(record.photo);
    if(token!==fileVersion){bitmap.close();return;}
    photo?.close();photo=bitmap;photoBlob=record.photo;state=record.state;loadedId=record.id;matrix=null;
    $('design-name').value=record.name;$('notes').value=record.notes||'';
    undo=[];redo=[];selection.clear();before=false;place=false;previewDraft=false;refresh();say('Saved design opened.');
  } catch {say('This saved design could not be opened.');}
});
on('delete-saved','click',async()=>{
  const id=$('saved').value;if(!id){say('Choose a saved design first.');return;}
  try {await designStore('readwrite',store=>store.delete(id));if(loadedId===id)loadedId=null;await updateList();say('Saved design deleted from this browser.');}
  catch {say('The saved design could not be deleted.');}
});

async function exportImage(extension) {
  const output=document.createElement('canvas');draw(output,photo,state);
  return blobFromCanvas(output,extension==='jpg'?'image/jpeg':'image/png',.94);
}
for(const ext of ['png','jpg'])on(ext,'click',async()=>{
  try{
    const url=URL.createObjectURL(await exportImage(ext)),link=document.createElement('a');
    link.href=url;link.download='jeanrie-nail-design.'+ext;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);say('Design downloaded. You can attach it in WhatsApp.');
  }catch{say('Image export failed. Try a smaller photo.');}
});
on('share','click',async()=>{
  try{
    const file=new File([await exportImage('png')],'jeanrie-nail-design.png',{type:'image/png'});
    if(!navigator.canShare?.({files:[file]})){say('Image sharing is unavailable here. Download PNG and attach it in WhatsApp.');return;}
    await navigator.share({files:[file],title:'Jeanrie’s Nail Lab',text:summary()});
  }catch(error){if(error.name!=='AbortError')say('Sharing did not complete. Download the image and attach it manually.');}
});

fetch('/data/nail-shades.json').then(response=>{
  if(!response.ok)throw Error();
  return response.json();
}).then(data=>{
  catalogue=data.shades;
  for(const [id,key] of [['category','category'],['shade-finish','finish']]){
    const values=[...new Set([...catalogue,...customs].map(item=>item[key]))].sort();
    for(const value of values)$(id).add(new Option(value,value));
  }
  palette();
}).catch(()=>{palette();say('Supplier palette unavailable. Custom colours still work.');});
updateList().catch(()=>say('Local design storage is unavailable in this browser.'));
palette();renderSavedColours();refresh();
