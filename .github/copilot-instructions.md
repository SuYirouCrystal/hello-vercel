<!-- Copilot instructions tailored to the hello-vercel Next.js app -->
# Quick Guide for AI Coding Agents

This repository is a small Next.js 13 TypeScript app (app router). The guidance below highlights project-specific architecture, conventions, and quick examples to help you be productive immediately.

**Architecture & Why**
- **App router:** Uses the `app/` directory (see [app/page.tsx](app/page.tsx) and [app/layout.tsx](app/layout.tsx)). Treat top-level files as Server Components by default; client interactivity must opt into `'use client'`.
- **Styling & fonts:** Global styles live in [app/globals.css](app/globals.css). Fonts are loaded via `next/font` in `app/layout.tsx`.
- **Backend integration:** Supabase client is created in [lib/supabase.ts](lib/supabase.ts). It expects public (browser) env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and is intended for client-side usage.

**Developer workflows & commands**
- Use `npm run dev` to start the dev server (Next.js). Build with `npm run build` and run production with `npm run start`. See `package.json` for exact scripts.
- Linting: run `npm run lint` which maps to `eslint` (project has `eslint-config-next`).

**Conventions & patterns in this repo**
- TypeScript-first: files are `.ts` / `.tsx`. Keep exports default for page/layout components as shown in `app/layout.tsx` and `app/page.tsx`.
- Data access pattern: import the supabase client via `import { supabase } from 'lib/supabase'` and call from pages or client components as appropriate. Example: `const { data, error } = await supabase.from('table').select('*')`.
- Environment vars: public keys are exposed via `NEXT_PUBLIC_...`—do not hardcode secrets. For server-only secrets use non-public env names and server-side code.

**Integration & boundaries**
- Database/auth: Supabase is the main external integration. The client in `lib/supabase.ts` uses the anon key (suitable for browser). If you need server-side access with elevated privileges, create a server-only client using a service role key and store it in a non-public env var.
- Deployment: standard Vercel/Next.js flow; nothing custom in `next.config.ts`.

**Files to reference for common tasks**
- App entry/layout: [app/layout.tsx](app/layout.tsx)
- Landing page example: [app/page.tsx](app/page.tsx)
- Supabase client: [lib/supabase.ts](lib/supabase.ts)
- Project scripts & deps: [package.json](package.json)
- High-level info: [README.md](README.md)

**Guidance for changes**
- Preserve the `app/` router boundaries: moving concepts into `app/` subfolders affects rendering (server vs client). When adding client components, add `'use client'` at the top.
- When adding secure server logic (webhooks, secret operations), prefer new API routes or server components that don't expose secrets to the client.
- Keep imports relative and consistent (e.g., `lib/supabase`). Avoid deep absolute path mapping unless you add tsconfig paths.

If anything above is unclear or you'd like more examples (e.g., a sample API route using Supabase service role or a client component fetching data), tell me which area to expand.
