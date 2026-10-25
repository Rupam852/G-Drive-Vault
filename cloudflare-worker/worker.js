/**
 * DriveVault Cloudflare Worker
 * Super-Fast Media Streaming, Edge Caching, HTTP Range Proxy & Direct Upload
 * 
 * Benefits:
 * - 0 MB Render RAM consumed (completely avoids Render free-tier OOM crashes)
 * - 300+ Edge Data Centers worldwide with ultra-low latency (<20ms in India)
 * - HTTP Range Support (Smooth video seeking and scrubbing)
 * - Free tier: 100,000 requests/day on Cloudflare
 */

export default {
  async fetch(request, env, ctx) {
    // Enable CORS for all incoming requests
    if (request.method === "OPTIONS") {
      return handleCors();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── 1. STREAMING / DOWNLOAD ENDPOINT: /stream/:fileId or /stream?fileId=... ──
      if (path.startsWith("/stream") || path.startsWith("/api/stream")) {
        return await handleMediaStream(request, url, env, ctx);
      }

      // ── 2. DIRECT RESUMABLE UPLOAD PROXY: /upload ──
      if (path.startsWith("/upload") || path.startsWith("/api/upload")) {
        return await handleDirectUpload(request, url);
      }

      // ── 3. HEALTH CHECK ──
      return new Response(JSON.stringify({
        status: "online",
        service: "DriveVault Cloudflare Edge Accelerator",
        version: "1.0.0",
        edgeRegion: request.cf?.colo || "Global"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() }
      });
    }
  }
};

/**
 * Handles Super-Fast Media Streaming & Chunk-by-Chunk Delivery
 */
async function handleMediaStream(request, url, env, ctx) {
  // Extract fileId from URL path or query params
  const segments = url.pathname.split("/").filter(Boolean);
  const fileId = url.searchParams.get("fileId") || (segments.length >= 2 ? segments[segments.length - 1] : null);

  if (!fileId) {
    return new Response(JSON.stringify({ error: "Missing fileId parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() }
    });
  }

  // Extract access token from Authorization header or ticket query parameter
  const authHeader = request.headers.get("Authorization");
  const tokenParam = url.searchParams.get("token") || url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token") || request.headers.get("x-goog-refresh-token");
  let accessToken = authHeader ? authHeader.replace("Bearer ", "").trim() : tokenParam;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized: Missing Google OAuth token" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders() }
    });
  }

  // Target Google Drive v3 API media download endpoint
  const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

  async function fetchDriveMedia(token) {
    const upstreamHeaders = new Headers();
    upstreamHeaders.set("Authorization", `Bearer ${token}`);
    upstreamHeaders.set("User-Agent", "DriveVault-Cloudflare-Edge/1.0");

    // Pass through Range header for video seeking (HTTP 206 Partial Content)
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      upstreamHeaders.set("Range", rangeHeader);
    }

    return await fetch(driveApiUrl, {
      method: "GET",
      headers: upstreamHeaders
    });
  }

  // Fetch directly from Google Drive API
  let googleResponse = await fetchDriveMedia(accessToken);

  // If Google returns 401 (token expired) and Cloudflare Worker has OAuth credentials configured:
  if (googleResponse.status === 401 && refreshToken && env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET) {
    try {
      const tokenRefreshRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      });
      if (tokenRefreshRes.ok) {
        const tokenData = await tokenRefreshRes.json();
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          googleResponse = await fetchDriveMedia(accessToken);
        }
      }
    } catch (e) {
      // Refresh error, continue with googleResponse
    }
  }

  if (!googleResponse.ok && googleResponse.status !== 206) {
    const errorText = await googleResponse.text();
    return new Response(JSON.stringify({
      error: "Google Drive API error",
      status: googleResponse.status,
      details: errorText
    }), {
      status: googleResponse.status,
      headers: { "Content-Type": "application/json", ...corsHeaders() }
    });
  }

  // Clone headers for client response
  const responseHeaders = new Headers(googleResponse.headers);

  // Set Cloudflare Edge Caching headers
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set("Access-Control-Allow-Headers", "*");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, Content-Disposition");
  responseHeaders.set("Accept-Ranges", "bytes");

  const dlFilename = url.searchParams.get("filename") || url.searchParams.get("download");
  if (dlFilename) {
    responseHeaders.set("Content-Disposition", `attachment; filename="${encodeURIComponent(dlFilename)}"`);
  }

  // Cache media streams at edge for 24 hours (if not an error)
  if (googleResponse.status === 200 || googleResponse.status === 206) {
    responseHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600");
  }

  // Stream bytes directly with zero buffering (0 MB RAM on Worker and Render)
  return new Response(googleResponse.body, {
    status: googleResponse.status,
    statusText: googleResponse.statusText,
    headers: responseHeaders
  });
}

/**
 * Handles Resumable Direct Upload Chunk Proxy
 */
async function handleDirectUpload(request, url) {
  if (request.method !== "POST" && request.method !== "PUT") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
  }

  const uploadUrl = url.searchParams.get("uploadUrl");
  if (!uploadUrl) {
    return new Response(JSON.stringify({ error: "Missing uploadUrl" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() }
    });
  }

  // Proxy upload chunk directly to Google's resumable session URI
  const googleUploadRes = await fetch(uploadUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  const resHeaders = new Headers(googleUploadRes.headers);
  resHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(googleUploadRes.body, {
    status: googleUploadRes.status,
    statusText: googleUploadRes.statusText,
    headers: resHeaders
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type, Authorization, x-goog-tokens, Content-Range",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
  };
}

function handleCors() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}
