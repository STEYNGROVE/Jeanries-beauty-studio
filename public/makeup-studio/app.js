import { decodePhoto, blobFromCanvas } from '/nail-lab/storage.js';
import { download, putLook, savedLook, shareCanvas, styleParams, wa } from '/playground/shared.js';
import { renderFace, presets, zones } from './render.js';

const $=id=>document.getElementById(id);
const status=text=>$('makeup-status').textContent=text;
const params=styleParams();
let photo=null, blob=null, landmarks=[], loaded=null, job=0, original=false, frame=0, detector;
let preset=params.look?.makeup||'muse', layers=structuredClone(presets[preset].layers);
if(params.tint)layers.eyes.colour=params.tint;
if(params.colour)layers[params.layer].colour=params.colour;
const canvas=$('makeup-preview'), layerFields={};

async function findFace(bitmap) {
  const base='/makeup-studio/models';
  detector ??= import(base+'/vision_bundle.mjs').then(async module=>{
    const files=await module.FilesetResolver.forVisionTasks(base);
    return module.FaceLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:base+'/face-landmarker.task',delegate:'CPU'},
      runningMode:'IMAGE',numFaces:1,minFaceDetectionConfidence:.55,minFacePresenceConfidence:.55,
    });
  }).catch(error=>{detector=null;throw error;});
  const model=await detector;
  return model.detect(bitmap).faceLandmarks[0]||[];
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
  for(const id of ['save-makeup','download-makeup','share-makeup'])$(id).disabled=!landmarks.length;
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

async function load(file) {
  if(!file)return;
  const version=++job;
  status('Opening selfie…');
  try {
    const result=await decodePhoto(file);
    if(version!==job){result.bitmap.close();return;}
    photo?.close();photo=result.bitmap;blob=result.blob;landmarks=[];loaded=null;original=false;
    $('makeup-split').value=0;refresh();
    status('Finding facial features on this device…');
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const features=await findFace(photo);
    if(version!==job)return;
    landmarks=features;
    status(landmarks.length?'Face found. Choose a look or adjust individual layers.':'No clear face found. Try a front-facing selfie in better light.');
    refresh();
  }catch(error){
    if(version===job)status(error.message.includes('Choose')||error.message.includes('photo')?error.message:'Face preview could not load. Try again in a current browser.');
  }
}

for(const id of ['selfie','selfie-camera'])$(id).addEventListener('change',e=>{load(e.target.files[0]);e.target.value='';});
$('makeup-preset').addEventListener('change',e=>{
  preset=e.target.value;layers=structuredClone(presets[preset].layers);original=false;syncFields();refresh();
});
$('makeup-split').addEventListener('input',()=>{original=false;refresh();});
$('makeup-before').addEventListener('click',()=>{original=!original;refresh();});
$('remove-makeup').addEventListener('click',()=>{for(const id of Object.keys(layers))layers[id].strength=0;syncFields();refresh();});
$('delete-selfie').addEventListener('click',()=>{
  job++;photo?.close();photo=null;blob=null;landmarks=[];loaded=null;
  canvas.width=1;canvas.height=1;refresh();status('Current selfie deleted.');
});
$('save-makeup').addEventListener('click',async()=>{
  try {
    const id=loaded||crypto.randomUUID(),name=$('makeup-name').value.trim()||presets[preset].name;
    await putLook({id,kind:'makeup',name,updated:Date.now(),photo:blob,landmarks,layers:structuredClone(layers),preset});
    loaded=id;status('Makeup look saved on this device.');
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
if(saved)savedLook(saved).then(async record=>{
  if(!record||record.kind!=='makeup'){status('This look is unavailable in this browser.');return;}
  const version=++job;
  const bitmap=await createImageBitmap(record.photo);
  if(version!==job){bitmap.close();return;}
  photo=bitmap;blob=record.photo;landmarks=record.landmarks;layers=record.layers;loaded=record.id;preset=record.preset;
  $('makeup-name').value=record.name;$('makeup-preset').value=preset;syncFields();refresh();status('Saved makeup look opened.');
}).catch(()=>status('This look could not be opened.'));
syncFields();refresh();
