"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EconomicEvent } from "@/lib/types";

const CURRENCIES = ["ALL", "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

function impactBadgeClass(impact: string) {
  switch (impact) {
    case "high":
      return "text-red-400 border-red-400/30";
    case "medium":
      return "text-amber-400 border-amber-400/30";
    default:
      return "text-muted-foreground";
  }
}

function formatEventTime(eventTime: string) {
  const d = eventTime.includes("T") ? new Date(eventTime) : new Date(eventTime.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return eventTime;
  return d.toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countdownLabel(eventTime: string): string {
  const d = eventTime.includes("T") ? new Date(eventTime) : new Date(eventTime.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return "passé";
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `dans ${days}j`;
  if (hours > 0) return `dans ${hours}h`;
  const mins = Math.floor(diffMs / 60_000);
  return `dans ${mins}min`;
}

export function CalendarPanel() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currency, setCurrency] = useState("ALL");
  const [impactFilter, setImpactFilter] = useState<"high-medium" | "all">("high-medium");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [upcomingPage, setUpcomingPage] = useState(0);
  const [pastPage, setPastPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  const dateRange = () => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 7);
    const to = new Date(now);
    to.setDate(to.getDate() + 14);
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  };

  const parseEventDate = (eventTime: string): Date | null => {
    const d = eventTime.includes("T") ? new Date(eventTime) : new Date(eventTime.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const isUpcoming = (eventTime: string) => {
    const d = parseEventDate(eventTime);
    return d !== null && d.getTime() >= Date.now() - 3_600_000;
  };

  const loadEvents = useCallback(() => {
    setLoading(true);
    const { from, to } = dateRange();
    const params = new URLSearchParams({ from, to });
    if (currency !== "ALL") params.set("currency", currency);
    if (impactFilter === "high-medium") params.set("impact", "high,medium");

    fetch(`/api/calendar?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setEvents(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currency, impactFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const syncCalendar = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/calendar", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setSyncMessage(data.error);
      } else {
        const warn = data.warning ? ` (${data.warning})` : "";
        setSyncMessage(`${data.eventsSaved} événements synchronisés via FMP${warn}`);
        loadEvents();
      }
    } catch (err) {
      setSyncMessage((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const calRes = await fetch("/api/sync/calendar", { method: "POST" });
      const calData = await calRes.json();
      const indRes = await fetch("/api/sync/indicators", { method: "POST" });
      const indData = await indRes.json();

      const parts: string[] = [];
      if (!calData.error) parts.push(`${calData.eventsSaved} événements`);
      if (!indData.error) parts.push(`${indData.totalSaved} points indicateurs US`);

      setSyncMessage(parts.length > 0 ? `Sync terminé: ${parts.join(", ")}` : "Erreur lors de la sync");
      loadEvents();
    } catch (err) {
      setSyncMessage((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const upcoming = useMemo(() => events.filter((e) => isUpcoming(e.eventTime)), [events]);
  const past = useMemo(() => events.filter((e) => !isUpcoming(e.eventTime)), [events]);

  const upcomingPages = Math.ceil(upcoming.length / pageSize);
  const pastPages = Math.ceil(past.length / pageSize);
  const upcomingSlice = upcoming.slice(upcomingPage * pageSize, (upcomingPage + 1) * pageSize);
  const pastSlice = past.slice(pastPage * pageSize, (pastPage + 1) * pageSize);

  useEffect(() => {
    setUpcomingPage(0);
    setPastPage(0);
  }, [currency, impactFilter, pageSize]);

  const renderTable = (rows: EconomicEvent[], showPastLabel = false) => (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quand</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead className="min-w-[180px]">Événement</TableHead>
            <TableHead>Indicateur</TableHead>
            <TableHead>Impact</TableHead>
            <TableHead className="text-right">Prev</TableHead>
            <TableHead className="text-right">Est.</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id} className={showPastLabel ? "opacity-80" : undefined}>
              <TableCell className="whitespace-nowrap">
                <div className="font-medium">{formatEventTime(e.eventTime)}</div>
                <div className="text-xs text-muted-foreground">
                  {showPastLabel ? "passé" : countdownLabel(e.eventTime)}
                </div>
              </TableCell>
              <TableCell className="font-mono font-semibold">{e.currencyCode}</TableCell>
              <TableCell className="whitespace-normal max-w-[220px]" title={e.eventName}>
                {e.eventName}
              </TableCell>
              <TableCell>{e.indicatorName ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={impactBadgeClass(e.impact)}>
                  {e.impact}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{e.previous || "—"}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{e.forecast || "—"}</TableCell>
              <TableCell className="text-right tabular-nums font-bold text-emerald-400">{e.actual ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{e.source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2>Calendrier économique</h2>
          <p className="mt-1 text-muted-foreground">
            Événements via FMP (Financial Modeling Prep). Cliquez « Sync calendrier » pour récupérer les prochains événements.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
              <SelectTrigger className="h-9 min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={impactFilter}
              onValueChange={(v) => v && setImpactFilter(v as "high-medium" | "all")}
            >
              <SelectTrigger className="h-9 min-w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high-medium">High + Medium</SelectItem>
                <SelectItem value="all">Tous impacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={loading} onClick={loadEvents}>
              {loading ? "..." : "Rafraîchir"}
            </Button>
            <Button size="sm" disabled={syncing} onClick={syncCalendar}>
              {syncing ? "Sync..." : "Sync calendrier"}
            </Button>
            <Button size="sm" variant="secondary" disabled={syncing} onClick={syncAll}>
              {syncing ? "Sync..." : "Sync tout (cal + indicateurs)"}
            </Button>
          </div>
        </div>
      </div>

      {syncMessage && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {syncMessage}
        </p>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>À venir ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {renderTable(upcomingSlice)}
            <PaginationControls
              page={upcomingPage}
              pages={upcomingPages}
              pageSize={pageSize}
              onPage={setUpcomingPage}
              onPageSize={setPageSize}
            />
          </CardContent>
        </Card>
      )}

      {past.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Cette semaine — déjà publiés ({past.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 && (
              <p className="mb-4 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                FMP fournit les événements à venir et déjà publiés. Utilisez les filtres ci-dessus
                pour affiner par devise et impact.
              </p>
            )}
            {renderTable(pastSlice, true)}
            <PaginationControls
              page={pastPage}
              pages={pastPages}
              pageSize={pageSize}
              onPage={setPastPage}
              onPageSize={setPageSize}
            />
          </CardContent>
        </Card>
      )}

      {events.length === 0 && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucun événement en base. Cliquez « Sync calendrier FMP » pour récupérer les événements.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
