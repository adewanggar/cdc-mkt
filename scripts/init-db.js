import 'dotenv/config';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { dbOptions, pool } from '../src/db.js';
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || Buffer.byteLength(process.env.ADMIN_PASSWORD)>72 || process.env.ADMIN_PASSWORD.startsWith('replace-')) {
 throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters in .env.');
}
const connection = await mysql.createConnection({ ...dbOptions, multipleStatements: true });
try {
 const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
 if (tables.length) throw new Error('Database already initialized; use admin to edit data. No data was overwritten.');
 await connection.query(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
 await connection.query(await readFile(new URL('../seed.sql', import.meta.url), 'utf8'));
 await connection.execute('UPDATE users SET name=?,email=?,password_hash=? WHERE id=1', [
  process.env.ADMIN_NAME || 'Administrator', process.env.ADMIN_EMAIL || 'admin@example.test', await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
 ]);
 console.log('Schema, example data, and admin account initialized.');
} finally { await connection.end(); await pool.end(); }
