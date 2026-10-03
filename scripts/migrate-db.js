import { pool, query } from '../src/db.js';
import { readFile } from 'node:fs/promises';

try {
 const columns=await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='site_settings' AND COLUMN_NAME='show_lab_name'");
 if(!columns.length) await query('ALTER TABLE site_settings ADD COLUMN show_lab_name BOOLEAN NOT NULL DEFAULT TRUE');
 await query(await readFile(new URL('../migrations/shortlinks.sql',import.meta.url),'utf8'));
 const [codeColumn]=await query("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='short_links' AND COLUMN_NAME='slug'");
 if(codeColumn.COLLATION_NAME!=='ascii_bin') await query('ALTER TABLE short_links MODIFY slug VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL');
 console.log('Database updated; existing settings and contacts preserved.');
} finally { await pool.end(); }
