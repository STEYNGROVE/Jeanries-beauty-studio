const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async str=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const cookie=(req,name)=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const tables={products:['name','category','sku','price_cents','image_url','active'],appointments:['customer_name','contact','service','starts_at','status','notes'],enquiries:['customer_name','contact','message','status'],advertisements:['title','caption','image_url','status','scheduled_at','product_id']};
export async function onRequest({request,env,params}) {
  if(!env.DB || !env.ADMIN_GOOGLE_SUB) return json({error:'Not configured'},503);
  const session=cookie(request,'jeanrie_session'); if(!session)return json({error:'Sign in required'},401);
  const record=await env.DB.prepare('SELECT google_sub,email FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(session),Date.now()).first();
  if(!record || record.google_sub!==env.ADMIN_GOOGLE_SUB)return json({error:'Not authorized'},403);
  const path=Array.isArray(params.path)?params.path.join('/'):params.path||'';
  if(path==='me' && request.method==='GET')return json({email:record.email,role:'primary-admin',paidAdvertising:false,autoPublish:false});
  const [resource,id]=path.split('/');if(!tables[resource] || path.split('/').length>2)return json({error:'Not found'},404);
  if(request.method==='GET'){
    if(id)return json({error:'Not found'},404);
    const rows=await env.DB.prepare(`SELECT * FROM ${resource} ORDER BY updated_at DESC LIMIT 200`).all();return json({items:rows.results});
  }
  if(!['POST','PATCH','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
  if(new URL(request.url).origin!==request.headers.get('Origin'))return json({error:'Invalid request origin'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
  if(Number(request.headers.get('Content-Length')||0)>20000)return json({error:'Payload too large'},413);
  let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400)}
  if(!input || typeof input!=='object' || Array.isArray(input))return json({error:'Invalid input'},400);
  if(request.method==='DELETE'){
    if(!id)return json({error:'ID required'},400);
    await env.DB.prepare(`DELETE FROM ${resource} WHERE id=?`).bind(id).run();return json({ok:true});
  }
  const allowed=tables[resource], keys=Object.keys(input);
  if(!keys.length || keys.some(k=>!allowed.includes(k)))return json({error:'Unknown or missing fields'},400);
  for(const k of keys){if(typeof input[k]==='string'&&input[k].length>3000)return json({error:'Field too long'},400)}
  if('price_cents'in input && (!Number.isInteger(input.price_cents)||input.price_cents<0))return json({error:'Invalid price'},400);
  if('active'in input && ![0,1].includes(input.active))return json({error:'Invalid active flag'},400);
  if(resource==='advertisements' && input.status && !['draft','pending','approved','rejected'].includes(input.status))return json({error:'Invalid advertising status'},400);
  if(request.method==='POST'){
    if(id)return json({error:'Unexpected ID'},400);
    const newId=crypto.randomUUID(), all=['id',...keys];
    await env.DB.prepare(`INSERT INTO ${resource} (${all.join(',')}) VALUES (${all.map(()=>'?').join(',')})`).bind(newId,...keys.map(k=>input[k])).run();return json({ok:true,id:newId},201);
  }
  if(!id)return json({error:'ID required'},400);
  const set=keys.map(k=>`${k}=?`).join(',');
  const result=await env.DB.prepare(`UPDATE ${resource} SET ${set},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...keys.map(k=>input[k]),id).run();return json({ok:true,changed:result.meta.changes});
}
