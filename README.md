# 📐 Tubes Sispeng — EP2004 Sistem Pengukuran

Dashboard monitoring **tiga alat ukur** berbasis ESP32 dalam satu website.

| Alat | Komponen | Firebase Path |
|------|----------|--------------|
| ⚡ KWH Meter | ESP32 + PZEM004T | `meters/{deviceId}/latest` |
| 🔍 Cable Fault Detector | ESP32 + INA219 + ADS1115 | `cable-fault/{deviceId}/latest` |
| 📡 Osiloskop | ESP32 + TFT Display | *(informasi statis)* |

## 🚀 Deploy

**Netlify:**
```
Build command  : npm run build
Publish dir    : dist
```

**Vercel:**
1. Push ke GitHub (repo: `tubes-sispeng`)
2. Import di vercel.com → Deploy ✅

## 🔥 Firebase — Struktur Data

```
meters/
  {deviceId}/
    latest/
      voltage, current, power, energy, frequency, pf, connected

cable-fault/
  {deviceId}/
    latest/
      resistansi, lokasi, tegangan, arus_potensial, arus_galvanometer, connected
```

## 📦 Tech Stack
React 19 + TypeScript · Tailwind CSS · Vite · Firebase Realtime Database
