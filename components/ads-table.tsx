"use client";

import type { OnlineItem } from "@/app/page";

type Props = {
  title: string;
  side: "BUY" | "SELL";
  ads: OnlineItem[];
  isAlerted: boolean;
};

export function AdsTable({ title, side, ads, isAlerted }: Props) {
  const cardClass = isAlerted
    ? "rounded-xl border border-emerald-700/50 bg-emerald-950/30 overflow-hidden"
    : "rounded-xl border border-border bg-card overflow-hidden";

  const headerClass = isAlerted
    ? "px-4 py-3 text-sm font-semibold text-emerald-200 bg-emerald-900/30 flex items-center justify-between"
    : "px-4 py-3 text-sm font-semibold text-foreground bg-muted/50 flex items-center justify-between";

  const sideColor = side === "BUY" ? "text-emerald-400" : "text-rose-400";

  if (ads.length === 0) {
    return (
      <div className={cardClass}>
        <div className={headerClass}>
          <span>{title}</span>
          <span className={`text-xs font-bold ${sideColor}`}>{side}</span>
        </div>
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No data yet. Start monitoring to fetch ads.
        </div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div className={headerClass}>
        <span>{title}</span>
        <span className={`text-xs font-bold ${sideColor}`}>{side}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={isAlerted ? "border-b border-emerald-800/50" : "border-b border-border"}>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Trader</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Price</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Available</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Rate</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Payments</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((item, i) => (
              <tr
                key={item.id}
                className={`${
                  i % 2 === 0
                    ? isAlerted ? "bg-emerald-900/10" : "bg-background"
                    : isAlerted ? "bg-emerald-900/20" : "bg-muted/20"
                } ${isAlerted ? "border-b border-emerald-900/30" : "border-b border-border/50"}`}
              >
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className={isAlerted ? "font-medium text-emerald-200" : "font-medium text-foreground"}>
                      {item.nickname}
                    </span>
                    <span className={`text-[10px] ${
                      item.merchantLevel === "TRUSTED_MERCHANT"
                        ? "text-yellow-400"
                        : item.merchantLevel === "MERCHANT"
                        ? "text-blue-400"
                        : "text-muted-foreground"
                    }`}>
                      {item.merchantLevel.replace(/_/g, " ")}
                    </span>
                  </div>
                </td>
                <td className={`px-4 py-2 text-right font-bold ${
                  side === "BUY"
                    ? isAlerted ? "text-emerald-300" : "text-emerald-600 dark:text-emerald-400"
                    : isAlerted ? "text-rose-300" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {item.price}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {parseFloat(item.lastQuantity).toFixed(0)}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground">
                  {Math.round(parseFloat(item.executeRate) * 100)}%
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.payments.slice(0, 3).map((p) => (
                      <span
                        key={p}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isAlerted
                            ? "bg-emerald-800/40 text-emerald-300"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {p}
                      </span>
                    ))}
                    {item.payments.length > 3 && (
                      <span className="text-muted-foreground text-[10px]">+{item.payments.length - 3}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
