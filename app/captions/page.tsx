"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Caption {
  id: string;
  text: string;
  created_datetime_utc: string;
}

export default function CaptionsPage() {
  const [session, setSession] = useState<any>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Get session
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        setSession(s);

        // Get captions
        const { data: captionsData } = await supabase
          .from("captions")
          .select("id, text, created_datetime_utc")
          .order("created_datetime_utc", { ascending: false });

        setCaptions((captionsData as Caption[]) || []);

        // Get user votes if logged in
        if (s?.user) {
          const { data: votesData } = await supabase
            .from("caption_votes")
            .select("caption_id, vote_value")
            .eq("profile_id", s.user.id);

          if (votesData) {
            const votes: Record<string, number> = {};
            votesData.forEach((v: any) => {
              votes[v.caption_id] = v.vote_value;
            });
            setUserVotes(votes);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const handleVote = async (captionId: string, voteValue: number) => {
    if (!session?.user) {
      alert("Please sign in to vote");
      return;
    }

    setVotingId(captionId);
    try {
      await supabase.from("caption_votes").insert({
        caption_id: captionId,
        profile_id: session.user.id,
        vote_value: voteValue,
      });

      setUserVotes((prev) => ({ ...prev, [captionId]: voteValue }));
    } catch (error) {
      console.error("Vote error:", error);
      alert("Failed to submit vote");
    } finally {
      setVotingId(null);
    }
  };

  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
  };

  const signOut = () => {
    supabase.auth.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <main className="container-center">
        <div className="card">
          <h1 className="title">Loading…</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="container-center">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="title">Captions</h1>
            <p className="muted" style={{ margin: 0 }}>
              {session
                ? `Signed in as ${session.user.email}`
                : "Sign in to vote on captions"}
            </p>
          </div>
          <div className="meta">
            {session ? (
              <button onClick={signOut} className="btn-danger">
                Sign out
              </button>
            ) : (
              <button onClick={signIn} className="btn-primary">
                Sign in
              </button>
            )}
          </div>
        </div>

        {captions.length === 0 ? (
          <div className="muted">No captions available</div>
        ) : (
          <div style={{ marginTop: "1rem" }}>
            {captions.map((caption) => (
              <div
                key={caption.id}
                style={{
                  padding: "1rem",
                  border: "1px solid #e5e7eb",
                  marginBottom: "1rem",
                  borderRadius: "0.5rem",
                }}
              >
                <p style={{ margin: "0 0 0.5rem 0" }}>{caption.text}</p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => handleVote(caption.id, 1)}
                    disabled={votingId === caption.id || !session}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor:
                        userVotes[caption.id] === 1 ? "#10b981" : "#e5e7eb",
                      border: "none",
                      borderRadius: "0.25rem",
                      cursor: votingId === caption.id ? "not-allowed" : "pointer",
                    }}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => handleVote(caption.id, -1)}
                    disabled={votingId === caption.id || !session}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor:
                        userVotes[caption.id] === -1 ? "#ef4444" : "#e5e7eb",
                      border: "none",
                      borderRadius: "0.25rem",
                      cursor: votingId === caption.id ? "not-allowed" : "pointer",
                    }}
                  >
                    👎
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb" }}>
          <Link href="/" style={{ color: "#3b82f6", textDecoration: "none" }}>
            ← Home
          </Link>
        </div>
      </div>
    </main>
  );
}
