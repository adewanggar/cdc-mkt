import 'dotenv/config';
import mysql from 'mysql2/promise';
export const dbOptions = {
 host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
 user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
 charset: 'utf8mb4', timezone: 'Z', connectionLimit: 8
};
export const pool = mysql.createPool(dbOptions);
pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
export async function query(sql, params = []) { return (await pool.execute(sql, params))[0]; }
