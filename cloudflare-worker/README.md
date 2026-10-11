# DriveVault Cloudflare Edge Accelerator Setup Guide

This guide explains how to deploy the Cloudflare Worker to achieve super-fast streaming, Range request video seeking, and zero Render RAM consumption.

---

## ⚡ Option 1: Instant 2-Minute Deployment via Cloudflare Dashboard (No Terminal Needed)

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) and log in (or create a free account).
2. On the left sidebar, click **Workers & Pages** -> **Overview**.
3. Click **Create Application** -> **Create Worker**.
4. Give it a name like `drivevault-edge-streamer` and click **Deploy**.
5. Click **Edit Code** (Quick Edit).
6. Delete the default code and paste the entire contents of [worker.js](file:///d:/PROJECT/drive-vault/cloudflare-worker/worker.js).
7. Click **Deploy / Save**.
8. Copy your Worker URL (e.g. `https://drivevault-edge-streamer.<your-name>.workers.dev`).

---

## 💻 Option 2: 1-Command CLI Deployment (Wrangler)

In your terminal:
```bash
cd d:\PROJECT\drive-vault\cloudflare-worker
npx wrangler login
npx wrangler deploy
```
Once deployed, it will output your live URL:
`https://drivevault-edge-streamer.<subdomain>.workers.dev`

---

## 📱 How to Connect It to Your Android App

In [DriveRepository.kt](file:///d:/PROJECT/drive-vault/android/app/src/main/java/com/rupam/drivevault/repository/DriveRepository.kt):
```kotlin
companion object {
    var cloudflareWorkerUrl: String? = "https://drivevault-edge-streamer.<your-name>.workers.dev"
}
```

Once this URL is set:
- Videos & Audio stream directly through Cloudflare Edge (0 buffering).
- Render RAM stays at **0 MB** during streaming.
- If left `null`, the app automatically falls back to your Render server safely.
