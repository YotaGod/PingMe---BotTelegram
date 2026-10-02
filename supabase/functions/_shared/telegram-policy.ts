export const SNOOZE_OPTIONS = [5, 10, 30, 60, 1440] as const;

export function isAllowedTelegramUser(
  telegramUserId: string,
  configured: string | undefined,
  requireAllowlist: boolean,
) {
  const values = configured
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!values?.length) return !requireAllowlist;
  return values.includes(telegramUserId);
}
