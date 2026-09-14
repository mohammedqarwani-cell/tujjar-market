"use client";
import { useEffect, useState } from "react";
import { MetaService, type MetaItem } from "@services/meta.service";
import { Prefs } from "@services/prefs.service";

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-4 shadow">
        {children}
      </div>
    </div>
  );
}

export default function LocationBar({
  onChange,
}: {
  onChange?: (city?: string, market?: string) => void;
}) {
  const [city, setCity] = useState<string | null>(null);
  const [market, setMarket] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [cities, setCities] = useState<MetaItem[]>([]);
  const [markets, setMarkets] = useState<MetaItem[]>([]);
  const [selCity, setSelCity] = useState("");
  const [selMarket, setSelMarket] = useState("");

  useEffect(() => {
    setCity(Prefs.getCity());
    setMarket(Prefs.getMarket());
  }, []);

  useEffect(() => {
    MetaService.cities(100)
      .then(setCities)
      .catch(() => setCities([]));
  }, []);
  async function loadMarkets(c?: string) {
    const m = await MetaService.markets(100, c);
    setMarkets(m);
  }
  useEffect(() => {
    if (open) loadMarkets(selCity || city || undefined);
  }, [open, selCity, city]);

  function apply() {
    Prefs.set(selCity || undefined, selMarket || undefined);
    setCity(selCity || null);
    setMarket(selMarket || null);
    setOpen(false);
    onChange?.(selCity || undefined, selMarket || undefined);
  }

  function clearAll() {
    Prefs.clear();
    setCity(null);
    setMarket(null);
    setSelCity("");
    setSelMarket("");
    setOpen(false);
    onChange?.(undefined, undefined);
  }

  return (
    <>
      <div className="text-sm">
        <button
          className="rounded-lg bg-gray-100 px-3 py-1 hover:bg-gray-200"
          onClick={() => {
            setSelCity(city || "");
            setSelMarket(market || "");
            setOpen(true);
          }}
        >
          {city ? (
            <>
              التسليم إلى <b>{city}</b>
              {market ? (
                <>
                  {" "}
                  — <span className="text-gray-600">{market}</span>
                </>
              ) : null}
            </>
          ) : (
            <>حدد موقع التسليم</>
          )}
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)}>
        <h3 className="mb-3 text-lg font-semibold">حدد موقعك</h3>
        <div className="grid gap-3">
          <select
            className="border rounded-lg p-2"
            value={selCity}
            onChange={(e) => {
              setSelCity(e.target.value);
              setSelMarket("");
              loadMarkets(e.target.value || undefined);
            }}
          >
            <option value="">اختر المدينة (اختياري)</option>
            {cities
              .filter((x) => x.name)
              .map((c) => (
                <option key={c.name!} value={c.name!}>
                  {c.name} ({c.count})
                </option>
              ))}
          </select>

          <select
            className="border rounded-lg p-2"
            value={selMarket}
            onChange={(e) => setSelMarket(e.target.value)}
            disabled={!selCity && !city}
          >
            <option value="">
              {selCity || city
                ? "اختر السوق (اختياري)"
                : "اختر مدينة أولًا (اختياري)"}
            </option>
            {markets
              .filter((x) => x.name)
              .map((m) => (
                <option key={m.name!} value={m.name!}>
                  {m.name} ({m.count})
                </option>
              ))}
          </select>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-black text-white"
              onClick={apply}
            >
              حفظ
            </button>
            <button
              className="px-4 py-2 rounded bg-gray-200"
              onClick={() => setOpen(false)}
            >
              إلغاء
            </button>
            {(city || market) && (
              <button
                className="ml-auto px-4 py-2 rounded bg-red-100 text-red-700"
                onClick={clearAll}
              >
                إزالة التفضيل
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
