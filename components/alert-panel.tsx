"use client";

import type { OnlineItem } from "@/app/page";

type Props = {
  type: "BUY" | "SELL";
  items: OnlineItem[];
  targetPrice: string;
  fiatCurrency: string;
};

export function AlertPanel({ type, items, targetPrice, fiatCurrency }: Props) {
  // type="BUY" означает что МЫ хотим КУПИТЬ USDT → ищем SELL объявления с ценой ≤ целевой
  // type="SELL" означает что МЫ хотим ПРОДАТЬ USDT → ищем BUY объявления с ценой ≥ целевой
  const isBuyAlert = type === "BUY";

  return (
    <div className="rounded-xl border-2 border-emerald-400 bg-emerald-950/60 p-5 animate-pulse-once">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
        <h2 className="text-lg font-bold text-emerald-300">
          {isBuyAlert ? "АЛЕРТ ПОКУПКИ" : "АЛЕРТ ПРОДАЖИ"} — Целевая цена достигнута!
        </h2>
      </div>
      <p className="text-sm text-emerald-200 mb-4">
        {isBuyAlert
          ? `Найдено ${items.length} SELL объявлений с ценой ≤ ${targetPrice} ${fiatCurrency} — можно купить USDT`
          : `Найдено ${items.length} BUY объявлений с ценой ≥ ${targetPrice} ${fiatCurrency} — можно продать USDT`}
      </p>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg bg-emerald-900/40 border border-emerald-700/50 px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-200 text-base">{item.price} {fiatCurrency}</span>
                <span className="text-emerald-400/70">·</span>
                <span className="text-emerald-300 font-medium">{item.nickname}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  item.merchantLevel === "TRUSTED_MERCHANT"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : item.merchantLevel === "MERCHANT"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-gray-500/20 text-gray-300"
                }`}>
                  {item.merchantLevel.replace("_", " ")}
                </span>
              </div>
              <div className="text-emerald-400/70 text-xs">
                Qty: {item.lastQuantity} · Min: {item.minAmount}{item.maxAmount ? ` · Max: ${item.maxAmount}` : ""} · {Math.round(parseFloat(item.executeRate) * 100)}% rate
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {item.payments.map((p) => (
                <span key={p} className="text-xs bg-emerald-800/40 text-emerald-300 px-1.5 py-0.5 rounded">
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
