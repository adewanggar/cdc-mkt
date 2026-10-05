// Uses only temporary links/admin/contact; restores the new bio profile and preserves marketing data.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import {query} from '../src/db.js';
if(!process.env.DB_NAME?.endsWith('_test')) throw new Error('Use a separate database ending in _test.');
const {app,closeResources}=await import('../src/server.js');
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,marker=randomUUID(),email=`bio-qa-${marker}@example.test`,password=randomBytes(20).toString('hex');
const [original]=await query('SELECT * FROM bio_settings WHERE id=1');
const [marketing]=await query('SELECT * FROM site_settings WHERE id=1');
const [counts]=await query('SELECT (SELECT COUNT(*) FROM visits) visits,(SELECT COUNT(*) FROM clicks) clicks');
let cookie='',csrf='',adminId,contactId,checks=0;const links=new Set(),sessions=new Set();
const profile={title:'Bio QA '+marker,description:'<Deskripsi tersendiri>',primary_color:'#123456',accent_color:'#fedcba',show_title:'1',is_active:'1'};
function ok(value){assert.ok(value);checks++;}
async function request(route,options={}) {
 const r=await fetch(base+route,{redirect:'manual',...options,headers:{...(cookie ? {cookie}:{}),...options.headers}});
 for(const raw of r.headers.getSetCookie()) if(raw.startsWith('lab.sid=')) {cookie=raw.split(';')[0];const signed=decodeURIComponent(cookie.slice(8));if(signed.startsWith('s:'))sessions.add(signed.slice(2).split('.')[0]);}
 return r;
}
async function page(route){const r=await request(route);assert.equal(r.status,200);checks++;const html=await r.text();csrf=html.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1] || csrf;return html;}
async function post(route,data,expected=302){const r=await request(route,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,...data})});assert.equal(r.status,expected,await r.clone().text());checks++;return r;}
try {
 ok((await post('/admin/bio',profile)).headers.get('location')==='/admin/login');
 const admin=await query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)',['Bio QA',email,await bcrypt.hash(password,12)]);adminId=admin.insertId;
 await page('/admin/login');await post('/admin/login',{email,password});await page('/admin/bio');
 await post('/admin/bio',{...profile,_csrf:'invalid'},403);await post('/admin/bio',{...profile,primary_color:'invalid'},400);
 await post('/admin/bio',profile);
 let html=await page('/bio');ok(html.includes(profile.title) && html.includes('&lt;Deskripsi tersendiri&gt;'));ok(!html.includes('Kontak Anda') && !html.includes('/go/wa/'));
 ok((await page('/bio/theme.css')).includes('--primary:#123456'));
 const button={title:'First '+marker,subtitle:'<Keterangan>',url:'https://example.com/promo?a=1&b=2',icon:'catalog',sort_order:'1',is_active:'1'};
 await post('/admin/biolinks/save',{...button,_csrf:'bad'},403);await post('/admin/biolinks/save',{...button,url:'javascript:alert(1)'},400);await post('/admin/biolinks/save',{...button,sort_order:'-1'},400);
 for(const [title,order,active] of [[button.title,'1','1'],['Last '+marker,'200','1'],['Hidden '+marker,'0','']]) {
  await post('/admin/biolinks/save',{...button,title,sort_order:order,is_active:active});const [row]=await query('SELECT id FROM bio_links WHERE title=?',[title]);links.add(row.id);
 }
 html=await page('/bio');ok(html.indexOf(button.title)<html.indexOf('Last '+marker));ok(!html.includes('Hidden '+marker));ok(html.includes('&lt;Keterangan&gt;'));ok(html.includes('href="https://example.com/promo?a=1&amp;b=2"'));
 const [first]=await query('SELECT id FROM bio_links WHERE title=?',[button.title]);
 await post('/admin/biolinks/save',{...button,id:String(first.id),is_active:''});ok(!(await page('/bio')).includes(button.title));
 await post('/admin/bio',{...profile,is_active:''});ok((await request('/bio')).status===404);
 await post('/admin/bio',{...profile,show_title:''});ok((await page('/bio')).includes('<h1 class="sr-only">'));
 const image=await sharp({create:{width:32,height:32,channels:4,background:'#123456'}}).png().toBuffer();
 const upload=new FormData();upload.set('_csrf',csrf);upload.set('target','biologo');upload.set('image',new Blob([image],{type:'image/png'}),'qa.png');
 const response=await request('/admin/upload',{method:'POST',body:upload});ok(response.status===302 && response.headers.get('location')==='/admin/bio');
 const [uploaded]=await query('SELECT logo_path FROM bio_settings WHERE id=1');ok(/^\/uploads\/[a-f0-9-]+\.webp$/.test(uploaded.logo_path));ok((await request(uploaded.logo_path)).status===200);
 const contact=await query('INSERT INTO contacts (slug,name,job_title,wa_number,wa_message,photo_path) VALUES (?,?,?,?,?,?)',['bio-qa-'+marker,'Bio QA','QA','628113052999','QA',uploaded.logo_path]);contactId=contact.insertId;
 await post('/admin/image/remove',{target:'biologo'});ok((await request(uploaded.logo_path)).status===200);
 await post('/admin/contacts/'+contactId+'/delete',{});contactId=null;ok((await request(uploaded.logo_path)).status===404);
 await post('/admin/biolinks/'+first.id+'/delete',{_csrf:'bad'},403);await post('/admin/biolinks/'+first.id+'/delete',{});ok(!(await query('SELECT id FROM bio_links WHERE id=?',[first.id])).length);
 assert.deepEqual((await query('SELECT * FROM site_settings WHERE id=1'))[0],marketing);checks++;
 assert.deepEqual((await query('SELECT (SELECT COUNT(*) FROM visits) visits,(SELECT COUNT(*) FROM clicks) clicks'))[0],counts);checks++;
 await post('/admin/logout',{});console.log(`${checks} Bio Instagram checks passed. Marketing data preserved.`);
} finally {
 await new Promise(resolve=>server.close(resolve));
 for(const rowId of links) await query('DELETE FROM bio_links WHERE id=? AND title LIKE ?',[rowId,'%'+marker]);
 if(contactId) await query('DELETE FROM contacts WHERE id=? AND slug=?',[contactId,'bio-qa-'+marker]);
 await query('UPDATE bio_settings SET title=?,description=?,logo_path=?,primary_color=?,accent_color=?,show_title=?,is_active=?,updated_at=? WHERE id=1 AND title=?',[original.title,original.description,original.logo_path,original.primary_color,original.accent_color,original.show_title,original.is_active,original.updated_at,profile.title]);
 if(adminId) await query('DELETE FROM users WHERE id=? AND email=?',[adminId,email]);
 for(const sessionId of sessions) await query('DELETE FROM sessions WHERE session_id=?',[sessionId]);
 await closeResources();
}
