# PingMe — Smart Reminder

🇮🇩 Bahasa Indonesia | [🇺🇸 English](./README.en.md)

PingMe adalah aplikasi pengingat pribadi berbasis Next.js, Supabase, dan Telegram. Pengguna dapat membuat pengingat sekali jalan maupun berulang, melihat riwayat, menunda pengingat, dan menerima notifikasi Telegram.

## Fitur utama

- Autentikasi email/password melalui Supabase Auth.
- Pengingat sekali jalan, harian, mingguan, dan bulanan.
- Zona waktu IANA, prioritas, kategori, pesan, tanggal akhir, dan weekdays preset.
- Dashboard, kalender, riwayat occurrence, pencarian, filter, tema light/dark, dan PWA.
- Telegram `/start`, `/help`, `/reminder`, `/edit`, `/list`, `/today`, `/upcoming`, `/delete`, dan `/cancel`.
- Tombol inline Telegram untuk kategori, prioritas, pengulangan, tunda, hapus, dan pemulihan alur.
- Reliability Center untuk failed delivery, stale occurrence, retry, repair, dan cleanup.
- Export/import JSON, template cepat, bulk action, dan penghapusan data lama.
- Telegram private-by-default menggunakan allowlist user ID.

## Mulai cepat

1. Gunakan Node.js 22 atau yang lebih baru.
2. Salin `.env.example` menjadi `.env.local`.
3. Isi hanya URL Supabase dan publishable/anon key di frontend.
4. Jalankan:

   ```powershell
   npm install
   npm run dev
   ```

5. Buka `http://localhost:3000`.

Panduan lengkap ada di [SETUP_GUIDE.md](./SETUP_GUIDE.md).

## Arsitektur singkat

Browser berkomunikasi dengan Supabase Auth dan Postgres melalui RLS. Supabase Cron memanggil `reminder-worker` setiap menit. Worker mengambil occurrence yang jatuh tempo secara atomik dan mengirim Telegram. `telegram-webhook` menangani perintah serta callback dengan ownership check.

Dokumentasi lengkap:

- [Documentation Analysis](./docs/DOCUMENTATION_ANALYSIS.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Security](./docs/SECURITY.md)
- [Testing Guide](./docs/TESTING_GUIDE.md)
- [Maintenance Guide](./docs/MAINTENANCE_GUIDE.md)
- [Release Guide](./docs/RELEASE_GUIDE.md)
- [Migration History](./docs/MIGRATION_HISTORY.md)
- [Changelog](./docs/CHANGELOG.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./docs/CONTRIBUTING.md)

## Perintah development

```powershell
npm run dev
npm run test:unit
npm run typecheck
npm run lint
npm run build
npm run test:db
```

`test:db` membutuhkan PostgreSQL/Supabase test environment yang tersedia. Lihat [TESTING_GUIDE.md](./docs/TESTING_GUIDE.md).

## Keamanan

Jangan commit `.env`, service-role key, Telegram bot token, webhook secret, worker secret, JWT signing secret, atau password database. Browser hanya boleh menerima `NEXT_PUBLIC_SUPABASE_URL` dan publishable/anon key. Semua secret backend harus disimpan sebagai Supabase Function secrets/Vault.

Lihat [SECURITY.md](./docs/SECURITY.md) sebelum deployment.

## Lisensi

Proyek ini menggunakan [MIT License](./LICENSE).
