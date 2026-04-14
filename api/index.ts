import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import stream from 'stream';
import archiver from 'archiver';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Trust proxy is required for secure cookies in Cloud Run/AI Studio
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  // Allow all origins — the APK itself is the security boundary for native
  // mobile requests. Capacitor WebView can use various origins depending on
  // the Capacitor version (capacitor://localhost, http://localhost, etc.)
  origin: (origin, callback) => callback(null, true),
  credentials: true,
}));
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[HTTP ${req.method}] ${req.url} - Cookies:`, req.headers.cookie || 'none');
  next();
});
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.APP_URL;

app.use(session({
  secret: process.env.SESSION_SECRET || 'drive-vault-secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Helper to get OAuth client
const getOAuth2Client = (req: express.Request) => {
  // Use APP_URL if available (injected by AI Studio), otherwise fallback to dynamic detection
  // The OAuth skill recommends using APP_URL as it's more reliable behind proxies
  // Priority: APP_URL > VITE_API_BASE_URL > dynamic detection
  let baseUrl = process.env.APP_URL || process.env.VITE_API_BASE_URL;
  
  if (!baseUrl) {
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    baseUrl = `${protocol}://${host}`;
  }

  // Ensure no trailing slash on baseUrl for consistency
  baseUrl = baseUrl.replace(/\/$/, '');
  const redirectUri = `${baseUrl}/auth/callback`;
  
  console.log('Constructed Redirect URI:', redirectUri);
  
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

// Help to get or create folder path
const folderCreationLocks = new Map<string, Promise<string>>();

// Download Tickets for authenticated downloads without header support (window.location)
const downloadTickets = new Map<string, { tokens: any, expires: number }>();
// Cleanup expired tickets every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of downloadTickets.entries()) {
    if (now > ticket.expires) downloadTickets.delete(id);
  }
}, 60000);

async function getOrCreateFolderPath(drive: any, pathParts: string[], parentId: string) {
  let currentParentId = parentId || 'root';
  let pathSoFar = currentParentId;
  
  for (const part of pathParts) {
    pathSoFar += '/' + part;
    
    if (folderCreationLocks.has(pathSoFar)) {
      currentParentId = await folderCreationLocks.get(pathSoFar)!;
      continue;
    }

    const folderTask = (async () => {
      const res = await drive.files.list({
        q: `name = '${part.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed = false`,
        fields: 'files(id)',
      });
      
      if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id;
      } else {
        const folder = await drive.files.create({
          requestBody: {
            name: part,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [currentParentId],
          },
          fields: 'id',
        });
        return folder.data.id;
      }
    })();
    
    folderCreationLocks.set(pathSoFar, folderTask);
    
    try {
      currentParentId = await folderTask;
    } catch (e) {
      folderCreationLocks.delete(pathSoFar);
      throw e;
    }
  }
  return currentParentId;
}

// Auth Routes
app.get('/api/auth/url', (req, res) => {
  const client = getOAuth2Client(req);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
    prompt: 'consent'
  });
  res.json({ url });
});

// Native OAuth handler for Mobile Apps
app.post('/api/auth/native', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).send('Missing code');

  try {
    const client = getOAuth2Client(req);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info to establish session
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userinfo = await oauth2.userinfo.get();

    // Store tokens and user in session
    const authData = {
      user: {
        id: userinfo.data.id,
        email: userinfo.data.email,
        name: userinfo.data.name,
        picture: userinfo.data.picture,
      },
      tokens,
    };

    (req as any).session.user = authData.user;
    (req as any).session.tokens = authData.tokens;

    res.json(authData);
  } catch (err) {
    console.error('Native Auth Error:', err);
    res.status(500).send('Authentication failed');
  }
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  const client = getOAuth2Client(req);
  try {
    const { tokens } = await client.getToken(code as string);
    console.log('[Server] Received tokens from Google');
    
    // Still try to save to session as a fallback
    (req as any).session.tokens = tokens;
    
    req.session.save((err) => {
      if (err) console.error('[Server] Session save error:', err);
      
      console.log('[Server] Sending tokens back to app via postMessage');
      res.send(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body>
            <script>
              if (window.opener) {
                // Send tokens directly to bypass cookie issues in iframes
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS',
                  tokens: ${JSON.stringify(tokens)}
                }, '*');
                console.log('Tokens sent to opener');
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            </script>
            <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
              <h2>Authentication Successful!</h2>
              <p>You can close this window now.</p>
            </div>
          </body>
        </html>
      `);
    });
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send('Authentication failed');
  }
});

// Helper to get tokens from session or header
const getTokensFromRequest = (req: express.Request) => {
  const sessionTokens = (req as any).session?.tokens;
  if (sessionTokens) return sessionTokens;

  const headerTokens = req.headers['x-goog-tokens'];
  const queryTokens = req.query.tokens;
  const ticketId = req.query.ticket as string;
  
  if (ticketId && downloadTickets.has(ticketId)) {
    const ticket = downloadTickets.get(ticketId);
    downloadTickets.delete(ticketId); // Single use
    return ticket?.tokens;
  }

  const tokenStr = (headerTokens || queryTokens) as string;

  if (tokenStr) {
    try {
      return JSON.parse(tokenStr);
    } catch (e) {
      console.error('Error parsing tokens:', e);
    }
  }
  return null;
};

app.get('/api/auth/me', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  console.log('Checking auth in /api/auth/me, has tokens:', !!tokens);
  
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    res.json(userInfo.data);
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(401).json({ error: 'Session expired' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // Default cookie name for express-session
    res.json({ success: true });
  });
});

// Multer config for memory storage
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/drive/upload', upload.single('file'), async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const { parentId, relativePath } = req.body;
    
    let targetParentId = parentId || 'root';
    if (relativePath) {
      const parts = relativePath.split('/').filter(p => p && p !== req.file?.originalname);
      if (parts.length > 0) {
        targetParentId = await getOrCreateFolderPath(drive, parts, targetParentId);
      }
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const response = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [targetParentId],
      },
      media: {
        mimeType: req.file.mimetype,
        body: bufferStream,
      },
      fields: 'id, name, mimeType, size, createdTime, thumbnailLink, webViewLink, parents, starred, shared',
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Drive API Routes
app.get('/api/drive/files', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    const folderId = req.query.folderId as string;
    const filter = req.query.filter as string;
    
    let q = "trashed = false and not properties has { key='isHidden' and value='true' }";
    if (filter === 'starred') {
      q += " and starred = true";
    } else if (filter === 'shared') {
      q += " and sharedWithMe = true";
    } else if (filter === 'recent') {
      // For recent, we search globally and sort by time
      q = "trashed = false and not properties has { key='isHidden' and value='true' }";
    } else if (folderId) {
      q += ` and '${folderId}' in parents`;
    } else {
      q += " and 'root' in parents";
    }

    const response = await drive.files.list({
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, thumbnailLink, webViewLink, parents, starred, shared, properties)',
      q: q,
      orderBy: filter === 'recent' ? 'modifiedTime desc' : undefined
    });
    res.json(response.data.files);
  } catch (error) {
    console.error('Error fetching drive files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

app.get('/api/drive/breakdown', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const breakdown: any = {
      image: { size: 0, count: 0 },
      video: { size: 0, count: 0 },
      audio: { size: 0, count: 0 },
      document: { size: 0, count: 0 },
      apk: { size: 0, count: 0 },
      archive: { size: 0, count: 0 },
      other: { size: 0, count: 0 }
    };

    let pageToken: string | undefined = undefined;
    
    do {
      const response: any = await drive.files.list({
        q: "trashed = false",
        pageSize: 1000,
        fields: 'nextPageToken, files(mimeType, size, name)',
        pageToken: pageToken
      });

      const files = response.data.files || [];
      files.forEach((f: any) => {
        if (f.mimeType === 'application/vnd.google-apps.folder') return;
        
        let type = 'other';
        const mime = f.mimeType;
        const name = (f.name || '').toLowerCase();

        if (mime.includes('image')) type = 'image';
        else if (mime.includes('video')) type = 'video';
        else if (mime.includes('audio')) type = 'audio';
        else if (mime.includes('pdf') || mime.includes('document') || mime.includes('spreadsheet') || mime.includes('presentation')) type = 'document';
        else if (mime === 'application/vnd.android.package-archive' || name.endsWith('.apk')) type = 'apk';
        else if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('7z')) type = 'archive';

        const size = parseInt(f.size || '0');
        breakdown[type].size += size;
        breakdown[type].count += 1;
      });

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    res.json(breakdown);
  } catch (error) {
    console.error('Error calculating breakdown:', error);
    res.status(500).json({ error: 'Failed to calculate breakdown' });
  }
});

app.delete('/api/drive/files/:id', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    // Move to trash instead of permanent delete
    await drive.files.update({ 
      fileId: req.params.id,
      requestBody: { trashed: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error moving file to trash:', error);
    res.status(500).json({ error: 'Failed to move file to trash' });
  }
});

app.get('/api/drive/trash', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.files.list({
      q: "trashed = true",
      fields: 'files(id, name, mimeType, size, createdTime, thumbnailLink, webViewLink)',
    });
    res.json(response.data.files);
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

app.post('/api/drive/files/:id/restore', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    await drive.files.update({ 
      fileId: req.params.id,
      requestBody: { trashed: false }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring file:', error);
    res.status(500).json({ error: 'Failed to restore file' });
  }
});

app.post('/api/drive/files/:id/star', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    const { starred } = req.body;
    await drive.files.update({
      fileId: req.params.id,
      requestBody: { starred }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error starring file:', error);
    res.status(500).json({ error: 'Failed to star file' });
  }
});

app.post('/api/drive/files/:id/move', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    const { newParentId } = req.body;
    
    const file = await drive.files.get({
      fileId: req.params.id,
      fields: 'parents'
    });
    const previousParents = file.data.parents?.join(',');
    
    const updateParams: any = {
      fileId: req.params.id,
      addParents: newParentId,
      fields: 'id, parents'
    };
    if (previousParents) updateParams.removeParents = previousParents;

    await drive.files.update(updateParams);
    res.json({ success: true });
  } catch (error) {
    console.error('Error moving file:', error);
    res.status(500).json({ error: 'Failed to move file' });
  }
});

app.delete('/api/drive/files/:id/permanent', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    await drive.files.delete({ fileId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Error permanently deleting file:', error);
    res.status(500).json({ error: 'Failed to permanently delete file' });
  }
});

app.post('/api/drive/files/:id/share', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    // Make file readable by anyone with the link
    await drive.permissions.create({
      fileId: req.params.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const file = await drive.files.get({
      fileId: req.params.id,
      fields: 'webViewLink',
    });

    res.json({ webViewLink: file.data.webViewLink });
  } catch (error) {
    console.error('Error sharing file:', error);
    res.status(500).json({ error: 'Failed to share file' });
  }
});

app.post('/api/drive/folders', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { name, parentId } = req.body;
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : ['root'],
      },
      fields: 'id, name, mimeType, parents, createdTime',
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

app.patch('/api/drive/files/:id', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { id } = req.params;
    const { name } = req.body;
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.files.update({
      fileId: id,
      requestBody: { name },
      fields: 'id, name, mimeType, size, createdTime',
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

app.get('/api/drive/about', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    const response = await drive.about.get({
      fields: 'storageQuota, user',
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching drive about info:', error);
    res.status(500).json({ error: 'Failed to fetch storage info' });
  }
});

// Hidden Files Routes
app.post('/api/drive/files/:id/hide', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    await drive.files.update({
      fileId: req.params.id,
      requestBody: {
        properties: {
          isHidden: 'true'
        }
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error hiding file:', error);
    res.status(500).json({ error: 'Failed to hide file: ' + (error.message || String(error)) });
  }
});

app.get('/api/drive/files/:id/permissions', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.permissions.list({
      fileId: req.params.id,
      fields: 'permissions(id, emailAddress, role, type, displayName, photoLink)'
    });
    
    res.json(response.data.permissions || []);
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

app.post('/api/drive/files/:id/permissions', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { emailAddress, role } = req.body;
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.permissions.create({
      fileId: req.params.id,
      requestBody: {
        type: 'user',
        role: role || 'reader',
        emailAddress
      },
      fields: 'id, emailAddress, role, type, displayName, photoLink'
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Error adding permission:', error);
    res.status(500).json({ error: 'Failed to add permission' });
  }
});

app.delete('/api/drive/files/:id/permissions/:permissionId', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    await drive.permissions.delete({
      fileId: req.params.id,
      permissionId: req.params.permissionId
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing permission:', error);
    res.status(500).json({ error: 'Failed to remove permission' });
  }
});

app.post('/api/drive/files/:id/unhide', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    await drive.files.update({
      fileId: req.params.id,
      requestBody: {
        properties: {
          // Setting properties to null deletes them
          isHidden: null as any
        }
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error unhiding file:', error);
    res.status(500).json({ error: 'Failed to unhide file: ' + (error.message || String(error)) });
  }
});

app.get('/api/drive/hidden', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.files.list({
      pageSize: 100,
      fields: 'files(id, name, mimeType, size, createdTime, thumbnailLink, webViewLink, parents, starred, shared, properties)',
      q: "properties has { key='isHidden' and value='true' } and trashed = false",
    });
    res.json(response.data.files);
  } catch (error: any) {
    console.error('Error fetching hidden files:', error);
    res.status(500).json({ error: 'Failed to fetch hidden files: ' + (error.message || String(error)) });
  }
});

app.post('/api/drive/download/ticket', (req, res) => {
  // Use tokens from body for POST, as they can be very large and exceed header limits
  const tokens = req.body.tokens || getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });
  
  const ticketId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  downloadTickets.set(ticketId, {
    tokens,
    expires: Date.now() + 60000 // 1 minute expiry
  });
  
  res.json({ ticketId });
});

app.get('/api/drive/download/:id', async (req, res) => {
  const tokens = getTokensFromRequest(req);
  if (!tokens) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    const fileId = req.params.id;

    // 1. Get file metadata
    const file = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    });

    const isFolder = file.data.mimeType === 'application/vnd.google-apps.folder';
    const isGoogleDoc = file.data.mimeType.startsWith('application/vnd.google-apps.') && !isFolder;

    if (isFolder) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${file.data.name}.zip"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);

      async function addFolderToZip(folderId: string, currentPath: string) {
        const listRes = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType)',
        });

        for (const item of listRes.data.files || []) {
          const itemPath = path.join(currentPath, item.name);
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            await addFolderToZip(item.id, itemPath);
          } else if (item.mimeType.startsWith('application/vnd.google-apps.')) {
            try {
              const exportRes = await drive.files.export({
                fileId: item.id,
                mimeType: 'application/pdf',
              }, { responseType: 'stream' });
              archive.append(exportRes.data, { name: itemPath + '.pdf' });
            } catch (e) {
              console.error(`Error exporting ${item.name}:`, e);
            }
          } else {
            const mediaRes = await drive.files.get({
              fileId: item.id,
              alt: 'media',
            }, { responseType: 'stream' });
            archive.append(mediaRes.data, { name: itemPath });
          }
        }
      }

      await addFolderToZip(fileId, '');
      await archive.finalize();
    } else if (isGoogleDoc) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${file.data.name}.pdf"`);
      
      const exportRes = await drive.files.export({
        fileId,
        mimeType: 'application/pdf',
      }, { responseType: 'stream' });
      
      exportRes.data.pipe(res);
    } else {
      res.setHeader('Content-Type', file.data.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file.data.name}"`);
      
      const mediaRes = await drive.files.get({
        fileId,
        alt: 'media',
      }, { responseType: 'stream' });
      
      mediaRes.data.pipe(res);
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});


// Vercel: Static files are served from outputDirectory (dist) by Vercel CDN.
// Express only handles /api/* and /auth/* routes.
// For local dev, server.ts handles everything including Vite middleware.

// Export the Express app for Vercel serverless
export default app;

