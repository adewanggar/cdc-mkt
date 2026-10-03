// Exercises only its own temporary shortlinks/sessions; preserves existing site data.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { query } from '../src/db.js';
if(!process.env.DB_NAME?.endsWith('_test')) throw new Error('Use a separate database ending in _test.');
const {app,closeResources}=await import('../src/server.js');
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,marker=randomUUID(),code='qa-'+marker;
const sessions=new Set(),created=new Set();let cookie='',csrf='',checks=0;
const data={title:'<QA '+marker+'>',slug:code,target_url:'https://example.com/a/long/path?q=lab%20test&campaign=october#details',is_active:'1'};
function ok(value) {assert.ok(value);checks++;}
async function request(route,options={}) {
 const r=await fetch(base+route,{redirect:'manual',...options,headers:{...(cookie ? {cookie}:{}),...options.headers}});
 for(const raw of r.headers.getSetCookie()) if(raw.startsWith('lab.sid=')) {
  cookie=raw.split(';')[0];const signed=decodeURIComponent(cookie.slice(8));if(signed.startsWith('s:')) sessions.add(signed.slice(2).split('.')[0]);
 }
 return r;
}
async function page(route) {
 const r=await request(route);assert.equal(r.status,200);checks++;
 const html=await r.text();csrf=html.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1] || csrf;return html;
}
async function post(route,values,expected=302) {
 const r=await request(route,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,...values})});
 assert.equal(r.status,expected,`${route}: ${await r.clone().text()}`);checks++;return r;
}
try {
 ok((await request('/admin/shortlinks')).headers.get('location')==='/admin/login');
 ok((await post('/admin/shortlinks',data)).headers.get('location')==='/admin/login');
 ok((await post('/admin/shortlinks/999999/remove',{})).headers.get('location')==='/admin/login');
 await page('/admin/login');await post('/admin/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
 await page('/admin/shortlinks');
 await post('/admin/shortlinks',{...data,_csrf:'bad'},403);
 await post('/admin/shortlinks',{...data,title:''},400);
 for(const url of ['javascript:alert(1)','data:text/html,test','http://example.com','https://user:pass@example.com','not-a-url']) await post('/admin/shortlinks',{...data,target_url:url},400);
 await post('/admin/shortlinks',{...data,slug:'../admin'},400);
 await post('/admin/shortlinks',data);
 const [row]=await query('SELECT * FROM short_links WHERE slug=?',[code]);created.add(row.id);
 const html=await page('/admin/shortlinks');ok(html.includes('&lt;QA '+marker+'&gt;'));ok(html.includes('data-copy=') && html.includes('/s/'+code));
 await post('/admin/shortlinks',data,400);
 ok((await query('SELECT COUNT(*) count FROM short_links WHERE slug=?',[code]))[0].count===1);
 let r=await request('/s/'+code,{method:'HEAD'});ok(r.status===302 && r.headers.get('location')===data.target_url);ok(r.headers.get('cache-control')==='no-store');
 ok((await query('SELECT click_count FROM short_links WHERE id=?',[row.id]))[0].click_count===0);
 r=await request('/s/'+code+'?url=https://untrusted.example');ok(r.status===302 && r.headers.get('location')===data.target_url);
 await Promise.all(Array.from({length:5},()=>request('/s/'+code)));
 ok((await query('SELECT click_count FROM short_links WHERE id=?',[row.id]))[0].click_count===6);
 const changed={...data,id:String(row.id),slug:'ignored-code',target_url:'https://example.org/updated?a=1&b=2'};
 await post('/admin/shortlinks',changed);
 r=await request('/s/'+code,{method:'HEAD'});ok(r.headers.get('location')===changed.target_url);
 ok((await query('SELECT slug,click_count FROM short_links WHERE id=?',[row.id]))[0].slug===code);
 await post('/admin/shortlinks',{...changed,is_active:''});ok((await request('/s/'+code)).status===404);
 await post('/admin/shortlinks',changed);ok((await request('/s/'+code,{method:'HEAD'})).status===302);
 await post('/admin/shortlinks',{...data,slug:'',title:'Auto '+marker});
 const [auto]=await query('SELECT * FROM short_links WHERE title=?',['Auto '+marker]);created.add(auto.id);ok(/^[a-f0-9]{8}$/.test(auto.slug));
 ok((await request('/s/not-found-'+marker)).status===404);
 await post('/admin/shortlinks/'+row.id+'/remove',{_csrf:'bad'},403);ok((await request('/s/'+code,{method:'HEAD'})).status===302);
 await post('/admin/shortlinks/'+row.id+'/remove',{});ok((await request('/s/'+code)).status===404);
 await post('/admin/logout',{});
 console.log(`${checks} shortlink checks passed. Existing lab data preserved.`);
} finally {
 await new Promise(resolve=>server.close(resolve));
 for(const rowId of created) await query('DELETE FROM short_links WHERE id=? AND (title=? OR title=?)',[rowId,data.title,'Auto '+marker]);
 for(const sessionId of sessions) await query('DELETE FROM sessions WHERE session_id=?',[sessionId]);
 await closeResources();
}
