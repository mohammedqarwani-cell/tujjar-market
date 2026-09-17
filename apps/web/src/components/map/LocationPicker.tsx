"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Pin = { lat: number; lng: number } | null;

/** Tap the map (or use the device position) to place the shop's pin. */
export function LocationPicker({ value, fallback, onChange }: { value: Pin; fallback: Pin; onChange: (pin: Pin) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");

  const placeMarker = (pin: Pin) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!pin) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const icon = L.divIcon({
      className: "",
      html: '<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#b86e14;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
    if (markerRef.current) markerRef.current.setLatLng([pin.lat, pin.lng]);
    else markerRef.current = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
  };

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current || mapRef.current) return;
      leafletRef.current = L;
      const start = value ?? fallback ?? { lat: 33.5112, lng: 36.3065 };
      const map = L.map(el.current, { scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 18 : 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map);
      map.on("click", (e) => {
        const pin = { lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) };
        placeMarker(pin);
        onChange(pin);
      });
      mapRef.current = map;
      placeMarker(value);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later pins are placed imperatively
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const useDevice = () => {
    if (!("geolocation" in navigator)) return setNote("المتصفح لا يدعم تحديد الموقع");
    setLocating(true);
    setNote("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pin = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
        placeMarker(pin);
        mapRef.current?.setView([pin.lat, pin.lng], 18);
        onChange(pin);
        setLocating(false);
      },
      () => {
        setNote("لم نتمكن من تحديد موقعك. اضغط على مكان المحل في الخريطة بدلاً من ذلك");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div>
      <div ref={el} className="z-0 h-72 w-full overflow-hidden rounded-xl ring-1 ring-line" />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={useDevice} disabled={locating} className="rounded-full bg-ink px-4 py-2 font-bold text-canvas disabled:opacity-60">
          {locating ? "جارٍ تحديد الموقع…" : "📍 استخدم موقعي الحالي (من داخل المحل)"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => {
              placeMarker(null);
              onChange(null);
            }}
            className="rounded-full px-3 py-2 text-muted hover:text-danger"
          >
            إزالة الموقع
          </button>
        )}
        <span className="text-xs text-muted">{value ? `✓ محدد: ${value.lat}, ${value.lng}` : "أو اضغط على مكان المحل في الخريطة"}</span>
      </div>
      {note && <p className="mt-1 text-xs text-danger">{note}</p>}
    </div>
  );
}
