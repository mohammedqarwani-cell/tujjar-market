export const GOV_COOKIE = "tujjar_gov";

export function setGovCookie(slug: string) {
  document.cookie = slug
    ? `${GOV_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`
    : `${GOV_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
