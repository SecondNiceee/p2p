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
  const [buyFiatAmountMin, setBuyFiatAmountMin] = useState("");
  const [buyFiatAmountMax, setBuyFiatAmountMax] = useState("");
  const [sellTargetPrice, setSellTargetPrice] = useState("");
  const [sellFiatAmountMin, setSellFiatAmountMin] = useState("");
  const [sellFiatAmountMax, setSellFiatAmountMax] = useState("");
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
  const lastAlertTimeRef = useRef<{ buy: number; sell: number }>({ buy: 0, sell: 0 });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Load monitoring status on page load
  useEffect(() => {
    async function loadMonitoringStatus() {
      try {
        const res = await fetch("/api/monitoring/status");
        if (res.ok) {
          const data = await res.json();
          if (data.is_active) {
            setIsRunning(true);
            if (data.fiat_currency) setFiatCurrency(data.fiat_currency);
            if (data.buy_target_price) setBuyTargetPrice(String(data.buy_target_price));
            if (data.buy_fiat_amount_min) setBuyFiatAmountMin(String(data.buy_fiat_amount_min));
            if (data.buy_fiat_amount_max) setBuyFiatAmountMax(String(data.buy_fiat_amount_max));
            if (data.sell_target_price) setSellTargetPrice(String(data.sell_target_price));
            if (data.sell_fiat_amount_min) setSellFiatAmountMin(String(data.sell_fiat_amount_min));
            if (data.sell_fiat_amount_max) setSellFiatAmountMax(String(data.sell_fiat_amount_max));
            if (data.interval_ms) setIntervalMs(data.interval_ms);
          }
        }
      } catch (e) {
        console.error("Failed to load monitoring status:", e);
      } finally {
        setIsLoadingStatus(false);
      }
    }
    loadMonitoringStatus();
  }, []);

  const sendTelegramAlert = useCallback(async (type: "BUY" | "SELL", items: OnlineItem[], targetPrice: string) => {
    try {
      const item = items[0];
      if (!item) return;

      const message =
        type === "BUY"
          ? `🛍️ <b>АЛЕРТ ПОКУПКИ (SELL объявление)</b>\n\n` +
            `💰 Цена: <b>${item.price} ${item.fiatCurrency}</b> (цель: ${targetPrice})\n` +
            `🪙 Минимум: ${item.minAmount} | Максимум: ${item.maxAmount || "не указано"}\n` +
            `👤 Продавец: <b>${item.nickname}</b>\n` +
            `⭐ Уровень: ${item.merchantLevel}\n` +
            `✅ Онлайн: ${item.isOnline ? "Да" : "Нет"}\n` +
            `🔗 <a href="https://t.me/wallet">Перейти</a>\n\n` +
            `Найдено объявлений: ${items.length}`
          : `💵 <b>АЛЕРТ ПРОДАЖИ (BUY объявление)</b>\n\n` +
            `💰 Цена: <b>${item.price} ${item.fiatCurrency}</b> (цель: ${targetPrice})\n` +
            `🪙 Минимум: ${item.minAmount} | Максимум: ${item.maxAmount || "не указано"}\n` +
            `👤 Покупатель: <b>${item.nickname}</b>\n` +
            `⭐ Уровень: ${item.merchantLevel}\n` +
            `✅ Онлайн: ${item.isOnline ? "Да" : "Нет"}\n` +
            `🔗 <a href="https://t.me/wallet">Перейти</a>\n\n` +
            `Найдено объявлений: ${items.length}`;

      await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } catch (error) {
      console.error("Failed to send Telegram alert:", error);
    }
  }, []);

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
      // + лимиты объявления пересекаются с нашим диапазоном суммы
      if (sellData.status === "SUCCESS") {
        setSellAds(sellData.data);
        if (buyTargetPrice) {
          const target = parseFloat(buyTargetPrice);
          const ourMin = buyFiatAmountMin ? parseFloat(buyFiatAmountMin) : null;
          const ourMax = buyFiatAmountMax ? parseFloat(buyFiatAmountMax) : null;
          const matched = sellData.data.filter((item: OnlineItem) => {
            if (parseFloat(item.price) > target) return false;
            // Проверяем пересечение диапазонов
            if (ourMin !== null || ourMax !== null) {
              const adMin = parseFloat(item.minAmount);
              const adMax = item.maxAmount ? parseFloat(item.maxAmount) : Infinity;
              // Наш диапазон должен пересекаться с диапазоном объявления
              const effectiveOurMin = ourMin ?? 0;
              const effectiveOurMax = ourMax ?? Infinity;
              if (effectiveOurMax < adMin || effectiveOurMin > adMax) return false;
            }
            return true;
          });
          if (matched.length > 0) {
            setBuyAlert({ triggered: true, items: matched });
            const now = Date.now();
            if (now - lastAlertTimeRef.current.buy > 30000) {
              lastAlertTimeRef.current.buy = now;
              sendTelegramAlert("BUY", matched, buyTargetPrice);
            }
          } else {
            setBuyAlert({ triggered: false, items: [] });
          }
        } else {
          setBuyAlert({ triggered: false, items: [] });
        }
      }

      // BUY объявления = кто хочет купить USDT → мы продаём
      // Алерт продажи: цена BUY объявления >= нашей целевой цены продажи
      // + лимиты объявления пересекаются с нашим диапазоном суммы
      if (buyData.status === "SUCCESS") {
        setBuyAds(buyData.data);
        if (sellTargetPrice) {
          const target = parseFloat(sellTargetPrice);
          const ourMin = sellFiatAmountMin ? parseFloat(sellFiatAmountMin) : null;
          const ourMax = sellFiatAmountMax ? parseFloat(sellFiatAmountMax) : null;
          const matched = buyData.data.filter((item: OnlineItem) => {
            if (parseFloat(item.price) < target) return false;
            // Проверяем пересечение диапазонов
            if (ourMin !== null || ourMax !== null) {
              const adMin = parseFloat(item.minAmount);
              const adMax = item.maxAmount ? parseFloat(item.maxAmount) : Infinity;
              const effectiveOurMin = ourMin ?? 0;
              const effectiveOurMax = ourMax ?? Infinity;
              if (effectiveOurMax < adMin || effectiveOurMin > adMax) return false;
            }
            return true;
          });
          if (matched.length > 0) {
            setSellAlert({ triggered: true, items: matched });
            const now = Date.now();
            if (now - lastAlertTimeRef.current.sell > 30000) {
              lastAlertTimeRef.current.sell = now;
              sendTelegramAlert("SELL", matched, sellTargetPrice);
            }
          } else {
            setSellAlert({ triggered: false, items: [] });
          }
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
  }, [fiatCurrency, buyTargetPrice, buyFiatAmountMin, buyFiatAmountMax, sellTargetPrice, sellFiatAmountMin, sellFiatAmountMax, sendTelegramAlert]);

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
          buyFiatAmountMin={buyFiatAmountMin}
          setBuyFiatAmountMin={setBuyFiatAmountMin}
          buyFiatAmountMax={buyFiatAmountMax}
          setBuyFiatAmountMax={setBuyFiatAmountMax}
          sellTargetPrice={sellTargetPrice}
          setSellTargetPrice={setSellTargetPrice}
          sellFiatAmountMin={sellFiatAmountMin}
          setSellFiatAmountMin={setSellFiatAmountMin}
          sellFiatAmountMax={sellFiatAmountMax}
          setSellFiatAmountMax={setSellFiatAmountMax}
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
