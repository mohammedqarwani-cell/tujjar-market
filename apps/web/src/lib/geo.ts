// لا تستخدم window أثناء التحميل؛ هذه دوال عميل تُستدعى بعد mount فقط.

export type CityPoint = { country: 'AE'|'SY'; name: string; lat: number; lng: number };

// مدن مدعومة كبداية (أضف ما تريد لاحقًا)
export const SUPPORTED_CITIES: CityPoint[] = [
  // UAE
  { country: 'AE', name: 'Abu Dhabi',     lat: 24.4539, lng: 54.3773 },
  { country: 'AE', name: 'Dubai',         lat: 25.2048, lng: 55.2708 },
  { country: 'AE', name: 'Sharjah',       lat: 25.3463, lng: 55.4209 },
  { country: 'AE', name: 'Ajman',         lat: 25.4052, lng: 55.5136 },
  { country: 'AE', name: 'Ras Al Khaimah',lat: 25.8007, lng: 55.9762 },
  { country: 'AE', name: 'Umm Al Quwain', lat: 25.5647, lng: 55.5552 },
  { country: 'AE', name: 'Fujairah',      lat: 25.1288, lng: 56.3265 },
  { country: 'AE', name: 'Al Ain',        lat: 24.2075, lng: 55.7447 },
  // Syria
  { country: 'SY', name: 'Damascus',      lat: 33.5138, lng: 36.2765 },
  { country: 'SY', name: 'Aleppo',        lat: 36.2021, lng: 37.1343 },
  { country: 'SY', name: 'Homs',          lat: 34.7308, lng: 36.7090 },
  { country: 'SY', name: 'Hama',          lat: 35.1318, lng: 36.7578 },
  { country: 'SY', name: 'Latakia',       lat: 35.5167, lng: 35.7833 },
  { country: 'SY', name: 'Tartus',        lat: 34.8951, lng: 35.8866 },
  { country: 'SY', name: 'Daraa',         lat: 32.6189, lng: 36.1021 },
  { country: 'SY', name: 'As-Suwayda',    lat: 32.7089, lng: 36.5695 },
  { country: 'SY', name: 'Idlib',         lat: 35.9306, lng: 36.6339 },
];

export function haversineKm(a: {lat:number; lng:number}, b: {lat:number; lng:number}) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s1));
}

export function guessNearestCity(lat: number, lng: number, cities = SUPPORTED_CITIES): CityPoint | null {
  let best: CityPoint | null = null;
  let bestDist = Infinity;
  for (const c of cities) {
    const d = haversineKm({lat, lng}, {lat: c.lat, lng: c.lng});
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

// geolocation من المتصفح (لا تُنادى أثناء SSR)
export async function getBrowserLocation(timeoutMs = 8000): Promise<{lat:number; lng:number} | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    const opts: PositionOptions = { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 };
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()   => resolve(null),
      opts
    );
  });
}
