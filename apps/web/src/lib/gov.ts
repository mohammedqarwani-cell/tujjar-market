export const GOV_COOKIE = "tujjar_gov";

export function setGovCookie(slug: string) {
  document.cookie = slug
    ? `${GOV_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`
    : `${GOV_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/** Set once the visitor picked a governorate, or we located them, so they aren't asked again */
const DECIDED_KEY = "tj_gov_decided";

export function govDecided() {
  try {
    return localStorage.getItem(DECIDED_KEY) === "1";
  } catch {
    return true;
  }
}

export function markGovDecided() {
  try {
    localStorage.setItem(DECIDED_KEY, "1");
  } catch {}
}

/** Fired by the header picker to run location detection again */
export const LOCATE_EVENT = "tujjar-locate";

export type GovPoint = { slug: string; name: string; status: "ACTIVE" | "COMING_SOON"; latitude?: number | null; longitude?: number | null };

/** Farther than this from every governorate centre means the visitor isn't in Syria */
const MAX_DISTANCE_KM = 120;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(a));
}

/** The governorate whose centre is closest to the given position, or null outside Syria. */
export function nearestGovernorate(lat: number, lng: number, governorates: GovPoint[]) {
  let best: GovPoint | null = null;
  let bestKm = Infinity;
  for (const g of governorates) {
    if (typeof g.latitude !== "number" || typeof g.longitude !== "number") continue;
    const km = distanceKm(lat, lng, g.latitude, g.longitude);
    if (km < bestKm) {
      best = g;
      bestKm = km;
    }
  }
  return bestKm <= MAX_DISTANCE_KM ? best : null;
}
