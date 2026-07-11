import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { getActivityTypeColor, getActivityTypeLabel } from "@/lib/activityTypes";

interface EventItem {
  id: string;
  title: string;
  date: Date;
  endDate?: Date;
  time: string;
  description: string | null;
  type: string;
  source: "activity" | "reservation";
  requester?: string;
}

/** Normalize a Date to local midnight for day-level comparisons. */
const atMidnight = (d: Date): Date => {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/** Does the given day fall within an event's date range (inclusive)? */
const dayInEvent = (day: Date, ev: EventItem): boolean => {
  const d = atMidnight(day).getTime();
  const start = atMidnight(ev.date).getTime();
  const end = atMidnight(ev.endDate ?? ev.date).getTime();
  return d >= start && d <= end;
};

/** "d MMM yyyy" for single-day, or "d MMM – d MMM yyyy" for a range. */
const formatEventRange = (ev: EventItem): string => {
  if (ev.endDate && atMidnight(ev.endDate).getTime() !== atMidnight(ev.date).getTime()) {
    return `${format(ev.date, "d MMM", { locale: id })} – ${format(ev.endDate, "d MMM yyyy", { locale: id })}`;
  }
  return format(ev.date, "d MMM yyyy", { locale: id });
};

export function EventCalendar() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);

      // Fetch activities and approved reservations
      const [activitiesRes, reservationsRes] = await Promise.all([
        supabase
          .from("activities")
          .select("*")
          .eq("is_active", true)
          .order("event_date", { ascending: true }),
        supabase
          .from("reservations")
          .select("*")
          .eq("status", "approved")
          .order("reservation_date", { ascending: true }),
      ]);

      const allEvents: EventItem[] = [];

      // Add activities
      if (activitiesRes.data) {
        activitiesRes.data.forEach((activity) => {
          const timeStr = activity.event_time
            ? activity.event_end_time
              ? `${activity.event_time} - ${activity.event_end_time}`
              : activity.event_time
            : "";

          allEvents.push({
            id: activity.id,
            title: activity.title,
            date: new Date(activity.event_date),
            endDate: activity.event_end_date ? new Date(activity.event_end_date) : undefined,
            time: timeStr,
            description: activity.description,
            type: activity.type,
            source: "activity",
          });
        });
      }

      // Add approved reservations
      if (reservationsRes.data) {
        reservationsRes.data.forEach((reservation) => {
          const timeStr = reservation.reservation_time
            ? reservation.reservation_end_time
              ? `${reservation.reservation_time} - ${reservation.reservation_end_time}`
              : reservation.reservation_time
            : "";

          // Use description as title if available, otherwise use activity type
          const displayTitle = reservation.description
            ? reservation.description
            : getActivityTypeLabel(reservation.activity_type);

          allEvents.push({
            id: reservation.id,
            title: displayTitle,
            date: new Date(reservation.reservation_date),
            endDate: reservation.reservation_end_date ? new Date(reservation.reservation_end_date) : undefined,
            time: timeStr,
            description: reservation.description,
            type: reservation.activity_type,
            source: "reservation",
            requester: reservation.name,
          });
        });
      }

      setEvents(allEvents);
      setIsLoading(false);
    };

    fetchEvents();
  }, []);

  const selectedDateEvents = events.filter((event) => date && dayInEvent(date, event));

  // Get upcoming events (still-running or future events only)
  const todayStart = atMidnight(new Date());
  const upcomingEvents = events
    .filter((event) => atMidnight(event.endDate ?? event.date) >= todayStart)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-islamic border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Kalender Kegiatan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-xl border-0 pointer-events-auto"
                modifiers={{
                  event: (day) => events.some((ev) => dayInEvent(day, ev)),
                }}
                modifiersClassNames={{
                  event: "bg-primary/20 text-primary font-bold",
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-islamic border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {date
                ? format(date, "EEEE, d MMMM yyyy", { locale: id })
                : "Pilih Tanggal"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateEvents.length > 0 ? (
              <div className="space-y-4">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground mb-1">
                          {event.title}
                        </h4>
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                        )}
                        {event.source === "reservation" && event.requester && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                            <User className="w-3 h-3" />
                            <span>{event.requester}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant="outline" className={getActivityTypeColor(event.type)}>
                          {getActivityTypeLabel(event.type)}
                        </Badge>
                        {event.source === "reservation" && (
                          <Badge variant="secondary" className="text-xs">
                            Reservasi
                          </Badge>
                        )}
                      </div>
                    </div>
                    {event.endDate && atMidnight(event.endDate).getTime() !== atMidnight(event.date).getTime() && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                        <CalendarDays className="w-4 h-4" />
                        <span>{formatEventRange(event)}</span>
                      </div>
                    )}
                    {event.time && (
                      <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{event.time}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>Masjid Pendidikan Ibnul Qayyim, Makassar</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Tidak ada kegiatan terjadwal pada tanggal ini</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kegiatan Mendatang Section */}
      <Card className="shadow-islamic border-0">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">
            Kegiatan Mendatang
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : upcomingEvents.length > 0 ? (
            <div className="divide-y divide-border">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-colors"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">
                      {event.title}
                    </h4>
                    <p className="text-sm text-primary">
                      {formatEventRange(event)} • {event.time || "-"}
                    </p>
                    {event.source === "reservation" && event.requester && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {event.requester}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant="outline" className={getActivityTypeColor(event.type)}>
                      {getActivityTypeLabel(event.type)}
                    </Badge>
                    {event.source === "reservation" && (
                      <Badge variant="secondary" className="text-xs">
                        Reservasi
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Tidak ada kegiatan mendatang</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={getActivityTypeColor(selectedEvent.type)}>
                  {getActivityTypeLabel(selectedEvent.type)}
                </Badge>
                {selectedEvent.source === "reservation" && (
                  <Badge variant="secondary">Reservasi</Badge>
                )}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {selectedEvent.endDate &&
                    atMidnight(selectedEvent.endDate).getTime() !== atMidnight(selectedEvent.date).getTime()
                      ? formatEventRange(selectedEvent)
                      : format(selectedEvent.date, "EEEE, d MMMM yyyy", { locale: id })}
                  </span>
                </div>
                {selectedEvent.time && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{selectedEvent.time}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>Masjid Pendidikan Ibnul Qayyim, Makassar</span>
                </div>
                {selectedEvent.source === "reservation" && selectedEvent.requester && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>Pemohon: {selectedEvent.requester}</span>
                  </div>
                )}
              </div>

              {selectedEvent.description && (
                <div className="pt-2 border-t">
                  <h4 className="font-medium text-sm mb-2">Keterangan Kegiatan</h4>
                  <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
