"use client";
import { useState } from "react";

export function Tabs({
  tabs,
  initial = 0,
}: {
  tabs: { label: string; content: React.ReactNode }[];
  initial?: number;
}) {
  const [i, setI] = useState(initial);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {tabs.map((t, idx) => (
          <button
            key={t.label}
            onClick={() => setI(idx)}
            className={`px-4 py-2 rounded-xl border ${
              i === idx ? "bg-black text-white" : "bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs[i].content}</div>
    </div>
  );
}
