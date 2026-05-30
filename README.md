# 🌀 Gangsing Battle Royale 3D - TikTok Live Interactive Game

Aplikasi game interaktif 3D berbasis WebGL (Three.js + React + Express) untuk streaming TikTok Live! Penonton bisa ikut bermain, bertarung, memengaruhi cuaca, dan membantu pemain lain langsung dari kolom obrolan (chat) dan gift TikTok.

---

## 🚀 Apa yang Baru di Versi Terbaru?

- **Pencahayaan Super Cerah (Sunlight Mode)**: Intensitas cahaya arena ditingkatkan drastis agar tampilan neon gladiator lebih hidup dan silau estetik.
- **HUD Musik Glassmorphism**: Panel 'Now Playing' dan tombol 'Next Song' didesain ulang dengan gaya kaca transparan (Emerald Black) yang modern di bagian atas layar.
- **Notifikasi Bar Full-Width**: Informasi gladiator mendarat (spawn) dan tereliminasi dipindahkan ke bagian bawah layar dalam bentuk bar satu baris yang elegan.
- **Buff HP Pemain Baru**: Gladiator yang baru mendarat kini memiliki darah lebih tebal (**300 - 500 HP**) agar lebih awet bertarung melawan veteran.
- **Optimasi Anti-Lag**: Menghapus efek visual berat seperti 'Floating Hearts' dan 'Disco Mode' untuk memastikan performa tetap mulus biarpun di-auto tap ribuan kali.

---

## 🎮 Fitur Interaktif Kolom Obrolan (TikTok Chat Commands)

### 1. ⚔️ Perintah Dendam (`#serang [nama_target]`)
* **Cara Menggunakan**: Ketik `#serang budi` di obrolan.
* **Efek Game**: Gangsing milikmu akan langsung mengunci target selama **8 detik** dengan aura kemarahan merah!

### 2. 🌀 Cuaca & Fisika Arena (`hujan` | `badai` | `malam` | `normal`)
Penonton bisa mengendalikan cuaca secara real-time. Lantai menjadi licin saat hujan, atau gelap estetik saat malam tiba.

### 3. 🎵 Kontrol Musik & Jukebox (`music` | `play` | `skip`)
* **Ketik `play [judul]`**: Memasukkan lagu ke antrean YouTube.
* **Ketik `skip` atau `next`**: Penonton bisa mengganti lagu yang sedang diputar secara kolektif!

---

## 🎁 Kontribusi Gift & Like (Gifter & Tapper Perks)

### 1. 🌟 Mode Giga Gifter
Kirim Gift (Donat, Berlian, Semesta) untuk berubah menjadi **Raksasa (Skala 2.5x)** dengan damage dan massa 5x lipat lebih kuat!

### 2. ❤️ Tap Layar / Like TikTok (Ultimate Like Boost)
* **Like Boost**: Akumulasi tiap 10 like memberikan **+30 HP** instan dan dorongan fisik kuat ke gladiator acak.
* **Airdrop (Setiap 10 Likes)**: Sekarang airdrop jatuh lebih sering! Bisa berisi Heal, Shield, Senjata Laser, atau Orb Skill.

---

## 🛠️ Teknis & Performa
- **Anti-Tembus (Collision Fix)**: Boss dan Gangsing kini memiliki fisik yang padat. Tidak bisa lagi menembus rintangan atau badan pemain lain.
- **Auto-Restore Viewers**: Jika server restart, semua penonton yang aktif di chat akan otomatis di-spawn ulang ke arena tanpa perlu chat lagi.
- **Persistensi Tekstur**: Pilihan lantai (tema) akan tetap tersimpan biarpun browser di-refresh atau server dimatikan.

---

## 🚀 Cara Menjalankan

1. **Instal Dependensi**: `npm install`
2. **Jalankan Aplikasi**: `npm run dev`
3. **Dashboard Kontrol**: `http://localhost:3010/dash`
