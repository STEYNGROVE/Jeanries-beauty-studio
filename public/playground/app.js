import { decodePhoto, blobFromCanvas } from '/nail-lab/storage.js';
import { draw } from '/nail-lab/paint.js';
import { renderFace } from '/makeup-studio/render.js';
import { deleteLook, download, looks, savedLook, savedLooks, shareCanvas, studioLinks, wa } from './shared.js';

const $=id=>document.getElementById(id);
const on=(id,type,handler)=>$(id).addEventListener(type,handler);
const say=(id,text)=>$(id).textContent=text;
const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
const random=length=>Math.floor(Math.random()*length);
const pick=rows=>rows[random(rows.length)];
const buttons=(root, links)=>{
  const row=element('div');row.className='lab-row';
  for(const [text,href] of links){const a=element('a',text);a.href=href;a.className='lab-action';row.append(a);}
  root.append(row);
};
function renderSuggestion(id,key,text,tint) {
  const node=$(id), link=studioLinks(key,tint);
  node.replaceChildren(element('p',text));
  buttons(node,[['Try on nails',link.nail],['Try on makeup',link.makeup]]);
}
function localRead(key,fallback) {
  try{return JSON.parse(localStorage.getItem('jeanrie-play-'+key))??fallback;}catch{return fallback;}
}
function localWrite(key,value) {
  try{localStorage.setItem('jeanrie-play-'+key,JSON.stringify(value));return true;}catch{return false;}
}

const lookKeys=Object.keys(looks);
let lastSpin='';
on('spin-look','click',()=>{
  lastSpin=pick(lookKeys.filter(key=>key!==lastSpin));
  renderSuggestion('roulette-result',lastSpin,'Your spin: '+looks[lastSpin].name+'.');
});

function selectRows(id,rows) {
  const control=$(id), current=control.value;
  control.replaceChildren(new Option('Choose a saved look',''),...rows.map(item=>new Option(item.name,item.id)));
  if(rows.some(item=>item.id===current))control.value=current;
}
async function refreshLibrary() {
  const rows=await savedLooks();
  const nail=rows.filter(item=>!item.kind||item.kind==='nail');
  for(const id of ['battle-a','battle-b'])selectRows(id,nail);
  for(const id of ['glam-look','reveal-look'])selectRows(id,rows);
  const list=$('look-library');
  list.replaceChildren();
  for(const item of rows) {
    const li=element('li');
    const link=element('a',item.name);
    link.href=(item.kind==='makeup'?'/makeup-studio/':'/nail-lab/')+'?saved='+encodeURIComponent(item.id);
    const remove=element('button','Delete');
    remove.type='button';remove.setAttribute('aria-label','Delete '+item.name);
    remove.addEventListener('click',async()=>{
      try{await deleteLook(item.id);await refreshLibrary();say('library-status','Look and photo deleted.');}
      catch{say('library-status','This look could not be deleted.');}
    });
    li.append(link,' · '+(item.kind==='makeup'?'Makeup':'Nails')+' ',remove);list.append(li);
  }
  if(!rows.length)list.append(element('li','You haven’t saved any looks in this browser yet.'));
}
refreshLibrary().catch(()=>say('library-status','Saved looks could not be opened in this browser.'));

async function card(record,before=false) {
  if(!record)throw new Error('Choose a saved look first.');
  const canvas=document.createElement('canvas'), photo=await createImageBitmap(record.photo);
  try{
    if(record.kind==='makeup')renderFace(canvas,photo,record.landmarks,record.layers,before);
    else draw(canvas,photo,record.state,{before});
  }finally{photo.close();}
  return canvas;
}
function contain(ctx,image,x,y,width,height) {
  const scale=Math.min(width/image.width,height/image.height);
  const w=image.width*scale,h=image.height*scale;
  ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);
}
on('compare-nails','click',async()=>{
  const a=$('battle-a').value,b=$('battle-b').value;
  if(!a||!b||a===b){say('battle-status','Choose two different nail designs.');return;}
  try{
    const records=await Promise.all([savedLook(a),savedLook(b)]);
    const [left,right]=await Promise.all(records.map(record=>card(record)));
    const output=$('battle-preview');output.width=1200;output.height=720;
    const ctx=output.getContext('2d');ctx.fillStyle='#f7f0e9';ctx.fillRect(0,0,1200,720);
    contain(ctx,left,14,14,579,632);contain(ctx,right,607,14,579,632);
    ctx.fillStyle='#653b60';ctx.font='24px sans-serif';ctx.textAlign='center';
    ctx.fillText(records[0].name,304,686,540);ctx.fillText(records[1].name,894,686,540);
    output.hidden=false;$('share-battle').disabled=false;say('battle-status','Comparison ready.');
  }catch(error){say('battle-status',error.message||'The comparison could not be created.');}
});
on('share-battle','click',async()=>{
  try{say('battle-status',await shareCanvas($('battle-preview'),'Jeanrie’s Nail Battle','jeanrie-nail-battle.png'));}
  catch(error){if(error.name!=='AbortError')say('battle-status','Could not share the comparison.');}
});

on('bestie-plan','click',()=>{
  const occasion=$('bestie-event').value, style=$('bestie-style').value, quick=$('bestie-time').value==='quick';
  const byStyle={Natural:'peach',Romantic:'berry',Bold:'midnight'};
  const key=occasion==='Wedding'&&style!=='Bold'?'champagne':occasion==='Work'&&style!=='Bold'?'muse':byStyle[style];
  const note=quick?'Try one main colour with a simple accent.':'Try the paired studios and save a before-and-after to discuss with Jeanrie.';
  renderSuggestion('bestie-result',key,looks[key].name+' for '+occasion.toLowerCase()+'. '+note);
});

const passport=localRead('passport',{count:0,goal:5,reward:''});
function updatePassport() {
  $('passport-goal').value=passport.goal;
  $('passport-reward').value=passport.reward;
  $('passport-progress').max=passport.goal;$('passport-progress').value=Math.min(passport.count,passport.goal);
  say('passport-count',passport.count+' local visits logged · goal '+passport.goal+'.');
  $('passport-wa').href=wa('Hello Jeanrie, could you explain the studio loyalty rewards?'+
    (passport.reward?' I am interested in '+passport.reward+'.':''));
  localWrite('passport',passport);
}
on('passport-goal','change',e=>{passport.goal=Math.max(1,Math.min(30,Math.round(Number(e.target.value)||5)));updatePassport();});
on('passport-reward','change',e=>{passport.reward=e.target.value.trim();updatePassport();});
on('add-visit','click',()=>{passport.count++;updatePassport();});
on('reset-visits','click',()=>{passport.count=0;updatePassport();});
updatePassport();

let products=[];
fetch('/data/catalogue.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  products=data.products;
  for(const tag of [...new Set(products.map(item=>item.category))].sort())$('box-category').add(new Option(tag,tag));
}).catch(()=>say('box-result','The catalogue is temporarily unavailable.'));
on('open-box','click',()=>{
  const category=$('box-category').value;
  const pool=products.filter(item=>!category||item.category===category);
  if(!pool.length){say('box-result','No products are available in this category.');return;}
  const selected=[];
  while(selected.length<3&&pool.length)selected.push(pool.splice(random(pool.length),1)[0]);
  const list=element('ul');
  for(const item of selected){
    const entry=element('li'),link=element('a',item.name);
    link.href='/concierge#product-'+encodeURIComponent(item.id);entry.append(link);list.append(entry);
  }
  const result=$('box-result');result.replaceChildren(list);
  buttons(result,[['Ask about this box',wa('Hello Jeanrie, could you confirm prices and availability for my Mystery Beauty Box? '+selected.map(p=>p.name).join(', ')+'.')]]);
});

let outfitJob=0;
on('outfit-photo','change',async e=>{
  const file=e.target.files[0];e.target.value='';
  if(!file)return;
  const job=++outfitJob;
  say('outfit-status','Sampling colours on this device…');
  try{
    const {bitmap}=await decodePhoto(file);
    let colour;
    try{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const size=Math.min(bitmap.width,bitmap.height)*.65;
      ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,64,64);
      const pixels=ctx.getImageData(0,0,64,64).data, bins=new Map();
      for(let i=0;i<pixels.length;i+=4){
        const rgb=[pixels[i],pixels[i+1],pixels[i+2]];
        if(pixels[i+3]<160)continue;
        const key=rgb.map(n=>Math.floor(n/32)).join('-');
        const bin=bins.get(key)||[0,0,0,0];bin[0]++;rgb.forEach((value,i)=>bin[i+1]+=value);bins.set(key,bin);
      }
      if(!bins.size)throw Error('Choose a photo with visible fabric.');
      const best=[...bins.values()].sort((a,b)=>b[0]-a[0])[0];
      colour='#'+best.slice(1).map(n=>Math.round(n/best[0]).toString(16).padStart(2,'0')).join('');
    }finally{bitmap.close();}
    if(job!==outfitJob)return;
    const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
    const channels=rgb(colour);
    const closest=lookKeys.reduce((best,key)=>{
      const dist=item=>rgb(looks[item].colour).reduce((total,value,i)=>total+(value-channels[i])**2,0);
      return dist(key)<dist(best)?key:best;
    });
    renderSuggestion('outfit-result',closest,looks[closest].name+' with an accent sampled from your photo.',colour);
    const swatch=element('span');swatch.className='play-chip';swatch.style.backgroundColor=colour;
    swatch.setAttribute('aria-hidden','true');$('outfit-result').prepend(swatch,document.createTextNode(colour+' '));
    say('outfit-status','Colour match ready.');
  }catch(error){if(job===outfitJob)say('outfit-status',error.message);}
});

fetch('/data/glam-wall.json').then(response=>{
  if(!response.ok)throw Error();
  return response.json();
}).then(data=>{
  const wall=$('public-glam-wall');
  const entries=data.entries.filter(item=>item.state==='approved'&&item.publicationConsent===true&&
    /^\/glam-gallery\/[a-z0-9-]+\.(?:jpg|png|webp)$/.test(item.image));
  wall.replaceChildren();
  if(!entries.length)wall.append(element('p','Approved customer looks will appear here.'));
  for(const item of entries) {
    const figure=element('figure'),image=element('img');
    image.src=item.image;image.alt=item.alt;image.loading='lazy';image.decoding='async';
    figure.append(image,element('figcaption',item.title));
    wall.append(figure);
  }
}).catch(()=>say('public-glam-wall','The gallery is temporarily unavailable.'));

function glamState() {
  $('prepare-glam').disabled=!$('glam-consent').checked||!$('glam-look').value;
  $('glam-wa').hidden=true;
}
on('glam-consent','change',glamState);on('glam-look','change',glamState);
on('prepare-glam','click',async()=>{
  if(!$('glam-consent').checked)return;
  const id=$('glam-look').value;
  try{
    const item=await savedLook(id),image=await card(item);
    if(!$('glam-consent').checked||$('glam-look').value!==id)return;
    download(await blobFromCanvas(image,'image/png'),'jeanrie-glam-review.png');
    $('glam-wa').href=wa('Hello Jeanrie, I have permission to share my look '+item.name+
      ' with you for review. Please ask me before publishing it. I will attach the image in WhatsApp.');
    $('glam-wa').hidden=false;
    say('glam-status','Review image ready. Attach the download to your WhatsApp enquiry.');
  }catch{say('glam-status','The review image could not be prepared.');}
});

const daysize=86_400_000;
function today() {
  const date=new Date();
  return Date.UTC(date.getFullYear(),date.getMonth(),date.getDate());
}
function showEvent(name,date) {
  const end=Date.parse(date+'T00:00:00Z'),remaining=Math.round((end-today())/daysize);
  const node=$('event-plan');
  if(!Number.isFinite(remaining)||remaining<0){node.textContent='Choose today or a future date.';return;}
  node.replaceChildren(element('p',(name||'Your event')+' · '+(remaining===0?'today':remaining+' days left')));
  const phases=[['Choose a look',14],['Ask Jeanrie about appointment availability',7],['Confirm your design and timing',2]];
  const list=element('ol');
  for(const [task,before] of phases){
    const when=new Date(Math.max(today(),end-daysize*before));
    const formatted=new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeZone:'UTC'}).format(when);
    list.append(element('li',formatted+' · '+task));
  }
  node.append(list);
  buttons(node,[['Ask about my event',wa('Hello Jeanrie, may I enquire about a beauty appointment for '+(name||'my event')+' on '+date+'?')]]);
}
const priorEvent=localRead('event',null);
if(priorEvent){$('event-name').value=priorEvent.name;$('event-date').value=priorEvent.date;showEvent(priorEvent.name,priorEvent.date);}
on('plan-event','click',()=>{
  const name=$('event-name').value.trim(),date=$('event-date').value;
  if(Date.parse(date+'T00:00:00Z')>=today())localWrite('event',{name,date});
  showEvent(name,date);
});
on('clear-event','click',()=>{localWrite('event',null);$('event-name').value='';$('event-date').value='';say('event-plan','Event cleared.');});

fetch('/data/nail-shades.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
  const eligible=data.shades.filter(shade=>!['Unavailable','Discontinued'].includes(shade.availability));
  if(!eligible.length){say('weekly-shade','No featured shade is available.');return;}
  const week=Math.floor((today()+3*daysize)/(7*daysize));
  const shade=eligible[week%eligible.length];
  const node=$('weekly-shade'),chip=element('span');chip.className='play-chip';chip.style.backgroundColor=shade.colour;chip.setAttribute('aria-hidden','true');
  node.append(chip,element('strong',shade.name+' · '+shade.brand+' '+shade.code),
    element('p','Supplier listing verified '+shade.verifiedOn+'. Preview colour is illustrative.'));
  const q=new URLSearchParams({brand:shade.brand,code:shade.code,collection:shade.collection});
  buttons(node,[['Try this shade','/nail-lab/?'+q],['Supplier listing',shade.source]]);
}).catch(()=>say('weekly-shade','The verified palette could not be loaded.'));

function gift() {
  const name=$('gift-name').value.trim(),message=$('gift-message').value.trim();
  const raw=Number($('gift-amount').value),amount=$('gift-amount').checkValidity()&&raw>0?'R'+raw.toLocaleString('en-ZA'):'';
  $('gift-wa').href=wa(['Hello Jeanrie, I would like to enquire about a digital gift card.',
    name&&'Recipient: '+name,amount&&'Proposed amount: '+amount,message&&'Message: '+message,
    'Please confirm the terms and how to purchase.'].filter(Boolean).join('\n'));
}
for(const id of ['gift-name','gift-amount','gift-message'])on(id,'input',gift);
gift();

const lessons={
  nails:{name:'Photograph your nails',url:'/nail-lab/',steps:[
    'Photograph your hand or foot in even, indirect light.',
    'Separate fingers or toes and keep the camera directly above the nails.',
    'Upload the photo and try a colour. Use Before and After to compare.']},
  makeup:{name:'Build a soft makeup look',url:'/makeup-studio/',steps:[
    'Start with an evenly lit, front-facing selfie.',
    'Choose Soft Rose or Bare Glow. Adjust the lip and blush intensity independently.',
    'Switch each layer off and on to see which details you want to keep.']},
  accents:{name:'Design an accent nail',url:'/nail-lab/',steps:[
    'Apply one base colour to all detected nails.',
    'Open Nail selection and placement and select one nail.',
    'Add a contrasting detail colour and choose Accent gems or another style.']},
};
let step=0;
function tutorial() {
  const lesson=lessons[$('lesson').value];
  say('lesson-step','Step '+(step+1)+' of '+lesson.steps.length+' · '+lesson.steps[step]);
  $('lesson-prev').disabled=step===0;$('lesson-next').disabled=step===lesson.steps.length-1;
  $('lesson-studio').href=lesson.url;
}
for(const [id,lesson] of Object.entries(lessons))$('lesson').add(new Option(lesson.name,id));
on('lesson','change',()=>{step=0;tutorial();});
on('lesson-prev','click',()=>{step--;tutorial();});on('lesson-next','click',()=>{step++;tutorial();});
tutorial();

let comparison;
function renderReveal() {
  if(!comparison)return;
  const [before,after]=comparison,canvas=$('reveal-preview');
  canvas.width=after.width;canvas.height=after.height;
  const ctx=canvas.getContext('2d'),width=canvas.width*Number($('reveal-split').value)/100;
  ctx.drawImage(after,0,0);
  ctx.save();ctx.beginPath();ctx.rect(0,0,width,canvas.height);ctx.clip();ctx.drawImage(before,0,0);ctx.restore();
  if(width>0&&width<canvas.width){ctx.fillStyle='#fffaf7';ctx.fillRect(width-1,0,2,canvas.height);}
}
on('show-reveal','click',async()=>{
  try{
    const item=await savedLook($('reveal-look').value);
    comparison=await Promise.all([card(item,true),card(item)]);
    for(const id of ['reveal-split','download-reveal','share-reveal'])$(id).disabled=false;
    $('reveal-preview').hidden=false;renderReveal();say('reveal-status','Comparison ready. Move the slider to change the reveal.');
  }catch(error){say('reveal-status',error.message||'The look could not be opened.');}
});
on('reveal-split','input',renderReveal);
on('download-reveal','click',async()=>{
  try{download(await blobFromCanvas($('reveal-preview'),'image/png'),'jeanrie-beauty-reveal.png');say('reveal-status','Reveal downloaded.');}
  catch{say('reveal-status','Could not download the reveal.');}
});
on('share-reveal','click',async()=>{
  try{say('reveal-status',await shareCanvas($('reveal-preview'),'Jeanrie’s Before & After','jeanrie-beauty-reveal.png'));}
  catch(error){if(error.name!=='AbortError')say('reveal-status','Could not share the reveal.');}
});
