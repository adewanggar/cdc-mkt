import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MySQLSession from 'express-mysql-session';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlink } from 'node:fs/promises';
import { pool, query, dbOptions } from './db.js';
import { invalid,text,passwordInput,normalizeWA,safeURL,id,slug,shortlinkCode,randomShortlinkCode,color,ink,parseHours,dayNames,openingStatus,device,ipHash,csrfEqual,csvCell,referrer } from './helpers.js';

const root = fileURLToPath(new URL('../',import.meta.url));
const production = process.env.NODE_ENV === 'production';
for (const key of ['SESSION_SECRET','IP_HASH_SECRET']) {
 if (!process.env[key] || process.env[key].length < 32 || process.env[key].startsWith('replace-')) throw new Error(`Set ${key} to at least 32 random characters.`);
}
const origin = new URL(process.env.APP_URL || 'http://localhost:3000');
if ((production && origin.protocol !== 'https:') || !['https:','http:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/') throw new Error('APP_URL must be a trusted site origin (HTTPS in production, no subpath).');
export const app = express();
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
app.disable('x-powered-by');
app.set('view engine','ejs'); app.set('views',path.join(root,'views'));
app.use(helmet({ contentSecurityPolicy:{ directives:{
 defaultSrc:["'self'"], scriptSrc:["'self'"], styleSrc:["'self'"], imgSrc:["'self'",'data:'],
 fontSrc:["'self'"], connectSrc:["'self'"], formAction:["'self'"], frameAncestors:["'none'"],
 upgradeInsecureRequests:production ? [] : null
} }, strictTransportSecurity:production ? undefined : false }));
app.use(compression());
app.use(express.urlencoded({ extended:false,limit:'32kb' }));
app.get('/theme.css', async (req,res)=> {
 const s=await settings();
 res.type('css').set('Cache-Control','no-cache').send(`:root{--primary:${s.primary_color};--accent:${s.accent_color};--primary-ink:${ink(s.primary_color)};--accent-ink:${ink(s.accent_color)}}`);
});
app.use(express.static(path.join(root,'public'), { maxAge:'1h',dotfiles:'deny',index:false }));
async function settings() { const [s]=await query('SELECT * FROM site_settings WHERE id=1'); if(!s) throw new Error('Initialize database first.'); if(typeof s.opening_hours==='string') s.opening_hours=JSON.parse(s.opening_hours); return s; }
async function bioSettings() { const [bio]=await query('SELECT * FROM bio_settings WHERE id=1'); if(!bio) throw new Error('Run database migration first.'); return bio; }
app.get('/bio/theme.css',async(req,res)=> {
 const bio=await bioSettings();
 res.type('css').set('Cache-Control','no-cache').send(`:root{--primary:${bio.primary_color};--accent:${bio.accent_color};--primary-ink:${ink(bio.primary_color)};--accent-ink:${ink(bio.accent_color)}}`);
});
app.get('/bio',async(req,res)=> {
 const bio=await bioSettings();
 if(!bio.is_active) return res.status(404).render('error',{message:'Halaman Bio Instagram sedang nonaktif.'});
 const [links,bioSections]=await Promise.all([
  query('SELECT l.* FROM bio_links l LEFT JOIN bio_sections s ON s.id=l.section_id WHERE l.is_active=1 AND (l.section_id IS NULL OR s.is_active=1) ORDER BY l.sort_order,l.id'),
  query('SELECT * FROM bio_sections WHERE is_active=1 ORDER BY sort_order,id')
 ]);
 const groups=[{id:null,title:''},...bioSections].map(section=>({...section,links:links.filter(link=>link.section_id===section.id)})).filter(section=>section.links.length);
 res.set('Cache-Control','no-store').render('bio-public',{bio,links,groups,canonical:new URL('/bio',origin).href});
});
async function resolveContact(routeSlug) {
 const s=await settings(); let c;
 if (routeSlug === 'default') {
  if(s.default_contact_id) [c]=await query('SELECT * FROM contacts WHERE id=? AND is_active=1',[s.default_contact_id]);
 } else {
  if(!/^[a-z0-9-]{1,80}$/.test(routeSlug)) throw Object.assign(new Error('Kontak tidak ditemukan.'),{status:404});
  [c]=await query('SELECT * FROM contacts WHERE slug=? AND is_active=1',[routeSlug]);
  if(!c) throw Object.assign(new Error('Kontak tidak ditemukan atau sudah nonaktif.'),{status:404});
 }
 let branch; if(c?.branch_id) [branch]=await query('SELECT * FROM branches WHERE id=? AND is_active=1',[c.branch_id]);
 return { s,c,branch,wa:c?.wa_number || s.default_wa_number,message:c?.wa_message || s.default_wa_message,
 maps:branch?.maps_url || s.default_maps_url,address:branch?.address || s.address };
}
app.get('/healthz',async(req,res)=> { await query('SELECT 1'); res.json({status:'ok'}); });
app.get('/s/:code',async(req,res)=> {
 const code=req.params.code;
 if(code.length>80 || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(code)) throw Object.assign(new Error('Shortlink tidak ditemukan.'),{status:404});
 const [link]=await query('SELECT id,target_url FROM short_links WHERE slug=? AND is_active=1',[code]);
 if(!link) throw Object.assign(new Error('Shortlink tidak ditemukan atau sudah nonaktif.'),{status:404});
 const destination=safeURL(link.target_url);
 if(req.method==='GET') {
  try { await query('UPDATE short_links SET click_count=click_count+1 WHERE id=?',[link.id]); }
  catch(err) { console.error('Shortlink counting unavailable:',err.code); }
 }
 res.set('Cache-Control','no-store').set('X-Robots-Tag','noindex, nofollow').redirect(302,destination);
});
async function publicPage(req,res,routeSlug) {
 const data=await resolveContact(routeSlug);
 if(req.method==='GET') {
  try { await query('INSERT INTO visits (contact_id,device_type,referrer,ip_hash) VALUES (?,?,?,?)',[
   data.c?.id || null,device(req.get('user-agent')),referrer(req.get('referer')),ipHash(req.ip,process.env.IP_HASH_SECRET)
  ]); } catch(e) { console.error('Visit tracking unavailable:',e.code); }
 }
 const buttons=await query('SELECT * FROM extra_buttons WHERE is_active=1 ORDER BY sort_order,id');
 res.set('Cache-Control','no-store').render('public',{...data,buttons,routeSlug,dayNames,status:openingStatus(data.s.opening_hours),
  canonical:new URL(routeSlug==='default' ? '/' : `/m/${routeSlug}`,origin).href,individual:routeSlug!=='default'});
}
app.get('/',(req,res)=>publicPage(req,res,'default'));
app.get('/m/:slug',(req,res)=>publicPage(req,res,req.params.slug));
app.get('/go/:type/:slug',async(req,res)=> {
 const data=await resolveContact(req.params.slug); let destination,buttonType;
 if(req.params.type==='wa') { destination=`https://wa.me/${normalizeWA(data.wa)}?text=${encodeURIComponent(data.message)}`; buttonType='whatsapp'; }
 else if(req.params.type==='care') { destination=`https://wa.me/628113052999?text=${encodeURIComponent('Halo Customer Care, saya ingin bertanya tentang layanan laboratorium.')}`; buttonType='whatsapp'; }
 else if(req.params.type==='maps') { destination=safeURL(data.maps,'maps'); buttonType='maps'; }
 else if(/^extra-\d+$/.test(req.params.type)) {
  const [button]=await query('SELECT * FROM extra_buttons WHERE id=? AND is_active=1',[id(req.params.type.slice(6))]);
  if(!button) throw Object.assign(new Error('Tombol tidak tersedia.'),{status:404});
  destination=safeURL(button.url,button.icon); buttonType=button.icon==='phone' ? 'phone':'other';
 } else throw Object.assign(new Error('Tombol tidak ditemukan.'),{status:404});
 if(req.method==='GET') {
  try { await query('INSERT INTO clicks (contact_id,button_type,device_type) VALUES (?,?,?)',[data.c?.id || null,buttonType,device(req.get('user-agent'))]); }
  catch(e) { console.error('Click tracking unavailable:',e.code); }
 }
 res.set('Cache-Control','no-store').redirect(302,destination);
});

const Store=MySQLSession(session);
export const sessionStore=new Store({ ...dbOptions,createDatabaseTable:false,clearExpired:true,expiration:28800000 });
app.use('/admin',session({ name:'lab.sid',secret:process.env.SESSION_SECRET,store:sessionStore,
 resave:false,saveUninitialized:false,cookie:{ httpOnly:true,secure:production,sameSite:'lax',maxAge:28800000,path:'/admin' }
}));
app.use('/admin',(req,res,next)=> {
 res.set('Cache-Control','no-store').set('X-Robots-Tag','noindex, nofollow');
 req.session.csrf ||= randomBytes(32).toString('hex');
 res.locals.csrf=req.session.csrf; res.locals.path=req.path;
 res.locals.success=req.session.flash || ''; delete req.session.flash;
 next();
});
function csrf(req,res,next) {
 if(!csrfEqual(req.body._csrf,req.session.csrf)) return res.status(403).render('error',{message:'Sesi formulir kedaluwarsa. Muat ulang halaman dan coba lagi.'});
 next();
}
const loginLimiter=rateLimit({ windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,
 message:'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' });
app.get('/admin/login',(req,res)=>req.session.userId ? res.redirect('/admin') : res.render('login',{error:''}));
const dummyHash=await bcrypt.hash(randomBytes(24).toString('hex'),12);
app.post('/admin/login',loginLimiter,csrf,async(req,res)=> {
 const email=text(req.body.email,'Email',190).toLowerCase(),password=passwordInput(req.body.password);
 const [user]=await query('SELECT * FROM users WHERE email=?',[email]);
 const match=await bcrypt.compare(password,user?.password_hash?.startsWith('$2') ? user.password_hash:dummyHash);
 if(!user || !match) return res.status(401).render('login',{error:'Email atau password salah.'});
 await new Promise((resolve,reject)=>req.session.regenerate(err=>err ? reject(err):resolve()));
 req.session.userId=user.id; req.session.version=user.session_version; req.session.csrf=randomBytes(32).toString('hex');
 await new Promise((resolve,reject)=>req.session.save(err=>err ? reject(err):resolve()));
 res.redirect('/admin');
});
app.use('/admin',async(req,res,next)=> {
 if(!req.session.userId) return res.redirect('/admin/login');
 const [user]=await query('SELECT id,name,email,session_version FROM users WHERE id=?',[req.session.userId]);
 if(!user || user.session_version!==req.session.version) {
  return req.session.destroy(()=>res.redirect('/admin/login'));
 }
 res.locals.user=user; next();
});
app.post('/admin/logout',csrf,(req,res)=>req.session.destroy(()=>{res.clearCookie('lab.sid',{path:'/admin'});res.redirect('/admin/login');}));

function statsFilter(req) {
 const days=[7,30,90].includes(Number(req.query.days)) ? Number(req.query.days):30;
 const group=['day','week','month'].includes(req.query.group) ? req.query.group:'day';
 const contactId=req.query.contact ? id(req.query.contact):null;
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const start=new Date(`${today}T00:00:00+07:00`); start.setUTCDate(start.getUTCDate()-days+1);
 const end=new Date(`${today}T00:00:00+07:00`); end.setUTCDate(end.getUTCDate()+1);
 const clause=contactId ? ' AND contact_id=?':'';
 const params=[start.toISOString().slice(0,19).replace('T',' '),end.toISOString().slice(0,19).replace('T',' '),...(contactId ? [contactId]:[])];
 return {days,group,contactId,start,end,clause,params};
}
async function statistics(req) {
 const filter=statsFilter(req);
 const time="DATE_ADD(event_at, INTERVAL 7 HOUR)";
 const bucket=filter.group==='month' ? `DATE_FORMAT(${time},'%Y-%m')` : filter.group==='week' ? `DATE_FORMAT(DATE_SUB(${time}, INTERVAL WEEKDAY(${time}) DAY),'%Y-%m-%d')` : `DATE_FORMAT(${time},'%Y-%m-%d')`;
 const events=`SELECT contact_id,visited_at event_at,device_type,'visit' kind FROM visits WHERE visited_at>=? AND visited_at<?${filter.clause}
 UNION ALL SELECT contact_id,clicked_at event_at,device_type,button_type kind FROM clicks WHERE clicked_at>=? AND clicked_at<?${filter.clause}`;
 const params=[...filter.params,...filter.params];
 const [totals,series,byContact,byDevice]=await Promise.all([
  query(`SELECT COALESCE(SUM(kind='visit'),0) visits,COALESCE(SUM(kind='whatsapp'),0) whatsapp,COALESCE(SUM(kind='maps'),0) maps,COALESCE(SUM(kind NOT IN ('visit','whatsapp','maps')),0) other FROM (${events}) e`,params),
  query(`SELECT ${bucket} bucket,SUM(kind='visit') visits,SUM(kind='whatsapp') whatsapp,SUM(kind='maps') maps FROM (${events}) e GROUP BY bucket ORDER BY bucket`,params),
  query(`SELECT COALESCE(c.name,'Kontak umum / dihapus') name,c.slug,SUM(e.kind='visit') visits,SUM(e.kind='whatsapp') whatsapp,SUM(e.kind='maps') maps FROM (${events}) e LEFT JOIN contacts c ON c.id=e.contact_id GROUP BY e.contact_id,c.name,c.slug ORDER BY visits DESC`,params),
  query(`SELECT device_type,SUM(kind='visit') visits FROM (${events}) e GROUP BY device_type`,params)
 ]);
 // Include days with zero activity so the trend never silently bridges missing days.
 const buckets=new Map();
 for(let date=new Date(filter.start.getTime()+7*3600000);date<new Date(filter.end.getTime()+7*3600000);date.setUTCDate(date.getUTCDate()+1)) {
  const bucketDate=new Date(date);
  if(filter.group==='week') bucketDate.setUTCDate(bucketDate.getUTCDate()-(bucketDate.getUTCDay()+6)%7);
  const key=bucketDate.toISOString().slice(0,filter.group==='month' ? 7:10);
  buckets.set(key,series.find(p=>p.bucket===key) || {bucket:key,visits:0,whatsapp:0,maps:0});
 }
 return {...filter,totals:totals[0],series:Number(totals[0].visits)+Number(totals[0].whatsapp)+Number(totals[0].maps) ? [...buckets.values()]:[],byContact,byDevice};
}
app.get('/admin',async(req,res)=> {
 const [stats,contacts,s]=await Promise.all([statistics(req),query('SELECT * FROM contacts ORDER BY name'),settings()]);
 res.render('admin',{section:'dashboard',title:'Ringkasan',s,contacts,stats,branches:[],buttons:[],dayNames,origin:origin.origin});
});
app.get('/admin/stats.csv',async(req,res)=> {
 const f=statsFilter(req);
 const events=`SELECT contact_id,visited_at event_at,device_type,'visit' kind FROM visits WHERE visited_at>=? AND visited_at<?${f.clause}
 UNION ALL SELECT contact_id,clicked_at event_at,device_type,button_type kind FROM clicks WHERE clicked_at>=? AND clicked_at<?${f.clause}`;
 // Stream in batches; bound memory even when the chosen period has many events.
 res.attachment('statistik-lab.csv').type('text/csv; charset=utf-8');
 res.write('\uFEFFWaktu (WIB),Marketing,Slug,Kegiatan,Perangkat\r\n');
 let offset=0;
 while(!res.destroyed) {
  const rows=await query(`SELECT DATE_FORMAT(DATE_ADD(e.event_at,INTERVAL 7 HOUR),'%Y-%m-%d %H:%i:%s') time,COALESCE(c.name,'Kontak umum / dihapus') name,c.slug,e.kind,e.device_type FROM (${events}) e LEFT JOIN contacts c ON c.id=e.contact_id ORDER BY e.event_at,e.contact_id,e.kind LIMIT 1000 OFFSET ${offset}`,[...f.params,...f.params]);
  if(!rows.length) break;
  for(const row of rows) {
   if(res.destroyed) break;
   if(!res.write([row.time,row.name,row.slug,row.kind,row.device_type].map(csvCell).join(',')+'\r\n')) {
    await new Promise(resolve=>{ const finish=()=>{res.off('drain',finish);res.off('close',finish);resolve();};res.once('drain',finish);res.once('close',finish); });
   }
  }
  offset+=rows.length;
 }
 res.end();
});
const sections={settings:'Pengaturan lab',contacts:'Kontak marketing',branches:'Lokasi & cabang',buttons:'Tombol tambahan',bio:'Bio Instagram',shortlinks:'Shortlink',qr:'QR kartu nama',users:'Kelola admin',password:'Keamanan akun'};
app.get('/admin/:section',async(req,res)=> {
 const section=req.params.section;
 if(!sections[section]) return res.status(404).render('error',{message:'Halaman tidak ditemukan.'});
 const [s,contacts,branches,buttons,admins,shortlinks]=await Promise.all([settings(),query('SELECT c.*,b.name branch_name FROM contacts c LEFT JOIN branches b ON b.id=c.branch_id ORDER BY c.id'),query('SELECT * FROM branches ORDER BY id'),query('SELECT * FROM extra_buttons ORDER BY sort_order,id'),section==='users' ? query('SELECT id,name,email FROM users ORDER BY id'):[],section==='shortlinks' ? query('SELECT * FROM short_links ORDER BY id DESC'):[]]);
 const [bio,bioLinks,bioSections]=section==='bio' ? await Promise.all([bioSettings(),query('SELECT * FROM bio_links ORDER BY sort_order,id'),query('SELECT * FROM bio_sections ORDER BY sort_order,id')]):[null,[],[]];
 res.render('admin',{section,title:sections[section],s,contacts,branches,buttons,admins,shortlinks,bio,bioLinks,bioSections,dayNames,origin:origin.origin,stats:null});
});
async function activeRelation(table,value) {
 const relationId=id(value,true);
 if(relationId && !(await query(`SELECT id FROM ${table} WHERE id=? AND is_active=1`,[relationId])).length) throw invalid('Pilih kontak atau cabang yang aktif.');
 return relationId;
}
function done(req,res,url,message='Perubahan berhasil disimpan.') { req.session.flash=message; res.redirect(url); }
app.post('/admin/settings',csrf,async(req,res)=> {
 const b=req.body;
 const values=[text(b.lab_name,'Nama lab',150),text(b.tagline,'Tagline',200,false),text(b.greeting,'Sapaan',200,false),
 text(b.address,'Alamat',500),JSON.stringify(parseHours(b)),color(b.primary_color),color(b.accent_color),safeURL(b.default_maps_url,'maps'),
 normalizeWA(b.default_wa_number),text(b.default_wa_message,'Pesan WhatsApp',1000),await activeRelation('contacts',b.default_contact_id),b.marketing_noindex ? 1:0,b.show_lab_name === '1' ? 1:0];
 await query('UPDATE site_settings SET lab_name=?,tagline=?,greeting=?,address=?,opening_hours=?,primary_color=?,accent_color=?,default_maps_url=?,default_wa_number=?,default_wa_message=?,default_contact_id=?,marketing_noindex=?,show_lab_name=? WHERE id=1',values);
 done(req,res,'/admin/settings');
});
app.post('/admin/bio',csrf,async(req,res)=> {
 const b=req.body;
 await query('UPDATE bio_settings SET title=?,description=?,primary_color=?,accent_color=?,show_title=?,is_active=? WHERE id=1',[
  text(b.title,'Judul halaman',150),text(b.description,'Deskripsi',500,false),color(b.primary_color),color(b.accent_color),b.show_title==='1' ? 1:0,b.is_active==='1' ? 1:0
 ]);
 done(req,res,'/admin/bio','Pengaturan Bio Instagram berhasil disimpan.');
});
const models={
 biosections:{table:'bio_sections',redirect:'/admin/bio',fields:['title','sort_order','is_active'],values:async b=> {
  const order=Number(b.sort_order);if(!Number.isInteger(order) || order<0 || order>999) throw invalid('Urutan harus 0–999.');
  return [text(b.title,'Judul section',150),order,b.is_active==='1' ? 1:0];
 }},
 biolinks:{table:'bio_links',redirect:'/admin/bio',fields:['title','subtitle','url','icon','sort_order','is_active','section_id'],values:async b=> {
  if(!['website','whatsapp','maps','instagram','catalog','phone'].includes(b.icon)) throw invalid('Jenis tombol tidak valid.');
  const order=Number(b.sort_order);if(!Number.isInteger(order) || order<0 || order>999) throw invalid('Urutan harus 0–999.');
  const sectionId=id(b.section_id,true);
  if(sectionId && !(await query('SELECT id FROM bio_sections WHERE id=?',[sectionId])).length) throw invalid('Section tidak ditemukan.');
  return [text(b.title,'Judul tombol',150),text(b.subtitle,'Keterangan tombol',200,false),safeURL(b.url,b.icon),b.icon,order,b.is_active==='1' ? 1:0,sectionId];
 }},
 contacts:{ fields:['slug','name','job_title','wa_number','wa_message','branch_id','is_active'],
  values:async b=>[slug(b.slug),text(b.name,'Nama',100),text(b.job_title,'Jabatan',100),normalizeWA(b.wa_number),text(b.wa_message,'Pesan',1000),await activeRelation('branches',b.branch_id),b.is_active ? 1:0] },
 branches:{ fields:['name','address','maps_url','is_active'], values:async b=>[text(b.name,'Nama cabang',150),text(b.address,'Alamat',500),safeURL(b.maps_url,'maps'),b.is_active ? 1:0] },
 buttons:{table:'extra_buttons',fields:['title','url','icon','sort_order','is_active'],values:async b=> {
  if(!['phone','instagram','website','catalog'].includes(b.icon)) throw invalid('Jenis tombol tidak valid.');
  const order=Number(b.sort_order); if(!Number.isInteger(order) || order<0 || order>999) throw invalid('Urutan harus 0–999.');
  return [text(b.title,'Judul',100),safeURL(b.url,b.icon),b.icon,order,b.is_active ? 1:0];
 }}
};
app.post('/admin/:model/save',csrf,async(req,res)=> {
 const model=models[req.params.model]; if(!model) throw invalid('Jenis data tidak valid.');
 const table=model.table || req.params.model,values=await model.values(req.body);
 if(req.body.id) {
  const rowId=id(req.body.id);
  const result=await query(`UPDATE ${table} SET ${model.fields.map(f=>`${f}=?`).join(',')} WHERE id=?`,[...values,rowId]);
  if(!result.affectedRows) throw invalid('Data tidak ditemukan.');
 } else await query(`INSERT INTO ${table} (${model.fields.join(',')}) VALUES (${values.map(()=>'?').join(',')})`,values);
 done(req,res,model.redirect || `/admin/${req.params.model}`);
});
async function removePhoto(photo) {
 if(/^\/uploads\/[a-f0-9-]+\.webp$/.test(photo || '')) {
  const refs=await query('SELECT id FROM contacts WHERE photo_path=? UNION ALL SELECT id FROM site_settings WHERE logo_path=? UNION ALL SELECT id FROM bio_settings WHERE logo_path=? LIMIT 1',[photo,photo,photo]);
  if(!refs.length) await unlink(path.join(root,'public',photo)).catch(()=>{});
 }
}
app.post('/admin/:model/:id/delete',csrf,async(req,res)=> {
 const model=models[req.params.model]; if(!model) throw invalid('Jenis data tidak valid.');
 const rowId=id(req.params.id),table=model.table || req.params.model;
 let old; if(req.params.model==='contacts') [old]=await query('SELECT photo_path FROM contacts WHERE id=?',[rowId]);
 await query(`DELETE FROM ${table} WHERE id=?`,[rowId]); await removePhoto(old?.photo_path);
 done(req,res,model.redirect || `/admin/${req.params.model}`,'Data berhasil dihapus.');
});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2*1024*1024,files:1,fields:5},fileFilter:(req,file,cb)=> {
 cb(['image/jpeg','image/png','image/webp'].includes(file.mimetype) ? null:invalid('Gambar harus JPG, PNG, atau WebP.'),true);
}});
app.post('/admin/upload',upload.single('image'),csrf,async(req,res)=> {
 if(!req.file) throw invalid('Pilih gambar maksimal 2 MB.');
 const contactId=req.body.target==='contact' ? id(req.body.contact_id):null;
 const bioTarget=req.body.target==='biologo';
 if(!contactId && !['logo','biologo'].includes(req.body.target)) throw invalid('Tujuan upload tidak valid.');
 const [record]=contactId ? await query('SELECT photo_path FROM contacts WHERE id=?',[contactId]):[bioTarget ? await bioSettings():await settings()];
 if(!record) throw invalid('Kontak tidak ditemukan.');
 const fileName=randomUUID()+'.webp',photo='/uploads/'+fileName;
 try {
  const metadata=await sharp(req.file.buffer,{limitInputPixels:16000000}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)) throw invalid('Format gambar tidak valid.');
  await sharp(req.file.buffer,{limitInputPixels:16000000,animated:false}).rotate().resize(contactId ? 400:600,contactId ? 400:600,{fit:contactId ? 'cover':'inside',withoutEnlargement:true}).webp({quality:82}).toFile(path.join(root,'public','uploads',fileName));
 } catch { throw invalid('Isi gambar tidak valid atau dimensi terlalu besar.'); }
 try {
  await query(contactId ? 'UPDATE contacts SET photo_path=? WHERE id=?':bioTarget ? 'UPDATE bio_settings SET logo_path=? WHERE id=?':'UPDATE site_settings SET logo_path=? WHERE id=?',[photo,contactId || 1]);
 } catch(e) { await removePhoto(photo); throw e; }
 await removePhoto(contactId ? record.photo_path:record.logo_path);
 done(req,res,contactId ? '/admin/contacts':bioTarget ? '/admin/bio':'/admin/settings','Gambar berhasil diunggah dan dikompres.');
});
app.post('/admin/image/remove',csrf,async(req,res)=> {
 const contactId=req.body.target==='contact' ? id(req.body.contact_id):null;
 const bioTarget=req.body.target==='biologo';
 if(!contactId && !['logo','biologo'].includes(req.body.target)) throw invalid('Tujuan tidak valid.');
 const [record]=contactId ? await query('SELECT photo_path FROM contacts WHERE id=?',[contactId]):[bioTarget ? await bioSettings():await settings()];
 if(!record) throw invalid('Data tidak ditemukan.');
 await query(contactId ? 'UPDATE contacts SET photo_path=NULL WHERE id=?':bioTarget ? 'UPDATE bio_settings SET logo_path=NULL WHERE id=?':'UPDATE site_settings SET logo_path=NULL WHERE id=?',[contactId || 1]);
 await removePhoto(contactId ? record.photo_path:record.logo_path);
 done(req,res,contactId ? '/admin/contacts':bioTarget ? '/admin/bio':'/admin/settings');
});
app.post('/admin/shortlinks',csrf,async(req,res)=> {
 const b=req.body,title=text(b.title,'Nama link',150),url=safeURL(b.target_url),active=b.is_active==='1' ? 1:0;
 if(url.length>2048) throw invalid('Link tujuan maksimal 2048 karakter.');
 const target=new URL(url);
 if(target.origin===origin.origin && /^\/s(?:\/|$)/.test(target.pathname)) throw invalid('Gunakan link tujuan asli, bukan shortlink situs ini.');
 if(b.id) {
  const result=await query('UPDATE short_links SET title=?,target_url=?,is_active=? WHERE id=?',[title,url,active,id(b.id)]);
  if(!result.affectedRows) throw invalid('Shortlink tidak ditemukan.');
 } else {
  const custom=text(b.slug,'Nama singkat',80,false);
  for(let attempt=0;attempt<3;attempt++) {
   const code=custom ? shortlinkCode(custom):randomShortlinkCode();
   try { await query('INSERT INTO short_links (title,slug,target_url,is_active) VALUES (?,?,?,?)',[title,code,url,active]); break; }
   catch(err) {
    if(err.code==='ER_DUP_ENTRY' && custom) throw invalid('Nama singkat sudah digunakan. Pilih nama lain.');
    if(err.code==='ER_DUP_ENTRY' && attempt<2) continue;
    throw err;
   }
  }
 }
 done(req,res,'/admin/shortlinks','Shortlink berhasil disimpan.');
});
app.post('/admin/shortlinks/:id/remove',csrf,async(req,res)=> {
 await query('DELETE FROM short_links WHERE id=?',[id(req.params.id)]);
 done(req,res,'/admin/shortlinks','Shortlink berhasil dihapus.');
});
app.post('/admin/users',csrf,async(req,res)=> {
 const name=text(req.body.name,'Nama admin',100),email=text(req.body.email,'Email',190).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid('Masukkan alamat email yang valid.');
 const password=passwordInput(req.body.password);
 if(password.length<12) throw invalid('Password admin baru minimal 12 karakter.');
 if(password!==req.body.confirm_password) throw invalid('Konfirmasi password tidak sama.');
 try { await query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)',[name,email,await bcrypt.hash(password,12)]); }
 catch(err) { if(err.code==='ER_DUP_ENTRY') throw invalid('Email sudah digunakan oleh admin lain.'); throw err; }
 done(req,res,'/admin/users','Admin baru berhasil ditambahkan. Akun sudah bisa digunakan untuk login.');
});
app.post('/admin/password',csrf,async(req,res)=> {
 const old=passwordInput(req.body.current_password),next=passwordInput(req.body.new_password);
 if(next.length<12 || Buffer.byteLength(next)>72) throw invalid('Password baru harus 12 karakter atau lebih, maksimal 72 byte.');
 if(next!==req.body.confirm_password) throw invalid('Konfirmasi password tidak sama.');
 const [user]=await query('SELECT password_hash FROM users WHERE id=?',[req.session.userId]);
 if(!await bcrypt.compare(old,user.password_hash)) throw invalid('Password saat ini salah.');
 await query('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(next,12),req.session.userId]);
 req.session.destroy(()=>{res.clearCookie('lab.sid',{path:'/admin'});res.redirect('/admin/login');});
});
app.get('/admin/qr/:slug/:format',async(req,res)=> {
 const {slug:routeSlug,format}=req.params;
 if(!['png','svg'].includes(format)) throw invalid('Format QR harus PNG atau SVG.');
 await resolveContact(routeSlug);
 const url=new URL(routeSlug==='default' ? '/':`/m/${routeSlug}`,origin).href;
 const options={errorCorrectionLevel:'H',margin:4,width:1600,color:{dark:'#002d68',light:'#ffffff'}};
 res.attachment(`qr-${routeSlug}.${format}`);
 if(format==='svg') res.type('image/svg+xml').send(await QRCode.toString(url,{...options,type:'svg'}));
 else res.type('image/png').send(await QRCode.toBuffer(url,options));
});
app.use((req,res)=>res.status(404).render('error',{message:'Halaman tidak ditemukan.'}));
app.use((err,req,res,next)=> {
 if(res.headersSent) return next(err);
 const status=err.status || (err.code==='ER_DUP_ENTRY' || err instanceof multer.MulterError ? 400:500);
 const message=err.code==='ER_DUP_ENTRY' ? 'Slug atau email sudah digunakan.':err instanceof multer.MulterError ? 'Upload gagal. Batas gambar 2 MB.':status<500 ? err.message:'Layanan sedang mengalami gangguan. Silakan coba lagi.';
 if(status>=500) console.error('Request failed:',err.code || err.name);
 res.status(status).render('error',{message});
});
export async function closeResources() { await sessionStore.close(); await pool.end(); }
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const server=app.listen(Number(process.env.PORT || 3000),()=>console.log(`Lab Connect ready on port ${process.env.PORT || 3000}`));
 for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await closeResources();process.exit(0);}));
}
