export type ReminderStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "disabled";
export type Priority = "low" | "medium" | "high";
export type ScheduleType = "one_time" | "daily" | "weekly" | "monthly";

export type Reminder = {
  id: string;
  title: string;
  message: string | null;
  category: string;
  priority: Priority;
  schedule_type: ScheduleType;
  timezone: string;
  start_at: string;
  end_at?: string | null;
  status: ReminderStatus;
  recurrence_rule: Record<string, unknown> | null;
  next_occurrence_id?: string;
  next_scheduled_at?: string;
  last_scheduled_at?: string;
};
