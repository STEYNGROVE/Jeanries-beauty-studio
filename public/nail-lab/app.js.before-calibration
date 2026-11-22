import { patterns, centre, rectangle, validQuad, draw } from './paint.js';
import { customNails } from './palette.js';
import { savedLooks, styleParams } from '/playground/shared.js';
import { afterPreview } from '/playground/photo-detector.js';
import { detectNails } from './detect.js';
import { decodePhoto, blobFromCanvas, designStore, readList, writeList } from './storage.js';

const $=id=>document.getElementById(id);
const on=(id,type,fn)=>$(id).addEventListener(type,fn);
const clone=value=>structuredClone(value);
const say=text=>$('lab-status').textContent=text;
const canvas=$('preview');
const isFoot=area=>/feet|foot/.test(area);
const digits={hand:['Thumb','Index','Middle','Ring','Little finger'],foot:['Big toe','Second toe','Third toe','Fourth toe','Little toe']};
const empty=(area='unspecified')=>({area,auto:0,turn:0,zoom:1,panX:0,panY:0,crop:'photo',nails:{}});
const limits=(x,min,max)=>Math.max(min,Math.min(max,x));
let state=empty(), photo=null, photoBlob=null, active='', selection=new Set(), place=false, before=false;
let undo=[],redo=[],drag=null,matrix=null,shade=null,previewDraft=false,drawFrame=0,fileVersion=0,loadedId=null;
let detection=null,scanning=false,canRetry=false,hasChosenStyle=false,placingSequence=false;
let pendingModel=null;
let recent=readList('recent'),favourites=readList('favourites'),catalogue=[];
const credit=(name,colour,category)=>({name,colour,category,brand:'Custom',finish:'Unspecified'});
const customs=customNails;
for(const [key,name] of Object.entries(patterns)) $('pattern').add(new Option(name,key));
const incoming=styleParams();
let pendingSelection=incoming.apply==='selected' && !!(incoming.colour||incoming.look);
if(incoming.look) {
  const {colour,accent,pattern,finish}=incoming.look;
  $('colour').value=colour;$('accent').value=incoming.tint||accent;
  $('pattern').value=pattern;$('finish').value=finish;hasChosenStyle=true;
}


if(incoming.colour){$('colour').value=incoming.colour;hasChosenStyle=true;showShade();}

function nailsFor() {
  if(state.auto)return Array.from({length:state.auto},(_,i)=>({id:'visible-'+i,name:'Nail '+(i+1)}));
  const kind=isFoot(state.area)?'foot':'hand';
  const sides=state.area.startsWith('both')?['left','right']:[state.area==='unspecified'?'left':state.area.split('-')[0]];
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
    matrix=draw(canvas,photo,editedState(),{active,selection:[...selection],before,guides:$('advanced-nails').open,screenScale:scale});
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
  const area=[...$('area').options].find(option=>option.value===state.area).textContent;
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
  const model=pendingModel?.token===fileVersion ? pendingModel : null;
  const area=model?.area ?? state.area;
  $('area').value=area;
  if(model || state.practiceTone) {
    $('model-area').value=area==='unspecified'?'left-hand':area;
    $('model-tone').value=model?.tone ?? state.practiceTone;
  }
  $('zoom').value=state.zoom;$('pan-x').value=state.panX;$('pan-y').value=state.panY;$('crop').value=state.crop;
  $('empty-photo').textContent=model?'Opening practice model…':'Add a photo to try on nail colours.';
  $('empty-photo').hidden=!!photo&&!model;
  canvas.hidden=!photo||!!model;
  $('place').textContent=place?'Finish placement':'Tap photo to place';
  $('place').setAttribute('aria-pressed',String(place));$('before').setAttribute('aria-pressed',String(before));
  $('before').textContent=before?'Show edited design':'Show original photo';
  document.body.classList.toggle('lab-auto',!!state.auto);
  document.body.classList.toggle('lab-selecting',pendingSelection);
  $('choose-styles').href=pendingSelection?'#advanced-nails':'#art-title';
  $('choose-styles').textContent=pendingSelection?'Choose nails to paint':'Choose colours and styles';
  $('cancel-detection').hidden=!scanning;
  $('manual-nails').hidden=!photo||scanning||!canRetry;
  $('scan-again').hidden=!photo||!canRetry||scanning;
  $('choose-styles').hidden=!state.auto;
  $('preview-frame').setAttribute('aria-busy',String(scanning||!!model));
  canvas.classList.toggle('mapping',$('advanced-nails').open&&(place||!!state.nails[active]));
  for(const id of ['before','rotate','delete-photo','place','centre','save','save-copy','png','jpg','share','zoom','pan-x','pan-y','crop']) $(id).disabled=!photo;
  for(const id of ['remove-nail','adjust-nail','nail-x','nail-y','nail-w','nail-h','nail-angle']) $(id).disabled=scanning||!state.nails[active];
  for(const id of ['place','centre']) $(id).disabled=scanning||!photo;
  for(const id of ['apply-all','select-all','select-side','reset-art'])$(id).disabled=!Object.keys(state.nails).length;
  $('select-active').disabled=!state.nails[active];$('apply').disabled=!selection.size;
  $('copy').disabled=!state.nails[active]?.design||!selection.size;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
  updateBoundary();updateSummary();drawPreview();
}


const modelTones = {
  light: '#E8B99D',
  medium: '#BD8061',
  deep: '#754833'
};

function modelArtwork(area, tone) {
  const foot = area.includes('foot') || area.includes('feet');
  const both = area.startsWith('both');
  const skin = modelTones[tone] || modelTones.medium;

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 650;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#F7F0E9';
  ctx.fillRect(0, 0, 800, 650);

  const nails = {};
  const sides = both ? ['left', 'right'] :
    [area.startsWith('right') ? 'right' : 'left'];

  sides.forEach((side, sideIndex) => {
    const cx = both ? (sideIndex ? 575 : 225) : 400;
    const scale = both ? 0.52 : 1;
    const flip = side === 'right' ? -1 : 1;

    ctx.save();
    ctx.translate(cx, 360);
    ctx.scale(scale * flip, scale);

    ctx.fillStyle = skin;
    ctx.strokeStyle = '#885C50';
    ctx.lineWidth = 5;

    ctx.beginPath();

    if (foot) {
      ctx.moveTo(-130, 290);
      ctx.bezierCurveTo(-150, 130, -160, -60, -110, -150);
      ctx.bezierCurveTo(-80, -220, -25, -180, 0, -130);
      ctx.bezierCurveTo(45, -180, 85, -120, 100, -70);
      ctx.bezierCurveTo(145, -80, 160, -20, 140, 50);
      ctx.lineTo(125, 290);
    } else {
      ctx.moveTo(-130, 290);
      ctx.lineTo(-155, -20);
      ctx.bezierCurveTo(-210, -100, -170, -145, -125, -95);
      ctx.lineTo(-105, -220);
      ctx.bezierCurveTo(-100, -260, -60, -260, -55, -220);
      ctx.lineTo(-45, -300);
      ctx.bezierCurveTo(-40, -345, 5, -345, 10, -300);
      ctx.lineTo(25, -315);
      ctx.bezierCurveTo(30, -350, 75, -345, 75, -305);
      ctx.lineTo(80, -240);
      ctx.bezierCurveTo(110, -270, 145, -250, 140, -210);
      ctx.lineTo(125, 290);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const positions = foot
      ? [[-100,-150],[-35,-115],[25,-80],[75,-45],[115,-10]]
      : [[-125,-90],[-80,-215],[-20,-285],[45,-290],[105,-220]];

    positions.forEach(([x,y], i) => {
      const px = cx + x * scale * flip;
      const py = 360 + y * scale;
      const w = (foot ? 48 : 34) * scale;
      const h = (foot ? 58 : 55) * scale;

      const points = [
        {x:px-w/2,y:py-h/2},
        {x:px+w/2,y:py-h/2},
        {x:px+w/2,y:py+h/2},
        {x:px-w/2,y:py+h/2}
      ];

      nails[side+'-'+i] = {points, design:null};

      ctx.fillStyle = '#F4D8C9';
      ctx.beginPath();
      ctx.roundRect(px-w/2,py-h/2,w,h,Math.min(w,h)*0.3);
      ctx.fill();
    });
  });

  return {canvas,nails};
}


// Photographic practice models: six local, preloaded source photos.
// Nail quads are approximations and can be refined with Advanced nail placement.
async function modelPhoto(area,tone) {
  const foot = /foot|feet/.test(area);
  const both = area.startsWith('both');
  const type = foot ? 'foot' : 'hand';
  const filename = `/nail-lab/models/${type}-${['light','medium','deep'].includes(tone)?tone:'medium'}.webp`;
  const response = await fetch(filename);
  if (!response.ok) throw new Error('Model photo missing');
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const single = 512;
    const output = document.createElement('canvas');
    output.width = both ? 1024 : single;
    output.height = single;
    const ctx = output.getContext('2d');
    ctx.fillStyle='#f7f0e9';ctx.fillRect(0,0,output.width,output.height);
    const sides = both ? ['left','right'] : [area.startsWith('right')?'right':'left'];
    const nails = {};
    // Photo-space nail centres, measured on the supplied 512px model crops.
    // Ordered thumb to little finger; big toe to little toe.
    // Measured against the actual 512x512 photographs, thumb/big toe first.
    // Each entry is nail centre x/y and approximate width/height in pixels.
    const centres = foot
      ? [[190,67,61,82],[293,111,41,47],[357,145,35,42],[416,195,33,39],[462,240,29,38]]
      : [[444,330,45,69],[397,80,37,66],[310,40,43,70],[222,58,43,68],[116,139,35,61]];
    sides.forEach((side,sideIndex)=>{
      const offset = both ? sideIndex*single : 0;
      const mirror = side==='right';
      ctx.save();ctx.translate(offset+(mirror?single:0),0);ctx.scale(mirror?-1:1,1);
      ctx.drawImage(bitmap,0,0,single,single);ctx.restore();
      // Show the selected side explicitly; the right model is mirrored.
      ctx.save();
      ctx.font='bold 18px sans-serif';
      ctx.textAlign='center';
      ctx.fillStyle='#523b42';
      ctx.fillText(`${side.toUpperCase()} ${foot?'FOOT':'HAND'}`,offset+256,493);
      ctx.restore();
      centres.forEach(([cx,cy,w,h],i)=>{
        const x=offset+(mirror?single-cx:cx);
        nails[side+'-'+i]={points:rectangle(x,cy,w,h),design:null};
      });
    });
    return {canvas:output,nails};
  } finally {bitmap.close();}
}

async function chooseModel(area=$('model-area').value, tone=$('model-tone').value) {
  stopCamera();
  stopDetection();

  const token = ++fileVersion;
  pendingModel = {area,tone,token};
  say('Opening practice model…');
  refresh();
  try {
    const model = await modelPhoto(area,tone);
    const blob = await blobFromCanvas(model.canvas,'image/png');
    const bitmap = await createImageBitmap(model.canvas);

    if (token !== fileVersion) {
      bitmap.close();
      return;
    }

    photo?.close();
    photo = bitmap;
    photoBlob = blob;
    loadedId = null;
    matrix = null;

    state = empty(area);
    state.practiceTone = tone;
    state.nails = model.nails;

    undo = [];
    redo = [];
    selection = new Set(Object.keys(model.nails));
    active = Object.keys(model.nails)[0];

    before = false;
    place = false;
    previewDraft = false;
    placingSequence = false;
    canRetry = false;
    drag = null;

    $('advanced-nails').open = false;

    say('Practice model ready. Choose colours and nail art.');
  } catch(error) {
    if(token===fileVersion)say('Could not create the model. Try again.');
  } finally {
    if(pendingModel?.token===token)pendingModel=null;
    if(token===fileVersion)refresh();
  }
}

on('choose-model','click',()=>chooseModel());
// Selecting another hand, foot or skin tone loads the corresponding model immediately.
on('model-area','change',()=>chooseModel());
on('model-tone','change',()=>chooseModel());

async function load(file) {
  if(!file)return;
  stopCamera();
  stopDetection();
  const token=++fileVersion;
  say('Opening photo…');
  try {
    const decoded=await decodePhoto(file);
    if(token!==fileVersion){decoded.bitmap.close();return;}
    stopDetection();
    photo?.close();photo=decoded.bitmap;photoBlob=decoded.blob;loadedId=null;matrix=null;
    state=empty(state.area);undo=[];redo=[];selection.clear();before=false;place=false;placingSequence=false;previewDraft=false;drag=null;
    $('advanced-nails').open=false;
    await scanPhoto();
  } catch(error){if(token===fileVersion){refresh();say(error.message);}}
}
function stopDetection() {
  detection?.abort();
  detection=null;scanning=false;canRetry=false;
}

async function scanPhoto() {
  if(!photo||scanning)return;
  const controller=new AbortController();
  detection=controller;scanning=true;canRetry=false;
  say('Finding nails on this device…');refresh();
  try {
    await afterPreview();
    if(controller.signal.aborted)return;
    const found=(await detectNails(photo,controller.signal)).filter(nail=>validQuad(nail.points));
    if(controller.signal.aborted)return;
    if(!found.length) {
      offerManual('No clear nails found.');
      return;
    }
    found.sort((a,b)=>a.centre.x-b.centre.x);
    state.auto=found.length;
    state.nails=Object.fromEntries(found.map((nail,i)=>['visible-'+i,{
      points:nail.points,mask:nail.mask,design:hasChosenStyle&&!pendingSelection?design():null,
    }]));
    placingSequence=place=false;drag=null;
    active='visible-0';selection=new Set(pendingSelection?[]:Object.keys(state.nails));undo=[];redo=[];
    if(pendingSelection)$('advanced-nails').open=true;
    say(found.length+(found.length===1?' nail found.':' nails found.')+
      (pendingSelection?' Choose nails, then Apply to selected nails.':' Choose a colour or style.'));
  } catch(error) {
    if(controller.signal.aborted)return;
    offerManual(error.name==='TimeoutError'?'Nail detection timed out.':'The nail finder could not load.');
  } finally {
    if(detection===controller){detection=null;scanning=false;refresh();}
  }
}
function offerManual(message) {
  canRetry=true;
  $('advanced-nails').open=true;
  say(message+' Place nails manually or find nails again.');
}
on('cancel-detection','click',()=>{
  stopDetection();
  offerManual('Nail detection cancelled.');
  refresh();
});
on('manual-nails','click',()=>{
  $('advanced-nails').open=true;
  active=nailsFor().find(nail=>!state.nails[nail.id])?.id||active;
  placingSequence=place=true;before=false;
  say('Tap the centre of each nail in the order shown.');
  refresh();
  canvas.scrollIntoView({block:'nearest'});
});
on('scan-again','click',scanPhoto);
on('advanced-nails','toggle',()=>{if(!$('advanced-nails').open)placingSequence=place=false;refresh();});
for(const id of ['upload','camera']){
  on(id,'click',()=>{if(!scanning)detectNails.prepare();});
  on(id,'change',event=>{load(event.target.files[0]);event.target.value='';});
}
let cameraStream=null,cameraRequest=0;
function stopCamera() {
  cameraRequest++;
  cameraStream?.getTracks().forEach(track=>track.stop());
  cameraStream=null;
  $('camera-video').srcObject=null;$('camera-preview').hidden=true;
}
on('camera-open','click',async()=>{
  if(!scanning)detectNails.prepare();
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
  const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
  frame.width=Math.round(video.videoWidth*scale);frame.height=Math.round(video.videoHeight*scale);
  frame.getContext('2d').drawImage(video,0,0,frame.width,frame.height);
  stopCamera();
  stopDetection();
  const token=++fileVersion;
  refresh();
  try{
    const file=await blobFromCanvas(frame,'image/jpeg',.93);
    if(token===fileVersion)await load(file);
  }catch{if(token===fileVersion)say('Could not capture a photo. Try again.');}
});
on('cancel-camera','click',stopCamera);
window.addEventListener('pagehide',stopCamera);
on('delete-photo','click',()=>{
  stopCamera();stopDetection();fileVersion++;photo?.close();photo=null;photoBlob=null;loadedId=null;drag=null;placingSequence=false;
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
on('area','change',event=>{
  const area=event.target.value;
  if(state.practiceTone || pendingModel?.token===fileVersion || (!photo && area!=='unspecified')){
    chooseModel(area);
    return;
  }
  change(()=>{
    const oldFoot=isFoot(state.area);
    state.area=area;
    if(state.auto)return;
    const allowed=new Set(nailsFor().map(n=>n.id));
    for(const id of Object.keys(state.nails)) if(oldFoot!==isFoot(area)||!allowed.has(id))delete state.nails[id];
    selection.clear();
  });
});
on('active-nail','change',event=>selectActive(event.target.value));
on('place','click',()=>{placingSequence=false;place=!place;before=false;say(place?'Tap the centre of the active nail on the photo.':'Placement cancelled.');refresh();});
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
  change(()=>{state.nails[active].points=points;delete state.nails[active].mask;});
});

function photoPoint(event) {
  const box=canvas.getBoundingClientRect();
  return matrix.inverse().transformPoint({x:(event.clientX-box.left)*canvas.width/box.width,y:(event.clientY-box.top)*canvas.height/box.height});
}
const inside=(point,points)=>points.every((a,i)=>{
  const b=points[(i+1)%4];return (b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x)>=0;
});
canvas.addEventListener('pointerdown',event=>{
  if(!matrix||before||scanning||!$('advanced-nails').open)return;
  const point=photoPoint(event);
  if(place){
    place=false;
    add(limits(point.x,0,photo.width),limits(point.y,0,photo.height));
    const next=placingSequence&&nailsFor().find(nail=>!state.nails[nail.id]);
    if(next){
      active=next.id;place=true;refresh();
      say('Outline placed. Tap '+next.name.toLowerCase()+' next, or finish placement to adjust outlines and apply colour.');
    } else placingSequence=false;
    return;
  }
  const nail=state.nails[active];
  const imageScale=Math.hypot(matrix.a,matrix.b)*canvas.clientWidth/canvas.width;
  const handle=nail?.points.findIndex(p=>Math.hypot(p.x-point.x,p.y-point.y)*imageScale<=16)??-1;
  const id=handle>=0?active:Object.keys(state.nails).reverse().find(key=>inside(point,state.nails[key].points));
  if(!id)return;
  event.preventDefault();
  const current=state.nails[id];
  selectActive(id,true);
  drag={id,point,handle,original:clone(current.points),mask:current.mask,previous:clone(state)};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  const point=photoPoint(event),dx=point.x-drag.point.x,dy=point.y-drag.point.y;
  const points=drag.original.map((p,i)=>drag.handle<0||drag.handle===i?{x:p.x+dx,y:p.y+dy}:p);
  if(validQuad(points)){
    const nail=state.nails[drag.id];
    nail.points=points;
    if(drag.mask&&drag.handle<0)nail.mask=drag.mask.map(([x,y,w,h])=>[x+dx,y+dy,w,h]);
    else if(dx||dy)delete nail.mask;
    drawPreview();
  }
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
on('clear-design','click',()=>{
  stopDetection();
  change(()=>{
    const {area,practiceTone}=state;
    state=empty(area);
    if(practiceTone)state.practiceTone=practiceTone;
    selection.clear();
  });
  canRetry=!!photo;refresh();
  say(photo?'Current design cleared. Use Find nails again to restart from this photo.':'Current design cleared.');
});
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
  rememberColour('recent',item);draftChanged();
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
function draftChanged() {
  hasChosenStyle=true;previewDraft=true;before=false;showShade();
  if(state.auto&&selection.size&&!pendingSelection) {
    const next=design();
    change(()=>{for(const id of selection)state.nails[id].design=clone(next);});
  } else refresh();
}
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
on('apply','click',()=>{pendingSelection=false;apply([...selection]);});
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
  const items=await savedLooks('nail');
  $('saved').replaceChildren(new Option('Choose a saved design',''),...items.map(item=>new Option(item.name,item.id)));
  $('saved').value=selected||'';
}
async function saveDesign(copy) {
  const token=fileVersion;
  try {
    const id=(!copy&&loadedId)||crypto.randomUUID(),name=$('design-name').value.trim()||'Nail design '+new Date().toLocaleDateString('en-ZA');
    const record={id,kind:'nail',name,updated:Date.now(),state:clone(state),notes:$('notes').value,photo:photoBlob};
    await designStore('readwrite',store=>store.put(record));
    if(token===fileVersion){
      loadedId=id;await updateList(id);
      if(token===fileVersion)say('Design saved on this device.');
    }
  } catch {if(token===fileVersion)say('The design could not be saved. Browser storage may be unavailable or full.');}
}
on('save','click',()=>saveDesign(false));
on('save-copy','click',()=>saveDesign(true));
async function restoreDesign(fromRoulette=false) {
  if(!$('saved').value){say('Choose a saved design first.');return;}
  stopCamera();stopDetection();
  const token=++fileVersion;
  refresh();
  try {
    const record=await designStore('readonly',store=>store.get($('saved').value));
    if(token!==fileVersion)return;
    if(!record||record.kind==='makeup')throw Error();
    const bitmap=await createImageBitmap(record.photo);
    if(token!==fileVersion){bitmap.close();return;}
    stopDetection();
    photo?.close();photo=bitmap;photoBlob=record.photo;state=record.state;loadedId=record.id;matrix=null;drag=null;placingSequence=false;
    $('design-name').value=record.name;$('notes').value=record.notes||'';
    undo=[];redo=[];selection=new Set(state.auto?Object.keys(state.nails):[]);before=false;place=false;previewDraft=false;
    if(fromRoulette&&incoming.apply==='all'){
      apply(Object.keys(state.nails));
    } else {
      if(fromRoulette&&pendingSelection){
        selection.clear();$('advanced-nails').open=true;say('Saved design opened. Choose nails, then Apply to selected nails.');
      } else say('Saved design opened.');
      refresh();
    }
  } catch {if(token===fileVersion)say('This saved design could not be opened.');}
}
on('restore','click',()=>restoreDesign());
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

const paletteReady=fetch('/data/nail-shades.json').then(response=>{
  if(!response.ok)throw Error();
  return response.json();
}).then(data=>{
  catalogue=data.shades;
  for(const [id,key] of [['category','category'],['shade-finish','finish']]){
    const values=[...new Set([...catalogue,...customs].map(item=>item[key]))].sort();
    for(const value of values)$(id).add(new Option(value,value));
  }
  const query=new URLSearchParams(location.search);
  const incomingShade=catalogue.find(row=>row.code===query.get('code')&&row.brand===query.get('brand')
    &&(!query.has('collection')||row.collection===query.get('collection')));
  if(incomingShade)pick(incomingShade);
  palette();
}).catch(()=>{palette();say('Supplier palette unavailable. Custom colours still work.');});
Promise.all([updateList(),paletteReady]).then(()=>{
  const id=new URLSearchParams(location.search).get('saved');
  if(!id)return;
  $('saved').value=id;
  if($('saved').value)return restoreDesign(!!incoming.apply);
  else say('This look is unavailable in this browser.');
}).catch(()=>say('Local design storage is unavailable in this browser.'));

palette();renderSavedColours();refresh();
