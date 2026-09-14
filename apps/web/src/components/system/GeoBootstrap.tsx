'use client';
import { useEffect } from 'react';
import { getBrowserLocation, guessNearestCity, SUPPORTED_CITIES } from '@lib/geo';

// مفتاح التخزين نفسه الذي يستخدمه RegionSwitcher
const KEY = 'user_region';

// نطلق حدث مخصص ليسمعه أي كومبوننت
function dispatchRegionChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('region-change'));
  }
}

export default function GeoBootstrap() {
  useEffect(() => {
    // إذا كان عندنا منطقة محفوظة لا نتدخل
    const saved = typeof window !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (saved) return;

    (async () => {
      const loc = await getBrowserLocation();
      if (!loc) return; // المستخدم رفض أو فشل

      const near = guessNearestCity(loc.lat, loc.lng, SUPPORTED_CITIES);
      if (!near) return;

      const region = { country: near.country, city: near.name };
      localStorage.setItem(KEY, JSON.stringify(region));
      dispatchRegionChange();
    })();
  }, []);

  return null; // لا يرسم شيئًا
}
