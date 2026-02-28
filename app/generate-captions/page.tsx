"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const API_BASE_URL = "https://api.almostcrackd.ai";
const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
};

type CaptionApiRecord = {
  id?: string;
  content?: string;
  caption?: string;
  text?: string;
  [key: string]: unknown;
};

function extractCaptionText(record: CaptionApiRecord): string {
  if (typeof record.content === "string" && record.content.trim()) return record.content;
  if (typeof record.caption === "string" && record.caption.trim()) return record.caption;
  if (typeof record.text === "string" && record.text.trim()) return record.text;
  return "";
}

function resolveContentType(file: File): string | null {
  if (SUPPORTED_TYPES.has(file.type)) {
    return file.type;
  }

  const extension = file.name.toLowerCase().split(".").pop();
  if (extension && extension in EXTENSION_TO_CONTENT_TYPE) {
    return EXTENSION_TO_CONTENT_TYPE[extension];
  }

  return null;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === "string") {
      return `${fallback}: ${payload.message}`;
    }
  } catch {
    // ignore invalid JSON response and use fallback
  }
  return `${fallback} (HTTP ${response.status})`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function GenerateCaptionsPage() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMissingFileWarning, setShowMissingFileWarning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [generatedCaptions, setGeneratedCaptions] = useState<CaptionApiRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setSession(s ?? null);
      setLoadingSession(false);
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

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setShowMissingFileWarning(false);
    setError("");
    setStatus("");
    setUploadedImageUrl("");
    setGeneratedCaptions([]);

    if (file && !resolveContentType(file)) {
      setError(`Unsupported file type: ${file.type || "unknown"}.`);
    }
  };

  const signIn = async () => {
    try {
      window.localStorage.setItem("postAuthRedirect", "/generate-captions");
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleGenerateCaptions = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      setShowMissingFileWarning(true);
      setError("Please select an image first.");
      return;
    }

    setShowMissingFileWarning(false);
    const contentType = resolveContentType(selectedFile);

    if (!contentType) {
      setError(
        "Unsupported file type. Please upload jpeg, jpg, png, webp, gif, or heic."
      );
      return;
    }

    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession();
    const accessToken = activeSession?.access_token;

    if (!accessToken) {
      setError("You must be signed in to generate captions.");
      return;
    }

    setProcessing(true);
    setError("");
    setStatus("Step 1/4: Generating presigned upload URL...");
    setUploadedImageUrl("");
    setGeneratedCaptions([]);

    try {
      const presignedRes = await fetch(`${API_BASE_URL}/pipeline/generate-presigned-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ contentType }),
      });

      if (!presignedRes.ok) {
        throw new Error(
          await readApiError(presignedRes, "Failed to generate presigned upload URL")
        );
      }

      const presignedPayload: { presignedUrl?: string; cdnUrl?: string } =
        await presignedRes.json();
      const presignedUrl = presignedPayload.presignedUrl;
      const cdnUrl = presignedPayload.cdnUrl;

      if (!presignedUrl || !cdnUrl) {
        throw new Error("Presigned URL response is missing required fields.");
      }

      setStatus("Step 2/4: Uploading image bytes...");
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        throw new Error(`Image upload failed (HTTP ${uploadRes.status}).`);
      }

      let registerPayload: { imageId?: string } | null = null;
      const maxRegisterAttempts = 4;
      for (let attempt = 1; attempt <= maxRegisterAttempts; attempt += 1) {
        setStatus(
          attempt === 1
            ? "Step 3/4: Registering uploaded image with pipeline..."
            : `Step 3/4: Register retry ${attempt}/${maxRegisterAttempts}...`
        );

        const registerRes = await fetch(`${API_BASE_URL}/pipeline/upload-image-from-url`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: cdnUrl,
            isCommonUse: false,
          }),
        });

        if (registerRes.ok) {
          registerPayload = await registerRes.json();
          break;
        }

        const shouldRetry = registerRes.status >= 500 || registerRes.status === 429;
        const isLastAttempt = attempt === maxRegisterAttempts;
        if (!shouldRetry || isLastAttempt) {
          throw new Error(await readApiError(registerRes, "Failed to register uploaded image"));
        }

        await sleep(600 * attempt);
      }

      if (!registerPayload) {
        throw new Error("Failed to register uploaded image.");
      }

      if (!registerPayload.imageId) {
        throw new Error("Image registration response is missing imageId.");
      }

      setStatus("Step 4/4: Generating captions...");
      const generateRes = await fetch(`${API_BASE_URL}/pipeline/generate-captions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId: registerPayload.imageId,
        }),
      });

      if (!generateRes.ok) {
        throw new Error(await readApiError(generateRes, "Failed to generate captions"));
      }

      const captionsPayload = await generateRes.json();
      const rows: CaptionApiRecord[] = Array.isArray(captionsPayload)
        ? captionsPayload
        : Array.isArray(captionsPayload?.captions)
          ? captionsPayload.captions
          : [];

      setUploadedImageUrl(cdnUrl);
      setGeneratedCaptions(rows);
      setStatus(`Done. Generated ${rows.length} caption${rows.length === 1 ? "" : "s"}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to complete caption generation.");
      setStatus("");
    } finally {
      setProcessing(false);
    }
  };

  if (loadingSession) {
    return (
      <main className="container-center">
        <div className="card">
          <h1 className="title">Loading…</h1>
          <p className="muted">Checking your session.</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container-center">
        <div className="card">
          <h1 className="title">Protected: Generate Captions</h1>
          <p className="muted">
            Sign in with Google to upload images and generate captions.
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
            <button onClick={signIn} className="btn-primary">
              Sign in with Google
            </button>
            <Link href="/" className="cta-link" style={{ marginTop: 0 }}>
              Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container-center">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="title">Generate Captions</h1>
            <p className="muted" style={{ margin: 0 }}>
              Signed in as {session.user?.email}
            </p>
          </div>
          <div className="meta">
            <button onClick={signOut} className="btn-danger">
              Sign out
            </button>
          </div>
        </div>

        <form onSubmit={handleGenerateCaptions}>
          <input
            id="image-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic"
            onChange={handleSelectFile}
            className="visually-hidden-input"
            ref={fileInputRef}
            disabled={processing}
          />
          <div className="file-picker-row">
            <button
              type="button"
              className="file-picker-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
            >
              Choose File
            </button>
            <span
              className={`file-picker-name${showMissingFileWarning ? " file-picker-name-warning" : ""}`}
            >
              {selectedFile ? selectedFile.name : "No file chosen"}
            </span>
          </div>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Supported types: jpeg, jpg, png, webp, gif, heic
          </p>

          <button
            type="submit"
            className="btn-primary"
            disabled={processing}
            style={{ marginTop: "0.75rem" }}
          >
            {processing ? "Generating..." : "Upload and Generate Captions"}
          </button>
        </form>

        {status ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            {status}
          </p>
        ) : null}

        {error ? (
          <div className="error" style={{ marginTop: "1rem" }}>
            <strong>Error:</strong> {error}
          </div>
        ) : null}

        {uploadedImageUrl ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            Uploaded image:{" "}
            <a href={uploadedImageUrl} target="_blank" rel="noreferrer">
              View image
            </a>
          </p>
        ) : null}

        {generatedCaptions.length > 0 ? (
          <div style={{ marginTop: "1rem" }}>
            <h2 className="card-subtitle">Generated Captions</h2>
            <ul style={{ marginTop: "0.75rem", paddingLeft: "1.2rem" }}>
              {generatedCaptions.map((record, index) => {
                const text = extractCaptionText(record);
                return (
                  <li key={`${record.id || "caption"}-${index}`} style={{ marginBottom: "0.5rem" }}>
                    {text || JSON.stringify(record)}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/" style={{ color: "#3b82f6", textDecoration: "none" }}>
            ← Home
          </Link>
        </div>
      </div>
    </main>
  );
}
