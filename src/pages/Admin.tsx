import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarDays,
  Wallet,
  FileText,
  Check,
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  ArrowLeft,
  LogOut,
  Eye,
  ShieldAlert,
  Loader2,
  CalendarIcon,
  Trash2,
  BookOpen,
  ClipboardList,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { PustakaManager } from "@/components/admin/PustakaManager";
import {
  ACTIVITY_TYPES,
  getActivityTypeLabel,
  SPEAKER_TOPIC_TYPES,
  SPEAKER_REQUIRED_TYPES,
  ATTENDANCE_TYPES,
} from "@/lib/activityTypes";
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

type BookingStatus = "pending" | "approved" | "rejected";

interface Booking {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  activity_type: string;
  reservation_date: string;
  reservation_end_date: string | null;
  reservation_time: string;
  reservation_end_time: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
  category: string | null;
}

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_end_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  type: string;
  description: string | null;
  speaker_name: string | null;
  topic: string | null;
  total_sessions: number | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Display a single date, or a "start s/d end" range for multi-day items.
function formatDateRange(start: string, end: string | null): string {
  return end && end !== start ? `${start} s/d ${end}` : start;
}

export default function Admin() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [statDialogOpen, setStatDialogOpen] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const navigate = useNavigate();

  // Transaction form state
  const [txType, setTxType] = useState<"income" | "expense">("income");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txDialogOpen, setTxDialogOpen] = useState(false);

  // Event form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventDateObj, setEventDateObj] = useState<Date>();
  const [eventEndDateObj, setEventEndDateObj] = useState<Date>();
  const [eventTime, setEventTime] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [eventType, setEventType] = useState("kajian");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventSpeaker, setEventSpeaker] = useState("");
  const [eventTopic, setEventTopic] = useState("");
  const [eventTotalSessions, setEventTotalSessions] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // View booking dialog
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);

  // View event detail dialog
  const [viewEvent, setViewEvent] = useState<Event | null>(null);

  // Delete confirmation dialogs
  const [deleteReservationId, setDeleteReservationId] = useState<string | null>(null);
  const [deleteTransactionId, setDeleteTransactionId] = useState<string | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);

      const [reservationsRes, transactionsRes, activitiesRes] = await Promise.all([
        supabase.from("reservations").select("*").order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("activities").select("*").eq("is_active", true).order("event_date", { ascending: true }),
      ]);

      if (reservationsRes.data) setBookings(reservationsRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
      if (activitiesRes.data) setEvents(activitiesRes.data);

      // Build booked slots for time validation
      const slots: BookedSlot[] = [];
      if (reservationsRes.data) {
        reservationsRes.data
          .filter((r) => r.status === "approved")
          .forEach((r) => {
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

      setIsLoadingData(false);
    };

    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin-login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/admin-login");
    toast({ title: "Logout Berhasil" });
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq("id", id);

    if (error) {
      toast({ title: "Gagal menyetujui", variant: "destructive" });
      return;
    }

    setBookings(bookings.map((b) => (b.id === id ? { ...b, status: "approved" } : b)));
    toast({ title: "Reservasi Disetujui", description: "Notifikasi telah dikirim ke pemohon" });
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
      .eq("id", id);

    if (error) {
      toast({ title: "Gagal menolak", variant: "destructive" });
      return;
    }

    setBookings(bookings.map((b) => (b.id === id ? { ...b, status: "rejected" } : b)));
    toast({ title: "Reservasi Ditolak", variant: "destructive" });
  };

  const handleDeleteReservation = async (id: string) => {
    const { error } = await supabase
      .from("reservations")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Gagal menghapus", variant: "destructive" });
      return;
    }

    setBookings(bookings.filter((b) => b.id !== id));
    toast({ title: "Reservasi Dihapus" });
  };

  const handleDeleteEvent = async (id: string) => {
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Gagal menghapus kegiatan", variant: "destructive" });
      return;
    }

    setEvents(events.filter((e) => e.id !== id));
    setBookedSlots(bookedSlots.filter((s) => {
      const event = events.find((e) => e.id === id);
      return !(event && s.date === event.event_date && s.startTime === event.event_time);
    }));
    toast({ title: "Kegiatan Dihapus" });
  };

  // Helper to check if event is past
  const isEventPast = (eventDate: string, eventEndTime: string | null) => {
    const now = new Date();
    const eventDateObj = new Date(eventDate);
    
    if (eventDateObj.toDateString() === now.toDateString()) {
      // Same day - check time
      if (eventEndTime) {
        const [hours, minutes] = eventEndTime.split(":").map(Number);
        const endTime = new Date(eventDateObj);
        endTime.setHours(hours, minutes, 0, 0);
        return now > endTime;
      }
      return false;
    }
    
    return eventDateObj < now;
  };

  const handleAddTransaction = async () => {
    if (!txAmount || !txDescription) {
      toast({ title: "Lengkapi semua field", variant: "destructive" });
      return;
    }

    // Remove thousand separators before parsing
    const numericAmount = parseInt(txAmount.replace(/\./g, ""));
    
    const { data, error } = await supabase.from("transactions").insert({
      type: txType,
      amount: numericAmount,
      description: txDescription,
      created_by: user?.id,
    }).select().single();

    if (error) {
      toast({ title: "Gagal menambahkan transaksi", variant: "destructive" });
      return;
    }

    setTransactions([data, ...transactions]);
    setTxAmount("");
    setTxDescription("");
    setTxDialogOpen(false);
    toast({ title: "Transaksi Ditambahkan" });
  };

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Gagal menghapus transaksi", variant: "destructive" });
      return;
    }

    setTransactions(transactions.filter((t) => t.id !== id));
    setDeleteTransactionId(null);
    toast({ title: "Transaksi Dihapus" });
  };

  const resetEventForm = () => {
    setEventTitle("");
    setEventDateObj(undefined);
    setEventEndDateObj(undefined);
    setEventTime("");
    setEventEndTime("");
    setEventType("kajian");
    setEventDescription("");
    setEventSpeaker("");
    setEventTopic("");
    setEventTotalSessions("");
    setEditingEventId(null);
  };

  const openEditDialog = (event: Event) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventDateObj(new Date(event.event_date + "T00:00:00"));
    setEventEndDateObj(event.event_end_date ? new Date(event.event_end_date + "T00:00:00") : undefined);
    setEventTime(event.event_time || "");
    setEventEndTime(event.event_end_time || "");
    setEventType(event.type);
    setEventDescription(event.description || "");
    setEventSpeaker(event.speaker_name || "");
    setEventTopic(event.topic || "");
    setEventTotalSessions(event.total_sessions?.toString() || "");
    setEventDialogOpen(true);
  };

  const handleAddEvent = async () => {
    if (!eventTitle || !eventDateObj || !eventDescription) {
      toast({ title: "Lengkapi semua field (Keterangan Kegiatan wajib diisi)", variant: "destructive" });
      return;
    }

    if (SPEAKER_REQUIRED_TYPES.includes(eventType) && (!eventSpeaker || !eventTopic)) {
      toast({ title: "Lengkapi Nama Pemateri dan Materi", variant: "destructive" });
      return;
    }

    if (eventType === "daurah" && (!eventTotalSessions || parseInt(eventTotalSessions) < 1)) {
      toast({ title: "Jumlah sesi minimal 1", variant: "destructive" });
      return;
    }

    if (eventEndDateObj && !isRangeFree(bookedSlots, eventDateObj, eventEndDateObj)) {
      toast({
        title: "Jadwal Bentrok",
        description: "Ada tanggal pada rentang yang dipilih yang sudah terpakai",
        variant: "destructive",
      });
      return;
    }

    const eventDateStr = format(eventDateObj, "yyyy-MM-dd");
    const eventEndDateStr = eventEndDateObj ? format(eventEndDateObj, "yyyy-MM-dd") : null;

    if (editingEventId) {
      const { data, error } = await supabase
        .from("activities")
        .update({
          title: eventTitle,
          event_date: eventDateStr,
          event_end_date: eventEndDateStr,
          event_time: eventTime || null,
          event_end_time: eventEndTime || null,
          type: eventType,
          description: eventDescription || null,
          speaker_name: SPEAKER_TOPIC_TYPES.includes(eventType) ? eventSpeaker || null : null,
          topic: SPEAKER_TOPIC_TYPES.includes(eventType) ? eventTopic || null : null,
          total_sessions: eventType === "daurah" ? parseInt(eventTotalSessions) || null : null,
        })
        .eq("id", editingEventId)
        .select()
        .single();

      if (error) {
        toast({ title: "Gagal mengupdate kegiatan", description: error.message, variant: "destructive" });
        return;
      }

      setEvents(events.map((e) => (e.id === editingEventId ? data : e)));
      resetEventForm();
      setEventDialogOpen(false);
      toast({ title: "Kegiatan Diperbarui" });
    } else {
      const { data, error } = await supabase.from("activities").insert({
        title: eventTitle,
        event_date: eventDateStr,
        event_end_date: eventEndDateStr,
        event_time: eventTime || null,
        event_end_time: eventEndTime || null,
        type: eventType,
        description: eventDescription || null,
        created_by: user?.id,
        speaker_name: SPEAKER_TOPIC_TYPES.includes(eventType) ? eventSpeaker || null : null,
        topic: SPEAKER_TOPIC_TYPES.includes(eventType) ? eventTopic || null : null,
        total_sessions: eventType === "daurah" ? parseInt(eventTotalSessions) || null : null,
      }).select().single();

      if (error) {
        toast({ title: "Gagal menambahkan kegiatan", description: error.message, variant: "destructive" });
        return;
      }

      setEvents([data, ...events]);
      resetEventForm();
      setEventDialogOpen(false);
      toast({ title: "Kegiatan Ditambahkan" });

      if (eventTime || eventEndDateStr) {
        setBookedSlots((prev) => [
          ...prev,
          { date: eventDateStr, endDate: eventEndDateStr, startTime: eventTime, endTime: eventEndTime || null },
        ]);
      }
    }
  };

  const pendingBookings = bookings.filter((b) => b.status === "pending");

  const eventIsMultiDay = !!eventEndDateObj;
  const fullyBlocked = useMemo(() => getFullyBlockedDates(bookedSlots), [bookedSlots]);

  // Get available end times for events
  const availableEventEndTimes = useMemo(() => {
    if (!eventDateObj || !eventTime) return [];
    // Multi-day: end time is on the last day, so any time is valid.
    if (eventIsMultiDay) return timeOptions;
    const startIndex = timeOptions.indexOf(eventTime);
    return timeOptions.slice(startIndex + 1).filter((t) => {
      for (let i = startIndex + 1; i <= timeOptions.indexOf(t); i++) {
        if (isTimeBooked(bookedSlots, eventDateObj, timeOptions[i], fullyBlocked)) return false;
      }
      return true;
    });
  }, [eventDateObj, eventTime, eventIsMultiDay, bookedSlots, fullyBlocked]);

  // Show loading while checking auth (must be after all hooks)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="w-16 h-16 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
            <p className="text-muted-foreground mb-4">
              Anda tidak memiliki izin untuk mengakses halaman admin.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/")}> 
                Kembali ke Beranda
              </Button>
              <Button variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter data based on search term
  const filteredBookings = bookings.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.activity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.phone.includes(searchTerm)
  );

  const filteredTransactions = transactions.filter((t) =>
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEvents = events.filter((e) =>
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    {
      id: "saldo",
      title: "Total Saldo",
      value: formatCurrency(totalIncome - totalExpense),
      icon: Wallet,
    },
    {
      id: "pemasukan",
      title: "Total Pemasukan",
      value: formatCurrency(totalIncome),
      icon: TrendingUp,
    },
    {
      id: "pengeluaran",
      title: "Total Pengeluaran",
      value: formatCurrency(totalExpense),
      icon: TrendingDown,
    },
    {
      id: "kegiatan",
      title: "Kegiatan Bulan Ini",
      value: events.length.toString(),
      icon: CalendarDays,
    },
    {
      id: "reservasi",
      title: "Reservasi Pending",
      value: pendingBookings.length.toString(),
      icon: Clock,
    },
  ];

  const incomeTransactions = transactions.filter((t) => t.type === "income");
  const expenseTransactions = transactions.filter((t) => t.type === "expense");

  const renderStatDialogContent = (statId: string) => {
    switch (statId) {
      case "saldo":
        return (
          <div className="space-y-4">
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Saldo Saat Ini</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(totalIncome - totalExpense)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Pemasukan</p>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                <p className="text-lg font-semibold text-red-600">{formatCurrency(totalExpense)}</p>
              </div>
            </div>
          </div>
        );
      case "pemasukan":
        return (
          <div className="space-y-3">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Pemasukan</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {incomeTransactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <p className="font-semibold text-green-600">{formatCurrency(tx.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "pengeluaran":
        return (
          <div className="space-y-3">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
              <p className="text-3xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {expenseTransactions.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <p className="font-semibold text-red-600">{formatCurrency(tx.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      case "reservasi":
        return (
          <div className="space-y-3">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Reservasi Pending</p>
              <p className="text-3xl font-bold text-yellow-600">{pendingBookings.length}</p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pendingBookings.length > 0 ? pendingBookings.map((booking) => (
                <div key={booking.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{booking.name}</p>
                      <p className="text-xs text-muted-foreground">{getActivityTypeLabel(booking.activity_type)}</p>
                    </div>
                    <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateRange(booking.reservation_date, booking.reservation_end_date)} • {booking.reservation_time}
                  </p>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-4">Tidak ada reservasi pending</p>
              )}
            </div>
          </div>
        );
      case "kegiatan":
        return (
          <div className="space-y-3">
            <div className="text-center p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Kegiatan Bulan Ini</p>
              <p className="text-3xl font-bold text-primary">{events.length}</p>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {events.length > 0 ? events.map((event) => (
                <div key={event.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    </div>
                    <Badge variant="outline">{getActivityTypeLabel(event.type)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateRange(event.event_date, event.event_end_date)} • {event.event_time}
                  </p>
                </div>
              )) : (
                <p className="text-center text-muted-foreground py-4">Tidak ada kegiatan bulan ini</p>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Kembali
                </Button>
              </Link>
              <div className="h-8 w-px bg-border" />
              <div>
                <h1 className="font-bold text-foreground">Admin</h1>
                <p className="text-xs text-muted-foreground">MASDIK IQIS</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden">
            <div className="flex items-center justify-between">
              <Link to="/">
                <Button variant="ghost" size="sm" className="px-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="text-center">
                <h1 className="font-bold text-foreground text-sm">Admin</h1>
                <p className="text-xs text-muted-foreground">MASDIK IQIS</p>
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="px-2"
                  onClick={() => setShowMobileSearch(!showMobileSearch)}
                >
                  <Search className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="px-2" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {showMobileSearch && (
              <div className="mt-3">
                <Input
                  placeholder="Cari..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
              {stats.map((stat, index) => (
                <Dialog key={index} open={statDialogOpen === stat.id} onOpenChange={(open) => setStatDialogOpen(open ? stat.id : null)}>
                  <DialogTrigger asChild>
                    <Card className="border-0 shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
                      <CardContent className="p-4 md:p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm text-muted-foreground mb-1 truncate">{stat.title}</p>
                            <p className="text-lg md:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                          </div>
                          <div className="w-10 h-10 md:w-12 md:h-12 gradient-islamic rounded-xl flex items-center justify-center shrink-0 ml-2">
                            <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <stat.icon className="w-5 h-5" />
                        {stat.title}
                      </DialogTitle>
                    </DialogHeader>
                    {renderStatDialogContent(stat.id)}
                  </DialogContent>
                </Dialog>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="reservations" className="space-y-4 md:space-y-6">
              <TabsList className="bg-card shadow-lg w-full md:w-auto overflow-x-auto">
                <TabsTrigger value="reservations" className="gap-1 md:gap-2 text-xs md:text-sm">
                  <FileText className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Reservasi</span>
                  <span className="sm:hidden">Rsv</span>
                </TabsTrigger>
                <TabsTrigger value="transactions" className="gap-1 md:gap-2 text-xs md:text-sm">
                  <Wallet className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Transaksi</span>
                  <span className="sm:hidden">Trx</span>
                </TabsTrigger>
                <TabsTrigger value="events" className="gap-1 md:gap-2 text-xs md:text-sm">
                  <CalendarDays className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Kegiatan</span>
                  <span className="sm:hidden">Keg</span>
                </TabsTrigger>
                <TabsTrigger value="pustaka" className="gap-1 md:gap-2 text-xs md:text-sm">
                  <BookOpen className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Pustaka</span>
                  <span className="sm:hidden">Pst</span>
                </TabsTrigger>
              </TabsList>

              {/* Reservations Tab */}
              <TabsContent value="reservations">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base md:text-lg">Daftar Reservasi</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nama</TableHead>
                          <TableHead className="hidden md:table-cell">Telepon</TableHead>
                          <TableHead>Kegiatan</TableHead>
                          <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBookings.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              {searchTerm ? "Tidak ada reservasi yang cocok" : "Belum ada reservasi"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredBookings.map((booking) => (
                            <TableRow key={booking.id}>
                              <TableCell className="font-medium text-sm">{booking.name}</TableCell>
                              <TableCell className="hidden md:table-cell text-sm">{booking.phone}</TableCell>
                              <TableCell className="text-sm">{getActivityTypeLabel(booking.activity_type)}</TableCell>
                              <TableCell className="hidden sm:table-cell text-sm">{formatDateRange(booking.reservation_date, booking.reservation_end_date)}</TableCell>
                              <TableCell>
                                <Badge className={cn(statusColors[booking.status] || statusColors.pending, "text-xs")}>
                                  {statusLabels[booking.status] || booking.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 md:gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setViewBooking(booking)}
                                        className="px-2"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Detail Reservasi</DialogTitle>
                                      </DialogHeader>
                                      {viewBooking && (
                                        <div className="space-y-4">
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Nama</Label>
                                              <p className="font-medium">{viewBooking.name}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Telepon</Label>
                                              <p className="font-medium">{viewBooking.phone}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Email</Label>
                                              <p className="font-medium">{viewBooking.email || "-"}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Kegiatan</Label>
                                              <p className="font-medium">{getActivityTypeLabel(viewBooking.activity_type)}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Tanggal</Label>
                                              <p className="font-medium">{formatDateRange(viewBooking.reservation_date, viewBooking.reservation_end_date)}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Waktu</Label>
                                              <p className="font-medium">
                                                {viewBooking.reservation_time}
                                                {viewBooking.reservation_end_time && ` - ${viewBooking.reservation_end_time}`}
                                              </p>
                                            </div>
                                          </div>
                                          <div>
                                            <Label className="text-muted-foreground text-xs">Keterangan</Label>
                                            <p className="font-medium">{viewBooking.description || "-"}</p>
                                          </div>
                                          <div>
                                            <Label className="text-muted-foreground text-xs">Status</Label>
                                            <Badge className={statusColors[viewBooking.status] || statusColors.pending}>
                                              {statusLabels[viewBooking.status] || viewBooking.status}
                                            </Badge>
                                          </div>
                                        </div>
                                      )}
                                    </DialogContent>
                                  </Dialog>
                                  {booking.status === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-primary hover:text-primary px-2"
                                        onClick={() => handleApprove(booking.id)}
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive hover:text-destructive px-2"
                                        onClick={() => handleReject(booking.id)}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                  {(booking.status === "rejected" || booking.status === "approved") && (
                                    <Dialog open={deleteReservationId === booking.id} onOpenChange={(open) => setDeleteReservationId(open ? booking.id : null)}>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive hover:text-destructive px-2"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Hapus Reservasi</DialogTitle>
                                          <DialogDescription>
                                            Apakah Anda yakin ingin menghapus reservasi dari "{booking.name}"? Tindakan ini tidak dapat dibatalkan.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter className="gap-2 sm:gap-0">
                                          <Button variant="outline" onClick={() => setDeleteReservationId(null)}>
                                            Batal
                                          </Button>
                                          <Button 
                                            variant="destructive" 
                                            onClick={() => {
                                              handleDeleteReservation(booking.id);
                                              setDeleteReservationId(null);
                                            }}
                                          >
                                            Hapus
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base md:text-lg">Daftar Transaksi</CardTitle>
                    <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1">
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Tambah</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Tambah Transaksi</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Tipe Transaksi</Label>
                            <Select value={txType} onValueChange={(v: "income" | "expense") => setTxType(v)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Pemasukan</SelectItem>
                                <SelectItem value="expense">Pengeluaran</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Jumlah (Rp)</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={txAmount}
                              onChange={(e) => {
                                // Remove all non-numeric characters
                                const numericValue = e.target.value.replace(/\D/g, "");
                                // Format with thousand separators
                                const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                setTxAmount(formattedValue);
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Deskripsi</Label>
                            <Input
                              placeholder="Deskripsi transaksi"
                              value={txDescription}
                              onChange={(e) => setTxDescription(e.target.value)}
                            />
                          </div>
                          <Button onClick={handleAddTransaction} className="w-full">
                            Simpan Transaksi
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {searchTerm ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTransactions.map((tx) => (
                            <TableRow key={tx.id}>
                              <TableCell className="text-sm">{new Date(tx.created_at).toLocaleDateString("id-ID")}</TableCell>
                              <TableCell className="font-medium text-sm">{tx.description}</TableCell>
                              <TableCell>
                                <Badge className={tx.type === "income" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                  {tx.type === "income" ? "Masuk" : "Keluar"}
                                </Badge>
                              </TableCell>
                              <TableCell className={cn("text-right font-semibold text-sm", tx.type === "income" ? "text-green-600" : "text-red-600")}>
                                {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                              </TableCell>
                              <TableCell>
                                <Dialog open={deleteTransactionId === tx.id} onOpenChange={(open) => setDeleteTransactionId(open ? tx.id : null)}>
                                  <DialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive hover:text-destructive px-2"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Hapus Transaksi</DialogTitle>
                                      <DialogDescription>
                                        Apakah Anda yakin ingin menghapus transaksi "{tx.description}"? Tindakan ini tidak dapat dibatalkan.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter className="gap-2 sm:gap-0">
                                      <Button variant="outline" onClick={() => setDeleteTransactionId(null)}>
                                        Batal
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={() => handleDeleteTransaction(tx.id)}
                                      >
                                        Hapus
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Events Tab */}
              <TabsContent value="events">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base md:text-lg">Daftar Kegiatan</CardTitle>
                    <Dialog open={eventDialogOpen} onOpenChange={(open) => { if (!open) { resetEventForm(); } setEventDialogOpen(open); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-1">
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Tambah</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{editingEventId ? "Edit Kegiatan" : "Tambah Kegiatan"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Judul Kegiatan</Label>
                            <Input
                              placeholder="Judul kegiatan"
                              value={eventTitle}
                              onChange={(e) => setEventTitle(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Tanggal Mulai</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !eventDateObj && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {eventDateObj
                                      ? format(eventDateObj, "PPP", { locale: idLocale })
                                      : "Pilih tanggal"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={eventDateObj}
                                    onSelect={(newDate) => {
                                      setEventDateObj(newDate);
                                      if (eventEndDateObj && newDate && eventEndDateObj <= newDate) setEventEndDateObj(undefined);
                                      setEventTime("");
                                      setEventEndTime("");
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
                                  <div className="p-3 border-t border-border">
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 bg-destructive/20 rounded" />
                                        <span>Penuh</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 bg-amber-100 rounded" />
                                        <span>Ada kegiatan</span>
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
                            <div className="space-y-2">
                              <Label>Tanggal Selesai <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    disabled={!eventDateObj}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !eventEndDateObj && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {eventEndDateObj
                                      ? format(eventEndDateObj, "PPP", { locale: idLocale })
                                      : "Sehari saja"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={eventEndDateObj}
                                    onSelect={(newDate) => {
                                      setEventEndDateObj(newDate);
                                      setEventEndTime("");
                                    }}
                                    disabled={(day) =>
                                      !eventDateObj ||
                                      day <= eventDateObj ||
                                      !isRangeFree(bookedSlots, eventDateObj, day)
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
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>{eventIsMultiDay ? "Waktu Mulai (hari pertama)" : "Waktu Mulai"}</Label>
                              <Select
                                value={eventTime}
                                onValueChange={(v) => {
                                  setEventTime(v);
                                  setEventEndTime("");
                                }}
                                disabled={!eventDateObj}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih jam" />
                                </SelectTrigger>
                                <SelectContent>
                                  {timeOptions.map((t) => {
                                    const isBooked = !eventIsMultiDay && eventDateObj
                                      ? isTimeBooked(bookedSlots, eventDateObj, t, fullyBlocked)
                                      : false;
                                    return (
                                      <SelectItem key={t} value={t} disabled={isBooked}>
                                        {t} {isBooked && "(Sudah terpakai)"}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{eventIsMultiDay ? "Waktu Selesai (hari terakhir)" : "Waktu Selesai"}</Label>
                              <Select
                                value={eventEndTime}
                                onValueChange={setEventEndTime}
                                disabled={!eventTime}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih jam" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableEventEndTimes.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Tipe Kegiatan</Label>
                            <Select value={eventType} onValueChange={(v) => { setEventType(v); setEventSpeaker(""); setEventTopic(""); setEventTotalSessions(""); }}>
                              <SelectTrigger>
                                <SelectValue />
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
                          {SPEAKER_TOPIC_TYPES.includes(eventType) && (
                            <>
                              <div className="space-y-2">
                                <Label>
                                  Nama Pemateri / Narasumber
                                  {SPEAKER_REQUIRED_TYPES.includes(eventType) && <span className="text-destructive"> *</span>}
                                </Label>
                                <Input
                                  placeholder="Nama pemateri"
                                  value={eventSpeaker}
                                  onChange={(e) => setEventSpeaker(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>
                                  {eventType === "tudung_sipulung" ? "Tema" : "Materi"}
                                  {SPEAKER_REQUIRED_TYPES.includes(eventType) && <span className="text-destructive"> *</span>}
                                </Label>
                                <Input
                                  placeholder={eventType === "tudung_sipulung" ? "Tema kegiatan" : "Judul materi"}
                                  value={eventTopic}
                                  onChange={(e) => setEventTopic(e.target.value)}
                                />
                              </div>
                            </>
                          )}
                          {eventType === "daurah" && (
                            <div className="space-y-2">
                              <Label>Jumlah Sesi <span className="text-destructive">*</span></Label>
                              <Input
                                type="number"
                                min="1"
                                placeholder="Jumlah sesi"
                                value={eventTotalSessions}
                                onChange={(e) => setEventTotalSessions(e.target.value)}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Keterangan Kegiatan <span className="text-destructive">*</span></Label>
                            <Textarea
                              placeholder="Keterangan kegiatan (wajib diisi)"
                              value={eventDescription}
                              onChange={(e) => setEventDescription(e.target.value)}
                              required
                            />
                          </div>
                          <Button onClick={handleAddEvent} className="w-full">
                            Simpan Kegiatan
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Judul</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvents.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              {searchTerm ? "Tidak ada kegiatan yang cocok" : "Belum ada kegiatan"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredEvents.map((event) => (
                              <TableRow key={event.id}>
                                <TableCell className="font-medium text-sm">{event.title}</TableCell>
                                <TableCell className="text-sm">{formatDateRange(event.event_date, event.event_end_date)}</TableCell>
                                <TableCell className="text-sm">
                                  {event.event_time || "-"}
                                  {event.event_end_time && ` - ${event.event_end_time}`}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{getActivityTypeLabel(event.type)}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {/* Kelola Absensi Button */}
                                    {ATTENDANCE_TYPES.includes(event.type) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="px-2 text-primary"
                                        onClick={() => navigate(`/admin/absensi/${event.id}`)}
                                        title="Kelola Absensi"
                                      >
                                        <ClipboardList className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {/* Edit Button */}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="px-2 text-blue-600 hover:text-blue-700"
                                      onClick={() => openEditDialog(event)}
                                      title="Edit Kegiatan"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    {/* View Detail Button */}
                                    <Dialog open={viewEvent?.id === event.id} onOpenChange={(open) => setViewEvent(open ? event : null)}>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="px-2"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Detail Kegiatan</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div>
                                            <Label className="text-muted-foreground text-xs">Judul Kegiatan</Label>
                                            <p className="font-medium">{event.title}</p>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Tanggal</Label>
                                              <p className="font-medium">{formatDateRange(event.event_date, event.event_end_date)}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Waktu</Label>
                                              <p className="font-medium">
                                                {event.event_time || "-"}
                                                {event.event_end_time && ` - ${event.event_end_time}`}
                                              </p>
                                            </div>
                                          </div>
                                          <div>
                                            <Label className="text-muted-foreground text-xs">Tipe Kegiatan</Label>
                                            <p><Badge variant="outline">{getActivityTypeLabel(event.type)}</Badge></p>
                                          </div>
                                          {event.speaker_name && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Pemateri</Label>
                                              <p className="font-medium">{event.speaker_name}</p>
                                            </div>
                                          )}
                                          {event.topic && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Materi</Label>
                                              <p className="font-medium">{event.topic}</p>
                                            </div>
                                          )}
                                          {event.total_sessions && (
                                            <div>
                                              <Label className="text-muted-foreground text-xs">Jumlah Sesi</Label>
                                              <p className="font-medium">{event.total_sessions} sesi</p>
                                            </div>
                                          )}
                                          <div>
                                            <Label className="text-muted-foreground text-xs">Keterangan</Label>
                                            <p className="font-medium whitespace-pre-wrap">{event.description || "-"}</p>
                                          </div>
                                        </div>
                                        <DialogFooter>
                                          <Button variant="outline" onClick={() => setViewEvent(null)}>
                                            Tutup
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                    
                                    {/* Delete Button */}
                                    <Dialog open={deleteEventId === event.id} onOpenChange={(open) => setDeleteEventId(open ? event.id : null)}>
                                      <DialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-destructive hover:text-destructive px-2"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Hapus Kegiatan</DialogTitle>
                                          <DialogDescription>
                                            Apakah Anda yakin ingin menghapus kegiatan "{event.title}"? Tindakan ini tidak dapat dibatalkan.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter className="gap-2 sm:gap-0">
                                          <Button variant="outline" onClick={() => setDeleteEventId(null)}>
                                            Batal
                                          </Button>
                                          <Button 
                                            variant="destructive" 
                                            onClick={() => {
                                              handleDeleteEvent(event.id);
                                              setDeleteEventId(null);
                                            }}
                                          >
                                            Hapus
                                          </Button>
                                        </DialogFooter>
                                      </DialogContent>
                                    </Dialog>
                                  </div>
                                </TableCell>
                              </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Pustaka Tab */}
              <TabsContent value="pustaka">
                <PustakaManager userId={user?.id} searchTerm={searchTerm} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
