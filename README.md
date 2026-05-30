# 🌀 Gangsing Battle Royale 3D - TikTok Live Interactive Game

Aplikasi game interaktif 3D berbasis WebGL (Three.js + React + Express) untuk streaming TikTok Live! Penonton bisa ikut bermain, bertarung, memengaruhi cuaca, dan membantu pemain lain langsung dari kolom obrolan (chat) dan gift TikTok.

---

## 🎮 Fitur Interaktif Kolom Obrolan (TikTok Chat Commands)

Penonton bisa mengetik perintah berikut di kolom chat TikTok Live untuk langsung berinteraksi dengan game:

### 1. ⚔️ Perintah Dendam (`#serang [nama_target]`)
* **Cara Menggunakan**: Ketik `#serang budi` atau `#serang @budi` di obrolan.
* **Efek Game**: Gangsing milikmu akan langsung mengunci target dan mengejar gangsing milik `budi` secara agresif selama **8 detik**!
* **Efek Visual**: Gangsingmu akan mengeluarkan **partikel asap merah kemarahan** ☄️ dan damage serta daya hempasan tabrakanmu akan bertambah saat menyerang target tersebut.

### 2. 🌀 Cuaca & Fisika Arena Dinamis (`hujan` | `badai` | `malam` | `normal`)
Penonton bisa mengendalikan cuaca dan hukum fisika di dalam arena secara real-time hanya dengan mengetik cuaca yang diinginkan:
* **`hujan`**: Rintik hujan 3D akan membasahi arena. Lantai menjadi **licin** (gesekan berkurang) sehingga gangsing-gangsing akan meluncur dan ngedrift secara liar!
* **`badai`**: Angin puting beliung (Tornado) akan berputar secara acak di arena. Gangsing yang mendekat akan tersedot ke pusaran dan terhempas keluar dengan keras!
* **`malam`**: Arena menjadi gelap gulita, menyalakan pendar lampu neon (*glow-in-the-dark*) warna-warni pada setiap gangsing. Sangat estetik!
* **`normal`**: Mengembalikan cuaca menjadi cerah dan fisika lantai kembali normal.

### 4. 🎵 Interaktif Jukebox & Pemutar Musik (`music` / `play` / `request` / `next`)
* **Cara Menggunakan**: Ketik `music [judul]`, `play [judul]`, `request [judul]`, atau `next [judul]` di chat.
* **Efek Game**: Lagu tersebut akan langsung dicari dari YouTube dan ditambahkan ke dalam **antrean Jukebox**.
* **Fitur Cerdas (WebSpy AutoFill)**: Jika antrean lagu kosong, sistem akan memanggil AI WebSpy secara otomatis untuk merekomendasikan dan memutar lagu yang sedang viral saat ini. Jika antrean benar-benar habis, sistem akan memutar lagu secara acak dari riwayat (hingga 200 lagu terakhir) untuk memastikan musik **tidak pernah putus**!

---

## 🎁 Kontribusi Gift & Like (Gifter & Tapper Perks)

Penonton yang mengirimkan Like atau Gift akan mendapatkan keuntungan luar biasa di dalam game:

### 1. 🌟 Mode Giga Gifter (`isGiga`)
Setiap kali mengirimkan Gift bernilai menengah ke atas (seperti **Donat 🍩, Kado 🎁, Berlian 💎, atau Semesta 🌌**):
* Gangsingmu akan langsung bertransformasi menjadi **Raksasa (Skala 2.5x lipat)** selama **15 detik**!
* Memiliki **massa 5x lipat lebih berat** sehingga tidak bisa dihempaskan oleh musuh biasa, malah akan mementalkan gangsing kecil dengan sangat jauh!
* Memiliki **Aura Pelangi** yang berkilau di sekeliling gangsing.
* Menghasilkan **2.5x lipat damage** tabrakan!

### 2. ❤️ Tap Layar / Like TikTok (Like Boost & Crate Drops)
Setiap tap layar atau Like yang masuk dari penonton:
* **Floating Hearts**: Muncul emoji hati yang melayang naik secara meriah dari bagian bawah layar live.
* **Like Boost**: Memberikan pemulihan darah **+3 HP** secara instan kepada gangsing acak yang masih hidup, memberikan dorongan kecepatan dorong, serta partikel neon berkilau.
* **Airdrop Drop (Setiap 30 Likes)**: Begitu terkumpul akumulasi kelipatan 30 Likes, kotak bantuan (airdrop) akan langsung jatuh dari langit! Jenis Airdrop yang bisa jatuh:
  * **❤️ HEAL (Kotak H)**: Memulihkan HP sebesar +50 HP.
  * **🛡️ SHIELD (Kotak S)**: Memulihkan perisai sebesar +60 Shield.
  * **⚔️ WEAPON (Kotak W)**: Memberikan senjata acak yang kuat (Laser, Tombak Emas, Palu, dll).
  * **⭐ GOLD JACKPOT (Kotak G)**: Memberikan tambahan +150 XP dan +100 Poin skor instan!
  * **💥 BOMB PRANK (Kotak B)**: Prank zonk! Meledak saat disentuh, mengurangi HP pemain sebanyak -30 HP, dan mementalkannya ke belakang dengan kencang!
  * **🔮 ORB SKILL (Kotak O)**: Memberikan power-up berupa pusaran orb pertahanan di sekitar pemain selama 75 detik!
  * **🎵 MUSIC BOX (Kotak ♫ Warna Pink)**: Mendapatkan +100 XP instan! Saat tersentuh, akan langsung men-trigger bot WebSpy untuk mencarikan satu lagu hit acak dan langsung memutarnya secara otomatis.

---

## 🗺️ Kustomisasi Lantai Arena (Dashboard Controls)

Dashboard pengontrol `/dash` memiliki fitur canggih untuk mengubah gaya arena secara instan:
* **Tema Lantai Bawaan**: Pilih tema instan seperti **Sci-Fi, Rumput, Pasir, Bata, Batu, Lava, Es, dan Kayu**.
* **Upload Tekstur Custom**: Klik tombol **Upload Tekstur Lantai Custom** untuk mengunggah gambar buatanmu sendiri (rumput realis, foto, dll) dan sistem akan otomatis mengaplikasikannya ke seluruh layar penonton secara real-time!

---

## 🎨 Visual dan Gameplay Tingkat Lanjut

* **Pencahayaan Cerah**: Arena diterangi dengan *Ambient Light* (2.0) berwarna putih bersih dan *Directional Light* kuat (4.0) membuat warna-warna neon 3D lebih hidup.
* **Safe Zone Berjalan Sangat Lambat**: Cincin *Safe Zone* sekarang disetel batas mengecilnya dan membesarnya maksimal di radius 40. Kecepatannya diperlambat hingga `0.001` per detik sehingga terkesan damai namun tetap dinamis membatasi arena permainan.

---

## 📂 Fitur Kustom Aset Dinamis (Custom OBJ Models)

Aa Baim sekarang bisa memasukkan model 3D kustom langsung ke folder proyek untuk digunakan secara dinamis di dalam permainan!

* **`assets/airdrop/` (Airdrop Kustom)**: 
  * Letakkan file `.obj` apa saja di folder ini (misal: `12221_Cat_v1_l3.obj` atau `Car Obj.obj`).
  * Sistem akan memuat model tersebut secara dinamis. Saat airdrop jatuh dari langit, model kustom aa Baim akan terpilih secara acak dan mendarat di arena sebagai kotak bantuan spesial!
* **`assets/object/` (Rintangan Fisik Kustom)**:
  * Letakkan file `.obj` apa saja di folder ini.
  * Model 3D tersebut akan langsung dimuat sebagai batu/rintangan kustom di dalam arena pertempuran!
  * Jika gangsing bertabrakan dengan rintangan ini, HP gangsing akan berkurang dan memberikan variasi warna-warni yang asik saat benturan.

Semua file di dalam folder `/assets` disajikan secara statis dan otomatis di-scan oleh server lewat endpoint `/api/custom-assets` saat game dimulai.

---

## 🚀 Cara Menjalankan Aplikasi

1. **Instal Dependensi**:
   ```bash
   npm install
   ```
2. **Jalankan Aplikasi secara Lokal**:
   ```bash
   npm run dev
   ```
   * Dashboard kontrol live: `http://localhost:3010/dash`
   * Layar streaming utama: `http://localhost:3010`

3. **Status Layanan Server (PM2)**:
   * Backend Relay Server: `pm2 start server/tiktok-relay.ts --name gangsing-relay`
   * Frontend Client Server: `pm2 start npm --name gangsing-ui -- run dev`
