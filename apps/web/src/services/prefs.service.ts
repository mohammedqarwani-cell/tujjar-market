export const Prefs = {
  getCity(): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(/(?:^|;\s*)pref_city=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  },
  getMarket(): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(/(?:^|;\s*)pref_market=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  },
  set(city?: string, market?: string) {
    if (typeof document === "undefined") return;
    const opts = ";path=/;max-age=" + 60 * 60 * 24 * 180; // 180 يوم
    if (city) document.cookie = `pref_city=${encodeURIComponent(city)}${opts}`;
    else document.cookie = `pref_city=;path=/;max-age=0`;
    if (market)
      document.cookie = `pref_market=${encodeURIComponent(market)}${opts}`;
    else document.cookie = `pref_market=;path=/;max-age=0`;
  },
  clear() {
    this.set(undefined, undefined);
  },
};
