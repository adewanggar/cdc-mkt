import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {pool,query} from '../src/db.js';
const password=process.env.ADMIN_PASSWORD;
if(!password || password.length<12 || Buffer.byteLength(password)>72 || password.startsWith('replace-')) throw new Error('Set a unique ADMIN_PASSWORD: 12+ characters, at most 72 bytes.');
try {
 const result=await query('UPDATE users SET name=?,email=?,password_hash=?,session_version=session_version+1 WHERE id=1',[
  process.env.ADMIN_NAME || 'Administrator',process.env.ADMIN_EMAIL || 'admin@example.test',await bcrypt.hash(password,12)
 ]);
 if(!result.affectedRows) throw new Error('No seeded admin (id=1). Import schema/seed first.');
 console.log('Admin account configured. Existing sessions revoked.');
} finally {await pool.end();}
