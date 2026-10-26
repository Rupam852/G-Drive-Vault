<p align="center">
  <img src="./public/og-image.jpg" width="100%" alt="DriveVault Showcase Banner" />
</p>

# 🌌 DriveVault

<p align="center">
  <strong>An elegant, decentralized Google Drive client, 4K media streaming platform & native mobile cloud vault.</strong>
</p>

<p align="center">
  <a href="https://github.com/Rupam852/G-Drive-Vault/releases"><img src="https://img.shields.io/badge/version-1.6.0-blue.svg?style=for-the-badge&logo=android" alt="Version" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB.svg?style=for-the-badge&logo=react" alt="React 19" /></a>
  <a href="https://developer.android.com/jetpack/compose"><img src="https://img.shields.io/badge/Android-Jetpack%20Compose-4285F4.svg?style=for-the-badge&logo=jetpackcompose" alt="Jetpack Compose" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-6-646CFF.svg?style=for-the-badge&logo=vite" alt="Vite 6" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-v4-06B6D4.svg?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS v4" /></a>
  <a href="https://neon.tech/"><img src="https://img.shields.io/badge/Database-Neon%20Postgres-00E599.svg?style=for-the-badge&logo=postgresql" alt="Neon Postgres" /></a>
  <a href="https://g-drive-vault.pages.dev/"><img src="https://img.shields.io/badge/Deployment-Cloudflare%20Pages-F38020.svg?style=for-the-badge&logo=cloudflare" alt="Cloudflare Pages" /></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Gateway-Vercel-000000.svg?style=for-the-badge&logo=vercel" alt="Vercel" /></a>
</p>

<p align="center">
  <a href="https://g-drive-vault.pages.dev/"><b>🌐 Launch Official Web App</b></a> &nbsp;•&nbsp;
  <a href="https://github.com/Rupam852/G-Drive-Vault/releases"><b>📱 Download Android APK</b></a> &nbsp;•&nbsp;
  <a href="#-key-features"><b>✨ Key Features</b></a> &nbsp;•&nbsp;
  <a href="#️-technology-stack--frameworks"><b>🛠️ Tech Stack</b></a>
</p>

---

## 🚀 Overview

**DriveVault** is a next-generation personal cloud explorer and high-performance media hub that connects directly to the official **Google Drive API v3**. 

Unlike conventional storage services that charge recurring subscription fees, DriveVault harnesses a **zero-hosting-cost decentralized model**: files are stored and managed directly on your personal Google Drive accounts (with 15 GB free storage per Google account), while DriveVault delivers a fluid, ultra-responsive native and web experience with **$0/month infrastructure cost**.

DriveVault is engineered as a unified cross-platform application:
- **Web App:** Built with React 19, TypeScript, Vite 6, and Tailwind CSS v4 featuring sleek glassmorphic aesthetics and dark/light modes.
- **Android App:** Built with 100% native **Jetpack Compose (Material3)**, Kotlin Coroutines, Android Media3 ExoPlayer, and biometric security targeting modern Android 15 (API level 36).

---

## ✨ Key Features

### 🎛️ Centralized Transfers Manager
* **Clean Header Modal:** All floating overlays and progress bars have been unified into a single Transfers button in the top navigation bar, featuring live active badge counters.
* **Dual Tab History:** Seamlessly switch between **Uploads** and **Downloads** history with granular status indicators (`Completed`, `Failed`, `In Progress`, `Paused`).
* **Active Stream Controls:** Pause (**⏸️**), Resume (**▶️**), or Cancel (**❌**) ongoing transfers on the fly.
* **Real-time Transfer Metrics:** Live transfer speed calculations (e.g. `4.8 MB/s`), dynamic ETA countdowns (e.g. `12s left`), and processed bytes tracking (`45 MB / 120 MB`).
* **Background Foreground Service (Android):** Native notification channels with live progress bars and controls keep downloads alive even when the app is minimized.

### 📂 Smart Drive Engine & Navigation
* **Smart Root Fallback:** Automatically resolves root hierarchies for accounts with phone/Google Photos sync backups where files lack explicit `'root'` parent IDs.
* **Instant SWR Caching:** Near 0ms folder navigation with client-side stale-while-revalidate caching and breadcrumb hierarchy.
* **Grid & List Views:** Instant toggle between high-density lists and media thumbnail grids.
* **Advanced Filters & Search:** Search files globally or filter instantaneously by type: Documents, PDFs, Images, Videos, Audio, and Archives.

### 🎬 Media Streaming & File Previews
* **Native Video Engine (Android):** Powered by Android **Media3 (ExoPlayer)** with hardware acceleration, audio track selection, and subtitle support.
* **HTTP Range Video Streaming (Web):** Full chunked video playback supporting instant scrubbing and low memory consumption.
* **In-App Document Viewer:** Native and web-based previews for PDFs, text/code files, Markdown, and high-resolution images.

### 📺 Smart TV & Chromecast Streaming
* **Google Cast Integration:** Effortlessly stream 4K/1080p videos directly from Google Drive onto Smart TVs and Chromecast devices.
* **Bidirectional Sync:** Real-time play/pause synchronization, fine-grained seek scrub bar with `hours:minutes:seconds` timestamp format, and volume control.
* **Smart Media Filtering:** Cast button is dynamically enabled exclusively for supported playable video/audio files.
* **Graceful Remote Fallback:** Resilient handling when the TV remote backs out or when reconnecting across mobile hotspot and Wi-Fi networks.

### 🔐 Enterprise-Grade Privacy & Security
* **Biometric Vault:** Lock sensitive files inside a private vault protected by fingerprint, face unlock, or app passcode.
* **Zero-Trace Metadata Masking:** Hidden files (`isHidden`) are securely filtered in-memory and omitted from global queries.
* **Neon PostgreSQL Token Store:** Encrypted OAuth tokens and session data stored securely in serverless PostgreSQL with automated schema migrations.

---

## 🛠️ Technology Stack & Frameworks

DriveVault is powered by modern, battle-tested technologies across web, backend, and native mobile layers:

```mermaid
flowchart TD
    Web["Web Client (React 19, Vite 6, Tailwind v4)"]
    Mobile["Android App (Jetpack Compose, Media3)"]
    Server["Backend Server (Node.js Express, TypeScript)"]
    Auth["Google OAuth 2.0 & Auth Handler"]
    Drive["Google Drive API v3"]
    DB["Neon Serverless PostgreSQL"]

    Web -->|REST API Requests| Server
    Mobile -->|REST API Requests| Server
    Server -->|OAuth Handshake| Auth
    Auth -->|Token Persistence| DB
    Server -->|Files & Metadata Ops| Drive
    Drive -->|Direct Media Streaming| Web
    Drive -->|Direct Media Streaming| Mobile
```

| Layer | Framework / Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Web** | **React 19**, **Vite 6**, **TypeScript 5.8** | High-performance, reactive user interface |
| **Styling & Motion** | **Tailwind CSS v4**, **Motion**, **Lucide Icons** | Ultra-modern design system, smooth animations |
| **Mobile UI** | **Android Jetpack Compose**, **Material 3** | 100% declarative native Android UI |
| **Mobile Media** | **Android Media3 ExoPlayer 1.4.1** | Native video/audio hardware-accelerated playback |
| **Mobile Networking** | **Retrofit 2.11**, **OkHttp 4.12**, **Coil 2.7** | Resilient HTTP requests, image caching |
| **Mobile Platform** | **Capacitor 8**, **Target SDK 36 (Android 15)** | Native bridges, biometric auth & foreground service |
| **Backend Runtime** | **Node.js**, **Express 4.22**, **tsx** | Scalable REST API & file streaming server |
| **Database** | **Neon.tech Serverless PostgreSQL** (`pg`) | Secure session, token, and preference storage |
| **Cloud Storage API** | **Google APIs v3** (`googleapis`) | Direct Google Drive file operations |
| **Deployment** | **Render** (API & Web Server) | Continuous deployment from GitHub `main` branch |

---

## ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
APP_URL=https://your-drivevault-app.onrender.com

# PostgreSQL Database (Neon.tech)
DATABASE_URL=postgresql://user:password@ep-sample-pooler.aws.neon.tech/neondb?sslmode=require

# Google Cloud OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret

# Session & Encryption Keys
SESSION_SECRET=your-super-strong-random-session-secret-key
```

---

## 🚀 Getting Started Locally

### 1️⃣ Clone & Install
```bash
git clone https://github.com/Rupam852/G-Drive-Vault.git
cd G-Drive-Vault
npm install
```

### 2️⃣ Run Development Server
```bash
npm run dev
```
The server will start at `http://localhost:3000` (serving both the API and the Vite frontend).

### 3️⃣ Run Type Check & Production Build
```bash
npm run lint     # TypeScript strict compilation check
npm run build    # Vite production bundle build
```

### 4️⃣ Android Native Development
Ensure Android Studio is installed with Android SDK 34+:
```bash
# Sync web assets to Capacitor Android project
npx cap sync android

# Open Android Studio
npx cap open android
```
Alternatively, build the release APK directly via Gradle:
```bash
cd android
./gradlew assembleRelease
```
The signed APK will be generated at `android/app/build/outputs/apk/release/app-release.apk`.

---

## 📥 In-App OTA Updates

DriveVault includes an integrated Over-The-Air (OTA) update checker configured via [`app-update.json`](app-update.json):

```json
{
  "latestVersion": "1.6.0",
  "apkUrl": "https://github.com/Rupam852/G-Drive-Vault/releases/download/v1.6.0/DriveVault.apk",
  "releaseNotes": "Unified Transfers Modal, Google Drive smart root fallback, React 19 & Tailwind v4 engine, Jetpack Compose media enhancements!"
}
```

---

## 📄 License & Credits

Built with ❤️ by [Rupam](https://github.com/Rupam852). Proprietary & open for personal cloud hosting.
