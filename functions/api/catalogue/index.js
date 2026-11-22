// Public read-only catalogue overlays verified admin edits on the original catalogue.
export async function onRequestGet({request,env}) {
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'};
 const origin=new URL(request.url).origin;
 const source=await fetch(origin+'/data/catalogue.json');
 if(!source.ok)return new Response(JSON.stringify({error:'Catalogue unavailable'}),{status:503,headers});
 const data=await source.json();
 if(!env.DB)return new Response(JSON.stringify(data),{headers});
 try {
  const rows=(await env.DB.prepare('SELECT * FROM products ORDER BY updated_at DESC LIMIT 1000').all()).results;
  const byId=new Map(data.products.map((p,i)=>[p.id,i]));
  for(const r of rows){
   const idx=byId.get(r.id);
   if(idx!==undefined){
    if(r.active===0){data.products.splice(idx,1);byId.clear();data.products.forEach((p,i)=>byId.set(p.id,i));continue;}
    const item=data.products[idx];
    if(r.name)item.name=r.name;if(r.category)item.category=r.category;
    if(r.sku)item.sku=r.sku;if(r.image_url)item.image=r.image_url;
    if(r.price_cents!==null){item.referencePriceCents=r.price_cents;item.referencePriceSource='Jeanrie admin verified price';delete item.priceValidUntil;delete item.priceValidFrom;}
   } else if(r.active!==0 && r.name){data.products.push({id:r.id,name:r.name,category:r.category||'Justine',sku:r.sku||'',image:r.image_url||'',...(r.price_cents===null?{}:{referencePriceCents:r.price_cents,referencePriceSource:'Jeanrie admin verified price'})});}
  }
 }catch(e){return new Response(JSON.stringify({error:'Catalogue temporarily unavailable'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}})}
 return new Response(JSON.stringify(data),{headers});
}
