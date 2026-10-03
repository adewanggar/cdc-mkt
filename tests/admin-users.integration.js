// Creates and removes only its own temporary admin and sessions; never clears lab data.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import { query } from '../src/db.js';
if(!process.env.DB_NAME?.endsWith('_test')) throw new Error('Use a separate database ending in _test.');
const {app,closeResources}=await import('../src/server.js');
const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const email=`qa-${randomUUID()}@example.test`,password=randomBytes(20).toString('hex');
let cookie='',csrf='',createdId,checks=0;
const sessions=new Set();
async function request(route,options={}) {
 const r=await fetch(base+route,{redirect:'manual',...options,headers:{...(cookie ? {cookie}:{}),...options.headers}});
 for(const raw of r.headers.getSetCookie()) if(raw.startsWith('lab.sid=')) {
  cookie=raw.split(';')[0];const signed=decodeURIComponent(cookie.slice(8));
  if(signed.startsWith('s:')) sessions.add(signed.slice(2).split('.')[0]);
 }
 return r;
}
async function page(route) {
 const r=await request(route); assert.equal(r.status,200);checks++;
 const html=await r.text();csrf=html.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1] || csrf;return html;
}
async function post(route,data,expected=302) {
 const r=await request(route,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,...data})});
 assert.equal(r.status,expected,`${route}: ${await r.clone().text()}`);checks++;return r;
}
try {
 const unauthorized=await post('/admin/users',{name:'Unauthorized'},302);
 assert.equal(unauthorized.headers.get('location'),'/admin/login');checks++;
 await page('/admin/login');
 await post('/admin/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
 await page('/admin/users');
 const data={name:'<Admin QA>',email,password,confirm_password:password};
 await post('/admin/users',{...data,_csrf:'invalid'},403);
 await post('/admin/users',{...data,name:''},400);
 await post('/admin/users',{...data,email:'invalid-address'},400);
 await post('/admin/users',{...data,password:'short',confirm_password:'short'},400);
 await post('/admin/users',{...data,password:'é'.repeat(40),confirm_password:'é'.repeat(40)},400);
 await post('/admin/users',{...data,confirm_password:'different-password'},400);
 const created=await post('/admin/users',data);
 assert.equal(created.headers.get('location'),'/admin/users');checks++;
 const [row]=await query('SELECT id,password_hash FROM users WHERE email=?',[email]);
 createdId=row?.id; assert.ok(createdId);checks++;
 assert.notEqual(row.password_hash,password);checks++;
 assert.ok(await bcrypt.compare(password,row.password_hash));checks++;
 const html=await page('/admin/users');assert.ok(html.includes('&lt;Admin QA&gt;'));checks++;
 assert.ok(!html.includes(row.password_hash) && !html.includes(password));checks++;
 await post('/admin/users',{...data,email:email.toUpperCase()},400);
 assert.equal((await query('SELECT COUNT(*) count FROM users WHERE email=?',[email]))[0].count,1);checks++;
 await post('/admin/logout',{});
 await page('/admin/login');await post('/admin/login',{email,password});
 assert.ok((await page('/admin/users')).includes('Akun Anda'));checks++;
 await post('/admin/logout',{});
 console.log(`${checks} admin account checks passed. Existing lab data preserved.`);
} finally {
 await new Promise(resolve=>server.close(resolve));
 if(createdId) await query('DELETE FROM users WHERE id=? AND email=?',[createdId,email]);
 for(const sessionId of sessions) await query('DELETE FROM sessions WHERE session_id=?',[sessionId]);
 await closeResources();
}
