# MONA AI • Atelier Biométrique & Pengenalan Wajah

Sistem Pengenalan Wajah Berbasis Deep Learning dengan Estetika Haute Couture Crimson & Imperial Gold, didukung oleh RetinaFace dan Facenet 512D.

## Fitur Utama

- **Haute Couture Aesthetic**: Antarmuka mewah bertema ruby maroon, gold leaf accents, glassmorphism, dan ambient glow.
- **Biometrik Tingkat Tinggi**: Arsitektur Facenet 512D dengan detektor RetinaFace untuk akurasi optimal.
- **Top-3 Nearest Neighbor Scoring**: Pengenalan multi-embedding dengan confidence score presisi.
- **Live Camera & Photo Upload**: Pengenalan wajah realtime via webcam atau inspeksi berkas foto/gambar.
- **Smart Launcher**: Integrasi otomatis backend Flask lokal, Cloudflare Tunnel, dan sinkronisasi URL endpoint.
- **Vercel Ready**: Konfigurasi deployment statis untuk hosting instan.

## Menjalankan Server Lokal

1. Pastikan dependensi terpasang:
   ```bash
   pip install -r requirements.txt
   ```
2. Jalankan sistem melalui file batch atau launcher:
   ```bash
   python launcher.py
   # atau klik ganda start_server.bat
   ```
3. Buka antarmuka web di browser: [http://localhost:5000](http://localhost:5000)

## Struktur Direktori

```
├── app.py               # Flask backend API (/api/recognize, /api/status, /api/health)
├── launcher.py          # Smart launcher (Flask backend + Cloudflare Tunnel)
├── face_encodings.pkl   # Basis data biometrik vektor wajah terdaftar
├── index.html           # Frontend utama (Atelier Biometrik)
├── style.css            # Styling desain Crimson & Gold
├── app.js               # Logika pemindaian & komunikasi API biometrik
├── static/              # Asset bundle untuk deployment Vercel
├── vercel.json          # Konfigurasi deployment Vercel
└── requirements.txt     # Dependensi Python
```
