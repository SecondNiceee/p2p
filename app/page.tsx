"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AlertPanel } from "@/components/alert-panel";
import { ControlPanel } from "@/components/control-panel";
import { AdsTable } from "@/components/ads-table";

export type OnlineItem = {
  id: string;
  number: string;
  userId: number;
  nickname: string;
  cryptoCurrency: string;
  fiatCurrency: string;
  side: "BUY" | "SELL";
  price: string;
  lastQuantity: string;
  minAmount: string;
  maxAmount: string | null;
  payments: string[];
  orderNum: number;
  executeRate: string;
  isOnline: boolean;
  merchantLevel: "REGULAR_USER" | "MERCHANT" | "TRUSTED_MERCHANT";
  paymentPeriod: number;
  isAutoAccept: boolean;
};

export default function Home() {
  const [fiatCurrency, setFiatCurrency] = useState("RUB");
  const [buyTargetPrice, setBuyTargetPrice] = useState("");
  const [buyFiatAmount, setBuyFiatAmount] = useState("");
  const [sellTargetPrice, setSellTargetPrice] = useState("");
  const [sellFiatAmount, setSellFiatAmount] = useState("");
  const [interval, setIntervalMs] = useState(5000);
  const [isRunning, setIsRunning] = useState(false);

  const [buyAds, setBuyAds] = useState<OnlineItem[]>([]);
  const [sellAds, setSellAds] = useState<OnlineItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [buyAlert, setBuyAlert] = useState<{ triggered: boolean; items: OnlineItem[] }>({
    triggered: false,
    items: [],
  });
  const [sellAlert, setSellAlert] = useState<{ triggered: boolean; items: OnlineItem[] }>({
    triggered: false,
    items: [],
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setError(null);
      const [buyRes, sellRes] = await Promise.all([
        fetch("/api/p2p", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cryptoCurrency: "USDT", fiatCurrency, side: "BUY", page: 1, pageSize: 10 }),
        }),
        fetch("/api/p2p", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cryptoCurrency: "USDT", fiatCurrency, side: "SELL", page: 1, pageSize: 10 }),
        }),
      ]);

      const buyData = await buyRes.json();
      const sellData = await sellRes.json();

      // SELL объявления = кто продаёт USDT → мы покупаем
      // Алерт покупки: цена SELL объявления <= нашей целевой цены покупки
      // + сумма в fiat попадает в minAmount..maxAmount объявления
      if (sellData.status === "SUCCESS") {
        setSellAds(sellData.data);
        if (buyTargetPrice) {
          const target = parseFloat(buyTargetPrice);
          const amount = buyFiatAmount ? parseFloat(buyFiatAmount) : null;
          const matched = sellData.data.filter((item: OnlineItem) => {
            if (parseFloat(item.price) > target) return false;
            if (amount !== null) {
              const min = parseFloat(item.minAmount);
              const max = item.maxAmount ? parseFloat(item.maxAmount) : Infinity;
              if (amount < min || amount > max) return false;
            }
            return true;
          });
          setBuyAlert(matched.length > 0 ? { triggered: true, items: matched } : { triggered: false, items: [] });
        } else {
          setBuyAlert({ triggered: false, items: [] });
        }
      }

      // BUY объявления = кто хочет купить USDT → мы продаём
      // Алерт продажи: цена BUY объявления >= нашей целевой цены продажи
      // + сумма в fiat попадает в minAmount..maxAmount объявления
      if (buyData.status === "SUCCESS") {
        setBuyAds(buyData.data);
        if (sellTargetPrice) {
          const target = parseFloat(sellTargetPrice);
          const amount = sellFiatAmount ? parseFloat(sellFiatAmount) : null;
          const matched = buyData.data.filter((item: OnlineItem) => {
            if (parseFloat(item.price) < target) return false;
            if (amount !== null) {
              const min = parseFloat(item.minAmount);
              const max = item.maxAmount ? parseFloat(item.maxAmount) : Infinity;
              if (amount < min || amount > max) return false;
            }
            return true;
          });
          setSellAlert(matched.length > 0 ? { triggered: true, items: matched } : { triggered: false, items: [] });
        } else {
          setSellAlert({ triggered: false, items: [] });
        }
      }

      if (!buyRes.ok && !sellRes.ok) {
        setError(buyData.errorMessage || sellData.errorMessage || "API error");
      }

      setLastUpdated(new Date());
    } catch (e) {
      setError(String(e));
    }
  }, [fiatCurrency, buyTargetPrice, sellTargetPrice]);

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    fetchPrices();
    timerRef.current = setInterval(fetchPrices, interval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, interval, fetchPrices]);

  const isAlerted = buyAlert.triggered || sellAlert.triggered;

  return (
    <main
      className={`min-h-screen transition-colors duration-500 font-sans ${
        isAlerted ? "bg-alert" : "bg-background"
      }`}
    >
      <div className="max-w-6xl mx-auto p-6 flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${isAlerted ? "text-alert-foreground" : "text-foreground"}`}>
              USDT P2P Monitor
            </h1>
            <p className={`text-sm mt-0.5 ${isAlerted ? "text-alert-foreground/70" : "text-muted-foreground"}`}>
              WalletBot P2P Market — real-time price tracker
            </p>
          </div>
          {lastUpdated && (
            <span className={`text-xs ${isAlerted ? "text-alert-foreground/60" : "text-muted-foreground"}`}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </header>

        <ControlPanel
          fiatCurrency={fiatCurrency}
          setFiatCurrency={setFiatCurrency}
          buyTargetPrice={buyTargetPrice}
          setBuyTargetPrice={setBuyTargetPrice}
          sellTargetPrice={sellTargetPrice}
          setSellTargetPrice={setSellTargetPrice}
          interval={interval}
          setInterval={setIntervalMs}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          isAlerted={isAlerted}
        />

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
            Error: {error}
          </div>
        )}

        {(buyAlert.triggered || sellAlert.triggered) && (
          <div className="flex flex-col gap-4">
            {buyAlert.triggered && (
              <AlertPanel type="BUY" items={buyAlert.items} targetPrice={buyTargetPrice} fiatCurrency={fiatCurrency} />
            )}
            {sellAlert.triggered && (
              <AlertPanel type="SELL" items={sellAlert.items} targetPrice={sellTargetPrice} fiatCurrency={fiatCurrency} />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AdsTable title="Купить USDT (SELL объявления)" side="SELL" ads={sellAds} isAlerted={isAlerted} />
          <AdsTable title="Продать USDT (BUY объявления)" side="BUY" ads={buyAds} isAlerted={isAlerted} />
        </div>
      </div>
    </main>
  );
}
