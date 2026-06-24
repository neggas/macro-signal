"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analyzeCurrency, generatePairSignals } from "@/lib/macro";
import { MacroAnalysis, PairSignal, IndicatorInput, MarketPositioning } from "@/lib/types";

interface Currency {
  id: number;
  code: string;
  name: string;
}

interface BacktestIndicator {
  id: number;
  name: string;
  category: string;
  previous: number;
  forecast: number;
  actual: number;
  sigma: number;
  sign: number;
  weight: number;
}

export function BacktestPanel() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<BacktestIndicator[]>([]);
  const [mp, setMp] = useState<MarketPositioning>({
    id: 1,
    cotSpxNetSpec: 0,
    cotUsdNetSpec: 0,
    vixLevel: 20,
    retailSentiment: "neutral",
  });
  const [result, setResult] = useState<{ analyses: MacroAnalysis[]; pairs: PairSignal[] } | null>(null);
  const [pairSearch, setPairSearch] = useState("");
  const [pairSignalFilter, setPairSignalFilter] = useState<string>("ALL");
  const [pairStrengthFilter, setPairStrengthFilter] = useState<string>("ALL");

  useEffect(() => {
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((d) => setCurrencies(d));
    fetch("/api/market-positioning")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.id) {
          setMp({
            id: d.id ?? 1,
            cotSpxNetSpec: d.cotSpxNetSpec ?? 0,
            cotUsdNetSpec: d.cotUsdNetSpec ?? 0,
            vixLevel: d.vixLevel ?? 20,
            retailSentiment: d.retailSentiment || "neutral",
          });
        }
      });
  }, []);

  useEffect(() => {
    if (selectedCurrency) {
      fetch(`/api/indicators?currencyId=${selectedCurrency}`)
        .then((r) => r.json())
        .then((d: BacktestIndicator[]) => setIndicators(d));
    }
  }, [selectedCurrency]);

  const updateInd = (id: number, field: keyof BacktestIndicator, value: number | string) => {
    setIndicators((prev) =>
      prev.map((ind) => (ind.id === id ? { ...ind, [field]: value } : ind))
    );
  };

  const runBacktest = async () => {
    if (!selectedCurrency) return;

    // Fetch all currencies and their indicators from DB
    const allCurrencies = await fetch("/api/currencies").then((r) => r.json()) as Currency[];
    const allIndicators: Record<number, IndicatorInput[]> = {};

    for (const cur of allCurrencies) {
      const rows = await fetch(`/api/indicators?currencyId=${cur.id}`).then((r) => r.json()) as IndicatorInput[];
      allIndicators[cur.id] = rows;
    }

    // Replace selected currency indicators with edited values
    allIndicators[selectedCurrency] = indicators.map((ind) => ({
      id: ind.id,
      currencyId: selectedCurrency,
      name: ind.name,
      category: ind.category as "Growth" | "Inflation" | "Labor",
      previous: ind.previous,
      forecast: ind.forecast,
      actual: ind.actual,
      sigma: ind.sigma,
      sign: ind.sign,
      weight: ind.weight,
    }));

    const analyses: MacroAnalysis[] = [];
    for (const cur of allCurrencies) {
      const rows = allIndicators[cur.id] || [];
      const analysis = analyzeCurrency(cur.id, cur.code, rows, mp);
      analyses.push(analysis);
    }

    const pairs = generatePairSignals(analyses);
    setResult({ analyses, pairs });
  };

  const grouped = {
    Growth: indicators.filter((i) => i.category === "Growth"),
    Inflation: indicators.filter((i) => i.category === "Inflation"),
    Labor: indicators.filter((i) => i.category === "Labor"),
  };

  const curCode = currencies.find((c) => c.id === selectedCurrency)?.code || "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration du Backtest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Devise à backtester</Label>
            <div className="flex flex-wrap gap-2">
              {currencies.map((c) => (
                <Button
                  key={c.id}
                  variant={selectedCurrency === c.id ? "default" : "outline"}
                  onClick={() => setSelectedCurrency(c.id)}
                >
                  {c.code}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">COT SPX Net Spec</Label>
              <Input type="number" step="any" value={mp.cotSpxNetSpec} onChange={(e) => setMp({ ...mp, cotSpxNetSpec: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">COT USD Net Spec</Label>
              <Input type="number" step="any" value={mp.cotUsdNetSpec} onChange={(e) => setMp({ ...mp, cotUsdNetSpec: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">VIX Level</Label>
              <Input type="number" step="any" value={mp.vixLevel} onChange={(e) => setMp({ ...mp, vixLevel: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sentiment Retail</Label>
              <Select value={mp.retailSentiment} onValueChange={(v) => v && setMp({ ...mp, retailSentiment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">Neutre</SelectItem>
                  <SelectItem value="extreme_bearish">Extrêmement baissier</SelectItem>
                  <SelectItem value="extreme_bullish">Extrêmement haussier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCurrency && indicators.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Modifier les indicateurs pour {curCode}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Modifiez les valeurs ci-dessous et lancez le backtest pour voir ce que le moteur aurait décidé.
              </p>
            </div>
            <Button onClick={runBacktest}>Lancer le backtest</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => (
              <div key={cat} className="space-y-2">
                <Badge variant="outline" className="text-sm">{cat}</Badge>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[cat].map((ind) => (
                    <div key={ind.id} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="font-medium text-sm">{ind.name}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Précédent</Label>
                          <Input type="number" step="any" value={ind.previous} onChange={(e) => updateInd(ind.id, "previous", Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prévision</Label>
                          <Input type="number" step="any" value={ind.forecast} onChange={(e) => updateInd(ind.id, "forecast", Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Actuel</Label>
                          <Input type="number" step="any" value={ind.actual} onChange={(e) => updateInd(ind.id, "actual", Number(e.target.value))} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sigma</Label>
                          <Input type="number" step="any" value={ind.sigma} onChange={(e) => updateInd(ind.id, "sigma", Number(e.target.value))} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={runBacktest} className="w-full">Lancer le backtest</Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Résultat du Backtest — Scores par devise</CardTitle>
            </CardHeader>
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
                    <TableHead className="text-muted-foreground">Position BC</TableHead>
                    <TableHead className="text-right text-muted-foreground">Risque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.analyses.map((a) => (
                    <TableRow key={a.currencyId} className={a.currencyId === selectedCurrency ? "bg-primary/10" : ""}>
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
                      <TableCell>{a.cbReaction.dominant}</TableCell>
                      <TableCell className="text-right font-mono">{(a.finalRiskPercent * 100).toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signaux de paires</CardTitle>
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
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Paire</TableHead>
                    <TableHead className="text-muted-foreground">Signal</TableHead>
                    <TableHead className="text-muted-foreground">Force</TableHead>
                    <TableHead className="text-right text-muted-foreground">Diff Macro</TableHead>
                    <TableHead className="text-right text-muted-foreground">Score Base</TableHead>
                    <TableHead className="text-right text-muted-foreground">Score Quote</TableHead>
                    <TableHead className="text-muted-foreground">BC Base</TableHead>
                    <TableHead className="text-muted-foreground">BC Quote</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.pairs
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
                        <TableCell className="text-right font-mono">{p.macroDiff.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{p.baseScore.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{p.quoteScore.toFixed(2)}</TableCell>
                        <TableCell>{p.baseCB}</TableCell>
                        <TableCell>{p.quoteCB}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
