import { pool, query } from '../src/db.js';
import { readFile } from 'node:fs/promises';

try {
 const columns=await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='site_settings' AND COLUMN_NAME='show_lab_name'");
 if(!columns.length) await query('ALTER TABLE site_settings ADD COLUMN show_lab_name BOOLEAN NOT NULL DEFAULT TRUE');
 await query(await readFile(new URL('../migrations/shortlinks.sql',import.meta.url),'utf8'));
 const [codeColumn]=await query("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='short_links' AND COLUMN_NAME='slug'");
 if(codeColumn.COLLATION_NAME!=='ascii_bin') await query('ALTER TABLE short_links MODIFY slug VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL');
 for(const file of ['bio-settings.sql','bio-links.sql','bio-sections.sql']) await query(await readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const sectionColumn=await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bio_links' AND COLUMN_NAME='section_id'");
 if(!sectionColumn.length) await query('ALTER TABLE bio_links ADD COLUMN section_id BIGINT UNSIGNED NULL, ADD CONSTRAINT bio_links_section_fk FOREIGN KEY (section_id) REFERENCES bio_sections(id) ON DELETE SET NULL');
 await query("INSERT IGNORE INTO bio_settings (id,title,description,logo_path,primary_color,accent_color) SELECT 1,lab_name,'Informasi, layanan, dan kabar terbaru.',logo_path,primary_color,accent_color FROM site_settings WHERE id=1");
 console.log('Database updated; existing settings and contacts preserved.');
} finally { await pool.end(); }
