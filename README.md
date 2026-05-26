# 🌌 DriveVault

<p align="center">
  <img src="./public/logo.svg" width="80" height="80" alt="DriveVault Logo" />
</p>

<p align="center">
  <strong>An elegant, self-hosted, secure Google Drive client & transfer manager.</strong>
</p>

<p align="center">
  <a href="https://github.com/Rupam852/G-Drive-Vault/releases"><img src="https://img.shields.io/badge/version-1.5.3-blue.svg?style=for-the-badge&logo=android" alt="Version" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/built%20with-React-61DAFB.svg?style=for-the-badge&logo=react" alt="React" /></a>
  <a href="https://capacitorjs.com/"><img src="https://img.shields.io/badge/native-Capacitor-119EFF.svg?style=for-the-badge&logo=capacitor" alt="Capacitor" /></a>
  <a href="https://neon.tech/"><img src="https://img.shields.io/badge/database-Neon%20Postgres-00E599.svg?style=for-the-badge&logo=postgresql" alt="Neon" /></a>
  <a href="https://render.com/"><img src="https://img.shields.io/badge/backend-Render-46E3B7.svg?style=for-the-badge&logo=render" alt="Render" /></a>
</p>

---

## 🚀 Welcome to DriveVault

**DriveVault** is a state-of-the-art personal cloud explorer client that connects directly to the official Google Drive API. Unlike traditional cloud drives that charge expensive monthly hosting fees, DriveVault utilizes a **genius decentralized architecture** where users upload/download files directly to their own personal Google Drive (offering 15 GB free space out of the box), keeping server hosting costs strictly at **$0 / month**!

Fully optimized for both web browsers and native Android devices, DriveVault delivers a premium, native-feeling enterprise dashboard with high-end glassmorphic visual aesthetics.

---

## ✨ Premium Features

### 🎛️ Unified Transfer Manager
* **Dual-Action Dashboard Overlay:** Track active transfers through an overlay card. Click **Minimize (➖)** to send the download to the background or **Cancel (❌)** to instantly terminate it.
* **Tabbed Transfer History:** A beautiful tabbed settings view supporting **Upload History** and **Download History** with dynamic sliding transitions.
* **Interactive Active Controls:** Pause (**⏸️**), Play/Resume (**▶️**), or Cancel (**❌**) active downloads on the fly.
* **Live Analytics:** Displays real-time download speeds (e.g., `4.5 MB/s`), remaining time ETA (e.g., `12s left`), and growth size text (`15 MB / 50 MB`).

### 📂 File System & Dashboard
* **Dynamic Search & Filters:** Instantly search your entire drive or filter by file types (Folders, PDF, Images, Videos, Audios, Zip).
* **Grid / List Views:** Toggle seamlessly between a grid of thumbnails and a detailed list format.
* **Star & Hide Files:** Bookmark your most important files or place them into a hidden vault folder with biometric/password protection support.
* **Zero-Lag SWR Caching:** Near 0ms navigation times for nested folders with custom client-side caching.

### 📱 Native Mobile Support (Capacitor)
* **Custom Background Notifications:** Integrated native Android bridge triggers notifications with high-end progress bars, speed, and remaining time details.
* **Persistent Download Storage:** Completed items automatically persist inside local storage for full history access.
* **OTA Auto-Updater:** Instantly alerts users to update their app upon release of a new version.

---

## 🛠️ The Architecture & Technology Stack

```mermaid
graph TD
    A[Capacitor Native App / Web Frontend] -->|API Requests| B[NodeJS Express API Server]
    B -->|OAuth Handshake| C[Google Drive API]
    B -->|Token Persistence| D[Neon.tech Serverless Postgres]
    A -->|Static Page Hosting| E[Vercel CDN]
```

* **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [TailwindCSS](https://tailwindcss.com/) (Hosted on Vercel)
* **Backend:** [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) (Hosted on Render Free Tier)
* **Database:** [Neon.tech](https://neon.tech/) Serverless PostgreSQL (For 100% Free Lifetime token stores)
* **Native Layer:** [Ionic Capacitor](https://capacitorjs.com/) (Compiling to fully signed Android release APKs)

---

## ⚙️ Environment Variables Config

Create a `.env` file in the root directory to run DriveVault:

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `PORT` | API Listening port | `3000` |
| `DATABASE_URL` | Neon.tech PostgreSQL connection string | `postgresql://user:pass@ep-host.aws.neon.tech/neondb` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `your-google-oauth-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-your-secret` |
| `SESSION_SECRET` | Secret key used to encrypt sessions and signed download tickets | `your-secure-custom-secret-string` |
| `APP_URL` | Production host URL | `https://g-drive-vault.onrender.com` |

---

## 🚀 Running Locally

### 1️⃣ Clone the Repository & Install Dependencies
```bash
git clone https://github.com/Rupam852/G-Drive-Vault.git
cd G-Drive-Vault
npm install
```

### 2️⃣ Start Development Server
```bash
npm run dev
```
The React development bundle will boot up locally at `http://localhost:5173`.

### 3️⃣ Build & Sync Capacitor Android Project
```bash
npm run build
npx cap sync
npx cap open android
```
This compiles the distribution resources and launches **Android Studio** directly for native physical testing.

---

## 📥 OTA Auto-Updater Config
The application's auto-update system is configured dynamically through [app-update.json](app-update.json):
```json
{
  "latestVersion": "1.5.3",
  "apkUrl": "https://docs.google.com/uc?export=download&id=1IjU8rFoq13__KPZ3VR5Y3InICv2m06Ba&confirm=t",
  "releaseNotes": "Major architectural update: Introducing tabbed Transfer History (Uploads & Downloads), live background minimize overlay, dynamic pause/resume/cancel controllers, and real-time speed, ETA, and progress size metrics! 🚀📥💎"
}
```

---

## 📄 License
This project is proprietary and custom-tailored for personal secure cloud explorer operations. All rights reserved.
