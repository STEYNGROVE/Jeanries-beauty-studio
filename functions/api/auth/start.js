export async function onRequestGet({request,env}) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.DB || !env.ADMIN_GOOGLE_SUB) return new Response('Admin authentication not configured', {status:503});
  const state=crypto.randomUUID(), nonce=crypto.randomUUID();
  const u=new URL(request.url), redirect=u.origin+'/api/auth/callback';
  const params=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirect,response_type:'code',scope:'openid email profile',state,nonce,prompt:'select_account'});
  const secure=u.protocol==='https:'?'; Secure':'';
  const headers=new Headers({Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params,'Cache-Control':'no-store'});
  headers.append('Set-Cookie',`jeanrie_oauth=${state}.${nonce}; HttpOnly${secure}; SameSite=Lax; Path=/api/auth; Max-Age=600`);
  return new Response(null,{status:302,headers});
}
