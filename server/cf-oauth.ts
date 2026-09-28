import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool, logAudit } from './db.js';
import { requireAuth } from './auth.js';
import { sanitizePagesProjectName } from './builder.js';

export const cfOAuthRouter = Router();

/**
 * Robustly resolve the callback redirect URI.
 * Prioritizes APP_URL environment variable, followed by reverse-proxy headers,
 * safely handling comma-separated proxy header lists.
 */
export function resolveRedirectUri(req: Request): string {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/+$/, '')}/api/auth/cloudflare/callback`;
  }
  const rawProto = req.headers['x-forwarded-proto'];
  const protocol = (typeof rawProto === 'string' ? rawProto.split(',')[0].trim() : '') || req.protocol || 'https';
  const rawHost = req.headers['x-forwarded-host'];
  const host = (typeof rawHost === 'string' ? rawHost.split(',')[0].trim() : '') || req.get('host') || 'localhost:3000';
  return `${protocol}://${host}/api/auth/cloudflare/callback`;
}

/**
 * Helper to retrieve Cloudflare OAuth App settings from database
 */
export async function getCloudflareOAuthSettings(): Promise<{
  clientId: string;
  clientSecret: string;
  scopes: string;
}> {
  const result = await pool.query(
    `SELECT key, value FROM app_settings 
     WHERE key IN ('cf_oauth_client_id', 'cf_oauth_client_secret', 'cf_oauth_scopes')`
  );
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[row.key] = row.value;
  }

  return {
    clientId: map['cf_oauth_client_id'] || process.env.CLOUDFLARE_OAUTH_CLIENT_ID || '',
    clientSecret: map['cf_oauth_client_secret'] || process.env.CLOUDFLARE_OAUTH_CLIENT_SECRET || '',
    scopes: map['cf_oauth_scopes'] || process.env.CLOUDFLARE_OAUTH_SCOPES || 'account:read pages:edit dns:edit',
  };
}

/**
 * GET /api/auth/cloudflare/config-status
 * Public/User status check: Is Cloudflare OAuth App configured by admin?
 */
cfOAuthRouter.get('/config-status', async (req: Request, res: Response) => {
  try {
    const { clientId, clientSecret, scopes } = await getCloudflareOAuthSettings();
    const isConfigured = Boolean(clientId.trim() && clientSecret.trim());
    res.json({
      configured: isConfigured,
      client_id: isConfigured ? `${clientId.slice(0, 6)}••••••` : '',
      scopes,
      redirect_uri: resolveRedirectUri(req),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/cloudflare/url
 * Generate Cloudflare OAuth 2.0 Authorization URL for 1-Click popup connect
 */
cfOAuthRouter.get('/url', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const { project_id } = req.query;
    if (!project_id || typeof project_id !== 'string') {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    // Verify project exists
    const projRes = await pool.query('SELECT id, name FROM cf_projects WHERE id = $1', [project_id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { clientId, clientSecret, scopes } = await getCloudflareOAuthSettings();
    if (!clientId.trim() || !clientSecret.trim()) {
      return res.status(400).json({
        error: 'Cloudflare OAuth App is not configured. Administrator must set OAuth Client ID and Secret in /vcon Settings.',
        code: 'OAUTH_NOT_CONFIGURED',
      });
    }

    // Determine redirect URI
    const redirectUri = resolveRedirectUri(req);

    // State payload with cryptographic signature & nonce
    const statePayload = {
      projectId: project_id,
      userId: user.id,
      userEmail: user.email,
      redirectUri,
      nonce: crypto.randomBytes(8).toString('hex'),
      ts: Date.now(),
    };

    const stateEncoded = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', clientSecret.trim()).update(stateEncoded).digest('base64url');
    const state = `${stateEncoded}.${signature}`;

    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: clientId.trim(),
      redirect_uri: redirectUri,
      scope: scopes.trim(),
      state,
    });

    const authUrl = `https://dash.cloudflare.com/oauth2/auth?${authParams.toString()}`;

    res.json({
      url: authUrl,
      redirect_uri: redirectUri,
      client_id: clientId.trim(),
      project_id,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/cloudflare/callback
 * OAuth callback handler: exchanges authorization code with Cloudflare,
 * fetches account details, saves to database, and posts message to opener popup.
 */
cfOAuthRouter.get(['/callback', '/callback/'], async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // Handle provider cancellation or denial
  if (error) {
    const errText = String(error_description || error);
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Cloudflare Authorization Error</title>
          <style>
            body { background: #06080D; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0C0F17; border: 1px solid #1e293b; border-radius: 8px; padding: 24px; max-width: 400px; text-align: center; }
            .err { color: #f87171; font-weight: bold; margin-bottom: 8px; font-size: 14px; }
            .desc { color: #94a3b8; font-size: 11px; margin-bottom: 16px; word-break: break-word; }
            button { background: #334155; color: #f8fafc; border: 0; padding: 6px 14px; border-radius: 4px; font-size: 11px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="err">Cloudflare Authorization Failed</div>
            <div class="desc">${escapeHtml(errText)}</div>
            <button onclick="window.close()">Close Window</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'CF_OAUTH_ERROR', error: ${JSON.stringify(errText)} }, window.location.origin);
            }
          </script>
        </body>
      </html>
    `);
  }

  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state parameter.');
  }

  try {
    const { clientId, clientSecret } = await getCloudflareOAuthSettings();
    if (!clientId.trim() || !clientSecret.trim()) {
      throw new Error('Cloudflare OAuth App is not configured on the server.');
    }

    // 1. Validate state and HMAC signature
    const [stateEncoded, signature] = String(state).split('.');
    if (!stateEncoded || !signature) {
      throw new Error('Invalid or corrupted OAuth state parameter.');
    }

    const expectedSig = crypto.createHmac('sha256', clientSecret.trim()).update(stateEncoded).digest('base64url');
    if (signature !== expectedSig) {
      throw new Error('OAuth state verification failed: unauthorized or tampered signature.');
    }

    let stateData: any = {};
    try {
      stateData = JSON.parse(Buffer.from(stateEncoded, 'base64url').toString('utf-8'));
    } catch {
      throw new Error('Invalid OAuth state data payload.');
    }

    // Enforce 15-minute validity window
    if (!stateData.ts || Date.now() - stateData.ts > 15 * 60 * 1000) {
      throw new Error('OAuth authorization session expired. Please retry connection from workspace.');
    }

    const { projectId, userEmail, redirectUri: stateRedirectUri } = stateData;
    if (!projectId) {
      throw new Error('Missing project context in OAuth state.');
    }

    const projRes = await pool.query('SELECT * FROM cf_projects WHERE id = $1', [projectId]);
    if (projRes.rows.length === 0) {
      throw new Error('Associated project no longer exists.');
    }
    const project = projRes.rows[0];

    // Use redirect URI stored in state or fall back to resolved URI
    const redirectUri = stateRedirectUri || resolveRedirectUri(req);

    // 2. Exchange authorization code for access token
    const basicAuth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: redirectUri,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
    });

    const tokenRes = await fetch('https://dash.cloudflare.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/json',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      const errDetail = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
      throw new Error(`Cloudflare token exchange failed: ${errDetail}`);
    }

    const accessToken = tokenData.access_token;

    // 3. Fetch user info & authorized Cloudflare Accounts with accessToken
    const cfHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    let userEmailFinal = userEmail || 'cloudflare-user';
    try {
      const userRes = await fetch('https://api.cloudflare.com/client/v4/user', {
        headers: cfHeaders,
      });
      const userData = await userRes.json().catch(() => ({}));
      if (userData.success && userData.result?.email) {
        userEmailFinal = userData.result.email;
      }
    } catch {
      // non-fatal
    }

    const accountsRes = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=50', {
      headers: cfHeaders,
    });
    const accountsData = await accountsRes.json().catch(() => ({}));

    if (!accountsRes.ok || !accountsData.success || !Array.isArray(accountsData.result) || accountsData.result.length === 0) {
      const accErr = accountsData.errors?.[0]?.message || 'No accessible Cloudflare accounts found for this token.';
      throw new Error(`Cloudflare account lookup failed: ${accErr}`);
    }

    const cfAccounts = accountsData.result;
    const connectedAccounts: any[] = [];

    // 4. Save accounts to database under this project
    for (const cfAcc of cfAccounts) {
      const cfAccountId = cfAcc.id;
      const accountAlias = cfAcc.name || userEmailFinal.split('@')[0] || `CF-${cfAccountId.slice(0, 6)}`;
      
      // Generate clean, deterministic subdomain prefix
      let baseSub = `cf-${cfAcc.name ? cfAcc.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : cfAccountId.slice(0, 6)}`;
      if (!baseSub || baseSub === 'cf-') baseSub = `cf-${cfAccountId.slice(0, 6)}`;
      let cleanSub = `${baseSub}-${Math.random().toString(36).substring(2, 6)}`;

      // Check if this CF account is already connected to this project
      const existingRes = await pool.query(
        'SELECT id, subdomain FROM cf_accounts WHERE project_id = $1 AND account_id = $2',
        [projectId, cfAccountId]
      );

      let recordId = '';
      if (existingRes.rows.length > 0) {
        // Update credentials for existing account
        recordId = existingRes.rows[0].id;
        cleanSub = existingRes.rows[0].subdomain || cleanSub;
        await pool.query(
          `UPDATE cf_accounts 
           SET api_token = $1, email = $2, alias = $3 
           WHERE id = $4`,
          [accessToken, userEmailFinal, accountAlias, recordId]
        );
      } else {
        // Ensure subdomain uniqueness across project accounts
        let subExists = await pool.query('SELECT id FROM cf_accounts WHERE project_id = $1 AND subdomain = $2', [projectId, cleanSub]);
        let attempts = 0;
        while (subExists.rows.length > 0 && attempts < 5) {
          cleanSub = `${baseSub}-${Math.random().toString(36).substring(2, 7)}`;
          subExists = await pool.query('SELECT id FROM cf_accounts WHERE project_id = $1 AND subdomain = $2', [projectId, cleanSub]);
          attempts++;
        }

        // Insert new account record with correct parameter order
        recordId = 'acc_' + Math.random().toString(36).substring(2, 12);
        await pool.query(
          `INSERT INTO cf_accounts (id, project_id, alias, account_id, api_token, email, subdomain)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [recordId, projectId, accountAlias, cfAccountId, accessToken, userEmailFinal, cleanSub]
        );
      }

      // Check if deployment row exists for this account & project, provision if absent
      const depCheck = await pool.query(
        'SELECT id FROM cf_deployments WHERE project_id = $1 AND account_id = $2',
        [projectId, recordId]
      );

      if (depCheck.rows.length === 0) {
        const depId = 'dep_' + Math.random().toString(36).substring(2, 12);
        const sanitizedName = sanitizePagesProjectName(project.name, cleanSub);
        const targetPagesDev = `${sanitizedName}.pages.dev`;
        const targetCustom = `${cleanSub}.${project.root_domain || 'pages.dev'}`;

        await pool.query(
          `INSERT INTO cf_deployments 
           (id, project_id, account_id, cf_pages_project_name, pages_dev_domain, custom_domain, cname_host, cname_target, dns_status, build_status, progress_percent, current_step, logs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'idle', 0, 'Ready to build', '')
           ON CONFLICT DO NOTHING`,
          [
            depId,
            projectId,
            recordId,
            sanitizedName,
            `https://${targetPagesDev}`,
            `https://${targetCustom}`,
            cleanSub,
            targetPagesDev,
          ]
        );
      }

      connectedAccounts.push({
        id: recordId,
        alias: accountAlias,
        account_id: cfAccountId,
      });
    }

    await logAudit(
      userEmailFinal,
      'CLOUDFLARE_OAUTH_CONNECTED',
      {
        project_id: projectId,
        accounts_count: connectedAccounts.length,
        accounts: connectedAccounts.map((a) => a.alias),
      },
      req.ip
    );

    const primaryName = connectedAccounts[0]?.alias || 'Cloudflare Account';

    // 5. Send postMessage to opener window and close popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Cloudflare Connected</title>
          <style>
            body { background: #06080D; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0C0F17; border: 1px solid #1e293b; border-radius: 8px; padding: 24px; max-width: 380px; text-align: center; }
            .badge { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(234, 88, 12, 0.15); color: #ea580c; border: 1px solid rgba(234, 88, 12, 0.3); margin-bottom: 12px; }
            .title { color: #f8fafc; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
            .desc { color: #94a3b8; font-size: 11px; margin-bottom: 16px; font-family: monospace; }
            .note { color: #10b981; font-size: 10px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div class="title">Cloudflare Account Connected!</div>
            <div class="desc">${escapeHtml(primaryName)} (${connectedAccounts.length} account${connectedAccounts.length === 1 ? '' : 's'})</div>
            <div class="note">Closing popup and syncing fleet...</div>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({
                  type: 'CF_OAUTH_SUCCESS',
                  projectId: ${JSON.stringify(projectId)},
                  count: ${connectedAccounts.length},
                  accountName: ${JSON.stringify(primaryName)}
                }, window.location.origin);
              }
            } catch (e) {
              console.error('postMessage error:', e);
            }
            setTimeout(() => {
              window.close();
            }, 600);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[Cloudflare OAuth Callback Error]:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Connection Error</title>
          <style>
            body { background: #06080D; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0C0F17; border: 1px solid #7f1d1d; border-radius: 8px; padding: 24px; max-width: 420px; text-align: center; }
            .err { color: #f87171; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
            .desc { color: #cbd5e1; font-size: 11px; margin-bottom: 16px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
            button { background: #334155; color: #f8fafc; border: 0; padding: 6px 14px; border-radius: 4px; font-size: 11px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="err">Failed to Connect Cloudflare Account</div>
            <div class="desc">${escapeHtml(err.message || 'Unknown OAuth error')}</div>
            <button onclick="window.close()">Close Window</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'CF_OAUTH_ERROR',
                error: ${JSON.stringify(err.message || 'Connection error')}
              }, window.location.origin);
            }
          </script>
        </body>
      </html>
    `);
  }
});

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * GET /api/auth/cloudflare/zones
 * Fetch all active Cloudflare Zones for connected accounts in a project
 */
cfOAuthRouter.get('/zones', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    if (!project_id || typeof project_id !== 'string') {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    // Get all accounts connected to this project
    const accsRes = await pool.query(
      'SELECT id, alias, account_id, api_token FROM cf_accounts WHERE project_id = $1 ORDER BY created_at ASC',
      [project_id]
    );

    const accounts = accsRes.rows;
    if (accounts.length === 0) {
      return res.json({
        success: true,
        count: 0,
        zones: [],
        message: 'No Cloudflare accounts connected yet. Please connect an account first.',
      });
    }

    const zonesMap = new Map<string, any>();

    // Query zones for each connected account token
    for (const acc of accounts) {
      const token = (acc.api_token || '').trim();
      if (!token) continue;

      try {
        const cfRes = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await cfRes.json().catch(() => ({}));
        if (cfRes.ok && data.success && Array.isArray(data.result)) {
          for (const zone of data.result) {
            if (!zonesMap.has(zone.id)) {
              zonesMap.set(zone.id, {
                id: zone.id,
                name: zone.name,
                status: zone.status,
                paused: zone.paused,
                type: zone.type,
                name_servers: zone.name_servers || [],
                account: {
                  id: zone.account?.id || acc.account_id,
                  name: zone.account?.name || acc.alias,
                },
                plan: zone.plan?.name || 'Free',
                connected_account_id: acc.id,
                connected_account_alias: acc.alias,
              });
            }
          }
        }
      } catch (zoneErr: any) {
        console.warn(`Failed to fetch zones for account ${acc.alias}:`, zoneErr.message);
      }
    }

    const zones = Array.from(zonesMap.values());
    res.json({
      success: true,
      count: zones.length,
      zones,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch Cloudflare zones' });
  }
});

/**
 * POST /api/auth/cloudflare/dns/auto-provision
 * 1-Click DNS Automation: Creates/updates Wildcard & Subdomain CNAME records in Cloudflare DNS,
 * and attaches Custom Domains to all fleet Cloudflare Pages projects.
 */
cfOAuthRouter.post('/dns/auto-provision', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const {
      project_id,
      zone_id,
      root_domain,
      proxied = true,
      sync_subdomains = true,
      create_wildcard = true,
    } = req.body || {};

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (!root_domain || !root_domain.trim()) {
      return res.status(400).json({ error: 'root_domain is required' });
    }

    const cleanDomain = root_domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

    // 1. Fetch project
    const projRes = await pool.query('SELECT * FROM cf_projects WHERE id = $1', [project_id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projRes.rows[0];

    // 2. Fetch project's connected accounts
    const accsRes = await pool.query(
      'SELECT id, alias, account_id, api_token, subdomain FROM cf_accounts WHERE project_id = $1 ORDER BY created_at ASC',
      [project_id]
    );
    const accounts = accsRes.rows;

    if (accounts.length === 0) {
      return res.status(400).json({
        error: 'No Cloudflare accounts connected to this project. Please connect at least one account.',
      });
    }

    // 3. Identify the token that has access to this zone / domain
    let activeToken = '';
    let targetZoneId = zone_id;
    let zoneDetails: any = null;

    for (const acc of accounts) {
      const token = (acc.api_token || '').trim();
      if (!token) continue;

      try {
        // If zone_id provided, verify access
        if (targetZoneId) {
          const zRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${targetZoneId}`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          const zData = await zRes.json().catch(() => ({}));
          if (zRes.ok && zData.success && zData.result) {
            activeToken = token;
            zoneDetails = zData.result;
            break;
          }
        }

        // Search zone by domain name
        const searchRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(cleanDomain)}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const searchData = await searchRes.json().catch(() => ({}));
        if (searchRes.ok && searchData.success && Array.isArray(searchData.result) && searchData.result.length > 0) {
          activeToken = token;
          targetZoneId = searchData.result[0].id;
          zoneDetails = searchData.result[0];
          break;
        }
      } catch {
        // continue
      }
    }

    if (!activeToken || !targetZoneId) {
      return res.status(400).json({
        error: `Could not access Cloudflare zone for domain '${cleanDomain}'. Ensure the domain exists in your connected Cloudflare account and the API token has 'DNS:Edit' and 'Zone:Read' permissions.`,
      });
    }

    const cfHeaders = {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
    };

    // Calculate base pages target
    const baseSanitized = sanitizePagesProjectName(project.name, accounts[0]?.subdomain || 'app');
    const primaryPagesTarget = `${baseSanitized}.pages.dev`;

    const provisionedRecords: any[] = [];
    const pagesBoundAccounts: any[] = [];

    // 4. Create or Update Wildcard CNAME record: *.example.com -> primaryPagesTarget
    if (create_wildcard) {
      const wildcardName = `*.${cleanDomain}`;
      try {
        // Check if wildcard CNAME already exists
        const checkDnsRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(wildcardName)}`,
          { headers: cfHeaders }
        );
        const checkDnsData = await checkDnsRes.json().catch(() => ({}));

        if (checkDnsRes.ok && checkDnsData.success && Array.isArray(checkDnsData.result) && checkDnsData.result.length > 0) {
          const existingRecord = checkDnsData.result[0];
          // Update existing
          let updateDnsRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records/${existingRecord.id}`,
            {
              method: 'PUT',
              headers: cfHeaders,
              body: JSON.stringify({
                type: 'CNAME',
                name: wildcardName,
                content: primaryPagesTarget,
                proxied: Boolean(proxied),
                ttl: 1, // Auto TTL
                comment: 'Auto-provisioned by Cloudflare Bulk Builder',
              }),
            }
          );
          let updateData = await updateDnsRes.json().catch(() => ({}));

          // If plan rejects proxying on wildcard, fallback to DNS Only (proxied: false)
          if (!updateData.success && updateData.errors?.[0]?.message?.toLowerCase().includes('wildcard')) {
            updateDnsRes = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records/${existingRecord.id}`,
              {
                method: 'PUT',
                headers: cfHeaders,
                body: JSON.stringify({
                  type: 'CNAME',
                  name: wildcardName,
                  content: primaryPagesTarget,
                  proxied: false,
                  ttl: 1,
                  comment: 'Auto-provisioned by Cloudflare Bulk Builder (DNS Only)',
                }),
              }
            );
            updateData = await updateDnsRes.json().catch(() => ({}));
          }

          provisionedRecords.push({
            name: wildcardName,
            type: 'CNAME',
            target: primaryPagesTarget,
            proxied: updateData.result?.proxied ?? false,
            action: 'updated',
            success: updateDnsRes.ok && updateData.success,
          });
        } else {
          // Create new record
          let createDnsRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`,
            {
              method: 'POST',
              headers: cfHeaders,
              body: JSON.stringify({
                type: 'CNAME',
                name: wildcardName,
                content: primaryPagesTarget,
                proxied: Boolean(proxied),
                ttl: 1,
                comment: 'Auto-provisioned by Cloudflare Bulk Builder',
              }),
            }
          );
          let createData = await createDnsRes.json().catch(() => ({}));

          // If plan rejects proxying on wildcard, fallback to DNS Only (proxied: false)
          if (!createData.success && createData.errors?.[0]?.message?.toLowerCase().includes('wildcard')) {
            createDnsRes = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`,
              {
                method: 'POST',
                headers: cfHeaders,
                body: JSON.stringify({
                  type: 'CNAME',
                  name: wildcardName,
                  content: primaryPagesTarget,
                  proxied: false,
                  ttl: 1,
                  comment: 'Auto-provisioned by Cloudflare Bulk Builder (DNS Only)',
                }),
              }
            );
            createData = await createDnsRes.json().catch(() => ({}));
          }

          provisionedRecords.push({
            name: wildcardName,
            type: 'CNAME',
            target: primaryPagesTarget,
            proxied: createData.result?.proxied ?? false,
            action: 'created',
            success: createDnsRes.ok && createData.success,
          });
        }
      } catch (wcErr: any) {
        console.warn('Wildcard DNS provision error:', wcErr);
      }

      // Also ensure Apex / Root domain CNAME exists for clean domain routing
      try {
        const rootCheckRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(cleanDomain)}`,
          { headers: cfHeaders }
        );
        const rootCheckData = await rootCheckRes.json().catch(() => ({}));
        if (rootCheckRes.ok && rootCheckData.success && Array.isArray(rootCheckData.result) && rootCheckData.result.length === 0) {
          const rootCreateRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`,
            {
              method: 'POST',
              headers: cfHeaders,
              body: JSON.stringify({
                type: 'CNAME',
                name: cleanDomain,
                content: primaryPagesTarget,
                proxied: Boolean(proxied),
                ttl: 1,
                comment: 'Auto-provisioned apex domain by Cloudflare Bulk Builder',
              }),
            }
          );
          const rootCreateData = await rootCreateRes.json().catch(() => ({}));
          if (rootCreateRes.ok && rootCreateData.success) {
            provisionedRecords.push({
              name: cleanDomain,
              type: 'CNAME',
              target: primaryPagesTarget,
              proxied: Boolean(proxied),
              action: 'created (Apex)',
              success: true,
            });
          }
        }
      } catch (rootDnsErr: any) {
        console.warn('Apex CNAME provision notice:', rootDnsErr.message);
      }
    }

    // 5. Sync Subdomain DNS records & bind custom domains to Cloudflare Pages for each account in fleet
    for (const acc of accounts) {
      const accSub = acc.subdomain;
      const fullSubdomain = `${accSub}.${cleanDomain}`;
      const accPagesProjectName = sanitizePagesProjectName(project.name, accSub);
      const accPagesTarget = `${accPagesProjectName}.pages.dev`;
      const accToken = (acc.api_token || activeToken).trim();
      const accId = acc.account_id?.trim();

      // If requested, also create explicit CNAME record for this subdomain
      if (sync_subdomains) {
        try {
          const subCheckRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(fullSubdomain)}`,
            { headers: cfHeaders }
          );
          const subCheckData = await subCheckRes.json().catch(() => ({}));

          if (subCheckRes.ok && subCheckData.success && Array.isArray(subCheckData.result) && subCheckData.result.length > 0) {
            const existingSub = subCheckData.result[0];
            await fetch(
              `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records/${existingSub.id}`,
              {
                method: 'PUT',
                headers: cfHeaders,
                body: JSON.stringify({
                  type: 'CNAME',
                  name: fullSubdomain,
                  content: accPagesTarget,
                  proxied: Boolean(proxied),
                  ttl: 1,
                }),
              }
            );
            provisionedRecords.push({
              name: fullSubdomain,
              type: 'CNAME',
              target: accPagesTarget,
              proxied: Boolean(proxied),
              action: 'updated',
              success: true,
            });
          } else {
            await fetch(
              `https://api.cloudflare.com/client/v4/zones/${targetZoneId}/dns_records`,
              {
                method: 'POST',
                headers: cfHeaders,
                body: JSON.stringify({
                  type: 'CNAME',
                  name: fullSubdomain,
                  content: accPagesTarget,
                  proxied: Boolean(proxied),
                  ttl: 1,
                }),
              }
            );
            provisionedRecords.push({
              name: fullSubdomain,
              type: 'CNAME',
              target: accPagesTarget,
              proxied: Boolean(proxied),
              action: 'created',
              success: true,
            });
          }
        } catch (subDnsErr: any) {
          console.warn(`Subdomain DNS error for ${fullSubdomain}:`, subDnsErr.message);
        }
      }

      // Bind custom domain to Cloudflare Pages Project
      if (accId && accToken) {
        try {
          const bindHeaders = {
            Authorization: `Bearer ${accToken}`,
            'Content-Type': 'application/json',
          };
          const bindRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accId}/pages/projects/${accPagesProjectName}/domains`,
            {
              method: 'POST',
              headers: bindHeaders,
              body: JSON.stringify({ name: fullSubdomain }),
            }
          );
          const bindData = await bindRes.json().catch(() => ({}));
          pagesBoundAccounts.push({
            alias: acc.alias,
            subdomain: fullSubdomain,
            pages_project: accPagesProjectName,
            status: bindRes.ok && bindData.success ? 'attached' : (bindData.errors?.[0]?.message || 'ready'),
          });
        } catch (bindErr: any) {
          console.warn(`Pages domain binding error for ${acc.alias}:`, bindErr.message);
        }
      }

      // Update deployment record in DB or provision if missing
      const depUpdate = await pool.query(
        `UPDATE cf_deployments 
         SET custom_domain = $1,
             dns_status = 'verified',
             cname_host = $2,
             cname_target = $3,
             updated_at = NOW()
         WHERE project_id = $4 AND account_id = $5`,
        [`https://${fullSubdomain}`, accSub, accPagesTarget, project_id, acc.id]
      );

      if (depUpdate.rowCount === 0) {
        const depId = 'dep_' + Math.random().toString(36).substring(2, 12);
        await pool.query(
          `INSERT INTO cf_deployments 
           (id, project_id, account_id, cf_pages_project_name, pages_dev_domain, custom_domain, cname_host, cname_target, dns_status, build_status, progress_percent, current_step, logs)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', 'idle', 0, 'Ready to build', '')
           ON CONFLICT DO NOTHING`,
          [
            depId,
            project_id,
            acc.id,
            accPagesProjectName,
            `https://${accPagesTarget}`,
            `https://${fullSubdomain}`,
            accSub,
            accPagesTarget,
          ]
        );
      }
    }

    // 6. Update Project root_domain
    await pool.query(
      `UPDATE cf_projects 
       SET root_domain = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [cleanDomain, project_id]
    );

    // 7. Forensic Audit Logging
    await logAudit(
      user.email,
      'CLOUDFLARE_DNS_AUTO_PROVISIONED',
      {
        project_id,
        root_domain: cleanDomain,
        zone_id: targetZoneId,
        records_count: provisionedRecords.length,
        accounts_count: accounts.length,
      },
      req.ip
    );

    res.json({
      success: true,
      root_domain: cleanDomain,
      zone_id: targetZoneId,
      zone_name: zoneDetails?.name || cleanDomain,
      zone_status: zoneDetails?.status || 'active',
      wildcard_target: primaryPagesTarget,
      provisioned_records: provisionedRecords,
      pages_bound_count: pagesBoundAccounts.length,
      message: `Successfully auto-provisioned DNS records and attached custom domains for ${cleanDomain}!`,
    });
  } catch (err: any) {
    console.error('DNS Auto-Provision Error:', err);
    res.status(500).json({ error: err.message || 'Failed to auto-provision DNS records' });
  }
});

/**
 * GET /api/auth/cloudflare/dns/verify-status
 * Live DNS & SSL verification status for a project's domain
 */
cfOAuthRouter.get('/dns/verify-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { project_id, domain } = req.query;
    if (!project_id || typeof project_id !== 'string') {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const cleanDomain = domain ? String(domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '') : '';

    const projRes = await pool.query('SELECT root_domain, name FROM cf_projects WHERE id = $1', [project_id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const targetDomain = cleanDomain || projRes.rows[0].root_domain;
    if (!targetDomain) {
      return res.json({
        configured: false,
        status: 'unconfigured',
        message: 'No root domain configured for this project.',
      });
    }

    // Get accounts to find valid token
    const accsRes = await pool.query('SELECT api_token FROM cf_accounts WHERE project_id = $1 LIMIT 5', [project_id]);
    let liveDnsRecords: any[] = [];
    let zoneFound = false;

    for (const acc of accsRes.rows) {
      const token = (acc.api_token || '').trim();
      if (!token) continue;

      try {
        const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(targetDomain)}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const zoneData = await zoneRes.json().catch(() => ({}));
        if (zoneRes.ok && zoneData.success && Array.isArray(zoneData.result) && zoneData.result.length > 0) {
          zoneFound = true;
          const zoneId = zoneData.result[0].id;
          const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=50`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          const dnsData = await dnsRes.json().catch(() => ({}));
          if (dnsRes.ok && dnsData.success && Array.isArray(dnsData.result)) {
            liveDnsRecords = dnsData.result.map((r: any) => ({
              id: r.id,
              name: r.name,
              type: r.type,
              content: r.content,
              proxied: r.proxied,
              ttl: r.ttl,
            }));
          }
          break;
        }
      } catch {
        // continue
      }
    }

    res.json({
      configured: true,
      domain: targetDomain,
      zone_found: zoneFound,
      records: liveDnsRecords,
      status: zoneFound ? 'active' : 'unverified',
      verified_at: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to verify DNS' });
  }
});
