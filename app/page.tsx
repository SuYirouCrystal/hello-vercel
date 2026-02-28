"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(s ?? null);
    }

    loadSession();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    try {
      window.localStorage.setItem("postAuthRedirect", "/");
    } catch {
      // ignore storage errors
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <main className="hero">
      <div className="hero-card">
        <div className="home-auth-corner">
          <div className="home-auth-shell">
            {session ? (
              <button onClick={handleLogout} className="home-auth-btn home-auth-btn-out">
                Sign out
              </button>
            ) : (
              <button onClick={handleLogin} className="home-auth-btn home-auth-btn-in">
                Sign in
              </button>
            )}
          </div>
        </div>

        <h1 className="hero-title">Hello World</h1>
        <div className="hero-decor" aria-hidden="true" />

        <p className="hero-sub">
          A minimal Next.js demo with a protected route and Google OAuth (via
          Supabase). Click below to view allowed domains, vote on captions, or
          upload an image and generate captions.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Link href="/domains" className="cta-link">
            View allowed signup domains
          </Link>
          <Link href="/captions" className="cta-link">
            Vote on captions
          </Link>
          <Link href="/generate-captions" className="cta-link">
            Generate captions from an image
          </Link>
        </div>
      </div>
    </main>
  );
}
