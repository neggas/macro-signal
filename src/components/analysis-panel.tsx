"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MacroAnalysis, PairSignal } from "@/lib/types";

export function AnalysisPanel() {
  const [data, setData] = useState<{ analyses: MacroAnalysis[]; pairs: PairSignal[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pairSearch, setPairSearch] = useState("");
  const [pairSignalFilter, setPairSignalFilter] = useState<string>("ALL");
  const [pairStrengthFilter, setPairStrengthFilter] = useState<string>("ALL");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [captureSaved, setCaptureSaved] = useState(false);
  const [captureStrengthFilter, setCaptureStrengthFilter] = useState<string>("Strong");
  const today = new Date().toISOString().split("T")[0];

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

  if (!data) {
    return <div className="p-6">Chargement de l'analyse...</div>;
  }

  if (data.analyses.length === 0) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Aucune devise pour le moment. Allez dans « Saisie des données » pour ajouter des devises et saisir les indicateurs.</p>
        <Button onClick={refresh} className="mt-4">Rafraîchir</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Tableau de Bord — Analyse Macro</h2>
        <div className="flex items-center gap-2">
          <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
            <DialogTrigger render={<Button variant="secondary" size="sm">Capturer les signaux</Button>} />
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Capturer les signaux du {today}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Saisissez le prix actuel de chaque paire pour créer un snapshot. Vous pourrez clôturer dans l'onglet Performance (5 jours après).
                  </p>
                  <Select value={captureStrengthFilter} onValueChange={(v) => v && setCaptureStrengthFilter(v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Strength" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Toutes</SelectItem>
                      <SelectItem value="Strong">Strong</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Weak">Weak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                  <div>Paire</div>
                  <div>Signal</div>
                  <div>Force</div>
                  <div className="text-right">Prix</div>
                </div>
                <div className="space-y-2">
                  {data?.pairs
                    .filter((p) => captureStrengthFilter === "ALL" || p.strength === captureStrengthFilter)
                    .map((p) => (
                      <div key={p.pair} className="grid grid-cols-4 gap-2 items-center">
                        <div className="text-sm font-medium">{p.pair}</div>
                        <div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${p.signal === "BUY" ? "bg-emerald-500/20 text-emerald-400" : p.signal === "SELL" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400"}`}>
                            {p.signal}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">{p.strength}</div>
                        <Input
                          type="number"
                          step="any"
                          placeholder="0.0000"
                          className="h-8 text-xs"
                          value={prices[p.pair] || ""}
                          onChange={(e) => setPrices((prev) => ({ ...prev, [p.pair]: e.target.value }))}
                        />
                      </div>
                    ))}
                </div>
                <Button
                  className="w-full"
                  disabled={captureSaved}
                  onClick={async () => {
                    if (!data) return;
                    const filteredPairs = data.pairs.filter(
                      (p) => captureStrengthFilter === "ALL" || p.strength === captureStrengthFilter
                    );
                    for (const p of filteredPairs) {
                      const price = parseFloat(prices[p.pair]);
                      if (isNaN(price) || price <= 0) continue;
                      await fetch("/api/signals/snapshot", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          snapshotDate: today,
                          pair: p.pair,
                          signal: p.signal,
                          strength: p.strength,
                          macroDiff: p.macroDiff,
                          entryPrice: price,
                        }),
                      });
                    }
                    setCaptureSaved(true);
                    setTimeout(() => {
                      setCaptureSaved(false);
                      setCaptureOpen(false);
                      setPrices({});
                    }, 1500);
                  }}
                >
                  {captureSaved ? "Enregistré !" : "Enregistrer les snapshots"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={refresh} disabled={loading} size="sm">
            {loading ? "Rafraîchissement..." : "Rafraîchir l'analyse"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="pairs">Signaux de paires</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Devise</TableHead>
                    <TableHead className="text-right text-muted-foreground">Score Macro</TableHead>
                    <TableHead className="text-right text-muted-foreground">Croissance</TableHead>
                    <TableHead className="text-right text-muted-foreground">Inflation</TableHead>
                    <TableHead className="text-right text-muted-foreground">Emploi</TableHead>
                    <TableHead className="text-muted-foreground">Régime</TableHead>
                    <TableHead className="text-muted-foreground">Confiance</TableHead>
                    <TableHead className="text-muted-foreground">Position BC</TableHead>
                    <TableHead className="text-muted-foreground">Sentiment</TableHead>
                    <TableHead className="text-right text-muted-foreground">Risque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.analyses.map((a) => (
                    <TableRow key={a.currencyId}>
                      <TableCell className="font-bold">{a.currencyCode}</TableCell>
                      <TableCell className={`text-right font-mono font-bold ${a.totalMacroScore > 0 ? "text-emerald-400" : a.totalMacroScore < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {a.totalMacroScore.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${a.growth.score > 0 ? "text-emerald-400" : a.growth.score < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {a.growth.score.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${a.inflation.score > 0 ? "text-emerald-400" : a.inflation.score < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {a.inflation.score.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${a.labor.score > 0 ? "text-emerald-400" : a.labor.score < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {a.labor.score.toFixed(2)}
                      </TableCell>
                      <TableCell>{a.regime}</TableCell>
                      <TableCell>{a.confidence}</TableCell>
                      <TableCell>{a.cbReaction.dominant}</TableCell>
                      <TableCell>{a.sentiment.macroSentiment}</TableCell>
                      <TableCell className="text-right font-mono">{(a.finalRiskPercent * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {data.analyses.map((a) => (
            <Card key={a.currencyId}>
              <CardHeader>
                <CardTitle>{a.currencyCode} — Décomposition détaillée</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ScoreCard title="Croissance" score={a.growth.score} indicators={a.growth.indicators} />
                  <ScoreCard title="Inflation" score={a.inflation.score} indicators={a.inflation.indicators} />
                  <ScoreCard title="Emploi" score={a.labor.score} indicators={a.labor.indicators} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div><strong>Poids adaptatifs :</strong> Croissance {a.adaptiveWeights.growth.toFixed(2)}, Inflation {a.adaptiveWeights.inflation.toFixed(2)}, Emploi {a.adaptiveWeights.labor.toFixed(2)}</div>
                    <div><strong>Score Macro :</strong> {a.totalMacroScore.toFixed(3)} ± {a.macroScoreSigma.toFixed(3)}</div>
                    <div><strong>Fuzzy :</strong> Good {(a.fuzzy.good * 100).toFixed(0)}%, Avg {(a.fuzzy.avg * 100).toFixed(0)}%, Bad {(a.fuzzy.bad * 100).toFixed(0)}% — <em>{a.fuzzy.dominant}</em></div>
                  </div>
                  <div className="space-y-2">
                    <div><strong>Réaction BC :</strong> Hawkish {(a.cbReaction.hawkish * 100).toFixed(0)}%, Neutral {(a.cbReaction.neutral * 100).toFixed(0)}%, Dovish {(a.cbReaction.dovish * 100).toFixed(0)}%</div>
                    <div><strong>Sentiment :</strong> Risk-On {(a.sentiment.riskOn * 100).toFixed(0)}%, Risk-Off {(a.sentiment.riskOff * 100).toFixed(0)}%, Neutre {(a.sentiment.neutral * 100).toFixed(0)}%</div>
                    <div><strong>Risque de retournement :</strong> {a.sentiment.reversalRisk ? "Oui" : "Non"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm border-t pt-4">
                  <div><strong>Biais USD :</strong> {a.usdBias.bias} ({a.usdBias.strength})</div>
                  <div><strong>Biais Or :</strong> {a.goldBias.bias} ({a.goldBias.strength})</div>
                  <div><strong>Biais Indices :</strong> {a.indicesBias.bias} ({a.indicesBias.strength})</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pairs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Signaux de trading par paire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Rechercher une paire..."
                  value={pairSearch}
                  onChange={(e) => setPairSearch(e.target.value)}
                  className="w-[200px]"
                />
                <Select value={pairSignalFilter} onValueChange={(v) => v && setPairSignalFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Signal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les signaux</SelectItem>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                    <SelectItem value="NEUTRAL">NEUTRAL</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={pairStrengthFilter} onValueChange={(v) => v && setPairStrengthFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Strength" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Toutes les forces</SelectItem>
                    <SelectItem value="Strong">Strong</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Weak">Weak</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paire</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Force</TableHead>
                    <TableHead>Diff Macro</TableHead>
                    <TableHead>Score Base</TableHead>
                    <TableHead>Score Quote</TableHead>
                    <TableHead>BC Base</TableHead>
                    <TableHead>BC Quote</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pairs
                    .filter((p) => {
                      const matchSearch = p.pair.toLowerCase().includes(pairSearch.toLowerCase());
                      const matchSignal = pairSignalFilter === "ALL" || p.signal === pairSignalFilter;
                      const matchStrength = pairStrengthFilter === "ALL" || p.strength === pairStrengthFilter;
                      return matchSearch && matchSignal && matchStrength;
                    })
                    .map((p) => (
                      <TableRow key={p.pair}>
                        <TableCell className="font-medium">{p.pair}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${p.signal === "BUY" ? "bg-emerald-500/20 text-emerald-400" :
                            p.signal === "SELL" ? "bg-red-500/20 text-red-400" :
                              "bg-gray-500/20 text-gray-400"
                            }`}>
                            {p.signal}
                          </span>
                        </TableCell>
                        <TableCell>{p.strength}</TableCell>
                        <TableCell>{p.macroDiff.toFixed(2)}</TableCell>
                        <TableCell>{p.baseScore.toFixed(2)}</TableCell>
                        <TableCell>{p.quoteScore.toFixed(2)}</TableCell>
                        <TableCell>{p.baseCB}</TableCell>
                        <TableCell>{p.quoteCB}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
  indicators: { name: string; finalScore: number; weightedScore: number }[];
}) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium">{title}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${score > 0 ? "bg-emerald-500/20 text-emerald-400" :
          score < 0 ? "bg-red-500/20 text-red-400" :
            "bg-gray-500/20 text-gray-400"
          }`}>
          {score.toFixed(2)}
        </span>
      </div>
      <div className="space-y-1 text-xs">
        {indicators.map((ind) => (
          <div key={ind.name} className="flex justify-between">
            <span className="text-muted-foreground">{ind.name}</span>
            <span>
              {ind.finalScore.toFixed(2)} → {ind.weightedScore.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
