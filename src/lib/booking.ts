// Shared scheduling utilities used by the admin activity form (Admin.tsx) and
// the public reservation form (BookingForm.tsx) so both agree on time options
// and conflict detection.
//
// Multi-day bookings block whole days: any day within a booking's
// [date, endDate] range is considered fully occupied.

import {
  addMinutes,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parse,
  parseISO,
} from "date-fns";

export interface BookedSlot {
  /** Start date, yyyy-MM-dd */
  date: string;
  /** End date for multi-day bookings, yyyy-MM-dd. null / equal to date = single day. */
  endDate?: string | null;
  startTime: string;
  endTime: string | null;
}

// Time options from 05:00 to 23:00 in 30-minute intervals.
export const generateTimeOptions = (): string[] => {
  const times: string[] = [];
  for (let hour = 5; hour <= 23; hour++) {
    times.push(`${hour.toString().padStart(2, "0")}:00`);
    if (hour < 23) times.push(`${hour.toString().padStart(2, "0")}:30`);
  }
  return times;
};

export const timeOptions = generateTimeOptions();

/** True if a multi-day slot (endDate strictly after date). */
const isMultiDaySlot = (slot: BookedSlot): boolean =>
  !!slot.endDate && slot.endDate > slot.date;

/** Does a booked slot occupy any part of the given yyyy-MM-dd date? */
export const slotOccupiesDate = (slot: BookedSlot, dateStr: string): boolean => {
  const end = isMultiDaySlot(slot) ? (slot.endDate as string) : slot.date;
  return dateStr >= slot.date && dateStr <= end;
};

/** Set of dates (yyyy-MM-dd) fully occupied by multi-day bookings. */
export const getFullyBlockedDates = (slots: BookedSlot[]): Set<string> => {
  const blocked = new Set<string>();
  for (const slot of slots) {
    if (isMultiDaySlot(slot)) {
      eachDayOfInterval({
        start: parseISO(slot.date),
        end: parseISO(slot.endDate as string),
      }).forEach((d) => blocked.add(format(d, "yyyy-MM-dd")));
    }
  }
  return blocked;
};

/** Is a specific time on a specific single day already booked? */
export const isTimeBooked = (
  slots: BookedSlot[],
  selectedDate: Date,
  checkTime: string,
  fullyBlocked?: Set<string>
): boolean => {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const blocked = fullyBlocked ?? getFullyBlockedDates(slots);
  if (blocked.has(dateStr)) return true;

  const checkTimeDate = parse(checkTime, "HH:mm", new Date());
  return slots.some((slot) => {
    // Multi-day slots are handled by whole-day blocking above.
    if (isMultiDaySlot(slot)) return false;
    if (slot.date !== dateStr) return false;

    const slotStart = parse(slot.startTime, "HH:mm", new Date());
    const slotEnd = slot.endTime
      ? parse(slot.endTime, "HH:mm", new Date())
      : addMinutes(slotStart, 120); // Default 2 hours if no end time

    return (
      isWithinInterval(checkTimeDate, { start: slotStart, end: slotEnd }) ||
      checkTime === slot.startTime
    );
  });
};

/** Does any booking occupy the given single day at all (any time)? */
export const isDateOccupied = (slots: BookedSlot[], day: Date): boolean => {
  const dateStr = format(day, "yyyy-MM-dd");
  return slots.some((slot) => slotOccupiesDate(slot, dateStr));
};

/** Is a single day fully booked (whole-day multi-day cover, or every slot taken)? */
export const isDayFull = (
  slots: BookedSlot[],
  day: Date,
  fullyBlocked?: Set<string>
): boolean => {
  const blocked = fullyBlocked ?? getFullyBlockedDates(slots);
  if (blocked.has(format(day, "yyyy-MM-dd"))) return true;
  return timeOptions.every((t) => isTimeBooked(slots, day, t, blocked));
};

/**
 * Is every day in [start, end] completely free? A new multi-day booking
 * occupies whole days, so the entire range (including the start day) must be
 * free of any other booking.
 */
export const isRangeFree = (
  slots: BookedSlot[],
  start: Date,
  end: Date
): boolean => eachDayOfInterval({ start, end }).every((d) => !isDateOccupied(slots, d));

/** Today at local midnight — for disabling past days consistently. */
export const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
