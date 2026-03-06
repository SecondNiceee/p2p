"use client";

import { useState } from "react";

type Props = {
  fiatCurrency: string;
  setFiatCurrency: (v: string) => void;
  buyTargetPrice: string;
  setBuyTargetPrice: (v: string) => void;
  buyFiatAmount: string;
  setBuyFiatAmount: (v: string) => void;
  sellTargetPrice: string;
  setSellTargetPrice: (v: string) => void;
  sellFiatAmount: string;
  setSellFiatAmount: (v: string) => void;
  interval: number;
  setInterval: (v: number) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  isAlerted: boolean;
};

const FIAT_OPTIONS = ["RUB", "USD", "EUR", "KZT", "UAH", "UZS"];
const INTERVAL_OPTIONS = [
  { label: "3s", value: 3000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
];

export function ControlPanel({
  fiatCurrency,
  setFiatCurrency,
  buyTargetPrice,
  setBuyTargetPrice,
  buyFiatAmount,
  setBuyFiatAmount,
  sellTargetPrice,
  setSellTargetPrice,
  sellFiatAmount,
  setSellFiatAmount,
  interval,
  setInterval,
  isRunning,
  setIsRunning,
  isAlerted,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleMonitoring = async () => {
    try {
      setError(null);
      setIsLoading(true);

      if (isRunning) {
        // Stop monitoring
        const res = await fetch("/api/monitoring/stop", { method: "POST" });
        if (!res.ok) throw new Error("Failed to stop monitoring");
        setIsRunning(false);
      } else {
        // Start monitoring
        const res = await fetch("/api/monitoring/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fiatCurrency,
            buyTargetPrice: buyTargetPrice ? parseFloat(buyTargetPrice) : null,
            buyFiatAmount: buyFiatAmount ? parseFloat(buyFiatAmount) : null,
            sellTargetPrice: sellTargetPrice ? parseFloat(sellTargetPrice) : null,
            sellFiatAmount: sellFiatAmount ? parseFloat(sellFiatAmount) : null,
            interval_ms: interval,
          }),
        });
        if (!res.ok) throw new Error("Failed to start monitoring");
        setIsRunning(true);
      }
    } catch (e) {
      setError(String(e));
      setIsLoading(false);
    }
  };

  const cardClass = isAlerted
    ? "rounded-xl border border-alert-border bg-alert-card p-5"
    : "rounded-xl border border-border bg-card p-5";

  const labelClass = isAlerted ? "text-xs font-medium text-alert-foreground/70 mb-1 block" : "text-xs font-medium text-muted-foreground mb-1 block";
  const inputClass = isAlerted
    ? "w-full rounded-md border border-alert-border bg-alert-input px-3 py-2 text-sm text-alert-foreground placeholder-alert-foreground/40 focus:outline-none focus:ring-2 focus:ring-alert-ring"
    : "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className={cardClass}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className={labelClass}>Fiat currency</label>
          <select
            value={fiatCurrency}
            onChange={(e) => setFiatCurrency(e.target.value)}
            className={inputClass}
          >
            {FIAT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Цена покупки USDT (≤)</label>
          <input
            type="number"
            placeholder="напр. 92.50"
            value={buyTargetPrice}
            onChange={(e) => setBuyTargetPrice(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Сумма покупки ({fiatCurrency})</label>
          <input
            type="number"
            placeholder="напр. 5000"
            value={buyFiatAmount}
            onChange={(e) => setBuyFiatAmount(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Цена продажи USDT (≥)</label>
          <input
            type="number"
            placeholder="напр. 95.00"
            value={sellTargetPrice}
            onChange={(e) => setSellTargetPrice(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Сумма продажи ({fiatCurrency})</label>
          <input
            type="number"
            placeholder="напр. 5000"
            value={sellFiatAmount}
            onChange={(e) => setSellFiatAmount(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Poll interval</label>
          <div className="flex gap-1">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                  interval === opt.value
                    ? "bg-primary text-primary-foreground"
                    : isAlerted
                    ? "bg-alert-input text-alert-foreground border border-alert-border hover:bg-alert-border"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{error}</div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleToggleMonitoring}
            disabled={isLoading}
            className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${
              isRunning
                ? "bg-destructive text-white hover:bg-destructive/80"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {isLoading ? "..." : isRunning ? "Stop Monitoring" : "Start Monitoring"}
          </button>
        </div>
      </div>
    </div>
  );
}
