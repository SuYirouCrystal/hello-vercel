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
  const [captionTotals, setCaptionTotals] = useState<Record<string, number>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Get session
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        setSession(s);

        // Get captions (map DB `content` -> `text` used in the UI)
        const { data: captionsData, error: captionsError } = await supabase
          .from("captions")
          .select("id, content, created_datetime_utc")
          .order("created_datetime_utc", { ascending: false });

        if (captionsError) {
          console.warn("Captions fetch error:", captionsError);
        }

        // Map DB shape to UI `Caption` shape (content -> text)
        const raw = (captionsData as any[]) || [];
        const captionsList: Caption[] = raw.map((r: any) => ({
          id: r.id,
          text: r.content,
          created_datetime_utc: r.created_datetime_utc,
        }));
        console.debug("loaded captions:", captionsList);
        setCaptions(captionsList);

        // Fetch votes for these captions (to compute totals and the current user's votes)
        const captionIds = captionsList.map((c) => c.id);
        if (captionIds.length > 0) {
          const { data: votesData } = await supabase
            .from("caption_votes")
            .select("id, caption_id, profile_id, vote_value")
            .in("caption_id", captionIds);

          if (votesData) {
            const totals: Record<string, number> = {};
            const votes: Record<string, number> = {};
            votesData.forEach((v: any) => {
              totals[v.caption_id] = (totals[v.caption_id] || 0) + v.vote_value;
              if (s?.user && v.profile_id === s.user.id) {
                votes[v.caption_id] = v.vote_value;
              }
            });

            setCaptionTotals(totals);
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
      // Check if the user already has a vote for this caption
      const { data: existingData, error: existingError } = await supabase
        .from("caption_votes")
        .select("id, vote_value")
        .eq("caption_id", captionId)
        .eq("profile_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.warn("Existing vote lookup error:", existingError);
      }

      if (existingData && existingData.id) {
        // Update existing vote
        await supabase
          .from("caption_votes")
          .update({ vote_value: voteValue })
          .eq("id", existingData.id);

        // Update totals by removing old value and adding new
        setCaptionTotals((prev) => ({
          ...prev,
          [captionId]: (prev[captionId] || 0) - (existingData.vote_value || 0) + voteValue,
        }));
      } else {
        // Insert new vote
        await supabase.from("caption_votes").insert({
          caption_id: captionId,
          profile_id: session.user.id,
          vote_value: voteValue,
        });

        // Add to totals
        setCaptionTotals((prev) => ({
          ...prev,
          [captionId]: (prev[captionId] || 0) + voteValue,
        }));
      }

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
                  <div style={{ display: "flex", alignItems: "center", marginLeft: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem", color: "#374151" }}>
                      Score: {captionTotals[caption.id] ?? 0}
                    </span>
                  </div>
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
