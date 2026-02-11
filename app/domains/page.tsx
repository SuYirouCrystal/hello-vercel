"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DomainsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<Array<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(s ?? null);

      if (!s) {
        setLoading(false);
        return;
      }

      const { data: rows, error: e } = await supabase
        .from("allowed_signup_domains")
        .select("id, apex_domain");

      if (!mounted) return;
      if (e) setError(e.message);
      else setData(rows as any[]);
      setLoading(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null);
      if (!session) {
        setData(null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  if (loading) {
    return (
      <main className="container-center">
        <div className="card">
          <h1 className="title">Loading Allowed Domains…</h1>
          <p className="muted">Contacting auth provider…</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container-center">
        <div className="card">
          <div className="header">
            <div>
              <h1 className="title">Protected: Allowed Signup Domains</h1>
              <p className="muted" style={{ margin: 0 }}>
                This page is gated. Sign in with Google to view the list.
              </p>
            </div>
            <div className="meta">
              <button onClick={signIn} className="btn-primary">
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const userEmail = (session as any)?.user?.email ?? "Unknown user";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <main className="container-center">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="title">Allowed Signup Domains (gated)</h1>
            <p className="muted" style={{ margin: 0 }}>
              A curated list of domains allowed to register. Shown because you're
              signed in as <strong>{userEmail}</strong>.
            </p>
          </div>

          <div className="meta">
            <button onClick={handleSignOut} className="btn-danger">
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{ marginTop: "0.5rem" }}>
          <div className="card-subtitle">Domains</div>
          <div>
            {data && data.length > 0 ? (
              <table className="domains-table" aria-label="Allowed domains">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>ID</th>
                    <th>Domain</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id}>
                      <td style={{ color: "#6b7280" }}>{row.id}</td>
                      <td>{row.apex_domain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="muted">No domains found.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}