# Hasil verifikasi

Tanggal: 3 Oktober 2026 (WIB). Pengujian memakai database MySQL Community Server **8.4.7** terpisah pada komputer lokal. Layanan produksi belum dideploy.

| Tahap | Hasil |
| --- | --- |
| Database | Schema dan seed berhasil diimport ke MySQL 8; foreign key, indeks, dan tiga kontak terbentuk |
| Backend | Normalisasi WA, URL encoding, redirect per kontak/cabang, prepared statements, dan header keamanan teruji |
| Halaman publik | Halaman utama dan marketing berhasil dirender; teks di-escape; noindex/canonical/OG teruji |
| Admin | Login/sesi, rate limit, CSRF, CRUD kontak/cabang/tombol, pengaturan, upload, serta perubahan password teruji |
| Statistik | Kunjungan/klik teratribusi, HMAC IP, filter kontak/periode, grafik, dan CSV teruji |
| QR | PNG 1600 × 1600 dan SVG terunduh; PNG didekode dan URL `/m/budi` sesuai APP_URL |
| Perangkat | Pemeriksaan browser pada lebar 360, 390, dan 430 px; tombol WA/Maps terlihat di layar awal dan tidak ada overflow halaman |
| Admin mobile | Menu dapat digulir dan tombol keluar tetap tersedia |

`npm test`: **4 unit test lulus**. Pengujian integrasi: **75 pemeriksaan lulus**. Pengujian negatif meliputi password salah, CSRF salah, URL javascript, slug berbahaya, kontak/tombol nonaktif, gambar palsu, dan SVG yang disamarkan sebagai PNG.

Instalasi bersih menggunakan `npm ci` juga diverifikasi. Audit `npm audit --omit=dev` melaporkan **0 kerentanan yang dikenal** pada saat pengujian. Override MySQL2 membuat session store memakai versi driver yang sama dengan aplikasi (3.24.5); Sharp diperbarui ke 0.35.5. Audit ini bukan jaminan bahwa semua kemungkinan masalah keamanan telah ditemukan.

## Lighthouse mobile

Lighthouse **13.5.0**, mode mobile standar, URL localhost, tanpa logo/foto upload. Pengujian selesai sekitar 09.36 WIB. Laporan lengkap berada pada file `lighthouse-mobile.html` di samping paket proyek.

| Kategori | Skor |
| --- | ---: |
| Performance | 100 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |

First Contentful Paint 1,2 detik; Largest Contentful Paint 1,4 detik; Total Blocking Time 0 ms; Cumulative Layout Shift 0. Halaman publik tidak memerlukan JavaScript, layanan font eksternal, atau framework frontend.

Skor ini untuk halaman publik lokal. Hosting, TLS, kondisi jaringan, data admin, dan gambar yang diunggah dapat mengubah hasil. Tidak ada pengujian VPS/cPanel, sertifikat SSL nyata, atau pembukaan aplikasi WhatsApp/Maps pada perangkat fisik; redirect tujuan diverifikasi melalui respons HTTP. Penilaian aksesibilitas otomatis tidak menggantikan pengujian menyeluruh dengan pembaca layar.

Data contoh dan statistik pada pratinjau lokal digunakan untuk QA, bukan data lab operasional. Nama lab/konfigurasi yang disimpan dalam pratinjau telah dipertahankan pada seed akhir; akun admin pada seed tetap dinonaktifkan hingga Anda menetapkan password sendiri saat instalasi.

## Pembaruan tombol Customer Care

Tombol Customer Care 08113052999 diverifikasi pada 13 tampilan HTML (halaman utama, tiga kontak, login, seluruh bagian admin, dan error), serta empat redirect publik ke wa.me/628113052999. Tampilan ponsel diperiksa: tombol tetap di kanan bawah dan memakai warna biru/kuning. Konfigurasi dan statistik sebelumnya tidak dihapus. Laporan Lighthouse di atas berasal dari pengujian sebelum penambahan tombol ini.


## Pembaruan template pesan

Lima template diverifikasi di browser pada formulir marketing dan pesan default lab. Pilihan mengisi pesan dengan nama penerima yang sesuai; edit manual beralih ke mode pesan sendiri. Pesan yang sudah tersimpan dipertahankan, dan pemilihan template baru hanya diterapkan setelah tombol Simpan ditekan. Pemeriksaan ini tidak mengubah data kontak atau menghapus statistik pengguna.


## Posisi tombol tambahan

Tombol tambahan memakai baris flex yang otomatis rata tengah dan dapat membungkus ke baris berikutnya. Pemeriksaan browser pada dua tombol aktif (Telepon dan Instagram), lebar 390 px, menunjukkan selisih titik tengah kelompok tombol terhadap wadah sebesar 0 px. Data dan status tombol pengguna tidak diubah.


## Logo Cahaya Diagnostic Centre

PNG transparan asli dipasang sebagai logo lab dan dimasukkan ke paket. Hash SHA256 sumber dan aset sama. Pada lebar layar 360 px, logo termuat dengan rasio utuh dan kedua CTA utama masih terlihat di layar awal (tombol Maps berakhir sekitar 646 px pada viewport 800 px). Pengaturan lab lainnya tidak diubah.

## Logo putih tanpa bingkai

Logo publik memakai SVG yang menyematkan PNG asli, dengan warna putih dan alpha tetap dipertahankan. ViewBox dibatasi ke area logo (972 x 433) agar ruang kosong kanan, kiri, atas, dan bawah terpangkas. Browser pada lebar 360 px mengonfirmasi ukuran tampilan 170 x 75,72 px, latar transparan, border 0, dan tanpa bayangan. Tampilan visual diverifikasi bersih langsung di atas header biru. PNG asli tetap disertakan sebagai sumber; hanya pengaturan logo yang diubah pada pratinjau pengguna.
## Pilihan tampilan nama lab

Pilihan Tampilkan nama lab di bawah logo telah diuji melalui panel admin: simpan tanpa centang, muat halaman utama dan /m/danang, lalu aktifkan kembali dan simpan. Saat disembunyikan, judul utama tetap tersedia bagi pembaca layar dengan ukuran 1 x 1 dan area visual terpotong; nama tidak tampak pada header. Logo, tagline, judul tab, dan footer tetap tersedia. Migrasi database dijalankan dua kali dengan sukses tanpa menghapus data. Pilihan awal dikembalikan ke tampil.
## Penambahan akun admin

27 pemeriksaan integrasi khusus berhasil: akses tanpa login ditolak, token CSRF wajib valid, nama/email/password/konfirmasi divalidasi, email duplikat ditolak tanpa menambah baris, password disimpan sebagai hash bcrypt dan tidak ditampilkan, nama di-escape pada daftar, serta akun baru berhasil login dan membuka Kelola admin. Pengujian hanya membuat dan membersihkan akun/sesi QA sendiri; data lab, kontak, statistik, password, dan sesi admin pengguna dipertahankan. Halaman Kelola admin dan formulir diperiksa secara visual di browser. Semua admin memiliki akses pengelolaan yang sama. Tidak diperlukan migrasi tabel untuk fitur ini.
## Shortlink terpisah

42 pemeriksaan integrasi khusus berhasil: akses pengelolaan tanpa login ditolak; CSRF create/delete; validasi nama, slug, dan URL HTTPS; nama singkat duplikat ditolak; kode otomatis; redirect tujuan beserta query/fragment; parameter pengunjung tidak dapat mengganti tujuan; HEAD tidak menambah klik; enam GET (termasuk lima bersamaan) tercatat tepat enam; pengubahan tujuan mempertahankan alias; nonaktif/aktif kembali; hapus; 404 untuk kode tidak dikenal; dan escaping nama pada daftar. Pengujian membersihkan hanya shortlink/sesi QA sendiri, tanpa menghapus kontak, statistik marketing, akun, atau pengaturan pengguna. Migrasi dijalankan dua kali tanpa kesalahan. Menu diperiksa di desktop dan ponsel; halaman ponsel tidak meluber secara horizontal.

## Shortlink Base62 dengan huruf besar/kecil

Lima unit test dan 49 pemeriksaan integrasi shortlink lulus. Cakupan baru: kode otomatis delapan karakter A–Z/a–z/0–9; alias campuran; dua alias yang hanya berbeda besar/kecil tersimpan sebagai dua baris dan redirect ke dua tujuan berbeda; varian case yang tidak dibuat mengembalikan 404; duplikat dengan case sama tetap ditolak. Alias lama yang berisi huruf kecil, angka, dan tanda hubung tetap diuji berhasil. Migrasi idempotent dijalankan dua kali dan mempertahankan data pengguna.

## Bio Instagram

45 pemeriksaan integrasi berhasil: menu hanya dapat dikelola setelah login; CSRF dan validasi warna/URL/urutan; pengaturan tersimpan dan tampil dengan escaping; tema warna independen; tidak menampilkan kartu/tautan marketing; urutan tombol; aktif/nonaktif tombol; edit dan hapus; status halaman; tampil/sembunyi judul; upload logo WebP; penggantian logo bio tidak mengubah logo lab; file gambar yang masih dipakai kontak tetap tersedia sampai referensi terakhir dihapus. Pengaturan lab serta jumlah visits/clicks marketing tidak berubah selama tes. Tabel baru dimigrasikan dua kali tanpa kesalahan, dan profil bio dikembalikan setelah pengujian. Pemeriksaan visual otomatis browser belum tersedia karena alat browser gagal saat inisialisasi; halaman lokal disediakan untuk pratinjau langsung.

## Section Bio Instagram

80 pemeriksaan integrasi Bio Instagram dan lima unit test lulus. Cakupan tambahan: membuat/mengedit/menghapus section, CSRF section, validasi judul/urutan/referensi section, escaping judul, pilihan section pada admin, urutan section terpisah dari tombol, tombol tanpa section di atas, section kosong tersembunyi, menonaktifkan section menyembunyikan semua tombolnya, memindahkan tombol antarsection, serta penghapusan section mengembalikan tombol ke Tanpa section tanpa menghapusnya. Tes membersihkan hanya data QA sendiri dan mempertahankan profil/statistik marketing. Migrasi dijalankan dua kali; data bio lama dipertahankan. CSS berhasil dikompilasi. Pemeriksaan visual browser masih terhalang kegagalan inisialisasi alat browser (os error 3).

## Pilihan beberapa cabang — 7 Oktober 2026

66 pemeriksaan khusus lokasi, 80 pemeriksaan Bio Instagram, dan lima unit test lulus. Cabang QA A dan B muncul di halaman depan, marketing, serta Bio Instagram; cabang nonaktif tersembunyi. Nama/alamat di-escape, nama cabang hadir di daftar Kunjungi kami dan dialog, serta setiap link membuka Maps cabang yang benar. Pilihan cabang yang tidak valid/nonaktif ditolak; HEAD tidak menambah klik; klik GET tetap milik marketing terkait; redirect Maps lama tetap berlaku. Mode tombol bio popup tersimpan tanpa URL, memakai ikon Lokasi, dan menghilangkan tombol bawaan yang berulang; beralih kembali ke URL Maps tetap bekerja. Pengaturan lab/bio, cabang asli, dan statistik yang sudah tersimpan dipertahankan; data QA sendiri dibersihkan.

Alat browser kembali tersedia. Dialog diverifikasi langsung di halaman depan dan Bio Instagram, desktop serta viewport ponsel 390 × 844. Tombol × dan Escape menutup dialog dan mengembalikan fokus ke pemicu. Pada ponsel lebar dialog 343 px dan lebar dokumen 375 px, tidak meluber horizontal. Mode Pilih cabang di admin menonaktifkan URL dan memilih ikon Maps tanpa menyimpan perubahan pengguna. Tampilan disimpan di `../preview-popup-lokasi.jpg`. Sandbox saat ini berisi satu cabang aktif; cabang kedua akan diisi sendiri oleh pengguna melalui admin.
