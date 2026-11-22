const redirect=(url,path)=>Response.redirect(new URL(path,url),302);
const cookie=(req,name)=>req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const hex=async str=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function onRequestGet({request,env}) {
  const url=new URL(request.url), raw=cookie(request,'jeanrie_oauth'), [state,nonce]=raw?.split('.')||[];
  if (!state || !nonce || !url.searchParams.get('state') || state!==url.searchParams.get('state') || !url.searchParams.get('code')) return new Response('Invalid or expired sign-in request',{status:403});
  const token=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code'),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:url.origin+'/api/auth/callback',grant_type:'authorization_code'})});
  if(!token.ok) return new Response('Google sign-in failed',{status:401});
  const body=await token.json();
  if(!body.id_token) return new Response('Missing identity token',{status:401});
  // Google validates signature, audience, expiry and issuer at its tokeninfo endpoint.
  const verify=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(body.id_token));
  if(!verify.ok) return new Response('Identity verification failed',{status:401});
  const identity=await verify.json();
  if(identity.aud!==env.GOOGLE_CLIENT_ID || !['accounts.google.com','https://accounts.google.com'].includes(identity.iss) || identity.nonce!==nonce || identity.sub!==env.ADMIN_GOOGLE_SUB || identity.email_verified!== 'true' || Number(identity.exp)*1000<=Date.now()) return new Response('This Google account is not authorized',{status:403});
  const secret=crypto.randomUUID()+crypto.randomUUID(), hash=await hex(secret), expires=Date.now()+8*3600000;
  await env.DB.prepare('INSERT INTO admin_sessions (token_hash,google_sub,email,expires_at) VALUES (?,?,?,?)').bind(hash,identity.sub,identity.email,expires).run();
  const headers=new Headers({Location:'/admin/', 'Cache-Control':'no-store'});
  headers.append('Set-Cookie',`jeanrie_session=${secret}; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=28800`);
  headers.append('Set-Cookie','jeanrie_oauth=; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=0');
  return new Response(null,{status:302,headers});
}
