# Contributing to GitForge — Multi-Account Cloudflare Pages Fleet Orchestrator

Thank you for your interest in contributing to this project!

---

## 1. Code of Conduct & Design Constitution

All contributors must adhere to the design and development standards defined in **[AGENTS.md](AGENTS.md)**:
- **Zero-Noise Policy**: No decorative marketing subtitles or unnecessary filler texts in dashboard controls.
- **Micro-Typography**: Maintain base font sizes (`text-[11px]`, `text-[10px]`) and `font-mono` for tokens, IDs, and metrics.
- **No Mock Fallbacks**: All features must integrate with real endpoints, PostgreSQL database schemas, and official third-party APIs.

---

## 2. Development Workflow

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Verify TypeScript and compilation before submitting PR:
   ```bash
   npm run lint
   npm run build
   ```

---

## 3. Commit Message Conventions

Use conventional commit style:
- `feat: add automated webhook retry logic`
- `fix: resolve token masking race condition in vault`
- `docs: update deployment troubleshooting guide`
- `refactor: optimize database connection pool query`
