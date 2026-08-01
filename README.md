# azra.co

Compile website atau file HTML jadi project Android — dan, kalau backend Termux-nya aktif, langsung jadi file `.apk` asli. Liquid glass UI, jelly/spring physics, 100% custom (tanpa framework).

(c) byazradev

---

## Isi paket

```
azra-co/
├── index.html          → frontend (buka langsung di browser, atau deploy ke Vercel)
├── script.js            → semua logic frontend (generator project, UI, koneksi backend)
├── backend.py            → server Python untuk Termux — compile .zip jadi .apk asli
├── requirements.txt       → dependency Python (cuma Flask)
├── setup_termux.sh         → sekali jalan, install Java/Android SDK/Gradle di Termux
└── README.md
```

## Dua mode pemakaian

### Mode 1 — Tanpa backend (paling simpel)
Buka `index.html` langsung di browser (double klik, atau deploy ke Vercel/Netlify seperti biasa).
Kamu bisa compile URL/HTML jadi **project Android (Gradle) siap-build**, lalu build manual lewat
Android Studio. Banner status di atas form akan menunjukkan **"Backend offline"** — itu wajar,
tombol "Compile Langsung ke .APK" otomatis disembunyikan dan kamu tetap bisa pakai "Compile ke Android"
biasa untuk dapat project .zip-nya.

### Mode 2 — Dengan backend Termux (compile jadi .apk asli, langsung dari HP)
Backend `backend.py` menjalankan Gradle beneran di Termux untuk menghasilkan `.apk` yang sudah di-sign
(debug) dan siap install — tidak perlu buka Android Studio sama sekali.

**Setup sekali saja:**
```bash
pkg install python -y
bash setup_termux.sh          # install Java 17, Android SDK, Gradle, aapt2 native (~10-25 menit)
pip install -r requirements.txt
```

**Setiap mau dipakai:**
```bash
python backend.py
```
Backend akan tanya URL frontend kamu (untuk CORS). Ada dua opsi:

- **Paling gampang:** kosongkan saja (tekan Enter) lalu buka `http://localhost:8080/` di browser HP
  yang sama — backend otomatis ikut menyajikan frontend-nya juga, jadi satu origin, tanpa masalah CORS.
- **Frontend di-deploy terpisah** (misal di Vercel): masukkan URL frontend-nya, contoh
  `https://azra-co.vercel.app`. Backend akan mengizinkan origin itu secara spesifik.
  Frontend otomatis mendeteksi `http://localhost:8080` sebagai alamat backend selama kamu membuka
  frontend-nya dari **browser di HP yang sama** dengan Termux (karena `localhost` merujuk ke
  perangkat itu sendiri). Kalau mau akses dari perangkat lain, expose backend lewat tunnel
  (Cloudflare Tunnel / ngrok) dan sesuaikan `Backend.baseUrl` di `script.js`.

Setelah backend jalan, banner status di frontend berubah **"Backend terhubung"** dan tombol
**"⚡ Compile Langsung ke .APK"** muncul. Klik itu → project di-generate di browser → dikirim ke
backend → Gradle build beneran di Termux → tombol **Download APK** muncul begitu selesai.

## Kenapa perlu setup_termux.sh?

Compile ke `.apk` butuh Android SDK build-tools, dan salah satu komponennya (`aapt2`) yang di-download
Gradle secara default adalah versi x86_64 — tidak jalan di ARM64 (chip HP Android). `setup_termux.sh`
memakai paket `aapt`/`aapt2` versi native Termux (di-compile khusus untuk aarch64 oleh tim Termux)
dan mengarahkan Gradle untuk memakainya lewat `android.aapt2FromMavenOverride`. Ini pendekatan yang
sudah terbukti dipakai komunitas Termux untuk build APK tanpa root/proot.

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `ANDROID_HOME tidak ditemukan` | Jalankan `setup_termux.sh`, lalu `source ~/.bashrc` |
| `aapt2 protocol failed` / `AAPT2 process unexpectedly terminated` | `pkg install aapt2 -y --force-reinstall`, lalu cek versinya cocok dengan AGP di `build.gradle` |
| Build sangat lambat / habis RAM | Tutup aplikasi lain, atau kecilkan `org.gradle.jvmargs` di `~/.gradle/gradle.properties` |
| Banner tetap "Backend offline" padahal `backend.py` sudah jalan | Pastikan browser & Termux di **HP yang sama**, dan tidak ada firewall/VPN yang memblokir `localhost` |
| CORS error di console browser | Isi `--origin` sesuai persis URL frontend (termasuk `https://`, tanpa trailing slash) saat menjalankan `backend.py` |

## Catatan keamanan

`backend.py` menjalankan `gradle` (yang pada akhirnya mengeksekusi kode dari project yang di-upload)
di perangkatmu. Ini didesain untuk **pemakaian personal/lokal** — jangan expose ke internet publik
tanpa autentikasi tambahan. Secara default backend bind ke `0.0.0.0` supaya bisa diakses dari
perangkat lain di jaringan yang sama; kalau tidak butuh itu, cukup akses lewat `localhost`.
