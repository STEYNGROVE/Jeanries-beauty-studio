const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestPost({request,env}){
 if(!env.DB)return reply({error:'Enquiries unavailable'},503);
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin)return reply({error:'Invalid origin'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'JSON required'},415);
 if(Number(request.headers.get('Content-Length')||0)>4000)return reply({error:'Too large'},413);
 let b;try{b=await request.json()}catch{return reply({error:'Invalid JSON'},400)}
 if(!b||!['appointment','enquiry'].includes(b.type)||b.website)return reply({error:'Invalid request'},400);
 const s=(v,n=400)=>typeof v==='string'?v.trim().slice(0,n):'';
 const name=s(b.name,120),contact=s(b.contact,120),message=s(b.message,900);
 if(!name||!message||!b.consent)return reply({error:'Name, message and consent required'},400);
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+':'+url.hostname));const fingerprint=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const now=Date.now(),window=now-3600000;
 const limit=await env.DB.prepare('SELECT count,window_start FROM intake_limits WHERE fingerprint=?').bind(fingerprint).first();
 if(limit&&limit.window_start>window&&limit.count>=5)return reply({error:'Please try again later'},429);
 await env.DB.prepare('INSERT INTO intake_limits(fingerprint,window_start,count) VALUES (?,?,1) ON CONFLICT(fingerprint) DO UPDATE SET window_start=excluded.window_start,count=CASE WHEN intake_limits.window_start<? THEN 1 ELSE intake_limits.count+1 END').bind(fingerprint,now,window).run();
 const id=crypto.randomUUID();
 if(b.type==='appointment'){
  const starts=s(b.starts_at,40),service=s(b.service,150);
  if(!service||!/^\d{4}-\d{2}-\d{2}/.test(starts))return reply({error:'Service and date required'},400);
  await env.DB.prepare('INSERT INTO appointments(id,customer_name,contact,service,starts_at,status,notes) VALUES(?,?,?,?,?,?,?)').bind(id,name,contact,service,starts,'new',message).run();
 }else await env.DB.prepare('INSERT INTO enquiries(id,customer_name,contact,message,status) VALUES(?,?,?,?,?)').bind(id,name,contact,message,'new').run();
 return reply({ok:true,id,notice:'Request received. Appointment is not confirmed.'},201);
}
