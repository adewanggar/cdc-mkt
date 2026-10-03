import { createHmac, timingSafeEqual } from 'node:crypto';
export function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }
export function passwordInput(value) {
 if(typeof value!=='string' || !value.length || Buffer.byteLength(value)>72 || value.includes('\0')) throw invalid('Password harus diisi dan maksimal 72 byte.');
 return value;
}
export function text(value, label, max = 200, required = true) {
 if (typeof value !== 'string') { if (!required && value == null) return ''; throw invalid(`${label} wajib diisi.`); }
 const clean = value.trim();
 if ((required && !clean) || clean.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(clean)) throw invalid(`${label} tidak valid (maks. ${max} karakter).`);
 return clean;
}
export function normalizeWA(input) {
 let number = text(input, 'Nomor WhatsApp', 30);
 if (!/^[+\d\s().-]+$/.test(number)) throw invalid('Nomor WhatsApp hanya boleh berisi nomor.');
 number = number.replace(/[^\d]/g, '');
 if (number.startsWith('00')) number = number.slice(2);
 if (number.startsWith('08')) number = '62' + number.slice(1);
 if (!/^[1-9]\d{7,14}$/.test(number)) throw invalid('Gunakan nomor internasional atau nomor 08xx.');
 return number;
}
export function safeURL(input, kind = 'website') {
 const value = text(input, 'URL', 2048);
 if (kind === 'phone') {
  if (!/^tel:\+?\d{6,15}$/.test(value)) throw invalid('Gunakan format telepon tel:+6221xxxx.');
  return value;
 }
 let url;
 try { url = new URL(value); } catch { throw invalid('URL tidak valid.'); }
 if (url.protocol !== 'https:' || url.username || url.password) throw invalid('URL harus menggunakan HTTPS tanpa kredensial.');
 if (kind === 'maps' && !['google.com','www.google.com','maps.google.com','google.co.id','www.google.co.id','maps.app.goo.gl','goo.gl'].includes(url.hostname)) throw invalid('Gunakan link Google Maps resmi.');
 return url.href;
}
export function id(value, optional = false) {
 if (optional && (value === '' || value == null)) return null;
 if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw invalid('ID tidak valid.');
 return Number(value);
}
export function slug(value) {
 const result = text(value, 'Slug', 80);
 if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result) || result === 'default') throw invalid('Slug harus huruf kecil, angka, atau tanda hubung; "default" dicadangkan.');
 return result;
}
export function color(value) {
 if (!/^#[0-9a-fA-F]{6}$/.test(value || '')) throw invalid('Warna harus berupa hex 6 digit.');
 return value.toLowerCase();
}
export function ink(hex) {
 const rgb = hex.slice(1).match(/../g).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722 > .179 ? '#102e54' : '#ffffff';
}
export function parseHours(input) {
 const result = {};
 for (let day = 0; day < 7; day++) {
  if (input[`closed_${day}`]) { result[day] = null; continue; }
  const open = input[`open_${day}`], close = input[`close_${day}`];
  if (![open,close].every(v=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v || '')) || open === close) throw invalid('Jam buka/tutup harus valid dan berbeda.');
  result[day] = { open, close };
 }
 return result;
}
export const dayNames = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
export function openingStatus(hours, now = new Date()) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Jakarta', weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(now).map(p=>[p.type,p.value]));
 const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday), clock = parts.hour+':'+parts.minute;
 const today = hours[day], yesterday = hours[(day+6)%7];
 const overnightYesterday = yesterday && yesterday.close < yesterday.open && clock < yesterday.close;
 const open = !!(overnightYesterday || (today && (today.open < today.close ? clock >= today.open && clock < today.close : clock >= today.open)));
 return { open, label: open ? 'Buka sekarang' : 'Sedang tutup', today: today ? `${today.open}–${today.close} WIB` : 'Tutup hari ini' };
}
export function device(agent = '') { return /ipad|tablet|android(?!.*mobile)/i.test(agent) ? 'tablet' : /mobile|iphone|ipod/i.test(agent) ? 'mobile' : 'desktop'; }
export function ipHash(ip, secret) { return createHmac('sha256', secret).update(ip || '').digest('hex'); }
export function csrfEqual(a,b) { return typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b)); }
export function csvCell(value) {
 let s=String(value ?? '');
 if (/^[\s]*[=+@-]/.test(s)) s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
export function referrer(value) { try { const u=new URL(value); return (u.origin+u.pathname).slice(0,2048); } catch { return ''; } }
