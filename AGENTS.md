# AGENTS.md — Development & Clean UI Design Constitution

This document defines the strict UI/UX design standards, architectural guidelines, and engineering principles for all future development on this project. Every agent and engineer working on this codebase **MUST ALWAYS** follow these rules without exception.

---

## 1. Clean & Compact Design Constitution (STRICT)

### A. Zero-Noise & Anti-Fluff Policy
- **NO decorative marketing copy or filler subtitles:** Never add descriptive subheadings like *"Full oversight, quota enforcement..."* or *"Central Control & Forensic Command"*.
- **NO redundant explanations under inputs:** Do not add helper paragraphs explaining obvious inputs (e.g. *"Controls maximum parallel child processes..."*). Keep input labels clear, concise, and direct.
- **Strictly Functional Text:** Only render text that is mandatory for feature execution or critical status indication. If an element does not provide direct actionable utility, remove it.

### B. Micro-Typography & Compact Sizing
- **Base Content Font Size:** Use `text-[11px]` for standard labels, table rows, and controls.
- **Micro Badges & Timestamps:** Use `text-[9px]` or `text-[10px]` for status pills, commit hashes, counts, and timestamps.
- **Headers & Titles:** Keep module headings compact (`text-xs font-bold`). Never use large headers (`text-base` or `text-lg`) inside dashboard tiles or table headers.
- **Monospace Discipline:** Always use `font-mono` for IDs, tokens, commit SHAs, URLs, domains, numeric counters, RAM/latency metrics, and code snippets.

### C. High-Density Layout & Spacing
- **Header Heights:** Restrict top navigation and header bars to `h-9` or `h-10` max (never `h-14` or `h-16`).
- **Sidebar Width:** Standardize sidebars to compact width (`w-44` or `w-48` max), with tight padding (`p-1.5`) and small item gaps (`space-y-0.5`).
- **Table Density:** Table row padding must stay tight (`py-1.5 px-2.5` or `py-2 px-2.5`). Truncate overflowing hashes and long names gracefully using `truncate max-w-[...]`.
- **Card & Tile Padding:** Dashboard KPI cards and setting boxes should use `p-2.5` or `p-3` with `rounded-lg` (avoid bloated `p-6` or `p-8`).
- **Button Dimensions:** Use compact button sizing (`px-2 py-0.5` or `px-2.5 py-1`) with small icons (`w-3 h-3` or `w-3.5 h-3.5`) and tight gaps (`gap-1`).

---

## 2. Component & Color Palette Standards

| Element Type | Preferred Tailwind Classes |
| :--- | :--- |
| **Page Background** | `bg-slate-950 text-slate-100` |
| **Module / Card Container** | `bg-slate-900 border border-slate-800 rounded-lg p-3` |
| **Inner Sub-containers** | `bg-slate-950 border border-slate-800/80 rounded p-2` |
| **Table Header** | `bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800` |
| **Table Row (Hover)** | `hover:bg-slate-800/30 transition text-[11px] font-mono` |
| **Form Inputs** | `bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 text-[11px] focus:outline-none focus:border-orange-500` |
| **Status: Live / OK** | `bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded` |
| **Status: Building / Active** | `bg-blue-950 text-blue-300 border border-blue-700 text-[9px] font-bold px-1.5 py-0.2 rounded animate-pulse` |
| **Status: Error / Failed** | `bg-red-950 text-red-300 border border-red-800 text-[9px] font-bold px-1.5 py-0.2 rounded` |
| **Primary Action Button** | `bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-semibold px-3 py-1 rounded transition` |
| **Secondary Button** | `bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] px-2 py-0.5 rounded transition` |
| **Danger / Stop Button** | `bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 text-[10px] font-semibold px-2 py-0.5 rounded` |

---

## 3. Structural & Routing Architecture

1. **User Builder Interface (`/`)**:
   - The primary builder view for managing individual projects, bulk account imports, and deployment queues.
2. **Admin Command Console (`/vcon`)**:
   - Isolated in `src/vcon/`.
   - Comprehensive multi-module control:
     - `Dashboard`: Real-time system vitals, RAM/DB latency, emergency abort, maintenance toggle.
     - `Projects`: Global project catalog, GitHub sync, build triggers, configuration drawer.
     - `CF Accounts`: Encrypted Cloudflare API token vault with live verification tester.
     - `Deployments`: Deployment queue monitor, terminal log viewer, retry and cancel handlers.
     - `Users`: Administrator accounts, PBKDF2 authentication, active session revocation.
     - `Settings`: Worker concurrency throttle (1–10), build timeout, webhook dispatches.
     - `Database`: Live Neon PostgreSQL table row metrics, automated cleanup, JSON backups.
     - `Audit Log`: Immutable forensic trail with IP addresses and JSON payloads.

---

## 4. Engineering & Code Discipline

- **No Mock or Simulated Fallbacks:** All features must connect to real endpoints, database tables, or official third-party APIs (Cloudflare v4 REST API, GitHub REST API, Neon PostgreSQL).
- **Zero-Error Compilation:** Any change must pass `npx tsc --noEmit` and `npm run build` with exit code 0.
- **Always Validate Tokens Live:** Use real Cloudflare `/client/v4/user/tokens/verify` checks rather than client-side regex assumptions.
- **Maintain Session & Audit Security:** Every administrative action must generate a log in `app_audit_logs`.
