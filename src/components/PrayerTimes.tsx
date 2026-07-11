import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { PrayerTime } from "@/types";
import { format, parse, isWithinInterval } from "date-fns";

const defaultPrayerData: PrayerTime[] = [
  { name: "Subuh", nameArabic: "الفجر", time: "04:30" },
  { name: "Dzuhur", nameArabic: "الظهر", time: "12:00" },
  { name: "Ashar", nameArabic: "العصر", time: "15:15" },
  { name: "Maghrib", nameArabic: "المغرب", time: "18:00" },
  { name: "Isya", nameArabic: "العشاء", time: "19:15" },
];

interface CurrentActivity {
  title: string;
  type: string;
}

function parseTimeToMinutes(timeStr: string): number {
  const cleanTime = timeStr.replace(/\s*\([^)]*\)/g, "").trim();
  const match = cleanTime.match(/(\d{1,2})\D(\d{2})/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

function getActivePrayer(currentTime: string, prayerData: PrayerTime[]): string | null {
  const currentMinutes = parseTimeToMinutes(currentTime);

  for (let i = 0; i < prayerData.length; i++) {
    const prayerStartMinutes = parseTimeToMinutes(prayerData[i].time);
    const prayerEndMinutes = prayerStartMinutes + 20; // Active for 20 minutes

    if (currentMinutes >= prayerStartMinutes && currentMinutes < prayerEndMinutes) {
      return prayerData[i].name;
    }
  }

  return null;
}

export function PrayerTimes() {
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [activePrayer, setActivePrayer] = useState<string | null>(null);
  const [prayerData, setPrayerData] = useState<PrayerTime[]>(defaultPrayerData);
  const [currentActivity, setCurrentActivity] = useState<CurrentActivity | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);

  // Fetch prayer times for Makassar
  useEffect(() => {
    const fetchPrayerTimes = async () => {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        
        const response = await fetch(
          `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=-5.1477&longitude=119.4327&method=20`
        );
        const data = await response.json();
        
        if (data.code === 200) {
          const timings = data.data.timings;
          setPrayerData([
            { name: "Subuh", nameArabic: "الفجر", time: timings.Fajr },
            { name: "Dzuhur", nameArabic: "الظهر", time: timings.Dhuhr },
            { name: "Ashar", nameArabic: "العصر", time: timings.Asr },
            { name: "Maghrib", nameArabic: "المغرب", time: timings.Maghrib },
            { name: "Isya", nameArabic: "العشاء", time: timings.Isha },
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch prayer times:", error);
      }
    };

    fetchPrayerTimes();
  }, []);

  // Fetch today's activities and approved reservations
  useEffect(() => {
    const fetchTodayEvents = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const [activitiesRes, reservationsRes] = await Promise.all([
        supabase
          .from("activities")
          .select("*")
          .eq("is_active", true)
          .or(
            `and(event_date.eq.${today},event_end_date.is.null),and(event_date.lte.${today},event_end_date.gte.${today})`
          ),
        supabase
          .from("reservations")
          .select("*")
          .eq("status", "approved")
          .or(
            `and(reservation_date.eq.${today},reservation_end_date.is.null),and(reservation_date.lte.${today},reservation_end_date.gte.${today})`
          ),
      ]);

      if (activitiesRes.data) setActivities(activitiesRes.data);
      if (reservationsRes.data) setReservations(reservationsRes.data);
    };

    fetchTodayEvents();
  }, []);

  // Check for current ongoing activity
  const checkCurrentActivity = (timeStr: string) => {
    const now = parse(timeStr.replace(/\./g, ":").substring(0, 5), "HH:mm", new Date());

    // Check activities - show title (judul kegiatan)
    for (const activity of activities) {
      if (!activity.event_time) continue;
      
      const startTime = parse(activity.event_time, "HH:mm", new Date());
      const endTime = activity.event_end_time
        ? parse(activity.event_end_time, "HH:mm", new Date())
        : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

      if (isWithinInterval(now, { start: startTime, end: endTime })) {
        // Show title (judul kegiatan)
        return { title: activity.title, type: activity.type };
      }
    }

    // Check approved reservations
    for (const reservation of reservations) {
      const startTime = parse(reservation.reservation_time, "HH:mm", new Date());
      const endTime = reservation.reservation_end_time
        ? parse(reservation.reservation_end_time, "HH:mm", new Date())
        : new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      if (isWithinInterval(now, { start: startTime, end: endTime })) {
        // Show description if available, otherwise show activity type
        const displayTitle = reservation.description 
          ? reservation.description 
          : reservation.activity_type.charAt(0).toUpperCase() + reservation.activity_type.slice(1);
        return { title: displayTitle, type: reservation.activity_type };
      }
    }

    return null;
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      const timeStr = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);

      const dateStr = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Makassar",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(now);

      setCurrentTime(timeStr);
      setCurrentDate(dateStr);
      
      const prayer = getActivePrayer(timeStr, prayerData);
      setActivePrayer(prayer);
      
      // Only check for activity if no prayer is active
      if (!prayer) {
        setCurrentActivity(checkCurrentActivity(timeStr));
      } else {
        setCurrentActivity(null);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [prayerData, activities, reservations]);

  // Determine what status to show
  const getStatusDisplay = () => {
    if (activePrayer) {
      return {
        type: "prayer",
        text: (
          <>
            Waktu Shalat <span className="font-bold">{activePrayer}</span> sedang berlangsung
          </>
        ),
      };
    }
    if (currentActivity) {
      return {
        type: "activity",
        text: (
          <>
            <span className="font-bold">{currentActivity.title}</span> sedang berlangsung
          </>
        ),
      };
    }
    return null;
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="relative overflow-hidden rounded-2xl gradient-islamic p-6 lg:p-8 shadow-islamic">
      {/* Decorative Pattern */}
      <div className="absolute inset-0 islamic-pattern opacity-30" />
      
      <div className="relative z-10">
        {/* Time & Date */}
        <div className="text-center mb-6">
          <p className="text-primary-foreground/80 text-sm mb-1">{currentDate}</p>
          <div className="text-5xl lg:text-6xl font-bold text-primary-foreground font-mono tracking-wider">
            {currentTime}
          </div>
        </div>

        {/* Prayer Times Grid */}
        <div className="grid grid-cols-5 gap-2 lg:gap-3">
          {prayerData.map((prayer) => (
            <div
              key={prayer.name}
              className={cn(
                "relative p-3 lg:p-4 rounded-xl text-center transition-all duration-500",
                activePrayer === prayer.name
                  ? "bg-accent text-accent-foreground shadow-gold scale-105"
                  : "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
              )}
            >
              {activePrayer === prayer.name && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
              )}
              <p className="font-arabic text-lg lg:text-xl mb-1">{prayer.nameArabic}</p>
              <p className="text-xs lg:text-sm font-medium">{prayer.name}</p>
              <p className={cn(
                "text-sm lg:text-base font-bold mt-1",
                activePrayer === prayer.name ? "text-accent-foreground" : "text-primary-foreground"
              )}>
                {prayer.time}
              </p>
            </div>
          ))}
        </div>

        {/* Status Indicator (Prayer or Activity) - Same design for both */}
        {statusDisplay && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 backdrop-blur-sm px-4 py-2 rounded-full bg-primary-foreground/20">
              <span className="w-2 h-2 rounded-full animate-pulse bg-accent" />
              <span className="text-sm text-primary-foreground">
                {statusDisplay.text}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
