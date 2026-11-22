import { decodePhoto, blobFromCanvas } from '/nail-lab/storage.js';
import { download, putLook, savedLook, shareCanvas, styleParams, wa } from '/playground/shared.js';
import { photoDetector, afterPreview } from '/playground/photo-detector.js';
import { renderFace, manualLandmarks, presets, zones } from './render.js';

const $=id=>document.getElementById(id);
const status=text=>$('makeup-status').textContent=text;
const params=styleParams();
let photo=null, blob=null, landmarks=[], loaded=null, job=0, original=false, frame=0, detection=null, anchors=null, adjusting=false;
let preset=params.look?.makeup||'muse', layers=structuredClone(presets[preset].layers);
if(params.tint)layers.eyes.colour=params.tint;
if(params.colour)layers[params.layer].colour=params.colour;
const canvas=$('makeup-preview'), layerFields={};

const findFace=photoDetector(new URL('./face-worker.js',import.meta.url));
// Warm the on-device landmark worker as soon as the customer interacts.
for (const id of ['selfie','selfie-camera','selfie-live']) {
  $(id).addEventListener('pointerdown',()=>findFace.prepare(),{once:true});
}


function draw() {
  if(!photo)return;
  renderFace(canvas,photo,landmarks,layers,original);
  const reveal=Number($('makeup-split').value);
  if(reveal&&!original) {
    const ctx=canvas.getContext('2d');
    const width=canvas.width*reveal/100;
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,canvas.height);ctx.clip();
    ctx.drawImage(photo,0,0,canvas.width,canvas.height);ctx.restore();
    ctx.fillStyle='#fffaf7';
    if(reveal<100)ctx.fillRect(width-1,0,2,canvas.height);
  }
  if(adjusting){
    const ctx=canvas.getContext('2d'), index=Number($('face-feature').value);
    anchors.forEach(({x,y},i)=>{
      ctx.beginPath();
      ctx.arc(x*canvas.width,y*canvas.height,Math.max(5,canvas.width*.012),0,2*Math.PI);
      ctx.lineWidth=Math.max(2,canvas.width*.003);
      ctx.strokeStyle=i===index?'#fff':'#553248';
      ctx.stroke();
    });
  }
  canvas.style.maxWidth=(70*canvas.width/canvas.height)+'vh';
}

function queue() {
  if(frame)return;
  frame=requestAnimationFrame(()=>{frame=0;draw();});
}

function refresh() {
  canvas.hidden=!photo;$('empty-selfie').hidden=!!photo;
  $('makeup-before').disabled=!photo;$('delete-selfie').disabled=!photo;
  $('makeup-split').disabled=!landmarks.length;
  for(const id of ['save-makeup','download-makeup','share-makeup'])$(id).disabled=!photo;
  $('face-retry').hidden=!photo||!!detection;
  $('face-manual').hidden=!photo||adjusting;
  $('face-controls').hidden=!adjusting;
  canvas.classList.toggle('mapping',adjusting);
  $('makeup-before').setAttribute('aria-pressed',String(original));
  $('makeup-before').textContent=original?'Show makeup':'Show original';
  const description=Object.entries(zones).filter(([id])=>layers[id]?.strength)
    .map(([id,name])=>name+' '+layers[id].colour).join(', ');
  $('makeup-wa').href=wa('Hello Jeanrie, I would like to enquire about makeup. My look: '+
    (description||'please help me choose')+'. Please confirm availability.');
  queue();
}

function syncFields() {
  for(const [id,fields] of Object.entries(layerFields)) {
    fields.colour.value=layers[id].colour;
    fields.power.value=layers[id].strength || 50;
    fields.check.checked=!!layers[id].strength;
  }
}

for(const [id,look] of Object.entries(presets))$('makeup-preset').add(new Option(look.name,id));
$('makeup-preset').value=preset;
for(const [id,name] of Object.entries(zones)) {
  const row=document.createElement('fieldset'), legend=document.createElement('legend');
  legend.textContent=name;
  const check=document.createElement('input'), colour=document.createElement('input'), power=document.createElement('input');
  check.type='checkbox';colour.type='color';power.type='range';power.min='1';power.max='100';
  for(const [input,text] of [[check,'Show '+name.toLowerCase()],[colour,name+' colour'],[power,name+' intensity']]) {
    const label=document.createElement('label');label.append(text,input);row.append(label);
    input.addEventListener('input',()=>{
      layers[id]={colour:colour.value,strength:check.checked?Number(power.value):0};
      original=false;refresh();
    });
  }
  row.prepend(legend);$('makeup-layers').append(row);
  layerFields[id]={check,colour,power};
}

function stopDetection(){
  detection?.abort();
  detection=null;
}

async function scanFace(){
  if(!photo||detection)return;
  const controller=new AbortController();
  detection=controller;
  status('Scanning eyes, lips, brows and facial contours on this device…');refresh();
  try {
    await afterPreview();
    if(controller.signal.aborted)return;
    const features=await findFace(photo,controller.signal);
    if(controller.signal.aborted)return;
    if(features.length>=468){
      landmarks=features;anchors=null;adjusting=false;
      status('Face mapped. Makeup colours and styles now update instantly.');
    }else status('No clear face found. Adjust makeup placement or find face again.');
  }catch(error){
    if(controller.signal.aborted)return;
    status((error.name==='TimeoutError'?'Face detection timed out.':'Face detection could not load.')+
      ' Adjust makeup placement or find face again.');
  }finally{
    if(detection===controller){detection=null;refresh();}
  }
}

function beginPhoto(){
  stopCamera();stopDetection();
  status('Opening selfie…');refresh();
  return ++job;
}

async function load(file,version){
  if(!file)return;
  version??=beginPhoto();
  try {
    const result=await decodePhoto(file);
    if(version!==job){result.bitmap.close();return;}
    // A retry on the previous preview may have started during decoding.
    stopDetection();
    photo?.close();photo=result.bitmap;blob=result.blob;
    landmarks=[];loaded=null;original=false;anchors=null;adjusting=false;
    $('makeup-split').value=0;refresh();
    await scanFace();
  }catch(error){if(version===job)status(error.message);}
}

for(const id of ['selfie','selfie-camera'])$(id).addEventListener('change',e=>{load(e.target.files[0]);e.target.value='';});
let stream=null,cameraRequest=0;
function stopCamera(){
  cameraRequest++;
  stream?.getTracks().forEach(track=>track.stop());
  stream=null;
  $('selfie-video').srcObject=null;$('selfie-camera-preview').hidden=true;
}
$('selfie-live').addEventListener('click',async()=>{
  stopCamera();
  const request=cameraRequest;
  try{
    const camera=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'}},audio:false});
    if(request!==cameraRequest){camera.getTracks().forEach(track=>track.stop());return;}
    stream=camera;$('selfie-video').srcObject=stream;$('selfie-camera-preview').hidden=false;
    status('Frame your face and choose Capture selfie.');
  }catch{if(request===cameraRequest)status('Live camera unavailable. Open device camera or choose a selfie.');}
});
$('selfie-camera-close').addEventListener('click',stopCamera);
window.addEventListener('pagehide',stopCamera);
$('selfie-capture').addEventListener('click',async()=>{
  const video=$('selfie-video');
  if(!video.videoWidth){status('Wait for the camera preview to load.');return;}
  const captured=document.createElement('canvas');
  const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));
  captured.width=Math.round(video.videoWidth*scale);captured.height=Math.round(video.videoHeight*scale);
  captured.getContext('2d').drawImage(video,0,0,captured.width,captured.height);
  const version=beginPhoto();
  try{
    const file=await blobFromCanvas(captured,'image/jpeg',.93);
    if(version===job)await load(file,version);
  }catch{if(version===job)status('Could not capture a selfie. Try again.');}
});
$('face-retry').addEventListener('click',scanFace);
const feature=()=>Number($('face-feature').value);
function syncAnchor(){
  const point=anchors[feature()];
  $('face-x').value=100*point.x;$('face-y').value=100*point.y;
  queue();
}
function updateAnchors(){
  stopDetection();
  const features=manualLandmarks(anchors,photo.width,photo.height);
  if(!features.length){
    status('Position the eye on the left before the eye on the right.');
    refresh();return;
  }
  landmarks=features;
  original=false;$('makeup-split').value=0;
  status('Placement updated. Choose a look or adjust individual layers.');
  refresh();
}
$('face-manual').addEventListener('click',()=>{
  stopDetection();
  const midpoint=(a,b)=>({x:(landmarks[a].x+landmarks[b].x)/2,y:(landmarks[a].y+landmarks[b].y)/2});
  anchors??=landmarks.length?[midpoint(33,133),midpoint(362,263),midpoint(0,17)]:
    [{x:.38,y:.42},{x:.62,y:.42},{x:.5,y:.62}];
  adjusting=true;syncAnchor();
  if(landmarks.length)refresh();
  else updateAnchors();
  canvas.scrollIntoView({block:'nearest'});
});
$('face-done').addEventListener('click',()=>{adjusting=false;refresh();});
$('face-feature').addEventListener('change',syncAnchor);
for(const axis of ['x','y'])$('face-'+axis).addEventListener('input',event=>{
  anchors[feature()][axis]=Number(event.target.value)/100;updateAnchors();
});
canvas.addEventListener('click',event=>{
  if(!adjusting)return;
  const box=canvas.getBoundingClientRect();
  anchors[feature()]={x:(event.clientX-box.left)/box.width,y:(event.clientY-box.top)/box.height};
  updateAnchors();
  $('face-feature').value=(feature()+1)%anchors.length;
  syncAnchor();
});
$('makeup-preset').addEventListener('change',e=>{
  preset=e.target.value;layers=structuredClone(presets[preset].layers);original=false;syncFields();refresh();
});
$('makeup-split').addEventListener('input',()=>{original=false;refresh();});
$('makeup-before').addEventListener('click',()=>{original=!original;refresh();});
$('remove-makeup').addEventListener('click',()=>{for(const id of Object.keys(layers))layers[id].strength=0;syncFields();refresh();});
$('delete-selfie').addEventListener('click',()=>{
  job++;stopCamera();stopDetection();photo?.close();photo=null;blob=null;landmarks=[];loaded=null;anchors=null;adjusting=false;
  canvas.width=1;canvas.height=1;refresh();status('Current selfie deleted.');
});
$('save-makeup').addEventListener('click',async()=>{
  try {
    const version=job;
    const id=loaded||crypto.randomUUID(),name=$('makeup-name').value.trim()||presets[preset].name;
    await putLook({id,kind:'makeup',name,updated:Date.now(),photo:blob,landmarks,anchors,layers:structuredClone(layers),preset});
    if(version===job){loaded=id;status('Makeup look saved on this device.');}
  }catch{status('The look could not be saved on this device.');}
});
function exportCanvas() {
  const output=document.createElement('canvas');renderFace(output,photo,landmarks,layers);return output;
}
$('download-makeup').addEventListener('click',async()=>{
  try{download(await blobFromCanvas(exportCanvas(),'image/png'),'jeanrie-makeup.png');status('Makeup image downloaded.');}
  catch{status('The image could not be exported.');}
});
$('share-makeup').addEventListener('click',async()=>{
  try{status(await shareCanvas(exportCanvas(),'Jeanrie’s Makeup Studio','jeanrie-makeup.png'));}
  catch(error){if(error.name!=='AbortError')status('Sharing did not complete. Download the image to attach it manually.');}
});
const saved=new URLSearchParams(location.search).get('saved');
const savedVersion=job;
if(saved)savedLook(saved).then(async record=>{
  if(savedVersion!==job)return;
  if(!record||record.kind!=='makeup'){status('This look is unavailable in this browser.');return;}
  const bitmap=await createImageBitmap(record.photo);
  if(savedVersion!==job){bitmap.close();return;}
  photo?.close();photo=bitmap;blob=record.photo;landmarks=record.landmarks;anchors=record.anchors||null;layers=record.layers;loaded=record.id;preset=record.preset;
  $('makeup-name').value=record.name;$('makeup-preset').value=preset;syncFields();refresh();status('Saved makeup look opened.');
}).catch(()=>{if(savedVersion===job)status('This look could not be opened.');});
syncFields();refresh();
