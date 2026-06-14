const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function toDate(input: Date | string | number) {
  return input instanceof Date ? input : new Date(input);
}

function getFormatter(
  options: Intl.DateTimeFormatOptions,
  locale = "en-US"
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: VIETNAM_TIME_ZONE,
    ...options,
  });
}

function getDateOnlyParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function createUtcDateFromKey(dateKey: string) {
  const { year, month, day } = getDateOnlyParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day));
}

export function getVietnamDateKey(input: Date | string | number = new Date()) {
  const parts = getFormatter(
    { year: "numeric", month: "2-digit", day: "2-digit" },
    "en-CA"
  ).formatToParts(toDate(input));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function getVietnamToday(input: Date | string | number = new Date()) {
  return getVietnamDateKey(input);
}

export function formatVietnamDate(
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
) {
  return getFormatter(options).format(toDate(input));
}

export function formatVietnamDateTime(
  input: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }
) {
  return getFormatter(options).format(toDate(input));
}

export function formatVietnamMonthLabel(dateKey: string) {
  return getFormatter({ month: "long", year: "numeric" }).format(
    createUtcDateFromKey(dateKey)
  );
}

export function addDaysToVietnamDate(dateKey: string, days: number) {
  const baseDate = createUtcDateFromKey(dateKey);
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return getVietnamDateKey(baseDate);
}

export function compareVietnamDateKeys(left: string, right: string) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function isSameVietnamDate(
  input: Date | string | number | null | undefined,
  dateKey: string
) {
  if (!input) return false;
  return getVietnamDateKey(input) === dateKey;
}

export function isVietnamDateWithinStay(
  dateKey: string,
  checkIn: string | null,
  checkOut: string | null
) {
  if (!checkIn || !checkOut) return false;
  const checkInKey = getVietnamDateKey(checkIn);
  const checkOutKey = getVietnamDateKey(checkOut);
  return (
    compareVietnamDateKeys(checkInKey, dateKey) <= 0 &&
    compareVietnamDateKeys(dateKey, checkOutKey) < 0
  );
}

export function getVietnamWeekStrip(centerDateKey: string) {
  return Array.from({ length: 5 }, (_, index) => {
    const dateKey = addDaysToVietnamDate(centerDateKey, index - 2);
    const date = createUtcDateFromKey(dateKey);

    return {
      dateKey,
      day: getFormatter({ weekday: "short" }).format(date),
      date: getFormatter({ day: "2-digit" }).format(date),
    };
  });
}

export function formatVietnamRelativeDay(
  input: Date | string | number | null | undefined,
  now: Date | string | number = new Date()
) {
  if (!input) return "recently";

  const inputKey = getVietnamDateKey(input);
  const nowKey = getVietnamDateKey(now);
  const inputDate = createUtcDateFromKey(inputKey);
  const nowDate = createUtcDateFromKey(nowKey);
  const diffDays = Math.round(
    (nowDate.getTime() - inputDate.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays > 1) return `${diffDays} days ago`;
  if (diffDays === -1) return "tomorrow";
  return `in ${Math.abs(diffDays)} days`;
}

export function formatVietnamRangeLabel(endDateKey: string, days: number) {
  const startDateKey = addDaysToVietnamDate(endDateKey, -(days - 1));
  return `${formatVietnamDate(createUtcDateFromKey(startDateKey))} - ${formatVietnamDate(
    createUtcDateFromKey(endDateKey)
  )}`;
}

export { VIETNAM_TIME_ZONE };
