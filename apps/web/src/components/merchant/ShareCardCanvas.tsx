"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { priceLabel } from "@lib/format";
import type { Currency, PriceType } from "@lib/types";

export type CardProduct = {
  id: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  currency: Currency;
  priceType: PriceType;
  images: string[];
};

export type CardShape = "square" | "story";

export const SHAPES: Record<CardShape, { w: number; h: number; label: string; hint: string }> = {
  square: { w: 1080, h: 1080, label: "مربعة", hint: "منشور فيسبوك وإنستغرام" },
  story: { w: 1080, h: 1920, label: "طولية", hint: "حالة واتساب وستوري" },
};

type Store = { name: string; slug: string; logoUrl?: string | null };

const BRAND = "#b86e14";
const INK = "#1f1a14";
const CANVAS_BG = "#fdfaf4";

/** Loads a picture for the canvas; cross-origin pictures need permission to be exported. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Only pictures from another site need permission; a data: URL must not ask for it
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Draws text right-to-left over at most `maxLines` lines and returns the height it used. */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      let cut = last;
      while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
      lines[maxLines - 1] = `${cut}…`;
    }
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length * lineHeight;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paints a ready-to-post picture of one product: its photo, price, the shop's name and a QR
 * code that opens the product. Everything is drawn in the browser, so Arabic looks right and
 * nothing is uploaded anywhere.
 */
export function useShareCard({
  product,
  store,
  shape,
  url,
  headline,
}: {
  product: CardProduct | null;
  store: Store;
  shape: CardShape;
  url: string;
  headline: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(true);
  const [warning, setWarning] = useState("");
  // A new run cancels the one before it, so a slow photo never paints over a newer card
  const runId = useRef(0);
  const storeName = store.name;

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = SHAPES[shape];
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const run = ++runId.current;
    setDrawing(true);
    setWarning("");

    try {
      await document.fonts.ready;
    } catch {}
    if (run !== runId.current) return;
    // canvas cannot read CSS variables, so take the family the page is actually using
    const family = getComputedStyle(document.body).fontFamily || '"Segoe UI", Tahoma, sans-serif';
    const font = (size: number, weight: 400 | 500 | 700 = 700) => `${weight} ${size}px ${family}`;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    // Background
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, w, h);

    const pad = Math.round(w * 0.06);
    const photoH = shape === "square" ? Math.round(h * 0.58) : Math.round(h * 0.62);

    // Product photo, cropped to fill
    const photo = product?.images[0] ? await loadImage(product.images[0]) : null;
    if (run !== runId.current) return;
    if (photo) {
      const scale = Math.max(w / photo.width, photoH / photo.height);
      const dw = photo.width * scale;
      const dh = photo.height * scale;
      ctx.drawImage(photo, (w - dw) / 2, (photoH - dh) / 2, dw, dh);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, photoH);
      grad.addColorStop(0, "#f9e6c6");
      grad.addColorStop(1, "#e6ead3");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, photoH);
      if (product?.images.length) setWarning("تعذّر تحميل صورة المنتج، جرّب مرة أخرى أو اختر منتجاً آخر.");
    }

    // Headline ribbon over the photo
    if (headline.trim()) {
      ctx.font = font(shape === "story" ? 54 : 46);
      const textW = ctx.measureText(headline).width;
      const rw = Math.min(w - pad * 2, textW + 64);
      const rh = shape === "story" ? 96 : 84;
      ctx.fillStyle = BRAND;
      roundRect(ctx, w - pad - rw, pad, rw, rh, rh / 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(headline, w - pad - 32, pad + (rh - (shape === "story" ? 60 : 52)) / 2);
    }

    // Card with the details
    const cardY = photoH - 40;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, pad / 2, cardY, w - pad, h - cardY - pad / 2, 48);
    ctx.fill();

    // QR code on the start side of the card, beside the text
    const qrSize = shape === "story" ? 260 : 200;
    const qrX = pad;
    const qrY = cardY + pad;
    try {
      const qrData = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: qrSize * 2, color: { dark: INK, light: "#ffffff" } });
      const qr = await loadImage(qrData);
      if (run !== runId.current) return;
      if (qr) ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = "#8a8073";
      ctx.font = font(30, 500);
      ctx.textAlign = "left";
      ctx.fillText("امسح للطلب", qrX, qrY + qrSize + 14);
      ctx.textAlign = "right";
    } catch {}

    let y = cardY + pad;
    const right = w - pad;
    const textWidth = w - pad * 2 - qrSize - 40;

    ctx.fillStyle = INK;
    ctx.font = font(shape === "story" ? 60 : 54);
    y += drawWrapped(ctx, product?.title ?? storeName, right, y, textWidth, shape === "story" ? 80 : 72, 2) + 14;

    // Price
    const price = product ? priceLabel(product) : null;
    ctx.fillStyle = BRAND;
    ctx.font = font(shape === "story" ? 84 : 74);
    const priceText = price ? price.main : "";
    if (priceText) {
      ctx.fillText(priceText, right, y);
      const priceW = ctx.measureText(priceText).width;
      if (product?.oldPrice && product.price && product.oldPrice > product.price) {
        const old = priceLabel({ price: product.oldPrice, currency: product.currency, priceType: "FIXED" }).main;
        ctx.font = font(44, 500);
        ctx.fillStyle = "#8a8073";
        const oldX = right - priceW - 24;
        const oldY = y + 30;
        ctx.fillText(old, oldX, oldY);
        const oldW = ctx.measureText(old).width;
        ctx.strokeStyle = "#8a8073";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(oldX, oldY + 24);
        ctx.lineTo(oldX - oldW, oldY + 24);
        ctx.stroke();
      }
      y += shape === "story" ? 112 : 100;
    }

    // Shop line
    ctx.fillStyle = INK;
    ctx.font = font(44, 500);
    ctx.fillText(storeName, right, y);
    y += 60;
    ctx.fillStyle = "#8a8073";
    ctx.font = font(32, 400);
    ctx.fillText("على تُجّار ماركت — اطلب أو تواصل مباشرة", right, y);

    // Site address, under the card
    ctx.fillStyle = "#8a8073";
    ctx.font = font(30, 500);
    ctx.direction = "ltr";
    ctx.textAlign = "right";
    ctx.fillText(url.replace(/^https?:\/\//, "").split("/")[0], right, h - pad / 2 - 54);
    ctx.direction = "rtl";

    setDrawing(false);
  }, [product, storeName, shape, url, headline]);

  useEffect(() => {
    void draw();
  }, [draw]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      try {
        canvas.toBlob((b) => resolve(b), "image/png", 0.92);
      } catch {
        resolve(null);
      }
    });

  return { canvasRef, drawing, warning, toBlob };
}
