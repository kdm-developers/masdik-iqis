// Single source of truth for activity / reservation types.
//
// Used by the admin activity form (Admin.tsx), the public reservation form
// (BookingForm.tsx) and the calendar display (EventCalendar.tsx) so the list of
// types, their labels and their colors stay consistent everywhere.

export interface ActivityTypeDef {
  value: string;
  label: string;
  /** Tailwind classes for the outline Badge shown on the calendar. */
  color: string;
}

export const ACTIVITY_TYPES: ActivityTypeDef[] = [
  { value: "kajian", label: "Kajian", color: "border-primary text-primary bg-transparent" },
  { value: "daurah", label: "Daurah", color: "border-emerald-600 text-emerald-600 bg-transparent" },
  { value: "pengajian", label: "Pengajian", color: "border-primary text-primary bg-transparent" },
  { value: "tudung_sipulung", label: "Tudung Sipulung", color: "border-purple-500 text-purple-500 bg-transparent" },
  { value: "rapat", label: "Rapat / Pertemuan", color: "border-blue-500 text-blue-500 bg-transparent" },
  { value: "pernikahan", label: "Akad Nikah / Resepsi", color: "border-pink-500 text-pink-500 bg-transparent" },
  { value: "aqiqah", label: "Aqiqah", color: "border-amber-500 text-amber-500 bg-transparent" },
  { value: "sosial", label: "Sosial", color: "border-gold text-gold bg-transparent" },
  { value: "lainnya", label: "Lainnya", color: "border-gray-500 text-gray-500 bg-transparent" },
];

// Colors for legacy values that may still exist in older rows but are no longer
// offered in the dropdowns.
const LEGACY_COLORS: Record<string, string> = {
  shalat: "border-emerald-600 text-emerald-600 bg-transparent",
  sholat: "border-emerald-600 text-emerald-600 bg-transparent",
  acara: "border-gold text-gold bg-transparent",
  reservasi: "border-secondary text-secondary-foreground bg-transparent",
};

const TYPE_MAP: Record<string, ActivityTypeDef> = Object.fromEntries(
  ACTIVITY_TYPES.map((t) => [t.value, t])
);

/** Human label for a type value, falling back to a capitalized raw value. */
export function getActivityTypeLabel(value: string): string {
  return TYPE_MAP[value]?.label ?? value.charAt(0).toUpperCase() + value.slice(1);
}

/** Badge color classes for a type value, with a sensible fallback. */
export function getActivityTypeColor(value: string): string {
  return (
    TYPE_MAP[value]?.color ??
    LEGACY_COLORS[value] ??
    "border-gray-500 text-gray-500 bg-transparent"
  );
}

// --- Admin-side behavior groupings (single source of truth) ---

/** Types that capture a speaker / narasumber and a topic / tema. */
export const SPEAKER_TOPIC_TYPES = ["kajian", "daurah", "tudung_sipulung"];
/** Types where speaker + topic are mandatory. */
export const SPEAKER_REQUIRED_TYPES = ["kajian", "daurah"];
/** Types that support QR-based attendance sessions. */
export const ATTENDANCE_TYPES = ["kajian", "daurah", "rapat", "tudung_sipulung"];
