-- Sample configuration preserved from the local preview. Replace sample contact details before use.
-- Import once after schema.sql. Admin is disabled until db:init/admin:reset hashes your own password.
INSERT INTO users (id,name,email,password_hash) VALUES
 (1,'Administrator','admin@example.test','DISABLED_SET_WITH_DB_INIT');
INSERT INTO branches (id,name,address,maps_url,is_active) VALUES
 (1,'Cabang Utama','Jl. Kesehatan No. 18, Jakarta Selatan','https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan',1);
INSERT INTO contacts (id,slug,name,job_title,photo_path,wa_number,wa_message,branch_id,is_active) VALUES
 (1,'umum','Tim Customer Care','Layanan pelanggan',NULL,'6281234567890','Halo, saya ingin bertanya tentang layanan pemeriksaan laboratorium.',1,1),
 (2,'budi','Budi Santoso','Marketing Executive',NULL,'6281234567891','Halo Budi, saya mendapat kartu nama Anda. Saya ingin bertanya tentang layanan lab.',1,1),
 (3,'sari','Sari Putri','Marketing Executive',NULL,'6281234567892','Halo Sari, saya mendapat kartu nama Anda. Saya ingin bertanya tentang layanan lab.',1,1);
INSERT INTO site_settings (id,lab_name,tagline,greeting,logo_path,address,opening_hours,primary_color,accent_color,default_maps_url,default_wa_number,default_wa_message,default_contact_id,marketing_noindex) VALUES
 (1,'Cahaya Diagnostic Centre','Lebih dekat dengan kesehatan Anda.','Halo! Ada yang bisa kami bantu?',NULL,'Jl. Kesehatan No. 18, Jakarta Selatan','{\"0\":null,\"1\":{\"open\":\"07:00\",\"close\":\"20:00\"},\"2\":{\"open\":\"07:00\",\"close\":\"20:00\"},\"3\":{\"open\":\"07:00\",\"close\":\"20:00\"},\"4\":{\"open\":\"07:00\",\"close\":\"20:00\"},\"5\":{\"open\":\"07:00\",\"close\":\"20:00\"},\"6\":{\"open\":\"07:00\",\"close\":\"14:00\"}}','#004aad','#ffde59','https://www.google.com/maps/search/?api=1&query=Jakarta+Selatan','6281234567890','Halo, saya ingin bertanya tentang layanan lab.',1,1);
INSERT INTO extra_buttons (id,title,url,icon,sort_order,is_active) VALUES
 (1,'Telepon','tel:+62215550123','phone',1,1),
 (2,'Instagram','https://www.instagram.com/','instagram',2,1),
 (3,'Daftar layanan','https://example.com/layanan.pdf','catalog',3,1);

-- Supplied Cahaya Diagnostic Centre logo, bundled in public/assets.
UPDATE site_settings SET logo_path='/assets/cahaya-logo-white.svg' WHERE id=1;
