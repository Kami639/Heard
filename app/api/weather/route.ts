import { NextRequest, NextResponse } from "next/server";
import { politeJson } from "@/lib/requestQueue";

/* What the weather actually did on the night of a show.
   Open-Meteo's archive is keyless and goes back to 1940, and we already have
   coordinates for every venue — so this is a free memory detail. */

const CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "clear", icon: "☀️" }, 1: { label: "mostly clear", icon: "🌤️" },
  2: { label: "partly cloudy", icon: "⛅" }, 3: { label: "overcast", icon: "☁️" },
  45: { label: "fog", icon: "🌫️" }, 48: { label: "freezing fog", icon: "🌫️" },
  51: { label: "light drizzle", icon: "🌦️" }, 53: { label: "drizzle", icon: "🌦️" },
  55: { label: "heavy drizzle", icon: "🌦️" }, 61: { label: "light rain", icon: "🌧️" },
  63: { label: "rain", icon: "🌧️" }, 65: { label: "heavy rain", icon: "⛈️" },
  71: { label: "light snow", icon: "🌨️" }, 73: { label: "snow", icon: "❄️" },
  75: { label: "heavy snow", icon: "❄️" }, 80: { label: "showers", icon: "🌦️" },
  81: { label: "showers", icon: "🌧️" }, 82: { label: "violent showers", icon: "⛈️" },
  95: { label: "thunderstorm", icon: "⛈️" }, 96: { label: "thunderstorm", icon: "⛈️" },
  99: { label: "thunderstorm", icon: "⛈️" },
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = sp.get("lat"), lng = sp.get("lng"), date = sp.get("date");
  if (!lat || !lng || !date) return NextResponse.json({ weather: null });
  if (new Date(date) > new Date()) return NextResponse.json({ weather: null }); // future show

  const qs = new URLSearchParams({
    latitude: lat, longitude: lng, start_date: date, end_date: date,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    temperature_unit: "fahrenheit", timezone: "auto",
  });

  const data = await politeJson<any>(`https://archive-api.open-meteo.com/v1/archive?${qs}`, {
    ttl: 365 * 24 * 3600 * 1000, // the past doesn't change
  });

  const d = data?.daily;
  if (!d?.weather_code?.length) return NextResponse.json({ weather: null });

  const code = d.weather_code[0];
  const info = CODES[code] ?? { label: "", icon: "🌡️" };
  return NextResponse.json({
    weather: {
      code,
      label: info.label,
      icon: info.icon,
      high: Math.round(d.temperature_2m_max?.[0] ?? 0),
      low: Math.round(d.temperature_2m_min?.[0] ?? 0),
      rain: (d.precipitation_sum?.[0] ?? 0) > 0.1,
    },
  });
}
