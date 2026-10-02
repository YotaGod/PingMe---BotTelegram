import type { Reminder } from "@/lib/types";

const today = new Date();
const at = (hour: number, minute: number) => {
  const date = new Date(today);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const demoReminders: Reminder[] = [
  {
    id: "demo-1",
    title: "Review weekly priorities",
    message: "Pilih tiga hal yang paling penting untuk minggu ini.",
    category: "Personal",
    priority: "high",
    schedule_type: "one_time",
    timezone: "Asia/Jakarta",
    start_at: at(9, 0),
    status: "active",
    recurrence_rule: null,
  },
  {
    id: "demo-2",
    title: "Minum air",
    message: "Istirahat sebentar dan isi ulang botol.",
    category: "Health",
    priority: "medium",
    schedule_type: "daily",
    timezone: "Asia/Jakarta",
    start_at: at(11, 30),
    status: "active",
    recurrence_rule: { frequency: "daily", time: "11:30" },
  },
  {
    id: "demo-3",
    title: "Kirim invoice ke Maya",
    message: "Lampirkan ringkasan pekerjaan bulan ini.",
    category: "Work",
    priority: "high",
    schedule_type: "one_time",
    timezone: "Asia/Jakarta",
    start_at: at(14, 0),
    status: "active",
    recurrence_rule: null,
  },
  {
    id: "demo-4",
    title: "Baca 20 halaman",
    message: null,
    category: "Personal",
    priority: "low",
    schedule_type: "daily",
    timezone: "Asia/Jakarta",
    start_at: at(20, 0),
    status: "active",
    recurrence_rule: { frequency: "daily", time: "20:00" },
  },
  {
    id: "demo-5",
    title: "Weekly team sync",
    message: "Bawa update project dan blocker.",
    category: "Work",
    priority: "medium",
    schedule_type: "weekly",
    timezone: "Asia/Jakarta",
    start_at: at(16, 0),
    status: "active",
    recurrence_rule: { frequency: "weekly", days: ["monday"], time: "16:00" },
  },
];
