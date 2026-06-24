"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SyncLog {
  id: number;
  synced_at: number;
  period: string;
  events_fetched: number;
  events_mapped: number;
  events_saved: number;
  status: string;
  error: string | null;
}

interface SyncResult {
  success?: boolean;
  error?: string;
  period?: string;
  eventsFetched?: number;
  eventsMapped?: number;
  eventsSaved?: number;
  details?: string[];
  debug?: boolean;
  count?: number;
  raw?: unknown;
}

export function SyncPanel() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [debugResult, setDebugResult] = useState<object | null>(null);
  const [impactFilter, setImpactFilter] = useState<"high-medium" | "all">("high-medium");
  const [debugMode, setDebugMode] = useState<"off" | "on">("off");

  const loadLogs = () => {
    setLoading(true);
    fetch("/api/sync")
      .then((r) => r.json())
      .then((d) => {
        setLogs(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    setLastResult(null);
    setDebugResult(null);
    try {
      const params = new URLSearchParams();
      if (impactFilter === "all") params.set("all", "true");
      if (debugMode === "on") params.set("debug", "true");
      const res = await fetch(`/api/sync?${params.toString()}`, { method: "POST" });
      const data = (await res.json()) as SyncResult;
      if (debugMode === "on") {
        setDebugResult(data as object);
      } else {
        setLastResult(data);
        loadLogs();
      }
    } catch (err) {
      const msg = { error: (err as Error).message };
      debugMode === "on" ? setDebugResult(msg) : setLastResult(msg);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (unixTs: number) => {
    return new Date(unixTs * 1000).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Auto-Sync — Forex Factory</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Récupère le calendrier de la semaine et met à jour les indicateurs. Pas besoin de cron : clique simplement pour rafraîchir.
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <Select value={impactFilter} onValueChange={(v) => setImpactFilter(v as "high-medium" | "all")}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Impact filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high-medium">High + Medium</SelectItem>
                <SelectItem value="all">Tous les impacts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={debugMode} onValueChange={(v) => setDebugMode(v as "off" | "on")}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="Debug" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Debug off</SelectItem>
                <SelectItem value="on">Debug on</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={syncing} onClick={triggerSync}>
            {syncing ? "Synchronisation..." : "Rafraîchir la semaine"}
          </Button>
        </div>
      </div>

      {debugResult && (
        <Card className="border-yellow-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-400">Réponse brute de l'API (Debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] text-muted-foreground bg-muted rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(debugResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {lastResult && (
        <Card className={lastResult.error ? "border-red-500/50" : "border-emerald-500/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {lastResult.error ? (
                <span className="text-red-400">Erreur de sync</span>
              ) : (
                <span className="text-emerald-400">Sync réussie</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lastResult.error ? (
              <p className="text-xs text-red-400">{lastResult.error}</p>
            ) : (
              <>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">Récupérés : <strong className="text-foreground">{lastResult.eventsFetched}</strong></span>
                  <span className="text-muted-foreground">Mappés : <strong className="text-foreground">{lastResult.eventsMapped}</strong></span>
                  <span className="text-muted-foreground">Enregistrés : <strong className="text-emerald-400">{lastResult.eventsSaved}</strong></span>
                </div>
                {lastResult.details && lastResult.details.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {lastResult.details.map((d, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground font-mono">{d}</div>
                    ))}
                  </div>
                )}
                {lastResult.details?.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun indicateur mappé — vérifiez que vos devises sont configurées dans « Saisie des données ».</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Historique des syncs</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadLogs} disabled={loading}>
            {loading ? "..." : "Rafraîchir"}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Période</TableHead>
                <TableHead className="text-xs text-right">Récupérés</TableHead>
                <TableHead className="text-xs text-right">Mappés</TableHead>
                <TableHead className="text-xs text-right">Enregistrés</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
                <TableHead className="text-xs">Erreur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-6">
                    Aucun sync effectué. Cliquez "Rafraîchir la semaine" pour démarrer.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{formatDate(log.synced_at)}</TableCell>
                  <TableCell className="text-xs">{log.period}</TableCell>
                  <TableCell className="text-xs text-right">{log.events_fetched}</TableCell>
                  <TableCell className="text-xs text-right">{log.events_mapped}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{log.events_saved}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${log.status === "ok" ? "text-emerald-400 border-emerald-400/30" : "text-red-400 border-red-400/30"}`}
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-red-400 max-w-[200px] truncate">
                    {log.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stockage historique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Chaque événement est enregistré avec sa <span className="font-mono">release_date</span>. La clé unique est <span className="font-mono">(currency_id, indicator_name, release_date)</span>, donc plusieurs dates de publication sont conservées en base.
          </p>
          <p className="text-xs text-muted-foreground">
            Parfait pour tracer des courbes d'évolution de chaque indicateur au fil du temps.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
