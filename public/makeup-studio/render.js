export const zones = {
  lips:'Lip colour', cheeks:'Blush', eyes:'Eyeshadow', liner:'Eyeliner', brows:'Brows', highlight:'Highlighter',
};
const palette = (lips, cheeks, eyes, liner, brows, highlight) => ({
  lips:{colour:lips,strength:58}, cheeks:{colour:cheeks,strength:44}, eyes:{colour:eyes,strength:52},
  liner:{colour:liner,strength:62}, brows:{colour:brows,strength:25}, highlight:{colour:highlight,strength:42},
});
export const presets = {
  muse:{name:'Modern Muse', layers:palette('#a65070','#cf7c97','#9a728d','#3a243d','#513a44','#f3d6c5')},
  garden:{name:'Secret Garden', layers:palette('#ad6c6c','#d1878b','#768463','#2f4637','#493e32','#f3dfbd')},
  champagne:{name:'Champagne Glow', layers:palette('#a66054','#c7836b','#cba36b','#59402c','#583d3b','#fff0d3')},
  midnight:{name:'Midnight Drama', layers:palette('#863954','#a95774','#604a83','#211b31','#382d38','#bca9ec')},
  berry:{name:'Berry Crush', layers:palette('#872a4f','#c6698f','#a75d89','#4a2448','#5d364b','#f5cfdf')},
  peach:{name:'Peach Daydream', layers:palette('#c96d56','#dd8f76','#d49a74','#693e37','#67473d','#ffe0ba')},
  classic:{name:'Classic Red', layers:palette('#b12037','#d78383','#ad8c79','#272024','#543736','#fadcbd')},
  minimal:{name:'Bare Glow', layers:palette('#a87268','#c58e88','#ad8c7f','#644d48','#624940','#f5e3d0')},
  rose:{name:'Soft Rose', layers:palette('#b16a82','#d992a2','#b58aa5','#634355','#6c485a','#f9dce7')},
  espresso:{name:'Espresso', layers:palette('#87584c','#aa6b54','#744f3e','#362726','#47352c','#d7a873')},
};

const face = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const outerLips=[61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
const innerLips=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
const upperLids=[[33,246,161,160,159,158,157,173,133],[362,398,384,385,386,387,388,466,263]];
const eyebrows=[[70,63,105,66,107,55,65,52,53,46],[336,296,334,293,300,276,283,282,295,285]];

function pathFrom(points, indexes) {
  const path=new Path2D();
  indexes.forEach(index=>{const [x,y]=points[index];path.lineTo(x,y);});
  path.closePath();return path;
}

function haze(ctx,x,y,xRadius,yRadius,colour,opacity,angle=0) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(xRadius,yRadius);
  const gradient=ctx.createRadialGradient(0,0,0,0,0,1);
  gradient.addColorStop(0,colour);gradient.addColorStop(.42,colour+'ba');gradient.addColorStop(1,colour+'00');
  ctx.globalAlpha=opacity;ctx.fillStyle=gradient;ctx.fillRect(-1,-1,2,2);ctx.restore();
}

export function renderFace(canvas,photo,landmarks,layers,before=false) {
  const ratio=Math.min(1,1200/Math.max(photo.width,photo.height));
  const width=Math.round(photo.width*ratio),height=Math.round(photo.height*ratio);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,width,height);ctx.drawImage(photo,0,0,width,height);
  if(before||!landmarks?.length)return;
  const p=landmarks.map(point=>[point.x*width,point.y*height]);
  const span=Math.hypot(p[454][0]-p[234][0],p[454][1]-p[234][1]);
  const angle=Math.atan2(p[263][1]-p[33][1],p[263][0]-p[33][0]);
  const tint=(name,paint)=>{
    const layer=layers[name];
    if(!layer?.strength)return;
    ctx.save();ctx.globalCompositeOperation=name==='highlight'?'screen':name==='liner'?'multiply':'soft-light';
    paint(layer.colour,layer.strength/100);ctx.restore();
  };
  ctx.save();ctx.clip(pathFrom(p,face));
  tint('cheeks',(colour,strength)=>{
    for(const index of [50,280])haze(ctx,...p[index],span*.19,span*.115,colour,strength*.92,angle);
  });
  tint('highlight',(colour,strength)=>{
    for(const index of [116,345,168])haze(ctx,...p[index],span*.105,span*.028,colour,strength*.55,angle);
  });
  tint('eyes',(colour,strength)=>{
    upperLids.forEach((eye,side)=>{
      const region=new Path2D();
      eye.forEach(i=>region.lineTo(...p[i]));
      const brow=p[side?334:105];
      for(const i of [...eye].reverse()){
        region.lineTo(p[i][0]+(brow[0]-p[i][0])*.13,p[i][1]+(brow[1]-p[i][1])*.56);
      }
      region.closePath();ctx.save();ctx.clip(region);
      const middle=p[eye[4]];
      haze(ctx,middle[0],middle[1]-span*.028,span*.12,span*.06,colour,strength,angle);ctx.restore();
    });
  });
  tint('liner',(colour,strength)=>{
    ctx.strokeStyle=colour;ctx.globalAlpha=strength*.74;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=Math.max(.6,span*.006);
    for(const eye of upperLids){ctx.beginPath();eye.forEach(i=>ctx.lineTo(...p[i]));ctx.stroke();}
  });
  tint('brows',(colour,strength)=>{
    ctx.globalAlpha=strength*.65;ctx.fillStyle=colour;
    for(const brow of eyebrows)ctx.fill(pathFrom(p,brow));
  });
  tint('lips',(colour,strength)=>{
    const shape=pathFrom(p,outerLips);shape.addPath(pathFrom(p,innerLips));
    ctx.globalCompositeOperation='multiply';ctx.globalAlpha=strength*.64;
    ctx.fillStyle=colour;ctx.fill(shape,'evenodd');
  });
  ctx.restore();
}
