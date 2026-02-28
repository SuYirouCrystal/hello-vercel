"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function consumePostAuthRedirect(): string {
  let target = "/domains";

  try {
    const saved = window.localStorage.getItem("postAuthRedirect");
    if (saved && saved.startsWith("/")) {
      target = saved;
    }
    window.localStorage.removeItem("postAuthRedirect");
  } catch {
    // ignore storage read errors and use default
  }

  return target;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Processing sign-in...");

  useEffect(() => {
    let mounted = true;

    async function handle() {
      try {
        const redirectTarget = consumePostAuthRedirect();

        // First, check if the client already has a session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (!mounted) return;
          setStatus("Sign-in successful, redirecting...");
          router.replace(redirectTarget);
          return;
        }

        // If no session, try PKCE code exchange (query param flow)
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }

          if (!mounted) return;
          setStatus("Sign-in successful, redirecting...");
          router.replace(redirectTarget);
          return;
        }

        // If no session, try to parse tokens from URL fragment (implicit flow)
        const hash = window.location.hash || "";
        const parsed: Record<string, string> = {};
        if (hash.startsWith("#")) {
          const params = new URLSearchParams(hash.slice(1));
          params.forEach((v, k) => (parsed[k] = v));
        }

        if (parsed.access_token) {
          // Store session using tokens
          await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token ?? "",
          });

          if (!mounted) return;
          setStatus("Sign-in successful, redirecting...");
          router.replace(redirectTarget);
          return;
        }

        // No session could be recovered
        if (!mounted) return;
        setStatus("Sign-in failed: no session found in URL.");
      } catch (err) {
        console.error("auth callback error", err);
        if (!mounted) return;
        setStatus("Sign-in failed. Check console for details.");
      }
    }

    handle();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="container-center">
      <div className="card">
        <h1 className="title">Auth callback</h1>
        <p className="muted">{status}</p>
      </div>
    </main>
  );
}
