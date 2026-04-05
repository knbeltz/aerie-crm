"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { LayoutDashboard, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high:   "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low:    "bg-surface-2 text-midnight/50",
};

export default function FolderDashboardPage() {
  const params = useParams();
  const folderId = params.folderId as Id<"folders">;

  const stats = useQuery(api.deals.getDashboardStats, { folderId });
  const isLoading = stats === undefined;

  const summaryCards = [
    { label: "Active Deals",  value: stats?.activeDeals  },
    { label: "Total Deals",   value: stats?.totalDeals   },
    { label: "Closed",        value: stats?.closedDeals  },
    { label: "Team Members",  value: stats?.memberCount  },
  ];

  const hasChartData = stats && stats.stageBreakdown.some((s) => s.count > 0);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard className="w-5 h-5 text-midnight/40" />
          <h1 className="font-manrope font-extrabold text-2xl text-midnight">
            Dashboard
          </h1>
        </div>
        <p className="text-sm text-midnight/50">
          Summary of your folder&apos;s deal flow and team activity.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map(({ label, value }) => (
          <div key={label} className="bg-surface-2 rounded-xl p-5">
            <p className="text-xs font-semibold text-midnight/40 uppercase tracking-wider mb-2">
              {label}
            </p>
            {isLoading ? (
              <div className="h-7 w-10 bg-active rounded animate-pulse" />
            ) : (
              <p className="font-manrope font-extrabold text-2xl text-midnight">
                {value ?? 0}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline by Stage */}
        <div className="bg-surface-2 rounded-xl p-5">
          <p className="font-manrope font-semibold text-sm text-midnight mb-4">
            Pipeline by Stage
          </p>

          {isLoading ? (
            <div className="h-48 bg-active/40 rounded-lg animate-pulse" />
          ) : !hasChartData ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
              <AlertCircle className="w-6 h-6 text-midnight/20" />
              <p className="text-sm text-midnight/30">No deals in the pipeline yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <BarChart
                data={stats!.stageBreakdown}
                margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#000626AA" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  // Truncate long stage names
                  tickFormatter={(v: string) =>
                    v.length > 9 ? v.slice(0, 9) + "…" : v
                  }
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#000626AA" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,6,38,0.04)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "none",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                    fontSize: 12,
                    padding: "6px 12px",
                  }}
                  formatter={(value: number) => [value, "Deals"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {stats!.stageBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Urgent Deals */}
        <div className="bg-surface-2 rounded-xl p-5">
          <p className="font-manrope font-semibold text-sm text-midnight mb-4">
            Urgent Deals
            <span className="ml-2 text-xs font-normal text-midnight/40">
              due within 7 days
            </span>
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div>
                    <div className="h-3.5 w-36 bg-active rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-24 bg-active/60 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-16 bg-active rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !stats || stats.urgentDeals.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
              <Clock className="w-6 h-6 text-midnight/20" />
              <p className="text-sm text-midnight/30">No deals due soon</p>
            </div>
          ) : (
            <div className="space-y-1 -mx-1">
              {stats.urgentDeals.map((deal) => {
                const daysLeft = Math.ceil(
                  (deal.stageDeadlineAt - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div
                    key={deal._id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-active/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-midnight truncate">
                        {deal.title}
                      </p>
                      <p className="text-xs text-midnight/40 truncate">
                        {deal.company ? `${deal.company} · ` : ""}
                        {deal.stageName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[deal.priority] ?? PRIORITY_COLORS.low}`}
                      >
                        {deal.priority}
                      </span>
                      <span className="text-xs text-midnight/40 whitespace-nowrap">
                        {daysLeft <= 1
                          ? "due tomorrow"
                          : `${daysLeft}d left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
