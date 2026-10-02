"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getNextOccurrence } from "@/lib/recurrence";
import {
  formatInTimeZone,
  fromZonedTime,
  timeAfterMinutes,
} from "@/lib/timezone";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Database,
  Pencil,
  Eraser,
  Filter,
  LayoutDashboard,
  ListTodo,
  LogOut,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { demoReminders } from "@/lib/demo-data";
import { getSupabase } from "@/lib/supabase";
import type { Reminder, ScheduleType } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Section = "dashboard" | "reminders" | "calendar" | "history" | "settings";
type Draft = {
  title: string;
  message: string;
  category: string;
  priority: Reminder["priority"];
  timezone: string;
  schedule: ScheduleType;
  date: string;
  endDate: string;
  time: string;
  day: number;
  days: number[];
};
type ReminderHistory = {
  id: string;
  occurred_at: string;
  status:
    | "pending"
    | "processing"
    | "sent"
    | "completed"
    | "snoozed"
    | "skipped"
    | "failed"
    | "cancelled";
  title: string;
  category: string;
  timezone: string;
};
const weekdayLabels = ["S", "S", "R", "K", "J", "S", "M"];
const pickerDayLabels = ["M", "S", "S", "R", "K", "J", "S"];
const weekDayNames = [
  "minggu",
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
];
const categoryColor: Record<string, string> = {
  Work: "mint",
  Personal: "lilac",
  Health: "peach",
  Home: "blue",
};
const nav: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "reminders", label: "Reminders", icon: ListTodo },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "history", label: "History", icon: Clock3 },
];
const emptyDraft = (timezone = "Asia/Jakarta"): Draft => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  return {
    title: "",
    message: "",
    category: "Personal",
    priority: "medium",
    timezone,
    schedule: "one_time",
    date: formatInTimeZone(date, timezone, "yyyy-MM-dd"),
    endDate: "",
    time: formatInTimeZone(date, timezone, "HH:mm"),
    day: date.getDate(),
    days: [Number(formatInTimeZone(date, timezone, "i")) % 7],
  };
};

function timeOf(value: string, timezone = "Asia/Jakarta") {
  return formatInTimeZone(new Date(value), timezone, "HH:mm");
}
function shortDate(value: string, timezone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: timezone,
  }).format(new Date(value));
}
function scheduledAt(reminder: Reminder) {
  return reminder.next_scheduled_at ?? reminder.start_at;
}
async function fetchReminders(supabase: SupabaseClient): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .order("start_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Reminder[];
  if (rows.length === 0) return rows;
  const { data: occurrences, error: occurrenceError } = await supabase
    .from("reminder_occurrences")
    .select("id,reminder_id,scheduled_at,snoozed_until,status")
    .in(
      "reminder_id",
      rows.map((row) => row.id),
    )
    .in("status", ["pending", "processing", "sent", "snoozed", "failed"])
    .order("scheduled_at", { ascending: true });
  if (occurrenceError) throw occurrenceError;
  const next = new Map<
    string,
    { id: string; scheduled_at: string; snoozed_until: string | null }
  >();
  for (const occurrence of occurrences ?? []) {
    if (!next.has(occurrence.reminder_id))
      next.set(occurrence.reminder_id, occurrence);
  }
  return rows.map((row) => ({
    ...row,
    next_occurrence_id: next.get(row.id)?.id,
    next_scheduled_at:
      next.get(row.id)?.snoozed_until ?? next.get(row.id)?.scheduled_at,
  }));
}
async function fetchHistory(
  supabase: SupabaseClient,
): Promise<ReminderHistory[]> {
  const { data, error } = await supabase
    .from("reminder_occurrences")
    .select(
      "id,scheduled_at,created_at,updated_at,sent_at,completed_at,status,reminders!inner(title,category,timezone)",
    )
    .in("status", [
      "pending",
      "processing",
      "sent",
      "completed",
      "snoozed",
      "skipped",
      "failed",
      "cancelled",
    ])
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const reminder = Array.isArray(row.reminders)
      ? row.reminders[0]
      : row.reminders;
    return {
      id: row.id,
      occurred_at:
        row.sent_at ?? row.completed_at ?? row.updated_at ?? row.created_at,
      status: row.status as ReminderHistory["status"],
      title: reminder.title,
      category: reminder.category,
      timezone: reminder.timezone,
    };
  });
}
function greeting() {
  const hour = new Date().getHours();
  return hour < 11
    ? "Pagi"
    : hour < 15
      ? "Siang"
      : hour < 18
        ? "Sore"
        : "Malam";
}

export function ReminderDashboard({ section }: { section: Section }) {
  const supabase = getSupabase();
  const [reminders, setReminders] = useState<Reminder[]>(() =>
    supabase ? [] : demoReminders,
  );
  const [history, setHistory] = useState<ReminderHistory[]>([]);
  const [busy, setBusy] = useState(true);
  const [isDemo] = useState(!supabase);
  const [hasSession, setHasSession] = useState(!supabase);
  const [userName, setUserName] = useState("Rizal");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setQuery(searchInput.trim().toLowerCase()),
      180,
    );
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!supabase) {
        const savedTimezone = localStorage.getItem("pingme-demo-timezone");
        if (savedTimezone) setTimezone(savedTimezone);
        const savedHistory = localStorage.getItem("pingme-demo-history");
        if (savedHistory) {
          try {
            setHistory(JSON.parse(savedHistory) as ReminderHistory[]);
          } catch {
            localStorage.removeItem("pingme-demo-history");
          }
        }
        setTelegramEnabled(
          localStorage.getItem("pingme-demo-telegram") !== "false",
        );
        const saved = localStorage.getItem("pingme-demo-reminders");
        if (saved) {
          try {
            setReminders(JSON.parse(saved) as Reminder[]);
          } catch {
            localStorage.removeItem("pingme-demo-reminders");
          }
        }
        if (alive) setBusy(false);
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        if (alive) {
          setHasSession(false);
          setReminders([]);
          setHistory([]);
          setError("");
          setBusy(false);
        }
        return;
      }
      setHasSession(true);
      const name = session.session.user.user_metadata.display_name;
      if (typeof name === "string" && alive) setUserName(name.split(" ")[0]);
      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: session.session.user.id,
            display_name: typeof name === "string" ? name : null,
          },
          { onConflict: "id" },
        );
      if (profileUpsertError) {
        if (alive) {
          setError(
            `Profil akun gagal disiapkan: ${profileUpsertError.message}`,
          );
          setBusy(false);
        }
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("timezone,telegram_notifications_enabled")
        .eq("id", session.session.user.id)
        .maybeSingle();
      if (profile?.timezone && alive) setTimezone(profile.timezone);
      if (typeof profile?.telegram_notifications_enabled === "boolean" && alive)
        setTelegramEnabled(profile.telegram_notifications_enabled);
      if (!alive) return;
      try {
        setReminders(await fetchReminders(supabase));
        setHistory(await fetchHistory(supabase));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Pengingat gagal dimuat.",
        );
      }
      setBusy(false);
    }
    void load();
    return () => {
      alive = false;
    };
  }, [supabase]);

  const active = useMemo(
    () => reminders.filter((reminder) => reminder.status === "active"),
    [reminders],
  );
  const filtered = useMemo(
    () =>
      reminders.filter((reminder) => {
        const matchesText =
          `${reminder.title} ${reminder.message ?? ""} ${reminder.category}`
            .toLowerCase()
            .includes(query);
        return (
          matchesText && (category === "all" || reminder.category === category)
        );
      }),
    [reminders, query, category],
  );
  const todayItems = useMemo(
    () =>
      active
        .filter(
          (reminder) =>
            formatInTimeZone(
              scheduledAt(reminder),
              reminder.timezone,
              "yyyy-MM-dd",
            ) === formatInTimeZone(new Date(), reminder.timezone, "yyyy-MM-dd"),
        )
        .sort((a, b) => scheduledAt(a).localeCompare(scheduledAt(b))),
    [active],
  );
  const nextReminder = todayItems[0];
  const categories = [
    ...new Set(reminders.map((reminder) => reminder.category)),
  ];
  const heading =
    section === "dashboard"
      ? "Overview"
      : section[0].toUpperCase() + section.slice(1);

  function persist(next: Reminder[]) {
    setReminders(next);
    if (isDemo)
      localStorage.setItem("pingme-demo-reminders", JSON.stringify(next));
  }

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft(timezone));
    setDialogOpen(true);
  }
  function openEdit(reminder: Reminder) {
    setEditing(reminder);
    setDraft({
      title: reminder.title,
      message: reminder.message ?? "",
      category: reminder.category,
      priority: reminder.priority,
      timezone: reminder.timezone,
      schedule: reminder.schedule_type,
      date: formatInTimeZone(
        reminder.start_at,
        reminder.timezone,
        "yyyy-MM-dd",
      ),
      endDate: reminder.end_at
        ? formatInTimeZone(reminder.end_at, reminder.timezone, "yyyy-MM-dd")
        : "",
      time: formatInTimeZone(reminder.start_at, reminder.timezone, "HH:mm"),
      day: Number(
        reminder.recurrence_rule?.day ??
          formatInTimeZone(reminder.start_at, reminder.timezone, "d"),
      ),
      days: Array.isArray(reminder.recurrence_rule?.days)
        ? (reminder.recurrence_rule.days as string[])
            .map((day) => weekDayNames.indexOf(day.toLowerCase()))
            .filter((day) => day >= 0)
        : [
            Number(
              formatInTimeZone(reminder.start_at, reminder.timezone, "i"),
            ) % 7,
          ],
    });
    setDialogOpen(true);
  }

  async function saveReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      supabase &&
      editing &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        editing.id,
      )
    )
      return setError(
        "Pengingat demo tidak bisa disimpan ke database. Buat pengingat baru.",
      );
    const scheduledAt = fromZonedTime(
      `${draft.date}T${draft.time}:00`,
      draft.timezone,
    );
    if (Number.isNaN(scheduledAt.getTime()))
      return setError("Tanggal dan waktu belum valid.");
    if (draft.schedule === "weekly" && draft.days.length === 0)
      return setError("Pilih minimal satu hari untuk pengulangan mingguan.");
    if (
      draft.endDate &&
      fromZonedTime(`${draft.endDate}T23:59:59`, draft.timezone) < scheduledAt
    )
      return setError("Tanggal akhir harus sama atau setelah tanggal mulai.");
    const rule =
      draft.schedule === "one_time"
        ? null
        : draft.schedule === "weekly"
          ? {
              frequency: "weekly",
              days: draft.days.map((day) => weekDayNames[day]),
              time: draft.time,
            }
          : draft.schedule === "monthly"
            ? { frequency: "monthly", day: draft.day, time: draft.time }
            : { frequency: "daily", time: draft.time };
    const values = {
      title: draft.title.trim(),
      message: draft.message.trim() || null,
      category: draft.category,
      priority: draft.priority,
      schedule_type: draft.schedule,
      timezone: draft.timezone,
      start_at: scheduledAt.toISOString(),
      end_at: draft.endDate
        ? fromZonedTime(
            `${draft.endDate}T23:59:59`,
            draft.timezone,
          ).toISOString()
        : null,
      recurrence_rule: rule,
    };
    if (supabase) {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId)
        return setError("Silakan masuk sebelum menyimpan pengingat.");
      const result = editing
        ? await supabase
            .from("reminders")
            .update(values)
            .eq("id", editing.id)
            .select()
            .single()
        : await supabase
            .from("reminders")
            .insert({ ...values, user_id: userId })
            .select()
            .single();
      if (result.error) return setError(result.error.message);
      if (editing) {
        persist(
          reminders.map((item) =>
            item.id === editing.id ? (result.data as Reminder) : item,
          ),
        );
      } else {
        try {
          persist(await fetchReminders(supabase));
          setHistory(await fetchHistory(supabase));
        } catch {
          persist([...reminders, result.data as Reminder]);
        }
      }
    } else {
      const newReminder: Reminder = {
        ...values,
        id: editing?.id ?? crypto.randomUUID(),
        status: editing?.status ?? "active",
      };
      persist(
        editing
          ? reminders.map((item) =>
              item.id === editing.id ? newReminder : item,
            )
          : [...reminders, newReminder],
      );
    }
    setDialogOpen(false);
    setError("");
    setNotice(
      editing ? "Pengingat diperbarui." : "Pengingat baru sudah dibuat.",
    );
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function updateStatus(reminder: Reminder, status: Reminder["status"]) {
    if (supabase) {
      if (status === "completed") {
        if (!reminder.next_occurrence_id)
          return setError("Occurrence aktif tidak ditemukan. Coba muat ulang.");
        const { error: actionError } = await supabase.rpc(
          "apply_user_occurrence_action",
          {
            p_occurrence_id: reminder.next_occurrence_id,
            p_action: "complete",
            p_snooze_minutes: 10,
          },
        );
        if (actionError) return setError(actionError.message);
        try {
          persist(await fetchReminders(supabase));
        } catch (loadError) {
          return setError(
            loadError instanceof Error
              ? loadError.message
              : "Data terbaru gagal dimuat.",
          );
        }
        setNotice("Selesai. Satu hal penting sudah beres.");
        window.setTimeout(() => setNotice(""), 2600);
        return;
      }
      const { error: updateError } = await supabase
        .from("reminders")
        .update({ status })
        .eq("id", reminder.id);
      if (updateError) return setError(updateError.message);
    }
    if (
      !supabase &&
      status === "completed" &&
      reminder.schedule_type !== "one_time"
    ) {
      const nextAt = getNextOccurrence(reminder, scheduledAt(reminder));
      const entry: ReminderHistory = {
        id: crypto.randomUUID(),
        occurred_at: scheduledAt(reminder),
        status: "completed",
        title: reminder.title,
        category: reminder.category,
        timezone: reminder.timezone,
      };
      const savedHistory = localStorage.getItem("pingme-demo-history");
      const previousHistory = savedHistory
        ? (JSON.parse(savedHistory) as ReminderHistory[])
        : [];
      const nextHistory = [entry, ...previousHistory];
      localStorage.setItem("pingme-demo-history", JSON.stringify(nextHistory));
      setHistory(nextHistory);
      persist(
        reminders.map((item) =>
          item.id === reminder.id && nextAt
            ? { ...item, status: "active", next_scheduled_at: nextAt }
            : item.id === reminder.id
              ? { ...item, status: "completed" }
              : item,
        ),
      );
      setNotice("Selesai. Berikutnya sudah dijadwalkan.");
      window.setTimeout(() => setNotice(""), 2600);
      return;
    }
    persist(
      reminders.map((item) =>
        item.id === reminder.id ? { ...item, status } : item,
      ),
    );
    setNotice(
      status === "completed"
        ? "Selesai. Satu hal penting sudah beres."
        : status === "paused"
          ? "Pengingat dijeda."
          : "Pengingat dilanjutkan.",
    );
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function snoozeReminder(reminder: Reminder) {
    if (supabase) {
      if (!reminder.next_occurrence_id)
        return setError("Occurrence aktif tidak ditemukan. Coba muat ulang.");
      const { error: actionError } = await supabase.rpc(
        "apply_user_occurrence_action",
        {
          p_occurrence_id: reminder.next_occurrence_id,
          p_action: "snooze",
          p_snooze_minutes: 10,
        },
      );
      if (actionError) return setError(actionError.message);
      try {
        persist(await fetchReminders(supabase));
      } catch (loadError) {
        return setError(
          loadError instanceof Error
            ? loadError.message
            : "Data terbaru gagal dimuat.",
        );
      }
    } else {
      const snoozedUntil = timeAfterMinutes(10);
      persist(
        reminders.map((item) =>
          item.id === reminder.id
            ? { ...item, next_scheduled_at: snoozedUntil }
            : item,
        ),
      );
    }
    setNotice("Ditunda 10 menit.");
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function removeReminder(reminder: Reminder) {
    if (
      supabase &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        reminder.id,
      )
    )
      return setError("ID pengingat tidak valid. Muat ulang lalu coba lagi.");
    if (!window.confirm(`Hapus “${reminder.title}”?`)) return;
    if (supabase) {
      const { error: deleteError } = await supabase
        .from("reminders")
        .delete()
        .eq("id", reminder.id);
      if (deleteError) return setError(deleteError.message);
    }
    persist(reminders.filter((item) => item.id !== reminder.id));
  }

  async function removeInactiveReminders() {
    const inactiveStatuses = ["completed", "cancelled", "disabled"] as const;
    const inactive = reminders.filter((item) =>
      inactiveStatuses.includes(item.status as (typeof inactiveStatuses)[number]),
    );
    if (!inactive.length) {
      setNotice("Tidak ada reminder nonaktif untuk dihapus.");
      window.setTimeout(() => setNotice(""), 2600);
      return;
    }
    if (
      !window.confirm(
        `Hapus ${inactive.length} reminder nonaktif beserta riwayatnya? Tindakan ini tidak dapat dibatalkan.`,
      )
    )
      return;
    if (supabase) {
      const { error: deleteError } = await supabase
        .from("reminders")
        .delete()
        .in("status", [...inactiveStatuses]);
      if (deleteError) return setError(deleteError.message);
      try {
        persist(await fetchReminders(supabase));
      } catch (loadError) {
        return setError(
          loadError instanceof Error
            ? loadError.message
            : "Data terbaru gagal dimuat.",
        );
      }
    } else {
      persist(
        reminders.filter(
          (item) => !inactiveStatuses.includes(item.status as (typeof inactiveStatuses)[number]),
        ),
      );
    }
    setNotice(`${inactive.length} reminder nonaktif berhasil dihapus.`);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function cleanOldData() {
    if (!supabase) {
      setNotice("Pembersihan database tersedia setelah masuk ke akun.");
      window.setTimeout(() => setNotice(""), 2600);
      return;
    }
    if (
      !window.confirm(
        "Hapus log notifikasi dan occurrence selesai lebih lama dari 30 hari? Reminder aktif dan jadwal yang belum selesai akan tetap aman.",
      )
    )
      return;
    const { data, error: cleanupError } = await supabase.rpc(
      "cleanup_user_reminder_data",
      { p_keep_days: 30 },
    );
    if (cleanupError) return setError(cleanupError.message);
    const result = (data ?? {}) as {
      notification_logs?: number;
      reminder_occurrences?: number;
      reminder_channels?: number;
    };
    try {
      setHistory(await fetchHistory(supabase));
    } catch (loadError) {
      return setError(
        loadError instanceof Error
          ? loadError.message
          : "Riwayat gagal dimuat ulang.",
      );
    }
    setNotice(
      `Database dibersihkan: ${result.notification_logs ?? 0} log, ${result.reminder_occurrences ?? 0} occurrence, dan ${result.reminder_channels ?? 0} channel dihapus.`,
    );
    window.setTimeout(() => setNotice(""), 4200);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.location.assign("/");
  }

  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <Link href="/" className="brand-lockup">
          <span className="brand-mark">
            p<span>.</span>
          </span>
          <span>
            Smart Reminder<span className="brand-dot">/</span>
          </span>
        </Link>
        <div className="workspace-label">
          WORKSPACE{" "}
          <button aria-label="Pengaturan workspace">
            <Settings2 size={14} />
          </button>
        </div>
        <div className="profile-mini">
          <div className="avatar avatar-small">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <span>
            <strong>{userName}</strong>
            <small>Personal space</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <p className="nav-caption">MENU</p>
        <nav className="main-nav" aria-label="Navigasi utama">
          {nav.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={id === "dashboard" ? "/" : `/${id}`}
              className={`nav-link ${section === id ? "nav-active" : ""}`}
              onClick={() => setMobileNav(false)}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "reminders" && (
                <span className="nav-count">{active.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">
              <Sparkles size={15} />
            </div>
            <strong>A little space helps.</strong>
            <p>Keep your list small enough to feel possible.</p>
          </div>
          <Link
            href="/settings"
            className={`nav-link ${section === "settings" ? "nav-active" : ""}`}
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </Link>
          <div className="sidebar-user">
            <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <span>
              <strong>{userName} A.</strong>
              <small>
                {isDemo
                  ? "Demo workspace"
                  : hasSession
                    ? "Personal account"
                    : "Not signed in"}
              </small>
            </span>
            {supabase ? (
              <button
                className="quiet-icon"
                aria-label="Keluar"
                onClick={signOut}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <Link className="quiet-icon" href="/login" aria-label="Masuk">
                <LogOut size={16} />
              </Link>
            )}
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileNav(false)}
          aria-label="Tutup navigasi"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Buka navigasi"
          >
            <span />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{heading}</strong>
          </div>
          <div className="top-actions">
            <span className="today-date">
              {new Intl.DateTimeFormat("id-ID", {
                weekday: "short",
                day: "numeric",
                month: "short",
              }).format(new Date())}
            </span>
            <span className="top-divider" />
            <button className="notification-button" aria-label="Notifikasi">
              <Bell size={17} />
              <i />
            </button>
            <Link
              href={supabase ? "/settings" : "/login"}
              className="top-avatar"
            >
              {userName.slice(0, 1).toUpperCase()}
            </Link>
          </div>
        </header>
        <div className="content-wrap">
          {isDemo && (
            <div className="demo-ribbon">
              <Sparkles size={14} />
              <span>Demo workspace</span>
              <span className="ribbon-separator" /> Perubahan tersimpan di
              browser ini{" "}
              <Link href="/register">
                Buat akun <span aria-hidden="true">↗</span>
              </Link>
            </div>
          )}
          {error && (
            <div className="inline-alert" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Tutup pesan">
                <X size={16} />
              </button>
            </div>
          )}
          {!isDemo && !hasSession ? (
            <AuthRequired />
          ) : section === "settings" ? (
            <SettingsPanel
              isDemo={isDemo}
              supabase={supabase}
              initialTimezone={timezone}
              initialTelegramEnabled={telegramEnabled}
              onTimezoneChange={setTimezone}
              onTelegramEnabledChange={setTelegramEnabled}
              onSignOut={signOut}
            />
          ) : section === "calendar" ? (
            <CalendarPanel
              reminders={active}
              timezone={timezone}
              onCreate={openCreate}
            />
          ) : section === "history" ? (
            <HistoryPanel
              reminders={reminders}
              history={history}
              isDemo={isDemo}
            />
          ) : section === "reminders" ? (
            <>
              <div className="page-heading compact-heading">
                <div>
                  <p className="eyebrow">YOUR PERSONAL SPACE</p>
                  <h1>
                    Reminders{" "}
                    <span className="heading-count">{active.length}</span>
                  </h1>
                  <p className="heading-sub">
                    Keep the things you care about within reach.
                  </p>
                </div>
                <div className="heading-actions">
                  <button className="secondary-button" onClick={cleanOldData}>
                    <Database size={16} /> Bersihkan data lama
                  </button>
                  <button className="secondary-button" onClick={removeInactiveReminders}>
                    <Eraser size={16} /> Hapus nonaktif
                  </button>
                  <button className="primary-button" onClick={openCreate}>
                    <Plus size={17} /> New reminder
                  </button>
                </div>
              </div>
              <ReminderTable
                reminders={filtered}
                categories={categories}
                category={category}
                query={searchInput}
                onQuery={setSearchInput}
                onCategory={setCategory}
                onEdit={openEdit}
                onToggle={(item) =>
                  updateStatus(
                    item,
                    item.status === "paused" ? "active" : "paused",
                  )
                }
                onComplete={(item) => updateStatus(item, "completed")}
                onSnooze={snoozeReminder}
                onDelete={removeReminder}
                onCreate={openCreate}
                loading={busy}
              />
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {new Intl.DateTimeFormat("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })
                      .format(new Date())
                      .toUpperCase()}
                  </p>
                  <h1>
                    Good {greeting()}, {userName}
                    <span className="heading-period">.</span>
                  </h1>
                  <p className="heading-sub">
                    A little progress, in the right direction.
                  </p>
                </div>
                <button className="primary-button" onClick={openCreate}>
                  <Plus size={17} /> New reminder
                </button>
              </div>
              <section className="hero-strip">
                <div className="hero-copy">
                  <div className="hero-kicker">
                    <span className="live-dot" /> TODAY AT A GLANCE
                  </div>
                  <h2>
                    {todayItems.length ? (
                      <>
                        A day with
                        <br />
                        <em>good intentions.</em>
                      </>
                    ) : (
                      <>
                        A little room
                        <br />
                        <em>to begin again.</em>
                      </>
                    )}
                  </h2>
                  <div className="hero-foot">
                    <span>{todayItems.length} reminders planned</span>
                    <span className="hero-line" />
                    <Link href="/calendar">
                      Open calendar <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-sun" />
                  <div className="art-arc art-arc-one" />
                  <div className="art-arc art-arc-two" />
                  <div className="art-leaf leaf-one" />
                  <div className="art-leaf leaf-two" />
                  <span className="art-star">✳</span>
                  <span className="art-note">
                    make it
                    <br />a good day
                  </span>
                </div>
                <div className="hero-note">
                  <span className="note-label">NEXT UP</span>
                  {nextReminder ? (
                    <>
                      <strong>{nextReminder.title}</strong>
                      <span>
                        {timeOf(
                          scheduledAt(nextReminder),
                          nextReminder.timezone,
                        )}{" "}
                        <i /> {nextReminder.category}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>No plans yet</strong>
                      <span>A good day can start small.</span>
                    </>
                  )}
                </div>
              </section>
              <div className="metric-row">
                <article className="metric-cell">
                  <span className="metric-label">ON YOUR LIST</span>
                  <div>
                    <strong>{active.length.toString().padStart(2, "0")}</strong>
                    <span className="metric-copy">active reminders</span>
                  </div>
                  <span className="metric-foot">
                    <ListTodo size={14} /> Across {categories.length || 0}{" "}
                    categories
                  </span>
                </article>
                <article className="metric-cell">
                  <span className="metric-label">TODAY</span>
                  <div>
                    <strong>
                      {todayItems.length.toString().padStart(2, "0")}
                    </strong>
                    <span className="metric-copy">things to remember</span>
                  </div>
                  <span className="metric-foot">
                    <Clock3 size={14} />{" "}
                    {nextReminder
                      ? `Next at ${timeOf(scheduledAt(nextReminder), nextReminder.timezone)}`
                      : "Space for something new"}
                  </span>
                </article>
                <article className="metric-cell progress-metric">
                  <span className="metric-label">THIS WEEK</span>
                  <div>
                    <strong>
                      72<span className="percent">%</span>
                    </strong>
                    <span className="metric-copy">follow-through</span>
                  </div>
                  <div
                    className="week-bars"
                    aria-label="Weekly follow-through chart"
                  >
                    <i style={{ height: "35%" }} />
                    <i style={{ height: "58%" }} />
                    <i style={{ height: "45%" }} />
                    <i style={{ height: "82%" }} />
                    <i style={{ height: "66%" }} />
                    <i style={{ height: "100%" }} />
                    <i style={{ height: "24%" }} />
                  </div>
                  <span className="metric-foot">
                    <span className="chart-legend" /> Better than last week
                  </span>
                </article>
              </div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">A CLEAR VIEW</p>
                  <h2>
                    Today&apos;s reminders <span>{todayItems.length}</span>
                  </h2>
                </div>
                <Link href="/reminders" className="text-link">
                  See all reminders <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className="today-list">
                {busy ? (
                  <LoadingRows />
                ) : todayItems.length ? (
                  todayItems
                    .slice(0, 5)
                    .map((item, index) => (
                      <ReminderRow
                        key={item.id}
                        reminder={item}
                        index={index}
                        onEdit={openEdit}
                        onToggle={() =>
                          updateStatus(
                            item,
                            item.status === "paused" ? "active" : "paused",
                          )
                        }
                        onComplete={() => updateStatus(item, "completed")}
                        onSnooze={() => snoozeReminder(item)}
                        onDelete={() => removeReminder(item)}
                      />
                    ))
                ) : (
                  <EmptyState onCreate={openCreate} />
                )}
              </div>
              <section className="bottom-row">
                <div className="week-card">
                  <div className="section-heading small-section">
                    <div>
                      <p className="eyebrow">YOUR RHYTHM</p>
                      <h2>This week</h2>
                    </div>
                    <Link href="/calendar" className="text-link">
                      View calendar <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                  <div className="week-strip">
                    {weekdayLabels.map((label, index) => {
                      const date = new Date();
                      date.setDate(
                        date.getDate() - ((date.getDay() + 6) % 7) + index,
                      );
                      const isToday =
                        date.toDateString() === new Date().toDateString();
                      return (
                        <Link
                          key={`${label}-${index}`}
                          href="/calendar"
                          className={`week-day ${isToday ? "week-today" : ""}`}
                        >
                          <span>{label}</span>
                          <strong>{date.getDate()}</strong>
                          <i className={index < 5 ? "has-event" : ""} />
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <div className="telegram-card">
                  <div className="telegram-orbit">
                    <Bell size={18} />
                  </div>
                  <div>
                    <p className="eyebrow">A GENTLE NUDGE</p>
                    <h3>Take it with you.</h3>
                    <p>
                      Connect Telegram and let your reminders find you there.
                    </p>
                    <Link href="/settings">
                      Connect Telegram <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                </div>
              </section>
            </>
          )}
          <footer className="page-footer">
            <span>Made for what matters.</span>
            <span>
              Asia/Jakarta <i /> PingMe, 2026
            </span>
          </footer>
        </div>
      </main>
      {dialogOpen && (
        <ReminderDialog
          draft={draft}
          setDraft={setDraft}
          editing={Boolean(editing)}
          error={error}
          onClose={() => {
            setDialogOpen(false);
            setError("");
          }}
          onSubmit={saveReminder}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
    </div>
  );
}

function ReminderRow({
  reminder,
  index,
  onEdit,
  onToggle,
  onComplete,
  onSnooze,
  onDelete,
}: {
  reminder: Reminder;
  index: number;
  onEdit: (item: Reminder) => void;
  onToggle: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={`reminder-row row-enter ${reminder.status === "paused" ? "row-paused" : ""}`}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <button
        className="complete-button"
        onClick={onComplete}
        aria-label={`Tandai ${reminder.title} selesai`}
      >
        <Check size={15} />
      </button>
      <span className="row-time">
        {timeOf(scheduledAt(reminder), reminder.timezone)}
      </span>
      <div className="row-main">
        <button className="row-title" onClick={() => onEdit(reminder)}>
          {reminder.title}
        </button>
        {reminder.message && (
          <span className="row-message">{reminder.message}</span>
        )}
      </div>
      <span
        className={`category-tag tag-${categoryColor[reminder.category] ?? "blue"}`}
      >
        <i />
        {reminder.category}
      </span>
      <span className={`priority-tag priority-${reminder.priority}`}>
        {reminder.priority}
      </span>
      <span className="recurrence-tag">
        {reminder.schedule_type === "one_time"
          ? "One-time"
          : reminder.schedule_type}
      </span>
      <div className="row-actions">
        <button aria-label="Edit reminder" onClick={() => onEdit(reminder)}>
          <Pencil size={15} />
        </button>
        <button aria-label="Tunda 10 menit" onClick={onSnooze}>
          <Clock3 size={15} />
        </button>
        <button
          aria-label={reminder.status === "paused" ? "Lanjutkan" : "Jeda"}
          onClick={onToggle}
        >
          {reminder.status === "paused" ? (
            <Play size={15} />
          ) : (
            <Pause size={15} />
          )}
        </button>
        <button aria-label="Hapus" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function ReminderTable({
  reminders,
  categories,
  category,
  query,
  onQuery,
  onCategory,
  onEdit,
  onToggle,
  onComplete,
  onSnooze,
  onDelete,
  onCreate,
  loading,
}: {
  reminders: Reminder[];
  categories: string[];
  category: string;
  query: string;
  onQuery: (value: string) => void;
  onCategory: (value: string) => void;
  onEdit: (item: Reminder) => void;
  onToggle: (item: Reminder) => void;
  onComplete: (item: Reminder) => void;
  onSnooze: (item: Reminder) => void;
  onDelete: (item: Reminder) => void;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <>
      <div className="table-tools">
        <label className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search reminders..."
          />
          <kbd>⌘ K</kbd>
        </label>
        <label className="filter-box">
          <Filter size={15} />
          <select
            value={category}
            onChange={(event) => onCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <span className="result-count">{reminders.length} reminders</span>
      </div>
      <div className="table-list">
        <div className="table-header">
          <span>REMINDER</span>
          <span>CATEGORY</span>
          <span>PRIORITY</span>
          <span>SCHEDULE</span>
          <span>STATUS</span>
          <span />
        </div>
        {loading ? (
          <LoadingRows />
        ) : reminders.length ? (
          reminders.map((item) => (
            <article className="table-row" key={item.id}>
              <div className="table-reminder">
                <button
                  className="complete-button compact-check"
                  onClick={() => onComplete(item)}
                  aria-label={`Tandai ${item.title} selesai`}
                >
                  <Check size={14} />
                </button>
                <div>
                  <button className="row-title" onClick={() => onEdit(item)}>
                    {item.title}
                  </button>
                  <span>
                    {shortDate(scheduledAt(item), item.timezone)} ·{" "}
                    {timeOf(scheduledAt(item), item.timezone)}
                  </span>
                </div>
              </div>
              <span
                className={`category-tag tag-${categoryColor[item.category] ?? "blue"}`}
              >
                <i />
                {item.category}
              </span>
              <span className={`priority-tag priority-${item.priority}`}>
                {item.priority}
              </span>
              <span className="table-schedule">
                {item.schedule_type.replace("_", " ")}
              </span>
              <span className={`status-pill status-${item.status}`}>
                {item.status}
              </span>
              <div className="table-actions">
                <button aria-label="Edit reminder" onClick={() => onEdit(item)}>
                  <Pencil size={15} />
                </button>
                <button
                  aria-label="Tunda 10 menit"
                  onClick={() => onSnooze(item)}
                >
                  <Clock3 size={15} />
                </button>
                <button aria-label="Ubah status" onClick={() => onToggle(item)}>
                  {item.status === "paused" ? (
                    <Play size={15} />
                  ) : (
                    <Pause size={15} />
                  )}
                </button>
                <button aria-label="Hapus" onClick={() => onDelete(item)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState onCreate={onCreate} />
        )}
      </div>
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">
        <CheckCheck size={21} />
      </div>
      <h3>Nothing competing for your attention.</h3>
      <p>Make a small promise to your future self.</p>
      <button className="secondary-button" onClick={onCreate}>
        <Plus size={15} /> Add a reminder
      </button>
    </div>
  );
}

function AuthRequired() {
  return (
    <section className="auth-required">
      <div className="auth-required-mark">
        <LockKeyhole size={19} />
      </div>
      <p className="eyebrow">YOUR PRIVATE SPACE</p>
      <h1>Sign in to your reminders.</h1>
      <p>
        Your reminders are private to your account. Sign in to view, create, or
        manage them.
      </p>
      <div className="auth-required-actions">
        <Link className="primary-button" href="/login">
          Sign in
        </Link>
        <Link className="secondary-button" href="/register">
          Create account
        </Link>
      </div>
    </section>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows" aria-label="Memuat pengingat">
      <i />
      <i />
      <i />
    </div>
  );
}

function CalendarPanel({
  reminders,
  timezone,
  onCreate,
}: {
  reminders: Reminder[];
  timezone: string;
  onCreate: () => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() =>
    formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"),
  );
  const today = new Date();
  const first = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  );
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const todayKey = formatInTimeZone(today, timezone, "yyyy-MM-dd");
  const dayReminders = reminders.filter(
    (reminder) =>
      formatInTimeZone(
        scheduledAt(reminder),
        reminder.timezone,
        "yyyy-MM-dd",
      ) === selectedDate,
  );
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">MAKE TIME FOR IT</p>
          <h1>Your calendar</h1>
          <p className="heading-sub">A gentle map of what is coming up.</p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Plus size={17} /> New reminder
        </button>
      </div>
      <div className="calendar-layout">
        <section className="calendar-sheet">
          <div className="calendar-month">
            <button
              aria-label="Bulan sebelumnya"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() - 1,
                    1,
                  ),
                )
              }
            >
              ‹
            </button>
            <h2>
              {new Intl.DateTimeFormat("id-ID", {
                month: "long",
                year: "numeric",
              }).format(visibleMonth)}
            </h2>
            <button
              aria-label="Bulan berikutnya"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth() + 1,
                    1,
                  ),
                )
              }
            >
              ›
            </button>
          </div>
          <div className="calendar-grid">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
              <span className="calendar-weekday" key={day}>
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, index) => (
              <span className="calendar-empty" key={`empty-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1;
              const dayKey = formatInTimeZone(
                new Date(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth(),
                  day,
                ),
                timezone,
                "yyyy-MM-dd",
              );
              const has = reminders.some(
                (reminder) =>
                  formatInTimeZone(
                    scheduledAt(reminder),
                    reminder.timezone,
                    "yyyy-MM-dd",
                  ) === dayKey,
              );
              return (
                <button
                  className={`calendar-day ${dayKey === todayKey ? "calendar-today" : ""} ${dayKey === selectedDate ? "calendar-selected" : ""}`}
                  key={day}
                  aria-pressed={dayKey === selectedDate}
                  onClick={() => setSelectedDate(dayKey)}
                >
                  <span>{day}</span>
                  {has && <i />}
                </button>
              );
            })}
          </div>
        </section>
        <aside className="upcoming-sheet">
          <p className="eyebrow">COMING UP</p>
          <h2>Worth remembering.</h2>
          {dayReminders.length ? (
            dayReminders.map((item) => (
              <div className="upcoming-item" key={item.id}>
                <span className="upcoming-time">
                  {timeOf(scheduledAt(item), item.timezone)}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {shortDate(scheduledAt(item), item.timezone)} ·{" "}
                    {item.category}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="calendar-empty-message">
              A quiet day, with room to choose.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function HistoryPanel({
  reminders,
  history,
  isDemo,
}: {
  reminders: Reminder[];
  history: ReminderHistory[];
  isDemo: boolean;
}) {
  const entries = isDemo
    ? [
        ...history,
        ...reminders
          .filter((item) => item.status === "completed")
          .map((item) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            status: "completed" as const,
            occurred_at: item.start_at,
            timezone: item.timezone,
          })),
      ]
    : history;
  const completedCount = entries.filter(
    (item) => item.status === "completed",
  ).length;
  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">LOOK HOW FAR YOU CAME</p>
          <h1>Your history</h1>
          <p className="heading-sub">
            Small things add up to a life well kept.
          </p>
        </div>
      </div>
      <div className="history-summary">
        <span className="history-number">
          {completedCount.toString().padStart(2, "0")}
        </span>
        <div>
          <strong>things you followed through on</strong>
          <span>Every completed reminder is proof you showed up.</span>
        </div>
        <CheckCheck size={23} />
      </div>
      <div className="history-list">
        {entries.length ? (
          entries.map((item) => (
            <article className="history-item" key={item.id}>
              <div className="history-check">
                <Check size={15} />
              </div>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.category} · {shortDate(item.occurred_at, item.timezone)}
                </span>
              </div>
              <span className={`history-done history-${item.status}`}>
                {item.status === "pending"
                  ? "Created"
                  : item.status === "processing"
                    ? "Processing"
                    : item.status === "sent"
                      ? "Triggered"
                      : item.status[0].toUpperCase() + item.status.slice(1)}
              </span>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-mark">
              <Clock3 size={20} />
            </div>
            <h3>Your next small win goes here.</h3>
            <p>Completed reminders will find a home on this page.</p>
          </div>
        )}
      </div>
    </>
  );
}

function SettingsPanel({
  isDemo,
  supabase,
  initialTimezone,
  initialTelegramEnabled,
  onTimezoneChange,
  onTelegramEnabledChange,
  onSignOut,
}: {
  isDemo: boolean;
  supabase: SupabaseClient | null;
  initialTimezone: string;
  initialTelegramEnabled: boolean;
  onTimezoneChange: (timezone: string) => void;
  onTelegramEnabledChange: (enabled: boolean) => void;
  onSignOut: () => void;
}) {
  const timezone = initialTimezone;
  const telegramEnabled = initialTelegramEnabled;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [telegramUrl, setTelegramUrl] = useState("");

  async function saveTimezone() {
    setBusy(true);
    setStatus("");
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setStatus("Masuk untuk menyimpan zona waktu.");
        setBusy(false);
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ timezone })
        .eq("id", data.user.id);
      if (error) {
        setStatus(error.message);
        setBusy(false);
        return;
      }
    } else {
      localStorage.setItem("pingme-demo-timezone", timezone);
    }
    onTimezoneChange(timezone);
    setStatus("Zona waktu tersimpan.");
    setBusy(false);
  }

  async function connectTelegram() {
    if (!supabase) {
      setStatus("Buat akun dan konfigurasi Telegram untuk menghubungkan bot.");
      return;
    }
    setBusy(true);
    setStatus("");
    const { data, error } = await supabase.functions.invoke(
      "telegram-link-token",
    );
    setBusy(false);
    if (error || !data?.url) {
      setStatus(error?.message ?? "Tautan Telegram belum tersedia.");
      return;
    }
    setTelegramUrl(data.url);
    setStatus("Tautan berlaku selama 10 menit.");
  }

  async function toggleTelegram() {
    const next = !telegramEnabled;
    setBusy(true);
    setStatus("");
    if (supabase) {
      const { error } = await supabase.rpc("set_telegram_notifications", {
        p_enabled: next,
      });
      if (error) {
        setStatus(error.message);
        setBusy(false);
        return;
      }
    } else {
      localStorage.setItem("pingme-demo-telegram", String(next));
    }
    onTelegramEnabledChange(next);
    setBusy(false);
    setStatus(
      next
        ? "Pengingat Telegram diaktifkan."
        : "Pengingat Telegram dinonaktifkan.",
    );
  }

  return (
    <>
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1>Settings</h1>
          <p className="heading-sub">
            A few details to make reminders feel like yours.
          </p>
        </div>
      </div>
      <div className="settings-list">
        <section className="settings-row">
          <div>
            <strong>Time zone</strong>
            <p>Used to keep your reminders in local time.</p>
          </div>
          <select
            value={timezone}
            onChange={(event) => {
              onTimezoneChange(event.target.value);
              setStatus("");
            }}
          >
            <option>Asia/Jakarta</option>
            <option>Asia/Makassar</option>
            <option>Asia/Jayapura</option>
            <option>Asia/Singapore</option>
            <option>UTC</option>
          </select>
          <button
            className="secondary-button"
            onClick={saveTimezone}
            disabled={busy}
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </section>
        <section className="settings-row">
          <div>
            <strong>Telegram notifications</strong>
            <p>Receive a friendly nudge wherever you are.</p>
          </div>
          <div className="settings-controls">
            <button
              className="toggle-control"
              aria-pressed={telegramEnabled}
              onClick={toggleTelegram}
              disabled={busy}
            >
              <i /> {telegramEnabled ? "On" : "Off"}
            </button>
            {telegramUrl ? (
              <a
                className="secondary-button"
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Telegram <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <button
                className="secondary-button"
                onClick={connectTelegram}
                disabled={busy}
              >
                {busy ? "Working..." : "Connect Telegram"}{" "}
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </section>
        {status && (
          <p className="settings-status" role="status">
            {status}
          </p>
        )}
        <section className="settings-row">
          <div>
            <strong>Account</strong>
            <p>
              {isDemo
                ? "Your demo reminders stay in this browser."
                : "Manage your PingMe account."}
            </p>
          </div>
          {isDemo ? (
            <Link className="secondary-button" href="/register">
              Create account <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button className="secondary-button" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </section>
      </div>
    </>
  );
}

function ReminderDialog({
  draft,
  setDraft,
  editing,
  error,
  onClose,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  editing: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft({ ...draft, [key]: value });
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="reminder-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <header>
          <div>
            <p className="eyebrow">A MOMENT FOR WHAT MATTERS</p>
            <h2 id="dialog-title">
              {editing ? "Edit reminder" : "New reminder"}
            </h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Tutup">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          {error && (
            <div className="dialog-error" role="alert">
              <span>{error}</span>
            </div>
          )}
          <label className="field-label">
            What do you want to remember?
            <input
              autoFocus
              required
              maxLength={120}
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="e.g. Call Mum"
            />
          </label>
          <label className="field-label">
            A little context <span className="optional">OPTIONAL</span>
            <textarea
              rows={2}
              maxLength={500}
              value={draft.message}
              onChange={(event) => update("message", event.target.value)}
              placeholder="Add a note for your future self..."
            />
          </label>
          <div className="form-grid">
            <label className="field-label">
              Category
              <select
                value={draft.category}
                onChange={(event) => update("category", event.target.value)}
              >
                {["Personal", "Work", "Health", "Home"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Priority
              <select
                value={draft.priority}
                onChange={(event) =>
                  update("priority", event.target.value as Draft["priority"])
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label className="field-label">
              Date
              <input
                type="date"
                value={draft.date}
                onChange={(event) => update("date", event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Time
              <input
                type="time"
                value={draft.time}
                onChange={(event) => update("time", event.target.value)}
                required
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field-label">
              Time zone
              <select
                value={draft.timezone}
                onChange={(event) => update("timezone", event.target.value)}
              >
                <option>Asia/Jakarta</option>
                <option>Asia/Makassar</option>
                <option>Asia/Jayapura</option>
                <option>Asia/Singapore</option>
                <option>Asia/Tokyo</option>
                <option>America/New_York</option>
                <option>UTC</option>
              </select>
            </label>
            <label className="field-label">
              End date <span className="optional">OPTIONAL</span>
              <input
                type="date"
                min={draft.date}
                value={draft.endDate}
                onChange={(event) => update("endDate", event.target.value)}
              />
            </label>
          </div>
          <label className="field-label">
            Repeat
            <select
              value={draft.schedule}
              onChange={(event) =>
                update("schedule", event.target.value as ScheduleType)
              }
            >
              <option value="one_time">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </label>
          {draft.schedule === "weekly" && (
            <div className="weekday-picker">
              <div className="weekday-picker-heading">
                <span>REPEAT ON</span>
                <button
                  type="button"
                  className="weekday-preset"
                  onClick={() => {
                    const weekdays = [1, 2, 3, 4, 5];
                    const alreadySelected =
                      weekdays.every((day) => draft.days.includes(day)) &&
                      draft.days.length === weekdays.length;
                    update("days", alreadySelected ? [] : weekdays);
                  }}
                >
                  Weekdays · Mon–Fri
                </button>
              </div>
              {pickerDayLabels.map((label, index) => {
                const day = (index + 1) % 7;
                return (
                  <button
                    type="button"
                    key={`${label}-${index}`}
                    className={
                      draft.days.includes(day) ? "weekday-selected" : ""
                    }
                    onClick={() =>
                      update(
                        "days",
                        draft.days.includes(day)
                          ? draft.days.filter((value) => value !== day)
                          : [...draft.days, day],
                      )
                    }
                    aria-label={weekDayNames[day]}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {draft.schedule === "monthly" && (
            <label className="field-label">
              Day of month
              <input
                type="number"
                min={1}
                max={31}
                value={draft.day}
                onChange={(event) => update("day", Number(event.target.value))}
              />
            </label>
          )}
          <footer>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button">
              <Plus size={16} /> {editing ? "Save changes" : "Create reminder"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
