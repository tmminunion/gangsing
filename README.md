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

### 3. 🏃 Gerakan Tambahan (`lompat` / `jump`)
* **Cara Menggunakan**: Ketik `lompat` atau `jump` di chat.
* **Efek Game**: Gangsingmu akan melompat tinggi ke udara untuk menghindari tabrakan atau keluar dari jebakan arena!

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

---

## 🗺️ Kustomisasi Lantai Arena (Dashboard Controls)

Dashboard pengontrol `/dash` memiliki fitur canggih untuk mengubah gaya arena secara instan:
* **Tema Lantai Bawaan**: Pilih tema instan seperti **Sci-Fi, Rumput, Pasir, Bata, Batu, Lava, Es, dan Kayu**.
* **Upload Tekstur Custom**: Klik tombol **Upload Tekstur Lantai Custom** untuk mengunggah gambar buatanmu sendiri (rumput realis, foto, dll) dan sistem akan otomatis mengaplikasikannya ke seluruh layar penonton secara real-time!

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
