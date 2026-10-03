// Run only against a disposable test DB: destroys analytics and tests password/CRUD.
import 'dotenv/config';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import jsQR from 'jsqr';
import {once} from 'node:events';
import {pool,query} from '../src/db.js';
if(!process.env.DB_NAME?.endsWith('_test')) throw new Error('Integration tests require DB_NAME ending in _test.');
const {app,closeResources}=await import('../src/server.js');
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;let cookie='',token='',checks=0;
async function request(url,options={}) {
 const response=await fetch(base+url,{redirect:'manual',...options,headers:{...(cookie ? {cookie}:{}),...options.headers}});
 const set=response.headers.getSetCookie();if(set.length) cookie=set.map(s=>s.split(';')[0]).join('; ');
 return response;
}
function ok(condition,message) {assert.ok(condition,message);checks++;}
async function page(url) {const r=await request(url);assert.equal(r.status,200,url);checks++;const html=await r.text();token=html.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1] || token;return html;}
async function post(url,data,expected=302){const r=await request(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,...data})});assert.equal(r.status,expected,`${url}: ${await r.clone().text()}`);checks++;return r;}
async function login(){await page('/admin/login');await post('/admin/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});await page('/admin');}
try {
 await query('DELETE FROM clicks');await query('DELETE FROM visits');
 const [version]=await query('SELECT VERSION() version');ok(version.version.startsWith('8.'),'MySQL 8');
 ok((await query('SELECT * FROM contacts')).length===3,'Three seeded contacts');
 let r=await request('/admin');ok(r.status===302 && r.headers.get('location')==='/admin/login','Protected admin');
 await page('/admin/login');await post('/admin/login',{email:process.env.ADMIN_EMAIL,password:'wrong-password'},401);
 await post('/admin/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD,_csrf:'wrong'},403);
 await login();
 for(const p of ['/admin/settings','/admin/contacts','/admin/branches','/admin/buttons','/admin/qr','/admin/password','/admin?days=7&group=week','/admin?days=90&group=month&contact=2']) await page(p);
 let html=await page('/m/budi');ok(html.includes('Budi Santoso') && html.includes('noindex,nofollow'),'Marketing page metadata');
 ok(html.includes('Customer Care') && html.includes('/go/care/budi'),'Customer Care button on marketing page');
 r=await request('/go/care/budi',{method:'HEAD'});ok(new URL(r.headers.get('location')).pathname==='/628113052999','Customer Care international WhatsApp number');
 r=await request('/go/wa/budi',{headers:{'user-agent':'iPhone Mobile'}});const wa=new URL(r.headers.get('location'));ok(r.status===302 && wa.hostname==='wa.me' && wa.pathname==='/6281234567891','WA redirect');ok(wa.searchParams.get('text').includes('kartu nama'),'Encoded WA message');
 r=await request('/go/maps/budi');ok(r.status===302 && r.headers.get('location').startsWith('https://www.google.com/maps'),'Maps redirect');
 r=await request('/go/extra-1/budi');ok(r.headers.get('location')==='tel:+62215550123','Phone redirect');
 r=await request('/go/extra-2/budi');ok(r.status===302,'Other link redirect');
 const visits=await query('SELECT * FROM visits');ok(visits.length===1 && visits[0].contact_id===2 && /^[a-f0-9]{64}$/.test(visits[0].ip_hash),'Visit attribution and IP hashing');
 ok((await query('SELECT * FROM clicks')).length===4,'All clicks recorded');
 html=await page('/admin?contact=2');ok(html.includes('Budi Santoso') && html.includes('activity-chart'),'Dashboard aggregates and chart');
 r=await request('/admin/stats.csv?contact=2');const csv=await r.text();ok(csv.includes('Budi Santoso') && csv.includes('whatsapp') && csv.split('\r\n').length===7,'CSV filters and rows');
 r=await request('/admin/qr/budi/png');const png=Buffer.from(await r.arrayBuffer());const metadata=await sharp(png).metadata();ok(metadata.width===1600 && metadata.height===1600,'High-resolution PNG QR');
 const raw=await sharp(png).ensureAlpha().raw().toBuffer();const decoded=jsQR(new Uint8ClampedArray(raw),1600,1600);ok(decoded?.data===new URL('/m/budi',process.env.APP_URL).href,'QR decodes to permanent marketing URL');
 r=await request('/admin/qr/budi/svg');ok((await r.text()).includes('<svg'),'SVG QR');
 await post('/admin/branches/save',{name:'Cabang Uji',address:'Alamat uji',maps_url:'https://maps.app.goo.gl/test',is_active:'1'});
 const [branch]=await query("SELECT * FROM branches WHERE name='Cabang Uji'");
 await post('/admin/contacts/save',{slug:'uji',name:'Kontak Uji',job_title:'Marketing',wa_number:'081234567893',wa_message:'Halo & sehat + aman?',branch_id:String(branch.id),is_active:'1'});
 const [contact]=await query("SELECT * FROM contacts WHERE slug='uji'");
 r=await request('/go/wa/uji');ok(new URL(r.headers.get('location')).searchParams.get('text')==='Halo & sehat + aman?','Special character URL encoding');
 r=await request('/go/maps/uji');ok(r.headers.get('location')==='https://maps.app.goo.gl/test','Branch override');
 await post('/admin/contacts/save',{id:String(contact.id),slug:'uji',name:'<script>alert(1)</script>',job_title:'Marketing',wa_number:'081234567894',wa_message:'Pesan baru',branch_id:String(branch.id),is_active:'1'});
 html=await page('/m/uji');ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !html.includes('<script>alert(1)</script>'),'HTML escaped');
 await post('/admin/contacts/save',{slug:"sql' OR 1=1",name:'Uji',job_title:'Uji',wa_number:'081234567890',wa_message:'Uji',branch_id:''},400);
 await post('/admin/buttons/save',{title:'Uji tombol',url:'javascript:alert(1)',icon:'website',sort_order:'1'},400);
 await post('/admin/buttons/save',{title:'Uji tombol',url:'https://example.com/',icon:'website',sort_order:'4',is_active:'1'});
 const [button]=await query("SELECT * FROM extra_buttons WHERE title='Uji tombol'");
 await post('/admin/buttons/save',{id:String(button.id),title:'Uji diperbarui',url:'https://example.com/',icon:'website',sort_order:'2'});
 r=await request(`/go/extra-${button.id}/budi`);ok(r.status===404,'Disabled button hidden');
 const image=await sharp({create:{width:64,height:64,channels:3,background:'#004aad'}}).png().toBuffer();
 const form=new FormData();form.set('_csrf',token);form.set('target','contact');form.set('contact_id',String(contact.id));form.set('image',new Blob([image],{type:'image/png'}),'test.png');
 r=await request('/admin/upload',{method:'POST',body:form});ok(r.status===302,'Valid upload');
 const [photo]=await query('SELECT photo_path FROM contacts WHERE id=?',[contact.id]);r=await request(photo.photo_path);ok(r.status===200 && r.headers.get('content-type').startsWith('image/webp'),'Compressed WebP');
 const bad=new FormData();bad.set('_csrf',token);bad.set('target','logo');bad.set('image',new Blob(['not an image'],{type:'image/png'}),'fake.png');
 r=await request('/admin/upload',{method:'POST',body:bad});ok(r.status===400,'Fake image rejected');
 const fakeSVG=new FormData();fakeSVG.set('_csrf',token);fakeSVG.set('target','logo');fakeSVG.set('image',new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>'],{type:'image/png'}),'fake.png');
 r=await request('/admin/upload',{method:'POST',body:fakeSVG});ok(r.status===400,'Disguised SVG rejected');
 const badCSRF=new FormData();badCSRF.set('_csrf','bad');badCSRF.set('target','logo');badCSRF.set('image',new Blob([image],{type:'image/png'}),'test.png');
 r=await request('/admin/upload',{method:'POST',body:badCSRF});ok(r.status===403,'Upload CSRF enforced');
 await post('/admin/contacts/save',{id:String(contact.id),slug:'uji',name:'Uji',job_title:'Marketing',wa_number:'081234567893',wa_message:'Uji',branch_id:''});
 r=await request('/m/uji');ok(r.status===404,'Disabled contact unavailable');r=await request('/go/wa/uji');ok(r.status===404,'Disabled contact redirect unavailable');
 await post(`/admin/contacts/${contact.id}/delete`,{});await post(`/admin/branches/${branch.id}/delete`,{});await post(`/admin/buttons/${button.id}/delete`,{});
 const s=(await query('SELECT * FROM site_settings WHERE id=1'))[0];const hours=typeof s.opening_hours==='string' ? JSON.parse(s.opening_hours):s.opening_hours;
 const settings={...s,default_contact_id:String(s.default_contact_id),marketing_noindex:'1'};for(let d=0;d<7;d++){if(!hours[d])settings[`closed_${d}`]='1';settings[`open_${d}`]=hours[d]?.open || '07:00';settings[`close_${d}`]=hours[d]?.close || '20:00';}
 await post('/admin/settings',{...settings,_csrf:'wrong'},403);await post('/admin/settings',settings);
 await post('/admin/password',{current_password:process.env.ADMIN_PASSWORD,new_password:'Changed-local-password!',confirm_password:'different'},400);
 await post('/admin/password',{current_password:process.env.ADMIN_PASSWORD,new_password:'Changed-local-password!',confirm_password:'Changed-local-password!'});
 r=await request('/admin');ok(r.status===302,'Password change revokes sessions');
 await query('UPDATE users SET password_hash=? WHERE id=1',[await bcrypt.hash(process.env.ADMIN_PASSWORD,12)]);
 await login();r=await request('/');ok(r.headers.get('content-security-policy').includes("script-src 'self'"),'CSP enforced');ok(r.headers.get('x-powered-by')===null,'Express signature removed');
 await post('/admin/logout',{});r=await request('/admin');ok(r.status===302,'Logout enforced');
 let limited=false;for(let i=0;i<11;i++){await page('/admin/login');r=await request('/admin/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token,email:process.env.ADMIN_EMAIL,password:'incorrect-password'})});if(r.status===429){limited=true;break;}}
 ok(limited,'Login rate limit enforced');
 console.log(`PASS: ${checks} integration checks against MySQL ${version.version}`);
} finally {
 await query('UPDATE users SET password_hash=? WHERE id=1',[await bcrypt.hash(process.env.ADMIN_PASSWORD,12)]);
 await query('DELETE FROM visits');await query('DELETE FROM clicks');await new Promise(resolve=>server.close(resolve));await closeResources();
}
