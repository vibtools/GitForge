import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec, spawn } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

interface BuildTaskOptions {
  projectId: string;
  accountIds?: string[];
}

// In-memory active build tracking with AbortController and ChildProcess tracking for instant, clean cancellations
interface ActiveBuildState {
  abortController: AbortController;
  processes: Set<import('child_process').ChildProcess>;
  workspaceDir?: string;
}

const activeBuilds = new Map<string, ActiveBuildState>();

export function isProjectBuilding(projectId: string): boolean {
  return activeBuilds.has(projectId);
}

export function cancelProjectBuild(projectId: string): boolean {
  const state = activeBuilds.get(projectId);
  if (state) {
    try {
      state.abortController.abort();
      for (const proc of state.processes) {
        try {
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {}
          }, 1500);
        } catch {}
      }
      state.processes.clear();
      if (state.workspaceDir && fs.existsSync(state.workspaceDir)) {
        try {
          fs.rmSync(state.workspaceDir, { recursive: true, force: true });
        } catch {}
      }
    } catch (err) {
      console.warn(`Error during cancel cleanup for ${projectId}:`, err);
    }
    activeBuilds.delete(projectId);
    return true;
  }
  return false;
}

export function cancelAllBuilds(): number {
  const count = activeBuilds.size;
  for (const projectId of Array.from(activeBuilds.keys())) {
    cancelProjectBuild(projectId);
  }
  return count;
}

export function getActiveBuildsCount(): number {
  return activeBuilds.size;
}

/**
 * Fetch GitHub commit metadata via GitHub REST API (lightweight lookup)
 */
export async function fetchGitHubRepoDetails(repoUrl: string, branch = 'main', token?: string) {
  const cleaned = repoUrl
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .trim();

  const parts = cleaned.split('/');
  if (parts.length >= 2) {
    const owner = parts[0];
    const repo = parts[1];
    const headers: Record<string, string> = {
      'User-Agent': 'Cloudflare-Bulk-Pages-Builder',
      Accept: 'application/vnd.github.v3+json',
    };
    if (token && token.trim()) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${branch || 'main'}`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        return {
          sha: (data.sha || '').substring(0, 7),
          fullSha: data.sha || '',
          message: data.commit?.message?.split('\n')[0] || 'Sync from GitHub',
          author: data.commit?.author?.name || 'GitHub Committer',
          date: data.commit?.author?.date || new Date().toISOString(),
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.message || `GitHub HTTP ${res.status}`;
        return {
          sha: 'HEAD',
          fullSha: 'HEAD',
          message: `Branch: ${branch} (${errMsg})`,
          author: 'GitHub',
          date: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    sha: 'HEAD',
    fullSha: 'HEAD',
    message: `Branch: ${branch}`,
    author: 'Git Syncer',
    date: new Date().toISOString(),
  };
}

/**
 * Helper to construct authenticated or public GitHub clone URL
 */
function getCloneUrl(rawRepo: string, token?: string): string {
  let cleaned = rawRepo.trim().replace(/\/+$/, '');
  if (cleaned.startsWith('git@github.com:')) {
    cleaned = cleaned.replace('git@github.com:', 'https://github.com/');
  } else if (cleaned.startsWith('github.com/')) {
    cleaned = `https://${cleaned}`;
  } else if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://github.com/${cleaned}`;
  }
  cleaned = cleaned.replace(/\/+$/, '').replace(/\.git$/i, '');

  if (token && token.trim()) {
    try {
      const urlObj = new URL(cleaned);
      const cleanPath = urlObj.pathname.replace(/\/+$/, '').replace(/\.git$/i, '');
      return `https://x-access-token:${encodeURIComponent(token.trim())}@${urlObj.host}${cleanPath}.git`;
    } catch {
      return `${cleaned}.git`;
    }
  }
  return `${cleaned}.git`;
}

export interface ScanResult {
  language: string;
  framework: string;
  architecture: 'Frontend SPA' | 'Full-Stack' | 'Static Site' | 'Backend API';
  is_dynamic: boolean;
  page_nature: string;
  cloudflare_compatible: boolean;
  cloudflare_status: string;
  recommended_build_command: string;
  recommended_output_dir: string;
  detected_env_vars: string[];
  detected_env_defaults?: Record<string, string>;
  detected_databases: string[];
  commit_sha: string;
  commit_message: string;
  commit_author: string;
  total_files: number;
  scanned_at: string;
}

/**
 * Deep forensic scanner for GitHub repositories:
 * Clones metadata/files, detects language, framework, Cloudflare Pages compatibility, env vars & databases
 */
export async function scanRepository(
  repoUrl: string,
  branch = 'main',
  token?: string
): Promise<ScanResult> {
  const cleanUrl = repoUrl.trim();
  if (!cleanUrl) {
    throw new Error('Repository URL is required for scanning');
  }

  const cloneUrl = getCloneUrl(cleanUrl, token);
  const targetBranch = branch?.trim() || 'main';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-repo-'));

  try {
    // 1. Shallow clone repository
    let cloneSuccess = false;
    try {
      await execAsync(`git clone --depth 1 --branch "${targetBranch}" "${cloneUrl}" "${tmpDir}"`, {
        timeout: 45000,
      });
      cloneSuccess = true;
    } catch (branchErr) {
      // Retry default branch
      if (fs.existsSync(tmpDir)) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      }
      fs.mkdirSync(tmpDir, { recursive: true });
      await execAsync(`git clone --depth 1 "${cloneUrl}" "${tmpDir}"`, { timeout: 45000 });
      cloneSuccess = true;
    }

    // 2. Read git commit info
    let commitSha = 'latest';
    let commitMessage = 'Initial repository scan';
    let commitAuthor = 'Developer';
    try {
      const { stdout: shaOut } = await execAsync('git rev-parse --short HEAD', { cwd: tmpDir });
      commitSha = shaOut.trim() || 'latest';
      const { stdout: msgOut } = await execAsync('git log -1 --pretty=format:"%s"', { cwd: tmpDir });
      commitMessage = msgOut.trim() || commitMessage;
      const { stdout: authOut } = await execAsync('git log -1 --pretty=format:"%an"', { cwd: tmpDir });
      commitAuthor = authOut.trim() || commitAuthor;
    } catch {}

    // 3. Scan files recursively (limit depth to 6 for speed)
    const allFiles: string[] = [];
    function walkDir(dir: string, depth = 0) {
      if (depth > 6 || allFiles.length > 500) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath, depth + 1);
          } else {
            allFiles.push(fullPath);
          }
        }
      } catch {}
    }
    walkDir(tmpDir);

    // 4. Detect Programming Languages
    const extCount: Record<string, number> = {};
    for (const f of allFiles) {
      const ext = path.extname(f).toLowerCase();
      if (ext) {
        extCount[ext] = (extCount[ext] || 0) + 1;
      }
    }

    let language = 'JavaScript';
    const tsCount = (extCount['.ts'] || 0) + (extCount['.tsx'] || 0);
    const jsCount = (extCount['.js'] || 0) + (extCount['.jsx'] || 0) + (extCount['.mjs'] || 0);
    const pyCount = extCount['.py'] || 0;
    const goCount = extCount['.go'] || 0;
    const phpCount = extCount['.php'] || 0;
    const htmlCount = extCount['.html'] || 0;

    if (tsCount > jsCount && tsCount > pyCount) {
      language = 'TypeScript';
    } else if (pyCount > jsCount && pyCount > tsCount) {
      language = 'Python';
    } else if (goCount > jsCount) {
      language = 'Go';
    } else if (phpCount > jsCount) {
      language = 'PHP';
    } else if (htmlCount > 0 && jsCount === 0 && tsCount === 0) {
      language = 'HTML / Static CSS';
    }

    // 5. Detect Framework & Architecture via package.json / configs
    let framework = 'Static HTML / Web';
    let architecture: 'Frontend SPA' | 'Full-Stack' | 'Static Site' | 'Backend API' = 'Static Site';
    let buildCommand = 'npm run build';
    let outputDir = 'dist';
    let isDynamic = false;
    let pageNature = 'Static Website (Instant Global CDN)';
    let cfCompatible = true;
    let cfStatus = '100% Fully Compatible with Cloudflare Pages';

    const pkgPath = path.join(tmpDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        const scripts = pkg.scripts || {};

        if (deps['next']) {
          framework = 'Next.js';
          architecture = 'Full-Stack';
          isDynamic = true;
          pageNature = 'SSR / SSG Hybrid (Next.js)';
          buildCommand = scripts['build'] ? 'npm run build' : 'next build';
          outputDir = fs.existsSync(path.join(tmpDir, 'out')) ? 'out' : '.next';
          cfStatus = 'Cloudflare Pages / OpenNext compatible (Static Export or Edge Worker)';
        } else if (deps['@vitejs/plugin-react'] || (deps['vite'] && deps['react'])) {
          framework = 'Vite + React';
          architecture = 'Frontend SPA';
          pageNature = 'Client-Side Rendered SPA (High Performance)';
          buildCommand = scripts['build'] ? 'npm run build' : 'vite build';
          outputDir = 'dist';
          cfStatus = '100% Direct Cloudflare Pages Deployable (Static Edge Asset)';
        } else if (deps['@sveltejs/kit'] || deps['svelte']) {
          framework = 'Svelte / SvelteKit';
          architecture = 'Frontend SPA';
          buildCommand = scripts['build'] ? 'npm run build' : 'npm run build';
          outputDir = 'build';
        } else if (deps['astro']) {
          framework = 'Astro';
          architecture = 'Static Site';
          buildCommand = scripts['build'] ? 'npm run build' : 'astro build';
          outputDir = 'dist';
        } else if (deps['nuxt'] || deps['vue']) {
          framework = deps['nuxt'] ? 'Nuxt.js' : 'Vue.js (Vite)';
          architecture = deps['nuxt'] ? 'Full-Stack' : 'Frontend SPA';
          buildCommand = scripts['build'] ? 'npm run build' : 'npm run build';
          outputDir = 'dist';
        } else if (deps['@remix-run/react'] || deps['@remix-run/node']) {
          framework = 'Remix';
          architecture = 'Full-Stack';
          buildCommand = scripts['build'] ? 'npm run build' : 'remix build';
          outputDir = 'build';
        } else if (deps['express'] && !deps['react'] && !deps['vue']) {
          framework = 'Express.js Backend API';
          architecture = 'Backend API';
          isDynamic = true;
          cfStatus = 'Requires Cloudflare Pages Functions or Workers proxy for server routes';
        } else if (scripts['build']) {
          framework = 'Node.js Custom Builder';
          buildCommand = 'npm run build';
          outputDir = 'dist';
        }
      } catch {}
    } else {
      if (fs.existsSync(path.join(tmpDir, 'index.html'))) {
        framework = 'Pure HTML5 / Static';
        architecture = 'Static Site';
        buildCommand = 'none';
        outputDir = '.';
        cfStatus = '100% Cloudflare Pages Direct Static Asset (No Build Needed)';
      }
    }

    // 6. Scan Environment Variables
    const envVarSet = new Set<string>();
    const envVarDefaults: Record<string, string> = {};
    const envFiles = ['.env', '.env.example', '.env.sample', '.env.local', '.env.template', '.env.development'];
    for (const ef of envFiles) {
      const fullEf = path.join(tmpDir, ef);
      if (fs.existsSync(fullEf)) {
        try {
          const lines = fs.readFileSync(fullEf, 'utf-8').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
              const eqIdx = trimmed.indexOf('=');
              const key = trimmed.slice(0, eqIdx).trim();
              const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
              if (key && /^[A-Z0-9_]+$/i.test(key)) {
                envVarSet.add(key);
                if (val && !envVarDefaults[key]) {
                  envVarDefaults[key] = val;
                }
              }
            }
          }
        } catch {}
      }
    }

    // Code scan for process.env.KEY and import.meta.env.KEY
    for (const file of allFiles.slice(0, 100)) {
      const ext = path.extname(file);
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue', '.svelte', '.html', '.json'].includes(ext)) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const procMatches = content.matchAll(/process\.env\.([A-Z0-9_]+)/g);
          for (const m of procMatches) {
            if (m[1] && m[1] !== 'NODE_ENV') envVarSet.add(m[1]);
          }
          const metaMatches = content.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g);
          for (const m of metaMatches) {
            if (m[1] && m[1] !== 'MODE' && m[1] !== 'BASE_URL') envVarSet.add(m[1]);
          }
        } catch {}
      }
    }

    // Fill demo values for any detected env var that doesn't have one
    for (const key of envVarSet) {
      if (!envVarDefaults[key]) {
        const upper = key.toUpperCase();
        if (upper.includes('URL') || upper.includes('HOST') || upper.includes('ENDPOINT') || upper.includes('DOMAIN')) {
          envVarDefaults[key] = 'https://api.example.com';
        } else if (upper.includes('KEY') || upper.includes('SECRET') || upper.includes('TOKEN') || upper.includes('PASSWORD') || upper.includes('AUTH')) {
          envVarDefaults[key] = `your_${key.toLowerCase()}_here`;
        } else if (upper.includes('PORT')) {
          envVarDefaults[key] = '3000';
        } else if (upper.includes('ENV') || upper.includes('MODE')) {
          envVarDefaults[key] = 'production';
        } else if (upper.includes('DB') || upper.includes('DATABASE')) {
          envVarDefaults[key] = 'postgresql://user:password@localhost:5432/dbname';
        } else if (upper.includes('APP') || upper.includes('TITLE') || upper.includes('NAME')) {
          envVarDefaults[key] = 'My Application';
        } else if (upper.includes('ENABLE') || upper.includes('DISABLE') || upper.includes('DEBUG') || upper.includes('FLAG')) {
          envVarDefaults[key] = 'true';
        } else {
          envVarDefaults[key] = `demo_${key.toLowerCase()}`;
        }
      }
    }

    // If no environment variables found at all, add framework-specific common sensible demo keys so user always sees relevant configs
    if (envVarSet.size === 0) {
      if (framework.includes('Vite') || framework.includes('React')) {
        envVarSet.add('VITE_API_URL');
        envVarDefaults['VITE_API_URL'] = 'https://api.example.com';
        envVarSet.add('VITE_APP_TITLE');
        envVarDefaults['VITE_APP_TITLE'] = 'My React App';
      } else if (framework.includes('Next')) {
        envVarSet.add('NEXT_PUBLIC_API_URL');
        envVarDefaults['NEXT_PUBLIC_API_URL'] = 'https://api.example.com';
        envVarSet.add('NEXT_PUBLIC_APP_ENV');
        envVarDefaults['NEXT_PUBLIC_APP_ENV'] = 'production';
      } else {
        envVarSet.add('API_URL');
        envVarDefaults['API_URL'] = 'https://api.example.com';
      }
    }

    // 7. Database Integrations Scan
    const detectedDbs: string[] = [];
    const allCodeSample = allFiles.slice(0, 50).map(f => {
      try { return fs.readFileSync(f, 'utf-8'); } catch { return ''; }
    }).join('\n');

    if (allCodeSample.includes('postgres') || allCodeSample.includes('DATABASE_URL') || allCodeSample.includes('pg') || allCodeSample.includes('neon')) {
      detectedDbs.push('PostgreSQL / Neon');
    }
    if (allCodeSample.includes('mysql') || allCodeSample.includes('MYSQL_URL')) {
      detectedDbs.push('MySQL / PlanetScale');
    }
    if (allCodeSample.includes('sqlite') || allCodeSample.includes('better-sqlite3')) {
      detectedDbs.push('SQLite / D1');
    }
    if (allCodeSample.includes('prisma') || fs.existsSync(path.join(tmpDir, 'prisma'))) {
      detectedDbs.push('Prisma ORM');
    }
    if (allCodeSample.includes('drizzle')) {
      detectedDbs.push('Drizzle ORM');
    }
    if (allCodeSample.includes('supabase')) {
      detectedDbs.push('Supabase');
    }
    if (allCodeSample.includes('mongodb') || allCodeSample.includes('mongoose')) {
      detectedDbs.push('MongoDB');
    }
    if (allCodeSample.includes('redis')) {
      detectedDbs.push('Redis / Upstash');
    }

    return {
      language,
      framework,
      architecture,
      is_dynamic: isDynamic,
      page_nature: pageNature,
      cloudflare_compatible: cfCompatible,
      cloudflare_status: cfStatus,
      recommended_build_command: buildCommand,
      recommended_output_dir: outputDir,
      detected_env_vars: Array.from(envVarSet),
      detected_env_defaults: envVarDefaults,
      detected_databases: detectedDbs,
      commit_sha: commitSha,
      commit_message: commitMessage,
      commit_author: commitAuthor,
      total_files: allFiles.length,
      scanned_at: new Date().toISOString(),
    };
  } finally {
    // Clean up temporary clone directory
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

/**
 * Live validation of Cloudflare credentials against official Cloudflare v4 REST API
 */
export async function verifyCloudflareCredentials(accountId: string, apiToken: string) {
  const token = (apiToken || '').trim();
  const accId = (accountId || '').trim();

  if (!token) {
    return { valid: false, error: 'API Token is required' };
  }
  if (!accId) {
    return { valid: false, error: 'Account ID is required' };
  }

  try {
    const cfHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Direct check of account access & Pages permission
    const pagesCheckRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accId}/pages/projects?per_page=1`,
      { method: 'GET', headers: cfHeaders }
    );
    const pagesData = await pagesCheckRes.json().catch(() => ({}));

    if (pagesCheckRes.ok && pagesData.success) {
      // Fetch account display name if possible
      let accountName = `Account (${accId.slice(0, 8)}...)`;
      try {
        const accRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}`, {
          method: 'GET',
          headers: cfHeaders,
        });
        const accData = await accRes.json().catch(() => ({}));
        if (accData.success && accData.result?.name) {
          accountName = accData.result.name;
        }
      } catch {
        // non-blocking
      }

      return {
        valid: true,
        accountName,
        accountId: accId,
        tokenStatus: 'active',
        pagesAccess: true,
      };
    }

    // If Pages check failed with 401/403, check error message
    if (pagesCheckRes.status === 401 || pagesCheckRes.status === 403) {
      const errMsg = pagesData.errors?.[0]?.message || `Authentication failed (HTTP ${pagesCheckRes.status})`;
      return { valid: false, error: `Cloudflare Error (${pagesCheckRes.status}): ${errMsg}` };
    }

    // 2. Fallback check on account endpoint
    const accRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accId}`, {
      method: 'GET',
      headers: cfHeaders,
    });
    const accData = await accRes.json().catch(() => ({}));

    if (accRes.ok && accData.success) {
      return {
        valid: true,
        accountName: accData.result?.name || `Account (${accId.slice(0, 8)}...)`,
        accountId: accId,
        tokenStatus: 'active',
      };
    }

    const finalErr = accData.errors?.[0]?.message || pagesData.errors?.[0]?.message || `Verification failed (HTTP ${accRes.status})`;
    return { valid: false, error: `Cloudflare Account Error: ${finalErr}` };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Connection test failed' };
  }
}

/**
 * Concurrency runner to execute tasks in parallel batches
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let currentIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (currentIndex < items.length) {
        const item = items[currentIndex++];
        await worker(item);
      }
    }
  );
  await Promise.allSettled(workers);
}

/**
 * Sanitize a project name for Cloudflare Pages:
 * Must be 1-58 chars, lowercase alphanumeric and hyphens, cannot start or end with a hyphen
 */
export function sanitizePagesProjectName(projectName: string, subdomain: string): string {
  const raw = `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${subdomain.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const cleaned = raw.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'cf-pages-app').slice(0, 58);
}

/**
 * Execute real bulk build:
 * 1. Clones GitHub repo locally to a temporary workspace
 * 2. Compiles/builds production assets
 * 3. Deploys live to Cloudflare Pages for all accounts using Wrangler
 * 4. Configures custom subdomains & DNS records
 */
export async function runBulkBuild({ projectId, accountIds }: BuildTaskOptions) {
  if (activeBuilds.has(projectId)) {
    throw new Error('A build is already running for this project.');
  }

  const abortController = new AbortController();
  const buildState: ActiveBuildState = {
    abortController,
    processes: new Set(),
    workspaceDir: '',
  };
  activeBuilds.set(projectId, buildState);

  let workspaceDir = '';

  try {
    // 1. Fetch Project configuration from Neon DB
    const projectRes = await pool.query('SELECT * FROM cf_projects WHERE id = $1', [projectId]);
    if (projectRes.rows.length === 0) {
      throw new Error('Project not found');
    }
    const project = projectRes.rows[0];

    // Mark project as building
    await pool.query(
      `UPDATE cf_projects SET status = 'building', updated_at = NOW() WHERE id = $1`,
      [projectId]
    );

    // 2. Query target Accounts to build
    let accountsQuery = 'SELECT * FROM cf_accounts WHERE project_id = $1 ORDER BY created_at ASC';
    let queryParams: any[] = [projectId];

    if (accountIds && accountIds.length > 0) {
      accountsQuery = 'SELECT * FROM cf_accounts WHERE project_id = $1 AND id = ANY($2)';
      queryParams = [projectId, accountIds];
    }

    const accountsRes = await pool.query(accountsQuery, queryParams);
    const accounts = accountsRes.rows;

    if (accounts.length === 0) {
      await pool.query(`UPDATE cf_projects SET status = 'idle' WHERE id = $1`, [projectId]);
      activeBuilds.delete(projectId);
      return;
    }

    // 3. Mark target deployments as queued
    for (const account of accounts) {
      const sanitizedName = sanitizePagesProjectName(project.name, account.subdomain);
      const targetPagesDev = `${sanitizedName}.pages.dev`;
      const targetCustom = `${account.subdomain}.${project.root_domain || 'pages.dev'}`;

      const depCheck = await pool.query(
        'SELECT id FROM cf_deployments WHERE project_id = $1 AND account_id = $2',
        [projectId, account.id]
      );

      if (depCheck.rows.length === 0) {
        const depId = 'dep_' + Math.random().toString(36).substring(2, 12);
        await pool.query(
          `INSERT INTO cf_deployments 
          (id, project_id, account_id, cf_pages_project_name, pages_dev_domain, custom_domain, cname_host, cname_target, dns_status, build_status, progress_percent, current_step, logs)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'queued', 5, 'Queued for build', '')`,
          [
            depId,
            projectId,
            account.id,
            sanitizedName,
            `https://${targetPagesDev}`,
            `https://${targetCustom}`,
            account.subdomain,
            targetPagesDev,
          ]
        );
      } else {
        await pool.query(
          `UPDATE cf_deployments 
           SET build_status = 'queued', progress_percent = 5, current_step = 'Queued for build', updated_at = NOW()
           WHERE project_id = $1 AND account_id = $2`,
          [projectId, account.id]
        );
      }
    }

    if (abortController.signal.aborted) {
      throw new Error('Build was canceled by user.');
    }

    // 4. Create isolated workspace directory for this build
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), `cf-build-${projectId.slice(0, 8)}-`));
    buildState.workspaceDir = workspaceDir;
    const repoDir = path.join(workspaceDir, 'repo');

    // Update initial log on target deployments
    await updateAllDeploymentsProgress(
      projectId,
      accounts.map((a: any) => a.id),
      15,
      'Cloning repository from GitHub...',
      `[${getTimestamp()}] Preparing build workspace at ${workspaceDir}\n[${getTimestamp()}] Cloning ${project.github_repo} (branch: ${project.github_branch || 'main'})...`
    );

    // 5. Execute real Git Clone
    const cloneUrl = getCloneUrl(project.github_repo, project.github_token);
    const targetBranch = project.github_branch?.trim() || 'main';

    const gitEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo',
    };

    try {
      if (abortController.signal.aborted) throw new Error('Build was canceled by user.');
      // First attempt: clone specified branch
      const cloneCmd = `git clone --depth 1 --branch "${targetBranch}" "${cloneUrl}" "${repoDir}"`;
      await execAsync(cloneCmd, { timeout: 60000, env: gitEnv });
    } catch (branchErr: any) {
      if (abortController.signal.aborted) throw new Error('Build was canceled by user.');
      // Fallback: clean up corrupted or partially created repoDir first
      if (fs.existsSync(repoDir)) {
        try {
          fs.rmSync(repoDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
      try {
        const fallbackCmd = `git clone --depth 1 "${cloneUrl}" "${repoDir}"`;
        await execAsync(fallbackCmd, { timeout: 60000, env: gitEnv });
      } catch (fallbackErr: any) {
        const rawErr = fallbackErr.message || branchErr.message;
        const sanitizedErr = rawErr.replace(/x-access-token:[^@]+@/g, 'x-access-token:***@');
        throw new Error(`Git clone failed: ${sanitizedErr}`);
      }
    }

    // Read real commit metadata from git repository
    let commitSha = 'latest';
    let commitFullSha = '';
    let commitMessage = 'Sync from GitHub';
    let commitAuthor = 'Git';

    try {
      const { stdout: shaOut } = await execAsync('git rev-parse HEAD', { cwd: repoDir });
      commitFullSha = shaOut.trim();
      commitSha = commitFullSha.slice(0, 7);
      const { stdout: msgOut } = await execAsync('git log -1 --pretty=format:"%s"', { cwd: repoDir });
      commitMessage = msgOut.trim() || commitMessage;
      const { stdout: authorOut } = await execAsync('git log -1 --pretty=format:"%an"', { cwd: repoDir });
      commitAuthor = authorOut.trim() || commitAuthor;
    } catch {
      // ignore git metadata errors
    }

    // Update project with latest commit info
    await pool.query(
      `UPDATE cf_projects SET latest_commit_sha = $1, latest_commit_message = $2 WHERE id = $3`,
      [commitSha, commitMessage, projectId]
    );

    // 6. Inject Environment Variables into workspace (.env, .env.production, .env.local)
    const rawEnvVars = project.env_vars && typeof project.env_vars === 'object' ? project.env_vars : {};
    const envEntries = Object.entries(rawEnvVars);
    if (envEntries.length > 0) {
      const envContent = envEntries
        .map(([k, v]) => `${k}=${String(v ?? '')}`)
        .join('\n');
      try {
        fs.writeFileSync(path.join(repoDir, '.env'), envContent, 'utf8');
        fs.writeFileSync(path.join(repoDir, '.env.production'), envContent, 'utf8');
        fs.writeFileSync(path.join(repoDir, '.env.local'), envContent, 'utf8');
      } catch (envWriteErr) {
        console.warn('Failed to write .env files in repo directory:', envWriteErr);
      }
    }

    // 7. Build assets if build_command is provided
    let buildLogs = '';
    const buildCmd = (project.build_command || '').trim();

    if (buildCmd && buildCmd !== 'none' && buildCmd !== 'None') {
      if (abortController.signal.aborted) throw new Error('Build was canceled by user.');

      await updateAllDeploymentsProgress(
        projectId,
        accounts.map((a: any) => a.id),
        30,
        `Running build: ${buildCmd}`,
        `[${getTimestamp()}] Commit: #${commitSha} - "${commitMessage}" (${commitAuthor})\n[${getTimestamp()}] Detected ${envEntries.length} environment variable(s)\n[${getTimestamp()}] Executing build command: ${buildCmd}`
      );

      try {
        const hasPackageJson = fs.existsSync(path.join(repoDir, 'package.json'));
        if (hasPackageJson && !fs.existsSync(path.join(repoDir, 'node_modules'))) {
          // Detect optimal package manager
          let installCmd = 'npm install --prefer-offline --no-audit --no-fund --legacy-peer-deps';
          let pmName = 'npm';

          if (fs.existsSync(path.join(repoDir, 'pnpm-lock.yaml'))) {
            pmName = 'pnpm';
            installCmd = 'npx --yes pnpm install --no-frozen-lockfile';
          } else if (fs.existsSync(path.join(repoDir, 'yarn.lock'))) {
            pmName = 'yarn';
            installCmd = 'npx --yes yarn install';
          } else if (fs.existsSync(path.join(repoDir, 'bun.lockb')) || fs.existsSync(path.join(repoDir, 'bun.lock'))) {
            pmName = 'bun';
            installCmd = 'npx --yes bun install';
          }

          await updateAllDeploymentsProgress(
            projectId,
            accounts.map((a: any) => a.id),
            35,
            `Installing dependencies (${pmName})...`,
            `[${getTimestamp()}] Installing dependencies via ${pmName} (${installCmd})...`
          );

          try {
            const { stdout: npmOut, stderr: npmErr } = await execAsync(installCmd, {
              cwd: repoDir,
              timeout: 240000,
              env: { ...process.env, ...rawEnvVars, NODE_ENV: 'development', CI: 'true' },
            });
            buildLogs += `\n[${pmName} install]\n${npmOut}\n${npmErr}`.trim();
          } catch (installErr: any) {
            const installDetailed = stripAnsi(`${installErr.stderr || ''}\n${installErr.stdout || ''}`.trim());
            throw new Error(`Dependency installation failed:\n${installDetailed || installErr.message}`);
          }
        }

        if (abortController.signal.aborted) throw new Error('Build was canceled by user.');

        // Run user build command with full injected env vars
        try {
          const { stdout: cmdOut, stderr: cmdErr } = await execAsync(buildCmd, {
            cwd: repoDir,
            timeout: 240000,
            env: {
              ...process.env,
              ...rawEnvVars,
              NODE_ENV: 'production',
              CI: 'true',
            },
          });
          buildLogs += `\n[${buildCmd}]\n${cmdOut}\n${cmdErr}`.trim();
        } catch (cmdErr: any) {
          const detailedStderr = stripAnsi(`${cmdErr.stderr || ''}\n${cmdErr.stdout || ''}`.trim());
          const cleanErr = detailedStderr ? `${cmdErr.message}\n${detailedStderr}` : cmdErr.message;
          throw new Error(`Build command failed: ${cleanErr}`);
        }
      } catch (buildErr: any) {
        throw buildErr;
      }
    }

    if (abortController.signal.aborted) throw new Error('Build was canceled by user.');

    // 8. Resolve output directory for Cloudflare Pages deployment
    const configuredOutputDir = (project.output_dir || 'dist').trim();
    let deployOutputDir = path.resolve(repoDir, configuredOutputDir);

    if (!fs.existsSync(deployOutputDir) || !fs.statSync(deployOutputDir).isDirectory()) {
      if (fs.existsSync(path.resolve(repoDir, 'dist'))) {
        deployOutputDir = path.resolve(repoDir, 'dist');
      } else if (fs.existsSync(path.resolve(repoDir, 'build'))) {
        deployOutputDir = path.resolve(repoDir, 'build');
      } else if (fs.existsSync(path.resolve(repoDir, 'out'))) {
        deployOutputDir = path.resolve(repoDir, 'out');
      } else if (fs.existsSync(path.resolve(repoDir, 'public'))) {
        deployOutputDir = path.resolve(repoDir, 'public');
      } else {
        // Guard: If falling back to repoDir but node_modules exists, do not upload raw node_modules to Cloudflare Pages
        if (fs.existsSync(path.resolve(repoDir, 'node_modules'))) {
          throw new Error(
            `Build output directory '${configuredOutputDir}' was not found. Please ensure the build command outputs to '${configuredOutputDir}', 'dist', 'build', or 'out'.`
          );
        }
        deployOutputDir = repoDir;
      }
    }

    // Check if directory contains files
    const outputFiles = fs.readdirSync(deployOutputDir);
    if (outputFiles.length === 0) {
      throw new Error(`Output directory '${deployOutputDir}' contains no files to deploy.`);
    }

    await updateAllDeploymentsProgress(
      projectId,
      accounts.map((a: any) => a.id),
      50,
      'Assets compiled. Deploying to Cloudflare accounts...',
      `[${getTimestamp()}] Build finished successfully. Output directory: ${path.relative(repoDir, deployOutputDir) || '.'} (${outputFiles.length} files/folders)`
    );

    // 9. Deploy to each Cloudflare account with controlled concurrency
    const commitInfo = {
      sha: commitSha,
      fullSha: commitFullSha,
      message: commitMessage,
      author: commitAuthor,
    };

    const CONCURRENCY_LIMIT = 3;
    await runWithConcurrency(accounts, CONCURRENCY_LIMIT, async (account) => {
      if (abortController.signal.aborted) return;
      await deployAccountWithWrangler(project, account, deployOutputDir, commitInfo, buildState);
    });

    // 10. Accurate overall project status calculation based on all deployments in DB
    const statsRes = await pool.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE build_status = 'failed') as failed,
         COUNT(*) FILTER (WHERE build_status = 'success') as success,
         COUNT(*) FILTER (WHERE build_status IN ('building', 'queued')) as active
       FROM cf_deployments WHERE project_id = $1`,
      [projectId]
    );
    const stats = statsRes.rows[0];
    const totalCount = parseInt(stats.total, 10) || 0;
    const failedCount = parseInt(stats.failed, 10) || 0;
    const successCount = parseInt(stats.success, 10) || 0;
    const activeCount = parseInt(stats.active, 10) || 0;

    let finalStatus = 'completed';
    if (activeCount > 0) {
      finalStatus = 'building';
    } else if (failedCount > 0 && successCount === 0) {
      finalStatus = 'failed';
    } else if (failedCount > 0 && successCount > 0) {
      finalStatus = 'partial_error';
    } else if (successCount > 0) {
      finalStatus = 'completed';
    } else {
      finalStatus = 'idle';
    }

    await pool.query(
      `UPDATE cf_projects SET status = $1, updated_at = NOW() WHERE id = $2`,
      [finalStatus, projectId]
    );
  } catch (globalErr: any) {
    console.error(`[Bulk Build Error for ${projectId}]:`, globalErr);
    const errText = globalErr.message || 'Build pipeline error';

    // Target only the accounts in this build scope
    let failTargetQuery = 'UPDATE cf_deployments SET build_status = $1, current_step = $2, error_message = $3, logs = logs || E\'\\n\' || $4, updated_at = NOW() WHERE project_id = $5';
    let failParams: any[] = ['failed', 'Build Failed', errText, `[${getTimestamp()}] FATAL: ${errText}`, projectId];

    if (accountIds && accountIds.length > 0) {
      failTargetQuery += ' AND account_id = ANY($6)';
      failParams.push(accountIds);
    }

    await pool.query(failTargetQuery, failParams);

    await pool.query(
      `UPDATE cf_projects SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [projectId]
    );
  } finally {
    activeBuilds.delete(projectId);
    // Cleanup temporary workspace directory
    if (workspaceDir && fs.existsSync(workspaceDir)) {
      try {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
      } catch (rmErr) {
        console.warn('Failed to clean up temp build workspace:', rmErr);
      }
    }
  }
}

/**
 * Real deployment for a single Cloudflare Account using Wrangler & Cloudflare REST API:
 * 1. Creates Pages project on Cloudflare if missing
 * 2. Uses `wrangler pages deploy` to upload assets and create production deployment
 * 3. Registers custom subdomain on Cloudflare Pages
 * 4. Updates deployment record with live URLs and DNS records in PostgreSQL
 */
async function deployAccountWithWrangler(
  project: any,
  account: any,
  outputDir: string,
  commitInfo: { sha: string; fullSha?: string; message: string; author: string },
  buildState?: ActiveBuildState
) {
  const logs: string[] = [];
  const appendLog = async (msg: string, progress?: number, step?: string) => {
    const formatted = `[${getTimestamp()}] ${msg}`;
    logs.push(formatted);
    const fullLog = logs.join('\n');

    const updateFields: string[] = ['logs = $1', 'updated_at = NOW()'];
    const params: any[] = [fullLog, project.id, account.id];

    if (progress !== undefined) {
      params.push(progress);
      updateFields.push(`progress_percent = $${params.length}`);
    }
    if (step) {
      params.push(step);
      updateFields.push(`current_step = $${params.length}`);
    }

    await pool.query(
      `UPDATE cf_deployments 
       SET ${updateFields.join(', ')} 
       WHERE project_id = $2 AND account_id = $3`,
      params
    );
  };

  try {
    if (buildState?.abortController.signal.aborted) {
      throw new Error('Build was canceled by user.');
    }

    const apiToken = account.api_token?.trim();
    const accountId = account.account_id?.trim();

    if (!apiToken || !accountId) {
      throw new Error('Cloudflare API Token or Account ID is missing.');
    }

    const sanitizedPagesName = sanitizePagesProjectName(project.name, account.subdomain);
    const targetPagesDev = `${sanitizedPagesName}.pages.dev`;
    const customSubdomain = `${account.subdomain}.${project.root_domain || 'pages.dev'}`;

    await appendLog(`Worker assigned to Cloudflare account: ${account.alias}`, 55, 'Deploying assets...');
    await appendLog(`Target Pages Project: ${sanitizedPagesName}`);

    const cfHeaders = {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    // 1. Ensure Cloudflare Pages project exists via REST API
    try {
      const checkRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${sanitizedPagesName}`,
        { method: 'GET', headers: cfHeaders }
      );

      if (checkRes.status === 401 || checkRes.status === 403) {
        const authData = await checkRes.json().catch(() => ({}));
        const authMsg = authData.errors?.[0]?.message || 'Invalid API Token or insufficient permissions.';
        throw new Error(`Cloudflare Authentication Failed (${checkRes.status}): ${authMsg}`);
      }

      if (checkRes.status === 404) {
        await appendLog(`Pages project does not exist yet. Creating '${sanitizedPagesName}'...`, 60);
        const createRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
          {
            method: 'POST',
            headers: cfHeaders,
            body: JSON.stringify({
              name: sanitizedPagesName,
              production_branch: project.github_branch || 'main',
            }),
          }
        );
        const createData = await createRes.json().catch(() => ({}));
        if (!createData.success && createRes.status >= 400) {
          const errMsg = createData.errors?.[0]?.message || `Cloudflare HTTP ${createRes.status}`;
          // Project might have just been created concurrently or already exists
          if (!errMsg.toLowerCase().includes('already exists')) {
            await appendLog(`Cloudflare notice: ${errMsg}`);
          }
        } else {
          await appendLog(`Pages project '${sanitizedPagesName}' created successfully on Cloudflare.`);
        }
      } else if (checkRes.ok) {
        await appendLog(`Pages project verified on Cloudflare.`);
      }
    } catch (apiErr: any) {
      if (apiErr.message?.startsWith('Cloudflare Authentication Failed')) {
        throw apiErr;
      }
      await appendLog(`Pages check notice: ${apiErr.message}`);
    }

    if (buildState?.abortController.signal.aborted) {
      throw new Error('Build was canceled by user.');
    }

    // 2. Deploy directory using Wrangler Pages Deploy CLI
    await appendLog(`Uploading build assets to Cloudflare edge network via Wrangler...`, 70, 'Uploading to Cloudflare...');

    const cleanCommitMsg = (commitInfo.message || 'Auto build').replace(/["`$\\]/g, ' ').trim();
    const wranglerArgs = [
      '--yes',
      'wrangler',
      'pages',
      'deploy',
      outputDir,
      `--project-name=${sanitizedPagesName}`,
      `--branch=${project.github_branch || 'main'}`,
    ];

    if (commitInfo.fullSha && /^[0-9a-f]{40}$/i.test(commitInfo.fullSha)) {
      wranglerArgs.push(`--commit-hash=${commitInfo.fullSha}`);
    } else if (commitInfo.sha && /^[0-9a-f]{7,40}$/i.test(commitInfo.sha)) {
      wranglerArgs.push(`--commit-hash=${commitInfo.sha}`);
    }
    if (cleanCommitMsg) {
      wranglerArgs.push(`--commit-message=${cleanCommitMsg.slice(0, 100)}`);
    }
    wranglerArgs.push('--commit-dirty=true');

    let wranglerStdout = '';
    let wranglerStderr = '';

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;

      const child = spawn('npx', wranglerArgs, {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: apiToken,
          CLOUDFLARE_ACCOUNT_ID: accountId,
          FORCE_COLOR: '0',
          CI: 'true',
        },
      });

      if (buildState) {
        buildState.processes.add(child);
      }

      const onAbort = () => {
        if (!isSettled) {
          isSettled = true;
          try {
            child.kill('SIGTERM');
            setTimeout(() => {
              try { child.kill('SIGKILL'); } catch {}
            }, 1000);
          } catch {}
          reject(new Error('Build was canceled by user.'));
        }
      };

      if (buildState?.abortController.signal.aborted) {
        onAbort();
      } else {
        buildState?.abortController.signal.addEventListener('abort', onAbort, { once: true });
      }

      const timeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            child.kill('SIGTERM');
          } catch {}
          reject(new Error('Wrangler deployment timed out after 180 seconds'));
        }
      }, 180000);

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        wranglerStdout += text;
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        wranglerStderr += text;
      });

      child.on('close', (code) => {
        clearTimeout(timeoutTimer);
        if (buildState) {
          buildState.processes.delete(child);
        }
        if (isSettled) return;
        isSettled = true;

        if (code === 0) {
          resolve();
        } else {
          const combinedErr = stripAnsi(`${wranglerStderr}\n${wranglerStdout}`.trim());
          reject(new Error(combinedErr || `Wrangler deployment exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeoutTimer);
        if (buildState) {
          buildState.processes.delete(child);
        }
        if (isSettled) return;
        isSettled = true;
        reject(err);
      });
    });

    const cleanWranglerOut = stripAnsi(wranglerStdout.trim());
    await appendLog(`Wrangler Deployment Output:\n${cleanWranglerOut}`, 85, 'Configuring custom domain...');

    // Extract live deployment URL if present in wrangler stdout
    let livePagesUrl = `https://${targetPagesDev}`;
    const urlMatch = wranglerStdout.match(/https:\/\/[a-zA-Z0-9.-]+\.pages\.dev/g);
    if (urlMatch && urlMatch.length > 0) {
      livePagesUrl = urlMatch[urlMatch.length - 1];
    }

    // 3. Register custom subdomain on Cloudflare Pages if root_domain is configured
    const hasRootDomain = Boolean(project.root_domain && project.root_domain.trim());
    if (hasRootDomain) {
      await appendLog(`Configuring custom domain '${customSubdomain}' on Cloudflare Pages...`, 90);
      try {
        const domainRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${sanitizedPagesName}/domains`,
          {
            method: 'POST',
            headers: cfHeaders,
            body: JSON.stringify({ name: customSubdomain }),
          }
        );
        const domainData = await domainRes.json().catch(() => ({}));
        if (domainData.success) {
          await appendLog(`Custom domain attached: ${customSubdomain}`);
        } else {
          const msg = domainData.errors?.[0]?.message || 'Domain record ready';
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exist')) {
            await appendLog(`Custom domain active: ${customSubdomain}`);
          } else {
            await appendLog(`Domain notice: ${msg}`);
          }
        }
      } catch (domErr: any) {
        await appendLog(`Domain attach notice: ${domErr.message}`);
      }
    } else {
      await appendLog(`No root domain configured; using primary Cloudflare domain: ${livePagesUrl}`, 90);
    }

    // 4. Mark deployment as successful in Neon DB
    const finalCustomUrl = hasRootDomain ? `https://${customSubdomain}` : livePagesUrl;
    await appendLog(`Deployment ready: ${livePagesUrl} | ${finalCustomUrl}`, 100, 'Deployed & Live');

    await pool.query(
      `UPDATE cf_deployments 
       SET build_status = 'success',
           progress_percent = 100,
           current_step = 'Deployed & Live',
           pages_dev_domain = $1,
           custom_domain = $2,
           cname_host = $3,
           cname_target = $4,
           dns_status = $5,
           commit_hash = $6,
           commit_message = $7,
           deployed_at = NOW(),
           error_message = NULL,
           logs = $8,
           updated_at = NOW()
       WHERE project_id = $9 AND account_id = $10`,
      [
        livePagesUrl,
        finalCustomUrl,
        account.subdomain,
        targetPagesDev,
        hasRootDomain ? 'configured' : 'verified',
        commitInfo.sha,
        commitInfo.message,
        logs.join('\n'),
        project.id,
        account.id,
      ]
    );
  } catch (accountErr: any) {
    const errorMsg = accountErr.message || 'Deployment error';
    await appendLog(`ERROR: ${errorMsg}`);
    await pool.query(
      `UPDATE cf_deployments 
       SET build_status = 'failed',
           current_step = 'Build Failed',
           error_message = $1,
           logs = $2,
           updated_at = NOW()
       WHERE project_id = $3 AND account_id = $4`,
      [errorMsg, logs.join('\n'), project.id, account.id]
    );
  }
}

/**
 * Batch update progress and step for all deployments of a project
 */
async function updateAllDeploymentsProgress(
  projectId: string,
  accountIds: string[],
  progress: number,
  step: string,
  logLine?: string
) {
  if (logLine) {
    await pool.query(
      `UPDATE cf_deployments 
       SET progress_percent = $1,
           current_step = $2,
           logs = logs || E'\n' || $3,
           updated_at = NOW()
       WHERE project_id = $4 AND account_id = ANY($5)`,
      [progress, step, logLine, projectId, accountIds]
    );
  } else {
    await pool.query(
      `UPDATE cf_deployments 
       SET progress_percent = $1,
           current_step = $2,
           updated_at = NOW()
       WHERE project_id = $3 AND account_id = ANY($4)`,
      [progress, step, projectId, accountIds]
    );
  }
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
