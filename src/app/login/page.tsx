"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, LockKeyhole } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase)
      return setError(
        "Supabase belum dikonfigurasi. Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (authError) setError(authError.message);
    else window.location.assign("/");
  }

  return (
    <main className="auth-screen">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} /> Kembali ke dashboard
      </Link>
      <section className="auth-panel">
        <div className="brand-mark large">
          p<span>.</span>
        </div>
        <p className="eyebrow">RUANG YANG LEBIH TENANG</p>
        <h1>
          Selamat datang
          <br />
          kembali.
        </h1>
        <p className="auth-copy">
          Masuk untuk melanjutkan ritme yang sudah kamu bangun.
        </p>
        <form className="auth-form" onSubmit={signIn}>
          <label>
            Email
            <span className="input-icon">
              <Mail size={16} />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@email.com"
              />
            </span>
          </label>
          <label>
            Kata sandi
            <span className="input-icon">
              <LockKeyhole size={16} />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button full-button" disabled={busy}>
            {busy ? "Memeriksa..." : "Masuk ke akun"}
          </button>
        </form>
        <p className="auth-switch">
          Belum punya akun? <Link href="/register">Daftar sekarang</Link>
        </p>
      </section>
      <aside className="auth-aside">
        <span className="aside-index">01 / 04</span>
        <p>“Clarity comes from knowing what deserves your attention.”</p>
        <span className="aside-caption">YOUR DAY, WITH INTENTION</span>
      </aside>
    </main>
  );
}
