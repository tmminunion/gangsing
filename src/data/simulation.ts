export const SIMULATED_USERNAMES = [
  'Budi_Surabaya',
  'Siti_Medan',
  'Kurniawan_X',
  'Putra_Bali',
  'Dewi_Jakarta',
  'Gamer_Santuy',
  'Sultan_Gift',
  'IndoGladiator',
  'Raja_Turu',
  'Wibu_Active',
  'Luffy_Wano',
  'Mega_Bandung',
  'Adhi_Yogya',
  'Pratama_Pro',
  'Slayer_TikTok',
  'Citra_Sari',
  'Dimas_Gaming',
  'Ahmad_Solo',
  'Rian_Fist',
  'Diva_Pink',
  'Aldo_Laser',
  'Fajar_Subuh',
  'Neng_Cantik',
  'Sobat_Ambyar',
  'Dosen_Kill',
  'Bocil_Kematian'
];

export const SIMULATED_COMMENTS = [
  'gabung dong bang!',
  'serang merah! ARSENAL GOAL 🔴 WHITE',
  'lompat tinggi!',
  'serang dia bang!!',
  'GG WP @Sultan_Gift!',
  'minta mawar dong buat PSG! 🔵',
  'hantam deket airdrop!',
  'gabung team biru PSG! 🔵⚽',
  'bantu shield si @Putra_Bali kawan',
  'COYG!! Come On You Gunners 🔴⚪!',
  'Allez Paris SG!! Hancurkan Gunners! 🔵✨',
  'wih dapet tombak emas!',
  'Saka lari kencang banget di kanan!',
  'gila laser sword Mbappe OP banget',
  'lompat lagi!!',
  'hancurkan si raja turu!',
  'Odegaard tendang luar kotak penalti!',
  'semangat semuanya!',
  'Ayo PSG team biru serang balik!',
  'bismillah menang battle royal ini',
  'serang yang besar!'
];

export const TIKTOK_LIVE_GUIDELINES = {
  title: 'Cara Mengoneksikan Game ke Live TikTok',
  steps: [
    {
      num: 1,
      title: 'Gunakan TikTok Live Studio / OBS',
      desc: 'Buka TikTok Live Studio atau OBS di PC Anda. Pilih sumber tangkapan layar (Screen Capture / Window Capture) lalu rekam area visual Game (9:16 portrait di sebelah kiri).'
    },
    {
      num: 2,
      title: 'Opsional: Jalankan Relay Server Node.js (Tiktok Live Connector)',
      desc: 'TikTok membatasi koneksi browser mentah. Untuk membaca chat langsung dari streaming Anda, instal paket "@toply/tiktok-live-connector" di komputer lokal atau server Anda untuk mengirimkan webhook event ke URL game ini.'
    },
    {
      num: 3,
      title: 'Ubah ke Faksion / Auto-Pilot',
      desc: 'Game dirancang agar dapat berjalan otomatis (Auto-Pilot / Bot Simulator) sehingga penonton live Anda tetap asyik bertarung walaupun Anda sedang menjauh dari layar.'
    }
  ]
};
