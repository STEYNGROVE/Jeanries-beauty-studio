import { customNails } from '/nail-lab/palette.js';
import { readList, writeList } from '/nail-lab/storage.js';
import { presets } from '/makeup-studio/render.js';
import { looks, savedLooks } from './shared.js';

import { uniformIndex, spinDestination, wrapAngle } from './wheel-math.js';
const maxSegments = 12;
const isHex = value => /^#[0-9a-f]{6}$/i.test(value || '');
const label = row => [row.name, row.brand, row.code].filter(Boolean).join(' · ');
const byId = id => document.getElementById(id);

function element(tag,text,className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function swatch(row) {
  const chip = element('span','', 'play-chip');
  chip.style.backgroundColor = row.colour;
  chip.setAttribute('aria-hidden','true');
  return chip;
}

function customMakeup(layer) {
  const unique = new Map();
  for (const preset of Object.values(presets)) {
    const colour = preset.layers[layer].colour;
    if (!unique.has(colour)) unique.set(colour,{name:preset.name,brand:'Custom studio colour',colour,layer});
  }
  return [...unique.values()];
}

async function catalogue(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Catalogue unavailable');
  const data = await response.json();
  return data.shades;
}

const hosts = {
  'Crystal Clawz': ['crystalclawz.co.za','www.crystalclawz.co.za'],
  'Gel-It': ['maskscara.com','www.maskscara.com'],
  'Justine': ['justine.co.za','www.justine.co.za','my.justine.co.za'],
};

function officialSource(row) {
  try {
    const url=new URL(row.source);
    return url.protocol==='https:'&&!url.username&&!url.password&&hosts[row.brand]?.includes(url.hostname);
  } catch { return false; }
}

function verified(rows, allowedBrands) {
  return rows.filter(row => allowedBrands.includes(row.brand) && row.name && row.code && isHex(row.colour) &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.verifiedOn || '') && officialSource(row) &&
    !['Unavailable','Discontinued'].includes(row.availability));
}

export function mountRoulette() {
  const category=byId('roulette-category'), wheel=byId('roulette-wheel'), button=byId('spin-look');
  const result=byId('roulette-result'), status=byId('roulette-status'), legend=byId('roulette-legend'), pool=byId('roulette-pool');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let choices=[], groups=[], rotation=0, spinning=false, nailRows, makeupRows;
  const pools = () => ({
    looks:Object.entries(looks).map(([look,row])=>({look,name:row.name,colour:row.colour})),
    nails:[...(nailRows || []),...customNails],
    crystal:(nailRows || []).filter(row=>row.brand==='Crystal Clawz'),
    gel:(nailRows || []).filter(row=>row.brand==='Gel-It'),
    justine:makeupRows || [],
    lips:[...(makeupRows || []).filter(row=>row.layer==='lips'),...customMakeup('lips')],
    eyes:[...(makeupRows || []).filter(row=>row.layer==='eyes'),...customMakeup('eyes')],
    cheeks:[...(makeupRows || []).filter(row=>row.layer==='cheeks'),...customMakeup('cheeks')],
  });

  function paint(winner=null, selected=-1, announce=true) {
    const step=360/groups.length;
    const shade=groups.map((rows,index)=>{
      const colour=index===selected?winner.colour:rows[0].colour;
      return colour+' '+index*step+'deg '+((index+1)*step-.7)+'deg, #f7f0e9 '+((index+1)*step-.7)+'deg '+(index+1)*step+'deg';
    });
    wheel.style.background=shade.length?'conic-gradient('+shade.join(',')+')':'#e5d5df';
    legend.replaceChildren();
    groups.forEach((rows,index)=>{
      const li=element('li');
      const current=index===selected?winner:rows[0];
      li.append(swatch(current),rows.map(label).join(' / '));
      if(announce&&index===selected)li.setAttribute('aria-current','true');
      legend.append(li);
    });
  }

  function loadWheel(clearResult=true) {
    choices=pools()[category.value];
    const segments=Math.min(maxSegments,choices.length);
    groups=Array.from({length:segments},(_,i)=>choices.filter((_,index)=>index%segments===i));
    rotation=0;wheel.style.transform='rotate(0deg)';
    delete wheel.dataset.selected;delete wheel.dataset.segment;
    paint();
    if(clearResult){result.hidden=true;result.replaceChildren();status.textContent='';}
    button.disabled=!choices.length;
    if(!choices.length) {
      const loading = (['crystal','gel'].includes(category.value)&&nailRows===undefined) ||
        (category.value==='justine'&&makeupRows===undefined);
      pool.textContent=loading?'Loading verified shades…':category.value==='justine'?
        'No current verified Justine makeup shades are available. Try a custom lipstick, eyeshadow or blush wheel.':
        'No verified shades are available for this wheel.';
      if(!loading)legend.append(element('li','This wheel has no eligible shades.'));
      return;
    }
    const custom = ['lips','eyes','cheeks'].includes(category.value)&&choices.every(row=>!row.code);
    pool.textContent=choices.length+' '+(category.value==='looks'?'looks':'colours')+
      (choices.length>segments?' in '+segments+' segments. Each colour has an equal chance, including colours grouped in the same segment.':
        ' · Each entry has an equal chance.')+(custom?' These are custom studio colours.':'');
  }

  function hrefs(row, saved) {
    const nail=new URLSearchParams(), makeup=new URLSearchParams();
    if(row.look){nail.set('look',row.look);makeup.set('look',row.look);}
    else {
      nail.set('colour',row.colour);
      if(['Crystal Clawz','Gel-It'].includes(row.brand)){
        nail.set('brand',row.brand);nail.set('code',row.code);nail.set('collection',row.collection);
      }
      makeup.set('colour',row.colour);makeup.set('layer',row.layer||'lips');
    }
    const apply=new URLSearchParams(nail);
    if(saved)apply.set('saved',saved);
    apply.set('apply','all');
    const selected=new URLSearchParams(apply);selected.set('apply','selected');
    return [
      '/nail-lab/?'+nail, '/nail-lab/?'+apply, '/nail-lab/?'+selected, '/makeup-studio/?'+makeup,
    ];
  }

  function saveColour(row) {
    const add = (key,item) => {
      const items=readList(key);
      const keep=items.filter(entry=>label(entry)!==label(item)||entry.colour!==item.colour);
      return writeList(key,[item,...keep].slice(0,24));
    };
    if(!add('roulette-colours',row)){status.textContent='Browser storage is unavailable.';return;}
    if(!row.layer&&!row.look)add('favourites',row);
    status.textContent='Saved '+row.name+' on this device.';
    renderSaved();
  }

  function renderSaved() {
    const box=byId('roulette-saved');
    box.replaceChildren();
    for(const row of readList('roulette-colours')){
      if(!isHex(row.colour))continue;
      const item=element('button',label(row));item.type='button';item.prepend(swatch(row));
      item.addEventListener('click',()=>{if(!spinning)reveal(row);});box.append(item);
    }
    if(!box.children.length)box.append(element('p','Your saved colours will appear here.'));
  }

  function reveal(row) {
    result.hidden=false;
    const heading=element('h3',label(row));heading.prepend(swatch(row));
    result.replaceChildren(heading,element('p',row.colour.toUpperCase()+' · Illustrative preview colour'));
    if(officialSource(row)){
      const source=element('a','Supplier listing');source.href=row.source;result.append(source);
    }
    const savedSelect=element('select');savedSelect.add(new Option('Start with a new photo',''));
    const field=element('label','Nail design to update');field.append(savedSelect);result.append(field);
    const actions=element('div','','lab-row');
    const names=['Try on my nails','Apply to all nails','Apply to selected nails','Try on my makeup'];
    const anchors=names.map(name=>element('a',name,'lab-action'));
    actions.append(...anchors);
    const links=()=>hrefs(row,savedSelect.value).forEach((url,i)=>anchors[i].href=url);
    links();savedSelect.addEventListener('change',links);
    savedLooks('nail').then(items=>{
      if(!savedSelect.isConnected)return;
      for(const item of items)savedSelect.add(new Option(item.name,item.id));
    }).catch(()=>{});
    const save=element('button','Save colour'), again=element('button','Spin again'), share=element('button','Share result');
    for(const action of [save,again,share])action.type='button';
    save.addEventListener('click',()=>saveColour(row));
    again.disabled=button.disabled;
    again.addEventListener('click',spin);
    share.addEventListener('click',async()=>{
      const url=new URL(hrefs(row,'')[row.layer?3:0],location.origin).href;
      const text=label(row)+' '+row.colour.toUpperCase();
      try{
        if(navigator.share){await navigator.share({title:'Jeanrie’s Colour Roulette',text,url});status.textContent='Result shared.';}
        else if(navigator.clipboard){await navigator.clipboard.writeText(text+' '+url);status.textContent='Result and link copied.';}
        else throw new Error('Share unavailable');
      }catch(error){
        if(error.name==='AbortError')return;
        const old=result.querySelector('#roulette-share');old?.remove();
        const fallback=element('textarea');fallback.id='roulette-share';fallback.readOnly=true;
        fallback.setAttribute('aria-label','Colour Roulette result and link');
        fallback.value=text+' '+url;
        result.append(fallback);fallback.focus();fallback.select();
        status.textContent='Copy the result and link from the text field.';
      }
    });
    actions.append(save,again,share);result.append(actions);
  }

  async function spin() {
    if(spinning||!choices.length)return;
    const winner=choices[uniformIndex(choices.length)];
    const segment=groups.findIndex(group=>group.includes(winner));
    const end=spinDestination(rotation,segment,groups.length);
    spinning=true;button.disabled=true;category.disabled=true;result.hidden=true;
    status.textContent='Spinning…';
    paint(winner,segment,false);
    if(!reduced.matches&&typeof wheel.animate==='function') {
      try{
        const animation=wheel.animate([
          {transform:'rotate('+rotation+'deg)'},
          {transform:'rotate('+end+'deg)'},
        ],{duration:3300,easing:'cubic-bezier(.46,.02,.15,1)'});
        await animation.finished;
      }catch{ /* Set the chosen resting angle even if the animation is interrupted. */ }
    }
    rotation=wrapAngle(end);wheel.style.transform='rotate('+rotation+'deg)';
    wheel.dataset.segment=String(segment);wheel.dataset.selected=winner.colour;
    legend.children[segment].setAttribute('aria-current','true');
    spinning=false;button.disabled=false;category.disabled=false;
    status.textContent='Selected '+label(winner)+'.';
    reveal(winner);
  }

  button.addEventListener('click',spin);
  category.addEventListener('change',()=>{if(!spinning)loadWheel();});
  function refreshFetched() {
    if(!spinning&&result.hidden)loadWheel();
  }
  catalogue('/data/nail-shades.json').then(rows=>{nailRows=verified(rows,['Crystal Clawz','Gel-It']);})
    .catch(()=>{nailRows=[];}).finally(refreshFetched);
  catalogue('/data/makeup-shades.json').then(rows=>{
    makeupRows=verified(rows,['Justine']).filter(row=>['lips','eyes','cheeks'].includes(row.layer));
  }).catch(()=>{makeupRows=[];}).finally(refreshFetched);
  renderSaved();loadWheel();
}
