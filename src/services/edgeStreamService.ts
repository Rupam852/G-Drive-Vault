/**
 * DriveVault Cloudflare Edge CDN & Stream Acceleration Service
 * Provides ultra-fast edge streaming with automatic fallback to Render standard server.
 */

export const CLOUDFLARE_WORKER_URL = 'https://drivevault-edge-streamer.rupambairagya07.workers.dev';

const CF_STORAGE_KEY = 'drive_vault_cf_edge_enabled';

export function isCloudflareEdgeEnabled(): boolean {
  try {
    const saved = localStorage.getItem(CF_STORAGE_KEY);
    return saved !== null ? saved === 'true' : true; // Enabled by default
  } catch {
    return true;
  }
}

export function setCloudflareEdgeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CF_STORAGE_KEY, String(enabled));
  } catch (e) {
    console.error('Failed to store Cloudflare edge preference:', e);
  }
}

/**
 * Generates an accelerated edge streaming URL using Cloudflare Worker CDN.
 * Returns null if Cloudflare is disabled or tokens are absent.
 */
export function getCloudflareStreamUrl(fileId: string, tokens: any, filename?: string): string | null {
  if (!isCloudflareEdgeEnabled()) return null;
  const token = tokens?.access_token;
  if (!token) return null;

  let base = `${CLOUDFLARE_WORKER_URL}/stream/${fileId}?token=${encodeURIComponent(token)}`;
  if (filename) {
    base += `&filename=${encodeURIComponent(filename)}`;
  }
  return tokens.refresh_token ? `${base}&refresh_token=${encodeURIComponent(tokens.refresh_token)}` : base;
}

/**
 * Checks if a URL is currently running through the Cloudflare Worker Edge CDN.
 */
export function isEdgeCdnUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('workers.dev') || url.includes('cloudflare');
}

export interface LatencyCheckResult {
  status: 'active' | 'not_active' | 'testing';
  latencyMs?: number;
  message: string;
}

/**
 * Ping Cloudflare Edge Worker and measure real-time network latency
 */
export async function pingCloudflareWorker(): Promise<LatencyCheckResult> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(CLOUDFLARE_WORKER_URL, { 
      method: 'GET',
      mode: 'cors',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    const latency = Math.round(performance.now() - start);

    if (res.ok || (res.status >= 200 && res.status < 500)) {
      return { status: 'active', latencyMs: latency, message: `${latency}ms latency` };
    }
    return { status: 'not_active', message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { status: 'not_active', message: e.name === 'AbortError' ? 'Timed out (8s)' : (e.message || 'Unreachable') };
  }
}

/**
 * Ping Render Backend server and measure latency
 */
export async function pingRenderBackend(apiBaseUrl: string): Promise<LatencyCheckResult> {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${apiBaseUrl}/`, { 
      method: 'GET',
      mode: 'cors',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    const latency = Math.round(performance.now() - start);

    if (res.ok || (res.status >= 200 && res.status < 500)) {
      return { status: 'active', latencyMs: latency, message: `${latency}ms latency` };
    }
    return { status: 'not_active', message: `HTTP ${res.status}` };
  } catch (e: any) {
    return { status: 'not_active', message: e.name === 'AbortError' ? 'Timed out (12s)' : (e.message || 'Unreachable') };
  }
}
