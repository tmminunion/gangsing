# 📋 Daftar Masalah & Rencana Pengembangan (Issues)

Berikut adalah daftar masalah yang diketahui dan rencana fitur selanjutnya untuk Gangsing Battle Royale 3D:

## 🐛 Masalah Diketahui (Known Bugs)
1. **Sinkronisasi Tekstur Lintas Browser**: Saat ini sudah diperbaiki menggunakan URL absolut, namun perlu dipastikan kestabilannya pada koneksi lambat.
2. **Keyring Lock (Server)**: Desktop server terkadang meminta unlock keyring secara manual saat aplikasi startup tertentu berjalan.
3. **Collision Precision**: Meskipun sudah anti-tembus, pada kecepatan sangat tinggi gangsing terkadang masih bisa sedikit masuk ke dalam model OBJ kustom yang kompleks.

## 💡 Rencana Fitur Baru (Planned Features)
1. **Team Mode**: Memungkinkan penonton bergabung ke tim (Merah vs Biru) berdasarkan keyword chat.
2. **Dynamic Arena Size**: Arena yang mengecil secara otomatis seiring berkurangnya jumlah pemain hidup.
3. **Jukebox Vote**: Fitur voting untuk menentukan lagu berikutnya di antrean.
4. **Boss Rage Mode**: Boss akan berubah warna dan menjadi jauh lebih agresif saat HP di bawah 20%.

## 🚀 Optimasi Mendatang
- **Texture Compression**: Mengurangi ukuran tekstur lantai custom agar loading lebih instan.
- **Worker Threads**: Memindahkan sebagian logika fisika ke web worker untuk meningkatkan FPS pada monitor refresh rate tinggi.
