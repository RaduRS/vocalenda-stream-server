import {
  format,
  parse,
  isValid,
  startOfWeek,
  addDays,
  parseISO,
} from "date-fns";
import { toZonedTime, fromZonedTime, format as formatTz } from "date-fns-tz";
import { enGB } from "date-fns/locale";

// UK timezone constant
export const UK_TIMEZONE = "Europe/London";

// UK date format constants
export const UK_DATE_FORMAT = "dd/MM/yyyy";
export const UK_TIME_FORMAT = "HH:mm";
export const UK_DATETIME_FORMAT = "dd/MM/yyyy HH:mm";
export const ISO_DATE_FORMAT = "yyyy-MM-dd";
export const ISO_TIME_FORMAT = "HH:mm";
export const ISO_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

// UK locale options (Monday as first day of week)
const UK_LOCALE_OPTIONS = {
  locale: enGB,
  weekStartsOn: 1, // Monday = 1
};

/**
 * Get the current date and time in UK timezone
 */
export function getCurrentUKDateTime() {
  return toZonedTime(new Date(), UK_TIMEZONE);
}

/**
 * Get the current date in UK timezone (time set to 00:00:00)
 */
export function getCurrentUKDate() {
  const ukNow = getCurrentUKDateTime();
  return new Date(ukNow.getFullYear(), ukNow.getMonth(), ukNow.getDate());
}

/**
 * Format a date in UK format (DD/MM/YYYY)
 */
export function formatUKDate(date) {
  return format(date, UK_DATE_FORMAT, UK_LOCALE_OPTIONS);
}

/**
 * Format a time in UK format (HH:MM)
 */
export function formatUKTime(date) {
  return format(date, UK_TIME_FORMAT, UK_LOCALE_OPTIONS);
}

/**
 * Format a datetime in UK format (DD/MM/YYYY HH:MM)
 */
export function formatUKDateTime(date) {
  return format(date, UK_DATETIME_FORMAT, UK_LOCALE_OPTIONS);
}

/**
 * Format a date in ISO format (YYYY-MM-DD)
 */
export function formatISODate(date) {
  return format(date, ISO_DATE_FORMAT);
}

/**
 * Format a time in ISO format (HH:MM:SS)
 */
export function formatISOTime(date) {
  return format(date, ISO_TIME_FORMAT);
}

/**
 * Format a datetime in ISO format (YYYY-MM-DDTHH:MM:SS)
 */
export function formatISODateTime(date) {
  return format(date, ISO_DATETIME_FORMAT);
}

/**
 * Parse a UK date string (DD/MM/YYYY) to Date object
 */
export function parseUKDate(dateString) {
  const parsed = parse(
    dateString,
    UK_DATE_FORMAT,
    new Date(),
    UK_LOCALE_OPTIONS
  );
  if (!isValid(parsed)) {
    throw new Error(
      `Invalid UK date format: ${dateString}. Expected format: DD/MM/YYYY`
    );
  }
  return parsed;
}

/**
 * Parse a UK time string (HH:MM) to Date object (using today's date)
 */
export function parseUKTime(timeString, baseDate) {
  const base = baseDate || getCurrentUKDate();
  const parsed = parse(timeString, UK_TIME_FORMAT, base, UK_LOCALE_OPTIONS);
  if (!isValid(parsed)) {
    throw new Error(
      `Invalid UK time format: ${timeString}. Expected format: HH:MM`
    );
  }
  return parsed;
}

/**
 * Parse a UK datetime string (DD/MM/YYYY HH:MM) to Date object
 */
export function parseUKDateTime(datetimeString) {
  const parsed = parse(
    datetimeString,
    UK_DATETIME_FORMAT,
    new Date(),
    UK_LOCALE_OPTIONS
  );
  if (!isValid(parsed)) {
    throw new Error(
      `Invalid UK datetime format: ${datetimeString}. Expected format: DD/MM/YYYY HH:MM`
    );
  }
  return parsed;
}

/**
 * Parse an ISO date string (YYYY-MM-DD) to Date object
 */
export function parseISODate(dateString) {
  const parsed = parseISO(dateString);
  if (!isValid(parsed)) {
    throw new Error(
      `Invalid ISO date format: ${dateString}. Expected format: YYYY-MM-DD`
    );
  }
  return parsed;
}

/**
 * Get the day of the week name in English (UK locale)
 * Returns: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
 */
export function getDayOfWeekName(date) {
  return format(date, "EEEE", UK_LOCALE_OPTIONS);
}

/**
 * Get the short day of the week name in English (UK locale)
 * Returns: Mon, Tue, Wed, Thu, Fri, Sat, Sun
 */
export function getShortDayOfWeekName(date) {
  return format(date, "EEE", UK_LOCALE_OPTIONS);
}

/**
 * Get the day of the week number (UK format: Monday = 1, Sunday = 7)
 */
export function getDayOfWeekNumber(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day; // Convert Sunday from 0 to 7
}

/**
 * Convert a date/time from any timezone to UK timezone
 */
export function convertToUKTime(date, fromTimezone) {
  // First convert the date to UTC from the source timezone
  const utcDate = fromZonedTime(date, fromTimezone);
  // Then convert from UTC to UK timezone
  return toZonedTime(utcDate, UK_TIMEZONE);
}

/**
 * Convert a date/time from UK timezone to any other timezone
 */
export function convertFromUKTime(date, toTimezone) {
  // First convert the UK time to UTC
  const utcDate = fromZonedTime(date, UK_TIMEZONE);
  // Then convert from UTC to the target timezone
  return toZonedTime(utcDate, toTimezone);
}

/**
 * Create a date from ISO date string and time string in UK timezone
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:MM format
 * @returns {Date} Date object in UK timezone
 */
export function createUKDateTime(isoDate, timeString) {
  const dateTimeString = `${isoDate}T${timeString}`;
  const parsed = parseISO(dateTimeString);
  if (!isValid(parsed)) {
    throw new Error(`Invalid date/time combination: ${isoDate} ${timeString}`);
  }
  // Treat the input as UK local time and convert to UTC for storage
  return fromZonedTime(parsed, UK_TIMEZONE);
}

/**
 * Create a timezone-aware ISO string for calendar APIs
 * @param {Date} date - Date object
 * @param {string} timezone - Target timezone (defaults to UK)
 * @returns {string} ISO string with timezone info
 */
export function createTimezoneAwareISO(date, timezone = UK_TIMEZONE) {
  return formatTz(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", { timeZone: timezone });
}

/**
 * Get the start of the week (Monday) for a given date in UK format
 */
export function getStartOfWeekUK(date) {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday = 1
}

/**
 * Get all days of the week starting from Monday
 */
export function getWeekDaysUK() {
  const monday = getStartOfWeekUK(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return getDayOfWeekName(day).toLowerCase();
  });
}

/**
 * Validate if a date string matches UK format (DD/MM/YYYY)
 */
export function isValidUKDate(dateString) {
  try {
    parseUKDate(dateString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a time string matches UK format (HH:MM)
 */
export function isValidUKTime(timeString) {
  try {
    parseUKTime(timeString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert 12-hour time format to 24-hour format
 * @param {string} time12h - Time in 12-hour format (e.g., "3:00 PM", "11:30 AM")
 * @returns {string} Time in 24-hour format (e.g., "15:00", "11:30")
 */
export function convert12to24Hour(time12h) {
  const time = time12h.trim().toLowerCase();
  const [timePart, period] = time.split(/\s+/);

  if (!period || (!period.includes("am") && !period.includes("pm"))) {
    throw new Error(
      `Invalid 12-hour time format: ${time12h}. Expected format: "HH:MM AM/PM"`
    );
  }

  const [hours, minutes] = timePart.split(":").map(Number);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 1 ||
    hours > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid time values in: ${time12h}`);
  }

  let hour24 = hours;

  if (period.includes("am")) {
    if (hours === 12) hour24 = 0; // 12 AM = 00:xx
  } else if (period.includes("pm")) {
    if (hours !== 12) hour24 = hours + 12; // PM times except 12 PM
  }

  return `${hour24.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Convert 24-hour time format to 12-hour format
 * @param {string} time24h - Time in 24-hour format (e.g., "15:00", "09:30")
 * @returns {string} Time in 12-hour format (e.g., "3:00 PM", "9:30 AM")
 */
export function convert24to12Hour(time24h) {
  const [hours, minutes] = time24h.split(":").map(Number);

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid 24-hour time format: ${time24h}`);
  }

  const period = hours >= 12 ? "PM" : "AM";
  let hour12 = hours % 12;
  if (hour12 === 0) hour12 = 12; // 0 becomes 12

  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get a human-readable relative time description
 * @param {Date} date - The date to describe
 * @param {Date} baseDate - The date to compare against (defaults to current UK time)
 * @returns {string} Human-readable description (e.g., "today", "tomorrow", "Monday", "next week")
 */
export function getRelativeTimeDescription(date, baseDate) {
  const base = baseDate || getCurrentUKDate();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const baseNormalized = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate()
  );

  const diffDays = Math.round(
    (target.getTime() - baseNormalized.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1 && diffDays <= 7)
    return getDayOfWeekName(target).toLowerCase();
  if (diffDays > 7 && diffDays <= 14)
    return `next ${getDayOfWeekName(target).toLowerCase()}`;

  return formatUKDate(target);
}

// Export commonly used date-fns functions
export {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  isSameDay,
  isBefore,
  isAfter,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
} from "date-fns";
