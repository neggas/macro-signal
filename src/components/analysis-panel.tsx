"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MacroAnalysis, PairSignal } from "@/lib/types";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

function scoreClass(score: number) {
  if (score > 0.2) return "text-emerald-400";
  if (score < -0.2) return "text-red-400";
  return "text-gray-400";
}

function signalIcon(signal: string) {
  if (signal === "BUY") return <TrendingUp className="h-4 w-4" />;
  if (signal === "SELL") return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function signalClass(signal: string) {
  if (signal === "BUY") return "bg-emerald-500/20 text-emerald-400";
  if (signal === "SELL") return "bg-red-500/20 text-red-400";
  return "bg-gray-500/20 text-gray-400";
}

export function AnalysisPanel() {
  const [data, setData] = useState<{ analyses: MacroAnalysis[]; pairs: PairSignal[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [overviewPage, setOverviewPage] = useState(0);
  const [pairPage, setPairPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [pairSearch, setPairSearch] = useState("");

  const refresh = () => {
    setLoading(true);
    fetch("/api/analysis")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  const pairs = useMemo(() => data?.pairs ?? [], [data?.pairs]);
  const analyses = useMemo(() => data?.analyses ?? [], [data?.analyses]);

  const topBuys = useMemo(
    () =>
      pairs
        .filter((p) => p.signal === "BUY" && (p.strength === "Strong" || p.strength === "Medium"))
        .slice(0, 3),
    [pairs]
  );
  const topSells = useMemo(
    () =>
      pairs
        .filter((p) => p.signal === "SELL" && (p.strength === "Strong" || p.strength === "Medium"))
        .slice(0, 3),
    [pairs]
  );

  const filteredPairs = useMemo(
    () =>
      pairSearch
        ? pairs.filter((p) => p.pair.toLowerCase().includes(pairSearch.toLowerCase()))
        : pairs,
    [pairs, pairSearch]
  );

  const overviewPages = Math.ceil(analyses.length / pageSize);
  const overviewSlice = useMemo(
    () => analyses.slice(overviewPage * pageSize, (overviewPage + 1) * pageSize),
    [analyses, overviewPage, pageSize]
  );

  const pairPages = Math.ceil(filteredPairs.length / pageSize);
  const pairSlice = useMemo(
    () => filteredPairs.slice(pairPage * pageSize, (pairPage + 1) * pageSize),
    [filteredPairs, pairPage, pageSize]
  );

  useEffect(() => {
    setOverviewPage(0);
    setPairPage(0);
  }, [pageSize, pairSearch]);

  if (!data || !data.analyses || data.analyses.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">
            Aucune analyse disponible. Ajoutez des devises ou synchronisez le calendrier.
          </p>
          <Button onClick={refresh} className="mt-4" variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "..." : "Rafraîchir"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Biais des banques centrales</h2>
          <p className="text-sm text-muted-foreground">
            Scoring macro, signaux de paires et probabilité hawkish / dovish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refresh} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Rafraîchissement..." : "Rafraîchir"}
          </Button>
        </div>
      </div>

      {(topBuys.length > 0 || topSells.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                Top opportunités achat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topBuys.map((p) => (
                  <div
                    key={p.pair}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 border border-emerald-500/20"
                  >
                    <span>{p.pair}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-80">{p.strength}</span>
                    <span className="text-xs tabular-nums">Diff {p.macroDiff.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-red-400">
                <TrendingDown className="h-4 w-4" />
                Top opportunités vente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {topSells.map((p) => (
                  <div
                    key={p.pair}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 border border-red-500/20"
                  >
                    <span>{p.pair}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-80">{p.strength}</span>
                    <span className="text-xs tabular-nums">Diff {p.macroDiff.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="rounded-lg bg-muted/70 p-1">
          <TabsTrigger
            value="overview"
            className="rounded-md text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger
            value="pairs"
            className="rounded-md text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Signaux de paires
          </TabsTrigger>
          <TabsTrigger
            value="details"
            className="rounded-md text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Détails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Scores macro par devise</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Devise</TableHead>
                    <TableHead className="text-xs text-right">Score macro</TableHead>
                    <TableHead className="text-xs text-right">Croissance</TableHead>
                    <TableHead className="text-xs text-right">Inflation</TableHead>
                    <TableHead className="text-xs text-right">Emploi</TableHead>
                    <TableHead className="text-xs">Régime</TableHead>
                    <TableHead className="text-xs">Confiance</TableHead>
                    <TableHead className="text-xs">Réaction BC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overviewSlice.map((a) => (
                    <TableRow key={a.currencyId}>
                      <TableCell className="font-bold text-sm">{a.currencyCode}</TableCell>
                      <TableCell
                        className={`text-right font-mono font-bold text-sm ${scoreClass(
                          a.totalMacroScore
                        )}`}
                      >
                        {a.totalMacroScore.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${scoreClass(a.growth.score)}`}>
                        {a.growth.score.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm ${scoreClass(a.inflation.score)}`}
                      >
                        {a.inflation.score.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${scoreClass(a.labor.score)}`}>
                        {a.labor.score.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">{a.regime}</TableCell>
                      <TableCell className="text-sm">{a.confidence}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="font-medium">
                          {a.cbReaction.dominant}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={overviewPage}
                pages={overviewPages}
                pageSize={pageSize}
                onPage={setOverviewPage}
                onPageSize={setPageSize}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pairs" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm font-medium">Signaux de trading par paire</CardTitle>
                <Input
                  placeholder="Filtrer une paire (ex. EURUSD)..."
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  className="h-9 w-full sm:w-[240px]"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Paire</TableHead>
                    <TableHead className="text-xs">Signal</TableHead>
                    <TableHead className="text-xs">Force</TableHead>
                    <TableHead className="text-xs text-right">Diff macro</TableHead>
                    <TableHead className="text-xs text-right">Score base</TableHead>
                    <TableHead className="text-xs text-right">Score quote</TableHead>
                    <TableHead className="text-xs">Réaction BC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairSlice.map((p) => (
                    <TableRow key={p.pair}>
                      <TableCell className="font-bold text-sm">{p.pair}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${signalClass(
                            p.signal
                          )}`}
                        >
                          {signalIcon(p.signal)}
                          {p.signal}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.strength}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.macroDiff.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.baseScore.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{p.quoteScore.toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.baseCB} / {p.quoteCB}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={pairPage}
                pages={pairPages}
                pageSize={pageSize}
                onPage={setPairPage}
                onPageSize={setPageSize}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {analyses.map((a) => (
            <Card key={a.currencyId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">{a.currencyCode} — Décomposition</CardTitle>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${scoreClass(
                      a.totalMacroScore
                    )}`}
                  >
                    {a.totalMacroScore.toFixed(2)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ScoreCard title="Croissance" score={a.growth.score} indicators={a.growth.indicators} />
                  <ScoreCard title="Inflation" score={a.inflation.score} indicators={a.inflation.indicators} />
                  <ScoreCard title="Emploi" score={a.labor.score} indicators={a.labor.indicators} />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2 text-sm">
                  <div className="font-medium text-foreground mb-2">Réaction banque centrale</div>
                  <div>
                    Hawkish {(a.cbReaction.hawkish * 100).toFixed(0)}% — Dovish{" "}
                    {(a.cbReaction.dovish * 100).toFixed(0)}% — Neutral{" "}
                    {(a.cbReaction.neutral * 100).toFixed(0)}%
                  </div>
                  <div>
                    <span className="text-muted-foreground">Régime :</span> {a.regime}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sentiment :</span> {a.sentiment.macroSentiment}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreCard({
  title,
  score,
  indicators,
}: {
  title: string;
  score: number;
  indicators: { name: string; previous: number; forecast: number; actual: number; sigma: number; rawScore: number; finalScore: number; weightedScore: number }[];
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${score > 0.2
            ? "bg-emerald-500/20 text-emerald-400"
            : score < -0.2
              ? "bg-red-500/20 text-red-400"
              : "bg-gray-500/20 text-gray-400"
            }`}
        >
          {score.toFixed(2)}
        </span>
      </div>
      <div className="space-y-2 text-xs">
        {indicators.length === 0 && (
          <div className="text-muted-foreground italic">Aucun indicateur actif</div>
        )}
        {indicators.map((ind) => {
          const surprise = ind.actual - ind.forecast;
          const surpriseStr = surprise >= 0 ? `+${surprise.toFixed(2)}` : surprise.toFixed(2);
          const surpriseClass = surprise > 0 ? "text-emerald-400" : surprise < 0 ? "text-red-400" : "text-muted-foreground";
          return (
            <div key={ind.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{ind.name}</span>
                <span className="font-mono font-bold">
                  {ind.finalScore.toFixed(2)} <span className="text-muted-foreground font-normal">→</span> {ind.weightedScore.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-3 pl-2 text-[10px] text-muted-foreground font-mono">
                <span>P: {ind.previous.toFixed(1)}</span>
                <span>F: {ind.forecast.toFixed(1)}</span>
                <span className={ind.actual !== 0 ? "text-foreground font-medium" : ""}>
                  A: {ind.actual !== 0 ? ind.actual.toFixed(1) : "—"}
                </span>
                <span className={surpriseClass}>
                  Δ: {ind.actual !== 0 ? surpriseStr : "—"}
                </span>
                <span className="opacity-60">σ: {ind.sigma.toFixed(3)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
