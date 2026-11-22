const hex=async str=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function onRequestPost({request,env}) {
 if(new URL(request.url).origin!==request.headers.get('Origin'))return new Response('Forbidden',{status:403});
 const value=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('jeanrie_session='))?.split('=')[1];
 if(value&&env.DB)await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await hex(value)).run();
 return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':'jeanrie_session=; HttpOnly; Secure; SameSite=Lax; Path=/api; Max-Age=0','Cache-Control':'no-store'}});
}
