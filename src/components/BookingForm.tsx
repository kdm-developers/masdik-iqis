import { useState, useEffect, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Send, CheckCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ACTIVITY_TYPES } from "@/lib/activityTypes";
import {
  BookedSlot,
  timeOptions,
  getFullyBlockedDates,
  isTimeBooked,
  isDateOccupied,
  isDayFull,
  isRangeFree,
  startOfToday,
} from "@/lib/booking";

export function BookingForm() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [time, setTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    activity: "",
    description: "",
  });

  const isMultiDay = !!endDate;

  // Fetch approved reservations and activities to show booked slots
  useEffect(() => {
    const fetchBookedSlots = async () => {
      const [reservationsRes, activitiesRes] = await Promise.all([
        supabase
          .from("reservations")
          .select("reservation_date, reservation_end_date, reservation_time, reservation_end_time")
          .eq("status", "approved"),
        supabase
          .from("activities")
          .select("event_date, event_end_date, event_time, event_end_time")
          .eq("is_active", true),
      ]);

      const slots: BookedSlot[] = [];

      if (reservationsRes.data) {
        reservationsRes.data.forEach((r) => {
          slots.push({
            date: r.reservation_date,
            endDate: r.reservation_end_date,
            startTime: r.reservation_time,
            endTime: r.reservation_end_time,
          });
        });
      }

      if (activitiesRes.data) {
        activitiesRes.data.forEach((a) => {
          if (a.event_time || a.event_end_date) {
            slots.push({
              date: a.event_date,
              endDate: a.event_end_date,
              startTime: a.event_time,
              endTime: a.event_end_time,
            });
          }
        });
      }

      setBookedSlots(slots);
    };

    fetchBookedSlots();
  }, []);

  const fullyBlocked = useMemo(() => getFullyBlockedDates(bookedSlots), [bookedSlots]);

  // Get available start times for the selected date
  const availableStartTimes = useMemo(() => {
    if (!startDate) return timeOptions;
    if (isMultiDay) return timeOptions; // whole-day booking, no per-slot conflict
    return timeOptions.filter((t) => !isTimeBooked(bookedSlots, startDate, t, fullyBlocked));
  }, [startDate, isMultiDay, bookedSlots, fullyBlocked]);

  // Get available end times.
  const availableEndTimes = useMemo(() => {
    if (!startDate || !time) return [];
    // Multi-day: end time is on the last day, so any time is valid.
    if (isMultiDay) return timeOptions;
    const startIndex = timeOptions.indexOf(time);
    return timeOptions.slice(startIndex + 1).filter((t) => {
      for (let i = startIndex + 1; i <= timeOptions.indexOf(t); i++) {
        if (isTimeBooked(bookedSlots, startDate, timeOptions[i], fullyBlocked)) return false;
      }
      return true;
    });
  }, [startDate, time, isMultiDay, bookedSlots, fullyBlocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.email || !formData.activity || !startDate || !time || !formData.description) {
      toast({
        title: "Form Tidak Lengkap",
        description: "Mohon lengkapi semua field yang diperlukan",
        variant: "destructive",
      });
      return;
    }

    if (endDate && !isRangeFree(bookedSlots, startDate, endDate)) {
      toast({
        title: "Jadwal Bentrok",
        description: "Ada tanggal pada rentang yang dipilih yang sudah terpakai",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.from("reservations").insert({
      name: formData.name,
      phone: formData.phone,
      email: formData.email || null,
      activity_type: formData.activity,
      reservation_date: format(startDate, "yyyy-MM-dd"),
      reservation_end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
      reservation_time: time,
      reservation_end_time: endTime || null,
      description: formData.description || null,
      status: "pending",
    });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Gagal Mengirim",
        description: "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitted(true);
    toast({
      title: "Pengajuan Berhasil!",
      description: "Tim kami akan segera menghubungi Anda",
    });
  };

  if (isSubmitted) {
    return (
      <Card className="shadow-islamic border-0">
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 gradient-islamic rounded-full flex items-center justify-center mx-auto mb-6 shadow-islamic">
            <CheckCircle className="w-10 h-10 text-primary-foreground" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Pengajuan Terkirim!
          </h3>
          <p className="text-muted-foreground mb-6">
            Terima kasih telah mengajukan reservasi. Tim kami akan menghubungi
            Anda dalam 1x24 jam untuk konfirmasi.
          </p>
          <Button
            onClick={() => {
              setIsSubmitted(false);
              setFormData({ name: "", phone: "", email: "", activity: "", description: "" });
              setStartDate(undefined);
              setEndDate(undefined);
              setTime("");
              setEndTime("");
            }}
            variant="outline"
          >
            Ajukan Reservasi Lain
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-islamic border-0">
      <CardHeader>
        <CardTitle>Formulir Reservasi Masjid</CardTitle>
        <CardDescription>
          Isi formulir di bawah untuk mengajukan penggunaan masjid
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap *</Label>
              <Input
                id="name"
                placeholder="Masukkan nama lengkap"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor WhatsApp *</Label>
              <Input
                id="phone"
                placeholder="08xxxxxxxxxx"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Jenis Kegiatan *</Label>
            <Select
              value={formData.activity}
              onValueChange={(value) =>
                setFormData({ ...formData, activity: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis kegiatan" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Tanggal Mulai */}
            <div className="space-y-2">
              <Label>Tanggal Mulai *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "PPP", { locale: id })
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(newDate) => {
                      setStartDate(newDate);
                      // Reset dependent fields when the start day changes.
                      if (endDate && newDate && endDate <= newDate) setEndDate(undefined);
                      setTime("");
                      setEndTime("");
                    }}
                    disabled={(day) =>
                      day < startOfToday() || isDayFull(bookedSlots, day, fullyBlocked)
                    }
                    modifiers={{
                      partiallyBooked: (day) =>
                        isDateOccupied(bookedSlots, day) && !isDayFull(bookedSlots, day, fullyBlocked),
                      fullyBooked: (day) => isDayFull(bookedSlots, day, fullyBlocked),
                    }}
                    modifiersClassNames={{
                      partiallyBooked: "bg-amber-100 text-amber-800",
                      fullyBooked: "bg-destructive/20 text-destructive line-through",
                    }}
                    className="pointer-events-auto"
                    initialFocus
                  />
                  <div className="p-3 border-t border-border space-y-2">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-destructive/20 rounded" />
                        <span>Penuh</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-amber-100 rounded" />
                        <span>Tersedia waktu lain</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-primary rounded" />
                        <span>Dipilih</span>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tanggal Selesai (opsional, untuk kegiatan lebih dari 1 hari) */}
            <div className="space-y-2">
              <Label>Tanggal Selesai <span className="text-muted-foreground font-normal">(opsional)</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!startDate}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "PPP", { locale: id })
                      : "Sehari saja"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(newDate) => {
                      setEndDate(newDate);
                      setEndTime("");
                    }}
                    disabled={(day) =>
                      !startDate ||
                      day <= startDate ||
                      !isRangeFree(bookedSlots, startDate, day)
                    }
                    className="pointer-events-auto"
                    initialFocus
                  />
                  <div className="p-3 border-t border-border text-xs text-muted-foreground">
                    Untuk kegiatan lebih dari 1 hari. Klik tanggal terpilih untuk membatalkan.
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Pilih Waktu */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pilih Waktu *
            </Label>
            {startDate ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {isMultiDay ? "Mulai (hari pertama)" : "Mulai"}
                    </Label>
                    <Select value={time} onValueChange={(v) => { setTime(v); setEndTime(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jam mulai" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((t) => {
                          const isBooked = !isMultiDay && isTimeBooked(bookedSlots, startDate, t, fullyBlocked);
                          return (
                            <SelectItem key={t} value={t} disabled={isBooked}>
                              {t} {isBooked && "(Sudah dipesan)"}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {isMultiDay ? "Selesai (hari terakhir)" : "Sampai"}
                    </Label>
                    <Select value={endTime} onValueChange={setEndTime} disabled={!time}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jam selesai" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEndTimes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {!isMultiDay && availableStartTimes.length < timeOptions.length && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Beberapa waktu pada tanggal ini sudah dipesan
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                Pilih tanggal terlebih dahulu untuk melihat waktu yang tersedia
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Keterangan Kegiatan *</Label>
            <Textarea
              id="description"
              placeholder="Tuliskan detail kegiatan Anda..."
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            variant="islamic"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isLoading ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
