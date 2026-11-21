export const patterns = {
  solid: 'Classic solid', french: 'Classic French tip', colourFrench: 'Coloured French tip',
  ombre: 'Ombré fade', floral: 'Botanical blooms', hearts: 'Hearts', stars: 'Stars',
  leopard: 'Animal print', geometric: 'Geometric lines', abstract: 'Funky swirls',
  confetti: 'Celebration confetti', snow: 'Winter sparkle', dots: 'Polka dots',
  accent: 'Accent gems', checker: 'Checkerboard', waves: 'Wave stripes', leaf: 'Leaf trail',
};

const tile = document.createElement('canvas');
tile.width = tile.height = 96;
const t = tile.getContext('2d');
const shape = new Path2D('M.15 .09 Q.5 -.04 .85 .09 Q.98 .19 .94 .46 L.82 .83 Q.5 1.04 .18 .83 L.06 .46 Q.02 .19 .15 .09Z');

function star(ctx, x, y, size, points = 5) {
  ctx.beginPath();
  for (let n = 0; n < points * 2; n++) {
    const a = n * Math.PI / points - Math.PI / 2;
    const r = n % 2 ? size * .4 : size;
    ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

function pattern(ctx, design) {
  const { pattern: name, accent, scale, offset } = design;
  ctx.fillStyle = ctx.strokeStyle = accent;
  ctx.translate(.5, .5 + offset / 100);
  ctx.scale(scale / 100, scale / 100);
  ctx.translate(-.5, -.5);
  const marks = [[.22,.32],[.65,.49],[.39,.73],[.78,.19]];
  if (name === 'french' || name === 'colourFrench') {
    if (name === 'french') ctx.fillStyle = '#fff8ed';
    ctx.beginPath();
    ctx.moveTo(-1,-1); ctx.lineTo(2,-1); ctx.lineTo(2,.27);
    ctx.quadraticCurveTo(.5,.04,-1,.27); ctx.fill();
  }
  if (name === 'ombre') {
    const fade = ctx.createLinearGradient(0, 0, 0, .83);
    fade.addColorStop(0, accent); fade.addColorStop(1, accent + '00');
    ctx.fillStyle = fade; ctx.fillRect(-1,-1,3,3);
  }
  if (name === 'geometric' || name === 'waves' || name === 'abstract' || name === 'leaf') {
    ctx.lineWidth = name === 'abstract' ? .085 : .04;
    for (const y of [.24,.52,.8]) {
      ctx.beginPath();
      ctx.moveTo(-.4,y-.12);
      if (name === 'geometric') { ctx.lineTo(.45,y+.1); ctx.lineTo(1.4,y-.29); }
      else ctx.bezierCurveTo(.12,y-.37,.8,y+.3,1.35,y-.08);
      ctx.stroke();
      if (name === 'leaf') {
        ctx.beginPath(); ctx.ellipse(.5,y-.07,.13,.052,-.55,0,Math.PI*2); ctx.fill();
      }
    }
  }
  for (const [x,y] of marks) {
    if (name === 'floral') {
      for (let j=0;j<5;j++) {
        const a=j * Math.PI * .4;
        ctx.beginPath(); ctx.ellipse(x+Math.cos(a)*.062,y+Math.sin(a)*.062,.059,.031,a,0,Math.PI*2); ctx.fill();
      }
    }
    if (name === 'hearts') {
      ctx.beginPath(); ctx.moveTo(x,y+.09);
      ctx.bezierCurveTo(x-.24,y-.05,x-.065,y-.18,x,y-.05);
      ctx.bezierCurveTo(x+.065,y-.18,x+.24,y-.05,x,y+.09); ctx.fill();
    }
    if (['stars','accent','snow'].includes(name)) star(ctx,x,y,name==='accent'?.14:.10,name==='snow'?6:5);
    if (name === 'confetti') { ctx.save();ctx.translate(x,y);ctx.rotate(y*8);ctx.fillRect(-.03,-.07,.06,.14);ctx.restore(); }
    if (name === 'dots' || name === 'leopard') {
      ctx.beginPath(); ctx.ellipse(x,y,.061,name==='dots'?.061:.088,y*8,0,Math.PI*2); ctx.fill();
      if (name === 'leopard') {
        ctx.save();ctx.fillStyle=design.colour;ctx.beginPath();ctx.ellipse(x+.009,y,.035,.05,y*8,0,Math.PI*2);ctx.fill();ctx.restore();
      }
    }
  }
  if (name === 'checker') {
    for (let x=-2;x<7;x++) for (let y=-2;y<7;y++) if ((x+y)%2===0) ctx.fillRect(x*.23,y*.23,.23,.23);
  }
}

function texture(design) {
  t.setTransform(1,0,0,1,0,0); t.clearRect(0,0,96,96);
  t.save(); t.scale(96,96); t.clip(shape);
  t.fillStyle=design.colour; t.fillRect(0,0,1,1);
  t.save(); pattern(t,design); t.restore();
  const light=t.createLinearGradient(0,0,1,.31);
  const chrome=design.finish==='Chrome';
  light.addColorStop(0,'#0005');
  light.addColorStop(.25,chrome?'#fff9':'#fff2');
  light.addColorStop(.47,chrome?'#0007':'#fff0');
  light.addColorStop(.65,design.finish==='Matte'?'#fff1':chrome?'#fffd':'#fff5');
  light.addColorStop(1,'#0006');
  t.fillStyle=light;t.fillRect(0,0,1,1);
  if (['Glitter','Shimmer'].includes(design.finish)) {
    for (let i=1;i<65;i++) {
      const x=(i*73%97)/97,y=(i*37%101)/101;
      t.fillStyle=i%3===0?'#fff9':'#fff4';
      t.beginPath();t.arc(x,y,design.finish==='Glitter'?.013:.007,0,Math.PI*2);t.fill();
    }
  }
  t.restore();
}

export function centre(points) {
  return points.reduce((sum,p)=>({x:sum.x+p.x/4,y:sum.y+p.y/4}),{x:0,y:0});
}

export function rectangle(x,y,w,h,angle=0) {
  const c=Math.cos(angle),s=Math.sin(angle);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({
    x:x+(a*w*c-b*h*s)/2,y:y+(a*w*s+b*h*c)/2,
  }));
}

export function validQuad(points) {
  const values = points.map((a,i)=>{
    const b=points[(i+1)%4],c=points[(i+2)%4];
    return (b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
  });
  return values.every(x=>x>8);
}

function project(points,u,v) {
  const [a,b,c,d]=points;
  const dx=b.x-c.x,dy=b.y-c.y,ex=d.x-c.x,ey=d.y-c.y;
  const sx=a.x-b.x+c.x-d.x,sy=a.y-b.y+c.y-d.y,det=dx*ey-ex*dy;
  const g=det?(sx*ey-ex*sy)/det:0,h=det?(dx*sy-sx*dy)/det:0;
  const div=1+g*u+h*v;
  return {
    x:(a.x+(b.x-a.x+g*b.x)*u+(d.x-a.x+h*d.x)*v)/div,
    y:(a.y+(b.y-a.y+g*b.y)*u+(d.y-a.y+h*d.y)*v)/div,
  };
}

function triangle(ctx, a,b,c, u,v,w) {
  const dx=v.x-u.x,dy=v.y-u.y,ex=w.x-u.x,ey=w.y-u.y;
  const det=dx*ey-ex*dy;
  const ax=((b.x-a.x)*ey-(c.x-a.x)*dy)/det;
  const ay=((b.y-a.y)*ey-(c.y-a.y)*dy)/det;
  const bx=((c.x-a.x)*dx-(b.x-a.x)*ex)/det;
  const by=((c.y-a.y)*dx-(b.y-a.y)*ex)/det;
  const mid={x:(a.x+b.x+c.x)/3,y:(a.y+b.y+c.y)/3};
  ctx.save();ctx.beginPath();
  for (const point of [a,b,c]) {
    // Slightly overlap neighbouring triangles to avoid antialiasing seams.
    const distance=Math.hypot(point.x-mid.x,point.y-mid.y) || 1;
    ctx.lineTo(point.x+(point.x-mid.x)*.6/distance,point.y+(point.y-mid.y)*.6/distance);
  }
  ctx.closePath();ctx.clip();
  ctx.transform(ax,ay,bx,by,a.x-ax*u.x-bx*u.y,a.y-ay*u.x-by*u.y);
  ctx.drawImage(tile,0,0); ctx.restore();
}

function paintNail(ctx, nail) {
  texture(nail.design);
  const steps=6;
  for(let x=0;x<steps;x++) for(let y=0;y<steps;y++) {
    const coords=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    const [a,b,c,d]=coords.map(([u,v])=>project(nail.points,u/steps,v/steps));
    const [u,v,w,z]=coords.map(([qx,qy])=>({x:qx*96/steps,y:qy*96/steps}));
    triangle(ctx,a,b,c,u,v,w); triangle(ctx,a,c,d,u,w,z);
  }
}

const overlay = document.createElement('canvas');
const layer = overlay.getContext('2d');

export function draw(canvas, photo, state, {active=null, selection=[], before=false, guides=false, screenScale=1}={}) {
  if (!photo) return null;
  const ratio = { square:1, portrait:.8, landscape:1.25 }[state.crop] ??
    (state.turn % 2 ? photo.height/photo.width : photo.width/photo.height);
  const width=Math.round(Math.min(1050,1050*ratio)),height=Math.round(width/ratio);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');
  const angle=state.turn*Math.PI/2;
  const fit=Math.max(width/(state.turn%2?photo.height:photo.width),height/(state.turn%2?photo.width:photo.height));
  const scale=fit*state.zoom,x=width*(.5+state.panX/200),y=height*(.5+state.panY/200);
  const matrix=new DOMMatrix().translate(x,y).rotate(angle*180/Math.PI).scale(scale).translate(-photo.width/2,-photo.height/2);
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#f7f0e9';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.setTransform(matrix);ctx.drawImage(photo,0,0);ctx.restore();
  if(!before) {
    if(overlay.width!==width||overlay.height!==height){overlay.width=width;overlay.height=height;}
    for(const nail of Object.values(state.nails)) if(nail.design) {
      layer.setTransform(1,0,0,1,0,0);layer.clearRect(0,0,width,height);
      layer.setTransform(matrix);paintNail(layer,nail);
      ctx.save();ctx.globalAlpha=nail.design.opacity/100;ctx.drawImage(overlay,0,0);ctx.restore();
    }
  }
  if(guides&&!before) for(const [id,nail] of Object.entries(state.nails)) {
    const points=nail.points.map(p=>matrix.transformPoint(p));
    ctx.beginPath();points.forEach(p=>ctx.lineTo(p.x,p.y));ctx.closePath();
    ctx.strokeStyle=selection.includes(id)?'#fff8e7':'#d9a5b5';
    ctx.lineWidth=(id===active?2:1)*screenScale;
    ctx.shadowColor='#281320'; ctx.shadowBlur=2*screenScale;ctx.stroke();ctx.shadowBlur=0;
    if(id===active) points.forEach((point,index)=>{
      ctx.beginPath();ctx.arc(point.x,point.y,5*screenScale,0,Math.PI*2);
      ctx.fillStyle=index<2?'#d9a5b5':'#653b60';ctx.fill();ctx.stroke();
    });
  }
  return matrix;
}
