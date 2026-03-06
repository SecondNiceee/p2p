"use client";

import { useState } from "react";

type Props = {
  fiatCurrency: string;
  setFiatCurrency: (v: string) => void;
  buyTargetPrice: string;
  setBuyTargetPrice: (v: string) => void;
  buyFiatAmountMin: string;
  setBuyFiatAmountMin: (v: string) => void;
  buyFiatAmountMax: string;
  setBuyFiatAmountMax: (v: string) => void;
  sellTargetPrice: string;
  setSellTargetPrice: (v: string) => void;
  sellFiatAmountMin: string;
  setSellFiatAmountMin: (v: string) => void;
  sellFiatAmountMax: string;
  setSellFiatAmountMax: (v: string) => void;
  interval: number;
  setInterval: (v: number) => void;
  isRunning: boolean;
  setIsRunning: (v: boolean) => void;
  isAlerted: boolean;
  onServerStatusChange?: (active: boolean) => void;
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
  buyFiatAmountMin,
  setBuyFiatAmountMin,
  buyFiatAmountMax,
  setBuyFiatAmountMax,
  sellTargetPrice,
  setSellTargetPrice,
  sellFiatAmountMin,
  setSellFiatAmountMin,
  sellFiatAmountMax,
  setSellFiatAmountMax,
  interval,
  setInterval,
  isRunning,
  setIsRunning,
  isAlerted,
  onServerStatusChange,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Сохранить настройки и запустить мониторинг на сервере
  const handleSaveAndStart = async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Validate before starting
      if (!buyTargetPrice && !sellTargetPrice) {
        setError("Set at least one target price");
        setIsLoading(false);
        return;
      }

      // Start/update monitoring config in DB
      const res = await fetch("/api/monitoring/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiatCurrency,
          buyTargetPrice: buyTargetPrice ? parseFloat(buyTargetPrice) : null,
          buyFiatAmountMin: buyFiatAmountMin ? parseFloat(buyFiatAmountMin) : null,
          buyFiatAmountMax: buyFiatAmountMax ? parseFloat(buyFiatAmountMax) : null,
          sellTargetPrice: sellTargetPrice ? parseFloat(sellTargetPrice) : null,
          sellFiatAmountMin: sellFiatAmountMin ? parseFloat(sellFiatAmountMin) : null,
          sellFiatAmountMax: sellFiatAmountMax ? parseFloat(sellFiatAmountMax) : null,
          interval_ms: interval,
        }),
      });
      if (!res.ok) throw new Error("Failed to save config");
      setIsRunning(true);
      onServerStatusChange?.(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Полностью остановить мониторинг на сервере (is_active = false)
  const handleStopServer = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const res = await fetch("/api/monitoring/stop", { method: "POST" });
      if (!res.ok) throw new Error("Failed to stop server monitoring");
      setIsRunning(false);
      onServerStatusChange?.(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  // Остановить только локальный опрос (UI), сервер продолжает работать
  const handleStopLocal = () => {
    setIsRunning(false);
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
          <label className={labelClass}>Сумма покупки от-до ({fiatCurrency})</label>
          <div className="flex gap-1">
            <input
              type="number"
              placeholder="от"
              value={buyFiatAmountMin}
              onChange={(e) => setBuyFiatAmountMin(e.target.value)}
              className={inputClass}
            />
            <input
              type="number"
              placeholder="до"
              value={buyFiatAmountMax}
              onChange={(e) => setBuyFiatAmountMax(e.target.value)}
              className={inputClass}
            />
          </div>
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
          <label className={labelClass}>Сумма продажи от-до ({fiatCurrency})</label>
          <div className="flex gap-1">
            <input
              type="number"
              placeholder="от"
              value={sellFiatAmountMin}
              onChange={(e) => setSellFiatAmountMin(e.target.value)}
              className={inputClass}
            />
            <input
              type="number"
              placeholder="до"
              value={sellFiatAmountMax}
              onChange={(e) => setSellFiatAmountMax(e.target.value)}
              className={inputClass}
            />
          </div>
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
        <div className="flex justify-end gap-2">
          {isRunning ? (
            <>
              <button
                onClick={handleStopLocal}
                disabled={isLoading}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                Скрыть опрос (UI)
              </button>
              <button
                onClick={handleStopServer}
                disabled={isLoading}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 bg-destructive text-white hover:bg-destructive/80"
              >
                {isLoading ? "..." : "Остановить сервер"}
              </button>
              <button
                onClick={handleSaveAndStart}
                disabled={isLoading}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {isLoading ? "..." : "Обновить настройки"}
              </button>
            </>
          ) : (
            <button
              onClick={handleSaveAndStart}
              disabled={isLoading}
              className="rounded-lg px-6 py-2 text-sm font-semibold transition-all disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isLoading ? "..." : "Запустить мониторинг"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
