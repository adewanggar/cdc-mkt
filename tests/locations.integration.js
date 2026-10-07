// Temporary branches/admin/contact/links only; preserves user settings and statistics.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import bcrypt from 'bcryptjs';
import {query} from '../src/db.js';
if(!process.env.DB_NAME?.endsWith('_test')) throw new Error('Use a separate database ending in _test.');
const {app,closeResources}=await import('../src/server.js');
const server=app.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,marker=randomUUID(),referer=`https://example.test/location-qa-${marker}`;
const email=`locations-qa-${marker}@example.test`,password=randomBytes(20).toString('hex');
const originalSettings=await query('SELECT * FROM site_settings');
const originalBio=await query('SELECT * FROM bio_settings');
const originalBranches=await query('SELECT * FROM branches ORDER BY id');
const [counts]=await query('SELECT (SELECT COUNT(*) FROM visits) visits,(SELECT COUNT(*) FROM clicks) clicks');
const branches=new Set(),links=new Set(),sessions=new Set();let cookie='',csrf='',adminId,contactId,checks=0;
function ok(value){assert.ok(value);checks++;}
async function request(route,options={}) {
 const response=await fetch(base+route,{redirect:'manual',...options,headers:{referer,...(cookie ? {cookie}:{}),...options.headers}});
 for(const raw of response.headers.getSetCookie()) if(raw.startsWith('lab.sid=')) {
  cookie=raw.split(';')[0];const signed=decodeURIComponent(cookie.slice(8));if(signed.startsWith('s:'))sessions.add(signed.slice(2).split('.')[0]);
 }
 return response;
}
async function page(route){const r=await request(route);assert.equal(r.status,200);checks++;const html=await r.text();csrf=html.match(/name="_csrf" value="([a-f0-9]+)"/)?.[1] || csrf;return html;}
async function post(route,data,expected=302){const r=await request(route,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:csrf,...data})});assert.equal(r.status,expected,await r.clone().text());checks++;return r;}
async function clearOwnAnalytics(){await query('DELETE FROM visits WHERE referrer=?',[referer]);if(contactId)await query('DELETE FROM clicks WHERE contact_id=?',[contactId]);}
try {
 const admin=await query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)',['Locations QA',email,await bcrypt.hash(password,12)]);adminId=admin.insertId;
 await page('/admin/login');await post('/admin/login',{email,password});await page('/admin/branches');
 const branch={name:'<Cabang A> '+marker,address:'Alamat cabang A\nSurabaya',maps_url:'https://www.google.com/maps?q=cabang-a&source=qa',is_active:'1'};
 await post('/admin/branches/save',{...branch,_csrf:'bad'},403);
 await post('/admin/branches/save',{...branch,maps_url:'https://evil.example.test/maps'},400);
 for(const [name,address,maps_url,active] of [[branch.name,branch.address,branch.maps_url,'1'],['Cabang B '+marker,'Alamat cabang B','https://maps.app.goo.gl/qaBranchB','1'],['Hidden '+marker,'Alamat tersembunyi','https://maps.app.goo.gl/qaHidden','']]) {
  await post('/admin/branches/save',{name,address,maps_url,is_active:active});const [row]=await query('SELECT id FROM branches WHERE name=?',[name]);branches.add(row.id);
 }
 const [a]=await query('SELECT id FROM branches WHERE name=?',[branch.name]);const [b]=await query('SELECT id FROM branches WHERE name=?',['Cabang B '+marker]);const [hidden]=await query('SELECT id FROM branches WHERE name=?',['Hidden '+marker]);
 const slug='location-qa-'+marker;
 const contact=await query('INSERT INTO contacts (slug,name,job_title,wa_number,wa_message,branch_id) VALUES (?,?,?,?,?,?)',[slug,'Location QA','QA','628113052999','QA',a.id]);contactId=contact.insertId;
 for(const route of ['/','/m/'+slug,'/bio']) {
  const html=await page(route);ok(html.includes('&lt;Cabang A&gt; '+marker) && html.includes('Cabang B '+marker));ok(!html.includes('Hidden '+marker));
  ok(html.includes('Kunjungi kami') && html.includes('id="location-dialog"'));
  ok(html.includes('data-location-picker') && html.includes('aria-haspopup="dialog"'));
  ok(html.includes('id="locations"') && html.includes('/locations.js?v=1'));
  ok((html.match(new RegExp('Cabang B '+marker,'g')) || []).length===2);
  ok(html.includes('Alamat cabang A\nSurabaya'));
  if(route==='/bio') ok(html.includes('href="https://maps.app.goo.gl/qaBranchB"') && !html.includes('/go/maps/'));
  else ok(html.includes(`/go/maps/${route==='/' ? 'default':slug}?branch=${b.id}`));
 }
 for(const [branchId,destination] of [[a.id,branch.maps_url],[b.id,'https://maps.app.goo.gl/qaBranchB']]) {
  const response=await request(`/go/maps/${slug}?branch=${branchId}`);ok(response.status===302 && response.headers.get('location')===destination);
 }
 ok((await query('SELECT COUNT(*) count FROM clicks WHERE contact_id=? AND button_type=?',[contactId,'maps']))[0].count===2);
 const head=await request(`/go/maps/${slug}?branch=${b.id}`,{method:'HEAD'});ok(head.status===302);
 ok((await query('SELECT COUNT(*) count FROM clicks WHERE contact_id=?',[contactId]))[0].count===2);
 ok((await request(`/go/maps/${slug}`)).headers.get('location')===branch.maps_url);
 for(const [value,status] of [['-1',400],['1 OR 1=1',400],['9007199254740991',404],[String(hidden.id),404]]) ok((await request(`/go/maps/${slug}?branch=${encodeURIComponent(value)}`)).status===status);
 await page('/admin/bio');const picker={title:'Pilih cabang '+marker,subtitle:'Dua lokasi',use_branches:'1',icon:'website',sort_order:'1',is_active:'1'};
 await post('/admin/biolinks/save',picker);const [link]=await query('SELECT * FROM bio_links WHERE title=?',[picker.title]);links.add(link.id);
 ok(link.url==='#locations' && link.icon==='maps');
 let html=await page('/bio');ok(html.includes(picker.title));ok(!html.includes('<strong>Lihat Lokasi</strong>'));
 html=await page('/admin/bio');ok(html.includes('<option value="1" selected>Pilih cabang (popup lokasi)</option>'));
 await post('/admin/biolinks/save',{...picker,id:String(link.id),use_branches:'',icon:'maps',url:'javascript:alert(1)'},400);
 await post('/admin/biolinks/save',{...picker,id:String(link.id),use_branches:'',icon:'maps',url:'https://maps.app.goo.gl/qaBranchB'});
 html=await page('/bio');ok(html.includes('<strong>Lihat Lokasi</strong>'));ok(html.includes('href="https://maps.app.goo.gl/qaBranchB"'));
 await post('/admin/branches/save',{...branch,id:String(a.id),is_active:''});html=await page('/bio');ok(!html.includes('&lt;Cabang A&gt; '+marker));ok(html.includes('Cabang B '+marker));
 ok((await request(`/go/maps/${slug}?branch=${a.id}`)).status===404);
 await clearOwnAnalytics();
 assert.deepEqual(await query('SELECT * FROM site_settings'),originalSettings);checks++;
 assert.deepEqual(await query('SELECT * FROM bio_settings'),originalBio);checks++;
 assert.deepEqual((await query('SELECT (SELECT COUNT(*) FROM visits) visits,(SELECT COUNT(*) FROM clicks) clicks'))[0],counts);checks++;
 console.log(`${checks} location checks passed. User settings and statistics preserved.`);
} finally {
 await new Promise(resolve=>server.close(resolve));await clearOwnAnalytics();
 for(const rowId of links)await query('DELETE FROM bio_links WHERE id=? AND title LIKE ?',[rowId,'%'+marker]);
 if(contactId)await query('DELETE FROM contacts WHERE id=? AND slug=?',[contactId,'location-qa-'+marker]);
 for(const rowId of branches)await query('DELETE FROM branches WHERE id=? AND name LIKE ?',[rowId,'%'+marker]);
 assert.deepEqual(await query('SELECT * FROM branches ORDER BY id'),originalBranches);
 if(adminId)await query('DELETE FROM users WHERE id=? AND email=?',[adminId,email]);
 for(const sessionId of sessions)await query('DELETE FROM sessions WHERE session_id=?',[sessionId]);
 await closeResources();
}
