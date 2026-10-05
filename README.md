# Lab Connect

Landing page ringan untuk kartu nama marketing laboratorium. Node.js + Express 5, MySQL 8, HTML/EJS, Tailwind CSS yang dikompilasi lokal, dan JavaScript kecil khusus admin. Halaman publik berfungsi tanpa JavaScript dan tanpa CDN.

## Isi proyek

```text
src/                 server Express, koneksi database, validasi
views/               halaman publik, login, dashboard, formulir admin
public/              CSS siap pakai, font lokal, favicon, JS admin
public/uploads/      gambar terkompresi (jangan hilang saat deploy)
scripts/             inisialisasi database dan reset admin
tests/               unit test dan pengujian integrasi MySQL
deploy/              contoh Nginx dan layanan systemd
schema.sql           tabel, indeks, foreign key, sesi
seed.sql             satu lab, satu cabang, tiga kontak, tiga tombol, satu admin
.env.example         contoh konfigurasi, tanpa kredensial produksi
Dockerfile           opsi deploy menggunakan container
compose.yaml         aplikasi + MySQL 8.4 dengan volume persisten
```

## Jalankan lokal

Prasyarat: Node.js 22+, npm, dan MySQL 8. Aplikasi berjalan pada root domain, bukan subfolder.

1. Ekstrak proyek dan buka terminal di folder `lab-connect`.
2. Instal paket menggunakan `npm ci`.
3. Salin `.env.example` menjadi `.env`, lalu isi koneksi database dan alamat situs.
4. Buat database dan akun aplikasi melalui akun administrator MySQL:

```sql
CREATE DATABASE lab_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lab_connect'@'127.0.0.1' IDENTIFIED BY 'GANTI_PASSWORD_DATABASE';
GRANT ALL PRIVILEGES ON lab_connect.* TO 'lab_connect'@'127.0.0.1';
```

`DB_HOST=127.0.0.1` harus sesuai host akun MySQL. Hosting tertentu menggunakan akun `@localhost`; ikuti pengaturan hosting. Hak pembuatan tabel diperlukan saat instalasi. Setelah instalasi, akun runtime hanya perlu SELECT, INSERT, UPDATE, DELETE pada database ini.

5. Isi `ADMIN_EMAIL` dengan email admin, dan `ADMIN_PASSWORD` dengan password unik minimal 12 karakter (maksimal 72 byte). Jangan memakai nilai `replace-...`.
6. Buat dua secret berbeda untuk `SESSION_SECRET` dan `IP_HASH_SECRET`; jalankan perintah berikut dua kali:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

7. Jalankan `npm run db:init`. Perintah ini mengimpor schema dan seed, lalu membuat hash bcrypt admin. Ia menolak menimpa database yang sudah berisi tabel users.
8. Jalankan `npm start`. Buka `http://localhost:3000` dan `http://localhost:3000/admin`. Login dengan email/password yang Anda isi sendiri.

CSS hasil kompilasi sudah disertakan. Jika tampilan diubah, jalankan `npm run build:css`. Untuk pengembangan, tersedia `npm run dev`.

### Import manual melalui phpMyAdmin atau klien MySQL

Pilih database kosong, import `schema.sql`, lalu `seed.sql`. Setelah itu jalankan `npm run admin:reset` dengan `.env` yang sudah diisi. Admin seed dinonaktifkan sampai password di-hash; tidak ada password admin universal yang aktif. Schema ditujukan untuk import sekali, bukan migrasi berulang.

Untuk reset password saat kehilangan akses, isi `ADMIN_PASSWORD` baru, lalu jalankan `npm run admin:reset` dari terminal hosting. Perintah ini mengatur admin seed id=1 dan mencabut seluruh sesi admin lama. Perubahan password dari panel admin juga mencabut seluruh sesi. `ADMIN_PASSWORD` dalam `.env` hanya dipakai oleh skrip instalasi/reset; tidak dipakai untuk login harian.

## Menggunakan admin

- **Pengaturan lab:** identitas, sapaan, logo, alamat, jam per hari, warna, nomor/pesan default, kontak untuk `/`, dan pilihan noindex halaman marketing.
- **Kontak marketing:** tambah, ubah, hapus, aktif/nonaktif; nomor 08xx otomatis menjadi 628xx. Foto opsional dapat diunggah setelah kontak dibuat. Cabang kosong memakai alamat dan Maps default lab.
- **Lokasi & cabang:** atur alamat dan link Google Maps resmi. Cabang nonaktif atau dihapus membuat kontak menggunakan lokasi default.
- **Tombol tambahan:** telepon memakai `tel:+62...`; tautan lain memakai HTTPS. Pilih ikon, urutan, dan status aktif. Katalog PDF memakai URL PDF yang sudah tersedia di hosting.
- **QR kartu nama:** unduh PNG 1600 × 1600 atau SVG. Kode menyimpan URL halaman, bukan nomor WhatsApp. Jangan mengubah slug atau menghapus kontak yang QR-nya masih beredar. Gunakan domain HTTPS final di `APP_URL`, lalu unduh ulang QR sebelum cetak pertama. Saat nomor/pesan/alamat berubah, QR yang sudah dicetak tetap berfungsi.
- **Ringkasan:** filter 7/30/90 hari, marketing, serta grafik harian/mingguan/bulanan. CSV mengekspor event dalam periode dan filter yang sama.
- **Keamanan akun:** ganti password dengan password saat ini. Setelah berhasil, login ulang.

Data seed adalah contoh: nama lab, nomor telepon, alamat, Maps, Instagram, dan katalog harus diganti dengan informasi nyata sebelum dibagikan. Statistik tidak diisi angka palsu.

## Definisi statistik

Setiap permintaan GET ke `/` atau `/m/:slug` dicatat sebagai kunjungan. Scan QR membuka halaman tersebut; pembukaan link langsung dan kunjungan ulang juga tercatat. Jadi angka ini **bukan penghitung scan kamera fisik atau pengunjung unik**. Permintaan HEAD, aset, panel admin, dan QR tidak menambah kunjungan. Bot/pratinjau tautan dapat ikut terhitung.

Klik melalui `/go/wa/:slug`, `/go/maps/:slug`, atau `/go/extra-ID/:slug` dicatat sebelum redirect. Klik bukan bukti bahwa chat terkirim atau pengguna sampai di lokasi. Halaman utama mengatribusikan aktivitas ke kontak default aktif; jika tidak ada, aktivitas masuk ke kontak umum. Kontak yang dihapus tidak menghapus riwayat; relasinya menjadi NULL dan laporan menampilkan “Kontak umum / dihapus”.

Waktu database disimpan UTC; laporan dan jam operasional memakai Asia/Jakarta (WIB), termasuk jam yang melewati tengah malam. Perangkat ditentukan dari User-Agent. IP hanya disimpan sebagai HMAC-SHA256 memakai secret, tanpa IP mentah. Query/fragment referrer dibuang; hanya origin dan path yang disimpan. Log aplikasi tidak mencatat IP pengunjung. Jika Nginx menyimpan access log, atur retensinya atau matikan sesuai kebutuhan privasi.

## Pengujian bertahap

```sh
npm test
```

Unit test memeriksa normalisasi nomor, URL/slug, jam WIB/shift malam, perangkat, hash IP, CSRF, dan CSV. Integrasi memeriksa database seed, autentikasi/sesi, halaman publik, redirect, statistik, CRUD, upload, CSRF, QR yang benar-benar didekode, perubahan password, dan rate limit login.

Untuk integrasi, buat database **terpisah** yang namanya berakhiran `_test`, isi konfigurasi dan password admin, lalu jalankan:

```sh
npm run db:init
npm run test:integration
```

Skrip integrasi membuka server sementara sendiri. Ia menghapus seluruh visits/clicks database test serta menguji perubahan password; jangan arahkan ke database operasional. Anda dapat memakai file `.env.test` terpisah dengan `node --env-file=.env.test tests/integration.js` setelah database test diinisialisasi. `APP_URL` harus tetap berupa origin valid dan admin harus sama dengan konfigurasi test.

Lihat `VALIDATION.md` untuk hasil pengujian paket ini. Target Lighthouse mobile adalah >90; skor aktual hosting dipengaruhi SSL, latency, server, dan gambar yang diunggah.

## Deploy ke VPS dengan Docker Compose

1. Pasang Docker Engine/Compose, Nginx, dan Certbot pada VPS Ubuntu/Debian. Arahkan DNS domain ke IP VPS. Buka port 80 dan 443. Database tidak perlu port publik.
2. Upload proyek, salin `.env.example` menjadi `.env`, isi seluruh password/secret. Atur `NODE_ENV=production`, `APP_URL=https://lab.example.com`, `TRUST_PROXY=1`; pakai domain Anda sendiri. `MYSQL_ROOT_PASSWORD` harus berbeda dari password aplikasi. Jangan commit `.env`.
3. Jalankan:

```sh
docker compose up -d db
docker compose run --rm app npm run db:init
docker compose up -d app
```

4. Salin `deploy/nginx.conf` ke `/etc/nginx/sites-available/lab-connect`; ganti domain, lalu aktifkan:

```sh
sudo ln -s /etc/nginx/sites-available/lab-connect /etc/nginx/sites-enabled/lab-connect
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d lab.example.com
sudo certbot renew --dry-run
```

Certbot memerlukan DNS dan port 80 yang dapat dijangkau. Sesudah SSL aktif, admin memakai cookie Secure. Pastikan HTTP diarahkan ke HTTPS. Contoh proxy mempercayai satu hop, dengan alamat klien ditulis ulang oleh Nginx; jangan memberi akses publik langsung ke port aplikasi. `APP_URL` dipakai untuk QR/canonical dan tidak diambil dari header Host pengunjung.

5. Buka situs HTTPS, login admin, ganti seluruh data contoh, lalu uji kontak dan QR dari ponsel. `https://domain/healthz` mengembalikan status ok bila koneksi database tersedia.

Volume `mysql_data` dan `uploads` harus dicadangkan. Jangan menjalankan `docker compose down -v` pada layanan operasional karena itu menghapus data. Untuk pembaruan kode: backup, upload perubahan, lalu `docker compose up -d --build app`; jangan menjalankan db:init lagi. Pantau dengan `docker compose logs --tail=100 app`.

## Deploy VPS tanpa Docker

Siapkan Node.js 22+, MySQL 8, Nginx, Certbot, dan user sistem `labconnect`. Letakkan proyek di `/var/www/lab-connect`, gunakan `.env` production, lalu jalankan `npm ci --omit=dev` dan instalasi database. CSS sudah dikompilasi dalam paket; lakukan perubahan CSS di lingkungan pengembangan.

Berikan kepemilikan folder uploads pada user aplikasi, dan batasi `.env` agar hanya administrator/user aplikasi yang dapat membacanya. Salin `deploy/lab-connect.service` ke `/etc/systemd/system/`, sesuaikan lokasi Node jika berbeda, lalu:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now lab-connect
sudo systemctl status lab-connect
```

Gunakan konfigurasi Nginx dan langkah SSL di atas. File layanan hanya memperbolehkan penulisan pada folder uploads; berkas aplikasi lain tetap hanya dapat dibaca. Backup database dan uploads sebelum pembaruan.

## Shared hosting cPanel

Hosting harus menyediakan **Setup Node.js App / Application Manager** (Node 22+) serta MySQL 8. Shared hosting PHP saja tidak dapat menjalankan proyek Express ini.

1. Buat database/user melalui MySQL Databases; nama sering diawali prefix akun. Import schema dan seed di phpMyAdmin.
2. Upload aplikasi di luar public_html, pilih domain/subdomain, root aplikasi tersebut, dan startup file `src/server.js`. Gunakan mode production; set variabel `.env`/environment sesuai fitur penyedia. Jalankan instalasi npm dari terminal cPanel.
3. Jalankan `npm run admin:reset` untuk mengaktifkan admin setelah import manual. Pastikan uploads dapat ditulis user aplikasi dan tersimpan saat restart.
4. Aktifkan AutoSSL pada domain dan redirect HTTPS. Atur `APP_URL` domain HTTPS final. Sesuaikan `TRUST_PROXY` dengan jumlah proxy yang dikonfirmasi penyedia; jangan set true yang mempercayai semua proxy.
5. Restart aplikasi melalui cPanel dan uji `/healthz`, login, upload, serta redirect dari HP. Jika penyedia tidak mendukung startup ESM atau Node 22, gunakan VPS yang memenuhi prasyarat.

## Keamanan & perawatan

SQL runtime memakai prepared statements; nama tabel/kolom dinamis hanya berasal dari allowlist internal. Instalasi schema memakai multi-statement hanya pada skrip lokal. Password bcrypt cost 12, sesi disimpan MySQL (bukan MemoryStore), cookie HttpOnly/SameSite, sesi dirotasi setelah login dan dicabut saat password diganti. Semua POST admin dilindungi token CSRF; login dibatasi 10 permintaan per IP per 15 menit. Limiter di memori sesuai deployment satu proses; gunakan store bersama bila nanti menjalankan beberapa replika.

EJS meng-escape input. Helmet memasang CSP; tidak ada JavaScript inline atau CDN publik. URL tervalidasi dan Google Maps dibatasi domain resmi. Upload dibatasi 2 MB/16 megapiksel, MIME dan isi diverifikasi, lalu diubah menjadi WebP dengan nama acak. SVG upload tidak diterima. CSV melindungi sel yang bisa ditafsirkan sebagai rumus spreadsheet. Jika pencatatan analytics gagal, tautan kontak tetap diarahkan; gangguan dicatat tanpa IP mentah.

Cadangkan data, gunakan password unik, dan jalankan `npm audit` saat memperbarui dependensi. Font Plus Jakarta Sans disertakan dengan lisensi OFL dalam `public/fonts/LICENSE.txt`.

Referensi: [keamanan Express](https://expressjs.com/en/advanced/best-practice-security/), [MySQL2 prepared statements](https://sidorares.github.io/node-mysql2/docs), [express-session](https://expressjs.com/en/resources/middleware/session/), [Certbot](https://certbot.eff.org/).

## WhatsApp Customer Care

Setiap halaman HTML (utama, marketing, login, seluruh admin, dan halaman error) memiliki tombol tetap Customer Care **08113052999**, dengan tujuan WhatsApp internasional **628113052999**. Klik dari halaman publik melewati `/go/care/:slug` dan dicatat sebagai klik WhatsApp pada marketing terkait. Pada admin/login/error, tombol membuka WhatsApp langsung agar aktivitas pengelola tidak masuk statistik marketing.

## Template pesan WhatsApp

Pengaturan lab dan formulir kontak marketing menyediakan pilihan template: informasi layanan, harga/paket, reservasi, persiapan pemeriksaan, dan dari kartu nama. Memilih template mengisi pesan dan menyesuaikan nama penerima; pesan tetap dapat diedit sebelum disimpan. Pesan yang sudah tersimpan tidak berubah hanya karena halaman dibuka. Memilih “Tulis pesan sendiri” mempertahankan isi saat ini untuk diedit. Template yang cocok dengan pesan tersimpan terpilih kembali saat formulir dibuka.

## Logo laboratorium

Logo Cahaya Diagnostic Centre yang diberikan disertakan sebagai PNG asli transparan di `public/assets/cahaya-logo.png`. Seed menggunakan logo tersebut. Header menampilkan logo putih flat langsung di atas biru, tanpa frame, dengan lebar 170 px di ponsel dan 190 px di desktop. Tampilan putih menggunakan SVG yang menyematkan alpha PNG asli dan membatasi area ke tepian logo; file asli tetap disimpan sebagai sumber. Logo tetap dapat diganti melalui Pengaturan Lab.

## Tampilkan atau sembunyikan nama lab

Di Pengaturan Lab, centang atau hapus centang **Tampilkan nama lab di bawah logo**, lalu Simpan pengaturan. Berlaku untuk header halaman utama dan semua halaman marketing. Nama lab tetap tersimpan, muncul pada judul tab/footer, dan dapat dibaca pembaca layar. Pengaturan awal menampilkan nama lab.

Untuk memperbarui instalasi lama, backup database, upload kode, jalankan `npm run db:migrate`, lalu restart aplikasi. Migrasi menambah pengaturan tanpa menghapus data dan aman dijalankan ulang. Jangan menjalankan db:init pada database yang sudah dipakai.

## Kelola admin

Buka **Kelola admin**, isi nama, email unik, password minimal 12 karakter (maksimal 72 byte), dan konfirmasi password; lalu klik **Tambah admin**. Akun baru dapat langsung login dan memiliki akses yang sama ke seluruh pengaturan, kontak, statistik, serta penambahan admin. Setiap admin dapat mengganti password akunnya sendiri melalui Keamanan akun. Password disimpan sebagai hash bcrypt dan tidak ditampilkan dalam daftar. Tidak ada pendaftaran publik; penambahan hanya tersedia bagi admin yang sudah login dan dilindungi CSRF. Tabel users yang ada sudah mendukung beberapa akun, sehingga fitur ini tidak memerlukan perubahan struktur database.
Pemeriksaan khusus penambahan admin dapat dijalankan pada database QA terpisah: `node --env-file=.env.test tests/admin-users.integration.js`. Pengujian memakai akun admin dari environment dan membersihkan hanya akun/sesi sementara yang dibuatnya.

## Shortlink

Menu **Shortlink** terpisah dari kontak marketing. Isi nama link dan URL tujuan HTTPS; nama singkat opsional (huruf besar, huruf kecil, angka, tanda hubung). Huruf besar/kecil dibedakan: `Promo` dan `promo` adalah dua alamat berbeda. Nama kosong menghasilkan kode acak Base62 delapan karakter, contoh `aB7xK2mQ`. Contoh alamat final: `https://mkt.cmhgroup.id/s/promo`, sesuai APP_URL. Klik baris untuk mengubah tujuan, aktif/nonaktif, menyalin alamat, membuka, atau menghapus shortlink. Nama singkat yang sudah dibuat tidak berubah saat tujuan diedit. Pembuatan/pengelolaan hanya tersedia bagi admin yang login dan dilindungi CSRF.

Shortlink aktif menggunakan redirect 302 tanpa cache. Shortlink nonaktif/dihapus mengembalikan 404. Penghitung adalah total permintaan GET, termasuk bot, pratinjau, dan kunjungan berulang; HEAD tidak dihitung. Penghitung terpisah dari statistik marketing. Tujuan tidak diambil dari parameter pengunjung. Tidak ada pengambilan konten URL tujuan oleh server.

Instalasi baru menggunakan schema.sql. Untuk instalasi lama, backup lalu jalankan `npm run db:migrate` sebelum restart aplikasi; migrasi menambah tabel short_links tanpa menghapus data dan aman dijalankan ulang. Jangan menjalankan db:init ulang.
Pengujian shortlink pada database QA terpisah: `node --env-file=.env.test tests/shortlinks.integration.js`. Skrip memakai akun admin dari environment dan membersihkan hanya shortlink/sesi sementara yang dibuatnya.

Pembaruan Base62: pada instalasi lama, jalankan `npm run db:migrate` sebelum restart. Migrasi mengubah kolom nama singkat menjadi peka huruf besar/kecil tanpa mengganti kode, tujuan, atau jumlah klik yang sudah tersimpan. Pengaturan slug kontak marketing tetap memakai huruf kecil.

## Bio Instagram

Menu **Bio Instagram** mengelola halaman publik `/bio`, contoh alamat final `https://mkt.cmhgroup.id/bio`. Judul, deskripsi, logo, warna, pilihan tampil judul, dan status halaman diatur sendiri. Admin dapat menambah, mengedit, mengurutkan, menyembunyikan, dan menghapus tombol. Ikon tersedia: Website, WhatsApp, Lokasi, Instagram, Katalog/layanan, Telepon. URL memakai HTTPS, atau `tel:+62...` untuk ikon Telepon. Link halaman dapat disalin dari menu ini untuk dimasukkan ke bio Instagram.

Halaman memakai tabel `bio_settings` dan `bio_links`, tidak memakai kontak marketing atau tombol tambahan marketing. Link membuka tujuan langsung, sehingga kunjungan/klik Bio Instagram tidak masuk statistik marketing. Tombol tetap Customer Care tetap tersedia sesuai pengaturan aplikasi. Pada pembuatan pertama, identitas dasar/logo/warna disalin dari lab; setelah itu pengaturan Bio Instagram berdiri sendiri. Daftar tombol dimulai kosong agar admin mengisinya sendiri. Logo yang masih digunakan halaman lain tidak dihapus dari penyimpanan saat diganti.

Instalasi baru memakai schema.sql dan seed.sql terbaru. Pembaruan instalasi lama: backup database/gambar, upload kode, jalankan `npm run db:migrate`, lalu restart aplikasi. Untuk Docker: `docker compose build app`, `docker compose run --rm app npm run db:migrate`, lalu `docker compose up -d app`. Migrasi membuat tabel baru tanpa menghapus data, dan dapat diulang.

Tes khusus pada database QA terpisah: `node --env-file=.env.test tests/bio.integration.js`. Pengujian memakai akun/tombol/kontak sementara sendiri, mengembalikan pengaturan bio, dan mempertahankan pengaturan/statistik marketing.

### Section Bio Instagram

Di menu Bio Instagram, buat section dengan judul sendiri (contoh: Kontak Cahaya Lab, Lokasi Cahaya Lab, Update & Info), tentukan urutan, lalu pilih section pada formulir setiap tombol. Judul kelompok tampil rata tengah dengan jarak antarsection. Urutan section dan urutan tombol dalam section diatur terpisah; angka kecil tampil lebih dulu. Tombol tanpa section tampil paling atas tanpa judul kelompok. Section kosong atau tanpa tombol aktif tidak ditampilkan.

Menonaktifkan section menyembunyikan judul dan seluruh tombolnya tanpa mengubah status tombol. Menghapus section mempertahankan tombol dan memindahkannya ke Tanpa section. Section dimulai kosong untuk diisi admin. Tombol lama tetap tersimpan tanpa section. Pembaruan VPS membutuhkan `npm run db:migrate` sebelum restart; migrasi menambah tabel `bio_sections` dan kolom `bio_links.section_id` tanpa menghapus isi bio.
