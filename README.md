# ⚡ Smart KWH Meter Dashboard

Website monitoring KWH meter berbasis ESP32 + PZEM004T dengan tampilan lucu!

## 🚀 Cara Deploy

### Option 1: Vercel (Paling Mudah)
1. Upload folder ini ke GitHub
2. Buka vercel.com → Import Project → pilih repo
3. Klik Deploy — selesai! ✅

### Option 2: Netlify
1. Upload folder ini ke GitHub
2. Buka netlify.com → Add new site → Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy! ✅

### Option 3: Manual
```bash
npm install
npm run build
# Upload folder dist/ ke hosting manapun
```

## 🔌 Koneksi ke ESP32

1. Buka website → klik ⚙️ Setting
2. Masukkan IP Address ESP32 (cek di Serial Monitor)
3. ESP32 harus konek WiFi yang sama dengan browser

### Endpoint yang dibutuhkan di ESP32:
```
GET http://<IP_ESP32>/data
Response JSON:
{
  "voltage": 220.5,
  "current": 1.23,
  "power": 270.6,
  "energy": 12.4,
  "frequency": 50.0,
  "pf": 0.90
}
```

## 📦 Tech Stack
- React 19 + TypeScript
- Tailwind CSS v3
- Vite 6
