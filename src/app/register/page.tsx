"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, LockKeyhole, UserRound } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase)
      return setMessage(
        "Supabase belum dikonfigurasi. Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    setBusy(false);
    setMessage(
      error ? error.message : "Periksa email kamu untuk mengonfirmasi akun.",
    );
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
        <p className="eyebrow">MULAI DENGAN LANGKAH KECIL</p>
        <h1>
          Buat ruang
          <br />
          untuk hal penting.
        </h1>
        <p className="auth-copy">
          Satu tempat untuk komitmen yang ingin kamu jaga.
        </p>
        <form className="auth-form" onSubmit={signUp}>
          <label>
            Nama
            <span className="input-icon">
              <UserRound size={16} />
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nama kamu"
              />
            </span>
          </label>
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
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </span>
          </label>
          {message && (
            <p className="form-note" role="status">
              {message}
            </p>
          )}
          <button className="primary-button full-button" disabled={busy}>
            {busy ? "Membuat akun..." : "Buat akun"}
          </button>
        </form>
        <p className="auth-switch">
          Sudah punya akun? <Link href="/login">Masuk</Link>
        </p>
      </section>
      <aside className="auth-aside">
        <span className="aside-index">02 / 04</span>
        <p>Make room for what matters.</p>
        <span className="aside-caption">A GENTLER WAY TO GET THINGS DONE</span>
      </aside>
    </main>
  );
}
