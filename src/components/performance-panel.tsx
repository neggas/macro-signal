"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SignalSnapshot } from "@/lib/types";

export function PerformancePanel() {
  const [snapshots, setSnapshots] = useState<SignalSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [exitInputs, setExitInputs] = useState<Record<number, string>>({});

  const load = () => {
    setLoading(true);
    fetch("/api/signals/snapshot")
      .then((r) => r.json())
      .then((d: SignalSnapshot[]) => {
        setSnapshots(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const closed = snapshots.filter((s) => s.result !== "Open");
    const wins = closed.filter((s) => s.result === "WIN");
    const losses = closed.filter((s) => s.result === "LOSS");
    const total = closed.length;
    const winRate = total > 0 ? (wins.length / total) * 100 : 0;
    const avgReturn = total > 0 ? closed.reduce((sum, s) => sum + s.returnPct, 0) / total : 0;
    const totalReturn = closed.reduce((sum, s) => sum + s.returnPct, 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, s) => sum + s.returnPct, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, s) => sum + s.returnPct, 0) / losses.length : 0;
    return { total, winRate, avgReturn, totalReturn, avgWin, avgLoss, openCount: snapshots.length - total };
  }, [snapshots]);

  const equityCurve = useMemo(() => {
    const closed = snapshots
      .filter((s) => s.result !== "Open")
      .sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime());
    let cumulative = 0;
    return closed.map((s) => {
      cumulative += s.returnPct;
      return { date: s.snapshotDate, cumulative };
    });
  }, [snapshots]);

  const closeSignal = async (id: number) => {
    const price = parseFloat(exitInputs[id]);
    if (isNaN(price) || price <= 0) return;
    const res = await fetch("/api/signals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, exitPrice: price }),
    });
    if (res.ok) {
      setExitInputs((prev) => ({ ...prev, [id]: "" }));
      load();
    }
  };

  const getResultColor = (result: string) => {
    if (result === "WIN") return "text-emerald-400";
    if (result === "LOSS") return "text-red-400";
    return "text-gray-400";
  };

  const getSignalBadge = (signal: string) => {
    if (signal === "BUY") return "bg-emerald-500/20 text-emerald-400";
    if (signal === "SELL") return "bg-red-500/20 text-red-400";
    return "bg-gray-500/20 text-gray-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Historique de performance</h2>
        <Button onClick={load} disabled={loading} size="sm">
          {loading ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Trades totaux" value={String(stats.total)} />
        <StatCard label="Taux de réussite" value={`${stats.winRate.toFixed(1)}%`} />
        <StatCard label="Rendement moyen" value={`${stats.avgReturn > 0 ? "+" : ""}${stats.avgReturn.toFixed(2)}%`} color={stats.avgReturn >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="Rendement total" value={`${stats.totalReturn > 0 ? "+" : ""}${stats.totalReturn.toFixed(2)}%`} color={stats.totalReturn >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="Gain moyen" value={`+${stats.avgWin.toFixed(2)}%`} color="text-emerald-400" />
        <StatCard label="Perte moyenne" value={`${stats.avgLoss.toFixed(2)}%`} color="text-red-400" />
      </div>

      {equityCurve.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Courbe de capital (Rendement cumulé %)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full relative">
              <svg className="w-full h-full" viewBox={`0 0 ${Math.max(equityCurve.length * 20, 200)} 200`} preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 50, 100, 150, 200].map((y) => (
                  <line key={y} x1="0" y1={y} x2={Math.max(equityCurve.length * 20, 200)} y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                ))}
                {/* Equity line */}
                {equityCurve.length > 1 && (
                  <polyline
                    fill="none"
                    stroke={stats.totalReturn >= 0 ? "#34d399" : "#f87171"}
                    strokeWidth="2"
                    points={equityCurve
                      .map((pt, i) => {
                        const minVal = Math.min(...equityCurve.map((e) => e.cumulative), 0);
                        const maxVal = Math.max(...equityCurve.map((e) => e.cumulative), 0);
                        const range = maxVal - minVal || 1;
                        const x = i * 20 + 10;
                        const y = 190 - ((pt.cumulative - minVal) / range) * 180;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                )}
              </svg>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Historique des signaux</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Paire</TableHead>
                <TableHead className="text-xs">Signal</TableHead>
                <TableHead className="text-xs">Force</TableHead>
                <TableHead className="text-xs text-right">Entrée</TableHead>
                <TableHead className="text-xs text-right">Sortie</TableHead>
                <TableHead className="text-xs text-right">Rendement</TableHead>
                <TableHead className="text-xs">Résultat</TableHead>
                <TableHead className="text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground text-xs py-6">
                    Aucun snapshot pour le moment. Capturer les signaux depuis le Tableau de bord.
                  </TableCell>
                </TableRow>
              )}
              {snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs">{s.snapshotDate}</TableCell>
                  <TableCell className="text-xs font-medium">{s.pair}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${getSignalBadge(s.signal)}`}>
                      {s.signal}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{s.strength}</TableCell>
                  <TableCell className="text-xs text-right">{s.entryPrice || "-"}</TableCell>
                  <TableCell className="text-xs text-right">{s.exitPrice || "-"}</TableCell>
                  <TableCell className={`text-xs text-right font-mono ${getResultColor(s.result)}`}>
                    {s.returnPct !== 0 ? `${s.returnPct > 0 ? "+" : ""}${s.returnPct.toFixed(2)}%` : "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.result === "Open" ? (
                      <Badge variant="outline" className="text-[10px]">Ouvert</Badge>
                    ) : (
                      <span className={`font-semibold text-xs ${getResultColor(s.result)}`}>{s.result}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {s.result === "Open" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="any"
                          placeholder="Prix de sortie"
                          className="h-7 w-24 text-xs"
                          value={exitInputs[s.id] || ""}
                          onChange={(e) => setExitInputs((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        />
                        <Button size="sm" className="h-7 text-[10px] px-2" onClick={() => closeSignal(s.id)}>
                          Clôturer
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`text-lg font-bold font-mono ${color || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
