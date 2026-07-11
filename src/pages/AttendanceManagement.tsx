import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, QrCode, Download, RefreshCw, Users, UserCheck, UserX,
  TrendingUp, Loader2, Trash2, BarChart3, Search, Filter, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface Activity {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  event_end_time: string | null;
  type: string;
  description: string | null;
  speaker_name: string | null;
  topic: string | null;
  total_sessions: number | null;
}

interface AttendanceSession {
  id: string;
  activity_id: string;
  session_number: number | null;
  session_label: string | null;
  qr_token: string;
  scan_type: string;
  is_active: boolean;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  activity_id: string;
  participant_name: string;
  feedback: string;
  instansi: string | null;
  phone_number: string | null;
  device_fingerprint: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

const BASE_URL = "https://masdik.iqis.sch.id";

const chartConfig = {
  kedatangan: { label: "Kedatangan", color: "hsl(var(--primary))" },
  selesai: { label: "Selesai", color: "hsl(var(--accent))" },
  gap: { label: "Tidak Selesai", color: "hsl(var(--destructive))" },
};

// Warna untuk chart instansi (palette 20 warna)
const INSTANSI_COLORS = [
  "#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed",
  "#db2777", "#0891b2", "#65a30d", "#ea580c", "#6d28d9",
  "#0d9488", "#b45309", "#be185d", "#1d4ed8", "#15803d",
  "#9333ea", "#c2410c", "#0369a1", "#4d7c0f", "#7e22ce",
];

export default function AttendanceManagement() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedQR, setSelectedQR] = useState<AttendanceSession | null>(null);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState("");
  const [filterInstansi, setFilterInstansi] = useState<string>("all");
  const qrRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!activityId) return;
    setIsLoading(true);

    const [actRes, sessRes, recRes] = await Promise.all([
      supabase.from("activities").select("*").eq("id", activityId).single(),
      supabase.from("attendance_sessions").select("*").eq("activity_id", activityId).order("session_number", { ascending: true }),
      supabase.from("attendance_records").select("*").eq("activity_id", activityId).order("created_at", { ascending: false }),
    ]);

    if (actRes.data) setActivity(actRes.data as Activity);
    if (sessRes.data) setSessions(sessRes.data as AttendanceSession[]);
    if (recRes.data) setRecords(recRes.data as AttendanceRecord[]);
    setIsLoading(false);
  }, [activityId]);

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin, fetchData]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/admin-login", { replace: true });
  }, [user, isAdmin, authLoading, navigate]);

  const generateToken = () => {
    return crypto.randomUUID().replace(/-/g, "").substring(0, 16);
  };

  const handleGenerateQR = async () => {
    if (!activity) return;
    setGenerating(true);

    try {
      const newSessions: { activity_id: string; session_number: number | null; session_label: string; qr_token: string; scan_type: string }[] = [];

      if (activity.type === "daurah" && activity.total_sessions) {
        for (let i = 1; i <= activity.total_sessions; i++) {
          let scanType = "session";
          if (i === 1) scanType = "arrival";
          if (i === activity.total_sessions) scanType = "completion";

          newSessions.push({
            activity_id: activity.id,
            session_number: i,
            session_label: `Sesi ${i}${i === 1 ? " (Kedatangan)" : i === activity.total_sessions ? " (Penutupan)" : ""}`,
            qr_token: generateToken(),
            scan_type: scanType,
          });
        }
      } else if (activity.type === "tudung_sipulung") {
        // Tudung Sipulung: hanya 1 QR untuk kehadiran
        newSessions.push({
          activity_id: activity.id,
          session_number: 1,
          session_label: "Hadir",
          qr_token: generateToken(),
          scan_type: "arrival",
        });
      } else {
        // Kajian/Rapat: 1 QR for arrival, 1 QR for completion
        newSessions.push({
          activity_id: activity.id,
          session_number: 1,
          session_label: "Kedatangan",
          qr_token: generateToken(),
          scan_type: "arrival",
        });
        newSessions.push({
          activity_id: activity.id,
          session_number: 2,
          session_label: "Selesai",
          qr_token: generateToken(),
          scan_type: "completion",
        });
      }

      const { data, error } = await supabase.from("attendance_sessions").insert(newSessions).select();
      if (error) throw error;
      if (data) setSessions(data as AttendanceSession[]);
      toast({ title: "QR Code berhasil di-generate!" });
    } catch {
      toast({ title: "Gagal generate QR", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleRegenerateQR = async (sessionId: string) => {
    const newToken = generateToken();
    const { error } = await supabase
      .from("attendance_sessions")
      .update({ qr_token: newToken, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) {
      toast({ title: "Gagal perbarui QR", variant: "destructive" });
      return;
    }
    setSessions(sessions.map((s) => (s.id === sessionId ? { ...s, qr_token: newToken } : s)));
    toast({ title: "QR Code diperbarui!" });
  };

  const handleDownloadQR = (session: AttendanceSession) => {
    const svg = document.getElementById(`qr-${session.id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = `qr-${session.session_label?.replace(/\s/g, "-") || session.qr_token}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleDeleteRecord = async (id: string) => {
    const { error } = await supabase.from("attendance_records").delete().eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", variant: "destructive" });
      return;
    }
    setRecords(records.filter((r) => r.id !== id));
    setDeleteRecordId(null);
    toast({ title: "Data absensi dihapus" });
  };

  const handleExportCSV = async () => {
    if (records.length === 0) {
      toast({ title: "Tidak ada data untuk diekspor", variant: "destructive" });
      return;
    }

    const XLSX = await import("xlsx");
    const isTudung = activity?.type === "tudung_sipulung";
    const headers = isTudung
      ? ["Nama", "No. Telepon", "Instansi", "Waktu", "Latitude", "Longitude"]
      : ["Nama", "No. Telepon", "Sesi", "Feedback", "Waktu", "Latitude", "Longitude"];
    const data = records.map((r) => {
      const session = sessions.find((s) => s.id === r.session_id);
      const waktu = format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: idLocale });
      if (isTudung) {
        return [
          r.participant_name,
          r.phone_number || "-",
          r.instansi || "-",
          waktu,
          r.latitude ?? "-",
          r.longitude ?? "-",
        ];
      }
      return [
        r.participant_name,
        r.phone_number || "-",
        session?.session_label || "-",
        r.feedback,
        waktu,
        r.latitude ?? "-",
        r.longitude ?? "-",
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `absensi-${activity?.title?.replace(/\s/g, "-") || "export"}.xlsx`);
    toast({ title: "Excel berhasil diunduh!" });
  };

  // Statistics
  const arrivalSession = sessions.find((s) => s.scan_type === "arrival");
  const completionSession = sessions.find((s) => s.scan_type === "completion");
  const arrivalCount = arrivalSession ? records.filter((r) => r.session_id === arrivalSession.id).length : 0;
  const completionCount = completionSession ? records.filter((r) => r.session_id === completionSession.id).length : 0;
  const gapCount = arrivalCount - completionCount;
  const totalRecords = records.length;

  const barData = sessions.map((s) => ({
    name: s.session_label || `Sesi ${s.session_number}`,
    peserta: records.filter((r) => r.session_id === s.id).length,
  }));

  const pieData = [
    { name: "Selesai", value: completionCount, fill: "hsl(var(--primary))" },
    { name: "Tidak Selesai", value: Math.max(0, gapCount), fill: "hsl(var(--destructive))" },
  ].filter((d) => d.value > 0);

  // Data chart & filter untuk Tudung Sipulung
  const instansiCountMap: Record<string, number> = {};
  records.forEach((r) => {
    const key = r.instansi || "Tidak diisi";
    instansiCountMap[key] = (instansiCountMap[key] || 0) + 1;
  });
  const instansiChartData = Object.entries(instansiCountMap)
    .map(([name, jumlah]) => ({ name, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah);
  const uniqueInstansi = instansiChartData.map((d) => d.name);

  // Filtered records berdasarkan search nama + filter instansi
  const filteredRecords = records.filter((r) => {
    const matchName = r.participant_name.toLowerCase().includes(searchName.toLowerCase());
    const matchInstansi =
      filterInstansi === "all" || r.instansi === filterInstansi ||
      (filterInstansi === "Tidak diisi" && !r.instansi);
    return matchName && matchInstansi;
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">Kegiatan tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-foreground truncate">Kelola Absensi</h1>
            <p className="text-xs text-muted-foreground truncate">{activity.title}</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-primary border-primary"
            onClick={() => window.open(`/dashboard/${activityId}`, "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Dashboard Publik</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Activity Info */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tipe</p>
                <Badge variant="outline" className="mt-1">{activity.type}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tanggal</p>
                <p className="font-medium text-sm">{activity.event_date}</p>
              </div>
              {activity.speaker_name && (
                <div>
                  <p className="text-xs text-muted-foreground">Pemateri</p>
                  <p className="font-medium text-sm">{activity.speaker_name}</p>
                </div>
              )}
              {activity.topic && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {activity.type === "tudung_sipulung" ? "Tema" : "Materi"}
                  </p>
                  <p className="font-medium text-sm">{activity.topic}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Statistics */}
        {records.length > 0 && (
          <div className={`grid gap-3 ${activity?.type === "tudung_sipulung" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-islamic flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {activity?.type === "tudung_sipulung" ? "Total Hadir" : "Total Absen"}
                  </p>
                  <p className="text-xl font-bold">{totalRecords}</p>
                </div>
              </CardContent>
            </Card>
            {activity?.type !== "tudung_sipulung" && (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kedatangan</p>
                  <p className="text-xl font-bold">{arrivalCount}</p>
                </div>
              </CardContent>
            </Card>
            )}
            {activity?.type !== "tudung_sipulung" && (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Selesai</p>
                  <p className="text-xl font-bold">{completionCount}</p>
                </div>
              </CardContent>
            </Card>
            )}
            {activity?.type !== "tudung_sipulung" && (
            <Card className="border-0 shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <UserX className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gap</p>
                  <p className="text-xl font-bold">{Math.max(0, gapCount)}</p>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        )}

        {/* Charts — tidak ditampilkan untuk tudung_sipulung */}
        {records.length > 0 && activity?.type !== "tudung_sipulung" && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Peserta per Sesi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="peserta" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Rasio Kedatangan vs Selesai
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                {pieData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">Belum ada data</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Instansi — hanya untuk tudung_sipulung */}
        {records.length > 0 && activity?.type === "tudung_sipulung" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pie chart distribusi instansi */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Distribusi Instansi
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <Pie
                      data={instansiChartData}
                      dataKey="jumlah"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) =>
                        `${name.length > 12 ? name.slice(0, 12) + "…" : name} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {instansiChartData.map((_, i) => (
                        <Cell key={i} fill={INSTANSI_COLORS[i % INSTANSI_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [value + " peserta", name]}
                    />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Bar chart horizontal per instansi */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Jumlah Peserta per Instansi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart
                    data={instansiChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      fontSize={10}
                      width={110}
                      tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="jumlah" radius={[0, 4, 4, 0]}>
                      {instansiChartData.map((_, i) => (
                        <Cell key={i} fill={INSTANSI_COLORS[i % INSTANSI_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* QR Code Section */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              QR Code Absensi
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Belum ada QR Code absensi</p>
                <Button onClick={handleGenerateQR} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Generate QR Code
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <Card key={session.id} className="border">
                    <CardContent className="p-4 text-center space-y-3">
                      <Badge variant={session.scan_type === "arrival" ? "default" : session.scan_type === "completion" ? "secondary" : "outline"}>
                        {session.session_label}
                      </Badge>
                      <div
                        className="flex justify-center cursor-pointer"
                        onClick={() => setSelectedQR(session)}
                      >
                        <QRCodeSVG
                          id={`qr-${session.id}`}
                          value={`${BASE_URL}/absen/${session.qr_token}`}
                          size={140}
                          level="H"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground break-all">
                        {records.filter((r) => r.session_id === session.id).length} peserta
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" variant="outline" onClick={() => handleDownloadQR(session)}>
                          <Download className="w-3 h-3 mr-1" />
                          Unduh
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRegenerateQR(session.id)}>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Perbarui
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Preview Dialog */}
        <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedQR?.session_label}</DialogTitle>
            </DialogHeader>
            {selectedQR && (
              <div className="flex flex-col items-center gap-4" ref={qrRef}>
                <QRCodeSVG
                  id={`qr-preview-${selectedQR.id}`}
                  value={`${BASE_URL}/absen/${selectedQR.qr_token}`}
                  size={280}
                  level="H"
                />
                <p className="text-xs text-muted-foreground text-center break-all">
                  {`${BASE_URL}/absen/${selectedQR.qr_token}`}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => selectedQR && handleDownloadQR(selectedQR)}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Attendance Records */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5" />
                Daftar Peserta
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredRecords.length}{filteredRecords.length !== records.length ? ` dari ${records.length}` : ""})
                </span>
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                {/* Search by name — semua tipe */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="pl-8 h-8 text-sm w-40"
                  />
                </div>
                {/* Filter by instansi — hanya untuk tudung_sipulung */}
                {activity?.type === "tudung_sipulung" && (
                  <Select value={filterInstansi} onValueChange={setFilterInstansi}>
                    <SelectTrigger className="h-8 text-sm w-44 gap-1">
                      <Filter className="w-3.5 h-3.5 shrink-0" />
                      <SelectValue placeholder="Semua instansi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Instansi</SelectItem>
                      {uniqueInstansi.map((inst) => (
                        <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="hidden md:table-cell">No. Telepon</TableHead>
                  {activity?.type === "tudung_sipulung" ? (
                    <TableHead>Instansi</TableHead>
                  ) : (
                    <>
                      <TableHead>Sesi</TableHead>
                      <TableHead className="hidden lg:table-cell">Feedback</TableHead>
                    </>
                  )}
                  <TableHead>Waktu</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={activity?.type === "tudung_sipulung" ? 5 : 6} className="text-center py-8 text-muted-foreground">
                      {records.length === 0
                        ? "Belum ada peserta yang absen"
                        : "Tidak ada peserta yang cocok dengan filter"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const session = sessions.find((s) => s.id === record.session_id);
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-sm">{record.participant_name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{record.phone_number || "-"}</TableCell>
                        {activity?.type === "tudung_sipulung" ? (
                          <TableCell className="text-sm">{record.instansi || "-"}</TableCell>
                        ) : (
                          <>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {session?.session_label || "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                              {record.feedback}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(record.created_at), "HH:mm", { locale: idLocale })}
                        </TableCell>
                        <TableCell>
                          <Dialog open={deleteRecordId === record.id} onOpenChange={(o) => setDeleteRecordId(o ? record.id : null)}>
                            <Button size="sm" variant="outline" className="text-destructive px-2" onClick={() => setDeleteRecordId(record.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Hapus Data Absensi</DialogTitle>
                                <DialogDescription>
                                  Hapus data absensi dari "{record.participant_name}"?
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setDeleteRecordId(null)}>Batal</Button>
                                <Button variant="destructive" onClick={() => handleDeleteRecord(record.id)}>Hapus</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
