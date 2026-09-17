"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = { lat: number; lng: number; title: string; subtitle?: string; href?: string };

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * OpenStreetMap map with store pins (and an optional market boundary circle).
 * Tiles come from openstreetmap.org, which the page's CSP allows; no API key or paid service.
 */
export function StoresMap({
  points,
  center,
  radius,
  height = 360,
  zoom = 16,
}: {
  points: MapPoint[];
  center?: { lat: number; lng: number } | null;
  radius?: number | null;
  height?: number;
  zoom?: number;
}) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      const first = center ?? points[0];
      if (!first) return;
      map = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView([first.lat, first.lng], zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map);

      if (center && radius) {
        L.circle([center.lat, center.lng], { radius, color: "#56632a", weight: 2, fillColor: "#6b7a36", fillOpacity: 0.08 }).addTo(map);
      }
      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#b86e14;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      });
      const bounds: [number, number][] = [];
      for (const p of points) {
        const popup = `<div dir="rtl" style="font-family:inherit;min-width:140px"><b>${escape(p.title)}</b>${p.subtitle ? `<div style="color:#6f655a;font-size:12px">${escape(p.subtitle)}</div>` : ""}${p.href ? `<a href="${escape(p.href)}" style="display:inline-block;margin-top:4px;color:#8f5410;font-weight:700">عرض المتجر ←</a>` : ""}</div>`;
        L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(map).bindPopup(popup);
        bounds.push([p.lat, p.lng]);
      }
      if (bounds.length > 1 && !radius) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, center, radius, zoom]);

  return <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-card ring-1 ring-line" role="region" aria-label="خريطة" />;
}
