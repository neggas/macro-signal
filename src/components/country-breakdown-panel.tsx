"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Currency {
  id: number;
  code: string;
  name: string;
}

interface Template {
  name: string;
  category: string;
  sign: number;
  weight: number;
}

interface CountryIndicator {
  id: number;
  parentCurrencyId: number;
  countryCode: string;
  countryName: string;
  name: string;
  category: string;
  previous: number;
  forecast: number;
  actual: number;
  sigma: number;
  sign: number;
  weight: number;
  releaseDate: string;
}

interface CountryConfig {
  code: string;
  name: string;
  weight: number;
}

const ZONES: Record<string, CountryConfig[]> = {
  EUR: [
    { code: "DE", name: "Allemagne", weight: 0.30 },
    { code: "FR", name: "France", weight: 0.20 },
    { code: "IT", name: "Italie", weight: 0.15 },
    { code: "ES", name: "Espagne", weight: 0.10 },
    { code: "NL", name: "Pays-Bas", weight: 0.06 },
  ],
};

function getActiveWeight(countryCode: string, activeCodes: string[]): number {
  const zone = ZONES["EUR"];
  const country = zone.find((c) => c.code === countryCode);
  if (!country) return 0;
  const totalWeight = zone
    .filter((c) => activeCodes.includes(c.code))
    .reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 0;
  return country.weight / totalWeight;
}

export function CountryBreakdownPanel() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [countryIndicators, setCountryIndicators] = useState<Record<string, CountryIndicator[]>>({});
  const [selectedCountry, setSelectedCountry] = useState<string>("DE");
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const selectedCurrency = currencies.find((c) => c.id === selectedCurrencyId);
  const zoneCountries = selectedCurrency ? ZONES[selectedCurrency.code] : null;

  useEffect(() => {
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((d) => {
        setCurrencies(d);
        const eur = d.find((c: Currency) => c.code === "EUR");
        if (eur) setSelectedCurrencyId(eur.id);
      });
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d));
  }, []);

  useEffect(() => {
    if (!selectedCurrencyId || templates.length === 0 || !zoneCountries) return;

    setLoading(true);
    Promise.all(
      zoneCountries.map(async (country) => {
        const res = await fetch(
          `/api/country-indicators?parentCurrencyId=${selectedCurrencyId}&countryCode=${country.code}`
        );
        const rows: CountryIndicator[] = await res.json();
        if (rows.length === 0) {
          // seed from templates
          for (const t of templates) {
            await fetch("/api/country-indicators", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                parentCurrencyId: selectedCurrencyId,
                countryCode: country.code,
                countryName: country.name,
                name: t.name,
                category: t.category,
                previous: 0,
                forecast: 0,
                actual: 0,
                sigma: 0,
                sign: t.sign,
                weight: t.weight,
                releaseDate: today,
              }),
            });
          }
          const reloadRes = await fetch(
            `/api/country-indicators?parentCurrencyId=${selectedCurrencyId}&countryCode=${country.code}`
          );
          const reloaded: CountryIndicator[] = await reloadRes.json();
          return { code: country.code, rows: reloaded };
        }
        return { code: country.code, rows };
      })
    )
      .then((results) => {
        const map: Record<string, CountryIndicator[]> = {};
        for (const r of results) {
          map[r.code] = r.rows;
        }
        setCountryIndicators(map);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCurrencyId, templates, today]);

  const implied = useMemo(() => {
    if (!templates.length || !zoneCountries) return [];

    return templates.map((t) => {
      const activeCodes: string[] = [];
      const values: Record<string, { previous: number; forecast: number; actual: number; sigma: number }> = {};

      for (const c of zoneCountries) {
        const rows = countryIndicators[c.code] || [];
        const row = rows.find((r) => r.name === t.name);
        if (row && (row.actual !== 0 || row.forecast !== 0 || row.previous !== 0)) {
          activeCodes.push(c.code);
          values[c.code] = {
            previous: row.previous,
            forecast: row.forecast,
            actual: row.actual,
            sigma: row.sigma,
          };
        }
      }

      if (activeCodes.length === 0) {
        return {
          name: t.name,
          category: t.category,
          sign: t.sign,
          weight: t.weight,
          previous: 0,
          forecast: 0,
          actual: 0,
          sigma: 0,
          activeCountries: 0,
        };
      }

      let previous = 0;
      let forecast = 0;
      let actual = 0;
      let sigma = 0;

      for (const code of activeCodes) {
        const w = getActiveWeight(code, activeCodes);
        previous += values[code].previous * w;
        forecast += values[code].forecast * w;
        actual += values[code].actual * w;
        sigma += values[code].sigma * w;
      }

      return {
        name: t.name,
        category: t.category,
        sign: t.sign,
        weight: t.weight,
        previous: Number(previous.toFixed(4)),
        forecast: Number(forecast.toFixed(4)),
        actual: Number(actual.toFixed(4)),
        sigma: Number(sigma.toFixed(4)),
        activeCountries: activeCodes.length,
      };
    });
  }, [countryIndicators, templates, zoneCountries]);

  const updateIndicator = (countryCode: string, id: number, field: keyof CountryIndicator, value: number | string) => {
    setCountryIndicators((prev) => ({
      ...prev,
      [countryCode]: prev[countryCode].map((ind) =>
        ind.id === id ? { ...ind, [field]: value } : ind
      ),
    }));
  };

  const saveCountry = async (countryCode: string) => {
    const rows = countryIndicators[countryCode];
    if (!rows) return;
    for (const ind of rows) {
      await fetch("/api/country-indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentCurrencyId: selectedCurrencyId,
          countryCode: ind.countryCode,
          countryName: ind.countryName,
          name: ind.name,
          category: ind.category,
          previous: ind.previous,
          forecast: ind.forecast,
          actual: ind.actual,
          sigma: ind.sigma,
          sign: ind.sign,
          weight: ind.weight,
          releaseDate: ind.releaseDate || today,
        }),
      });
    }
  };

  const applyToEur = async () => {
    if (!selectedCurrencyId) return;
    for (const ind of implied) {
      await fetch("/api/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currencyId: selectedCurrencyId,
          name: ind.name,
          category: ind.category,
          previous: ind.previous,
          forecast: ind.forecast,
          actual: ind.actual,
          sigma: ind.sigma,
          sign: ind.sign,
          weight: ind.weight,
          releaseDate: today,
        }),
      });
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const grouped = (countryCode: string) => {
    const rows = countryIndicators[countryCode] || [];
    return {
      Growth: rows.filter((i) => i.category === "Growth"),
      Inflation: rows.filter((i) => i.category === "Inflation"),
      Labor: rows.filter((i) => i.category === "Labor"),
    };
  };

  const groupedImplied = {
    Growth: implied.filter((i) => i.category === "Growth"),
    Inflation: implied.filter((i) => i.category === "Inflation"),
    Labor: implied.filter((i) => i.category === "Labor"),
  };

  if (!zoneCountries) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cette section est disponible uniquement pour la Zone Euro (EUR).
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm font-medium">Zone :</Label>
        <div className="flex flex-wrap gap-2">
          {currencies
            .filter((c) => ZONES[c.code])
            .map((c) => (
              <Button
                key={c.id}
                variant={selectedCurrencyId === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCurrencyId(c.id);
                  setCountryIndicators({});
                }}
              >
                {c.code}
              </Button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Données par pays - {selectedCurrency?.code}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center text-muted-foreground py-6">Chargement...</div>
              ) : (
                <Tabs value={selectedCountry} onValueChange={setSelectedCountry}>
                  <TabsList className="mb-4 flex-wrap h-auto">
                    {zoneCountries.map((c) => (
                      <TabsTrigger key={c.code} value={c.code} className="text-xs">
                        {c.name} ({Math.round(c.weight * 100)}%)
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {zoneCountries.map((c) => {
                    const g = grouped(c.code);
                    return (
                      <TabsContent key={c.code} value={c.code}>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs text-muted-foreground">
                            Saisissez les indicateurs pour {c.name}. Les valeurs à 0 sont ignorées dans le calcul implicite.
                          </p>
                          <Button size="sm" onClick={() => saveCountry(c.code)}>
                            Sauvegarder {c.name}
                          </Button>
                        </div>
                        <div className="space-y-4">
                          {(Object.keys(g) as Array<keyof typeof g>).map((cat) => (
                            <div key={cat} className="space-y-2">
                              <Badge variant="outline" className="text-xs">
                                {cat}
                              </Badge>
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                {g[cat].map((ind) => (
                                  <div key={ind.id} className="border rounded-lg p-3 space-y-2 bg-card">
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium text-sm">{ind.name}</div>
                                      <Input
                                        type="date"
                                        className="h-7 text-xs w-[130px]"
                                        value={ind.releaseDate || today}
                                        onChange={(e) =>
                                          updateIndicator(c.code, ind.id, "releaseDate", e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Précédent</Label>
                                        <Input
                                          type="number"
                                          step="any"
                                          className="h-8 text-sm"
                                          value={ind.previous}
                                          onChange={(e) =>
                                            updateIndicator(c.code, ind.id, "previous", Number(e.target.value))
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Prévision</Label>
                                        <Input
                                          type="number"
                                          step="any"
                                          className="h-8 text-sm"
                                          value={ind.forecast}
                                          onChange={(e) =>
                                            updateIndicator(c.code, ind.id, "forecast", Number(e.target.value))
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Actuel</Label>
                                        <Input
                                          type="number"
                                          step="any"
                                          className="h-8 text-sm"
                                          value={ind.actual}
                                          onChange={(e) =>
                                            updateIndicator(c.code, ind.id, "actual", Number(e.target.value))
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">Sigma</Label>
                                        <Input
                                          type="number"
                                          step="any"
                                          className="h-8 text-sm"
                                          value={ind.sigma}
                                          onChange={(e) =>
                                            updateIndicator(c.code, ind.id, "sigma", Number(e.target.value))
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Zone Euro Implicite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Moyenne pondérée des pays ayant des données. Poids normalisés dynamiquement.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Indicateur</TableHead>
                    <TableHead className="text-xs text-right">Prev</TableHead>
                    <TableHead className="text-xs text-right">Fcst</TableHead>
                    <TableHead className="text-xs text-right">Act</TableHead>
                    <TableHead className="text-xs text-right">Pays</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {implied.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-xs">
                        Aucune donnée saisie
                      </TableCell>
                    </TableRow>
                  )}
                  {implied.map((ind) => (
                    <TableRow key={ind.name}>
                      <TableCell className="text-xs font-medium py-2">{ind.name}</TableCell>
                      <TableCell className="text-xs text-right py-2">{ind.previous || "-"}</TableCell>
                      <TableCell className="text-xs text-right py-2">{ind.forecast || "-"}</TableCell>
                      <TableCell className="text-xs text-right py-2 font-semibold">{ind.actual || "-"}</TableCell>
                      <TableCell className="text-xs text-right py-2 text-muted-foreground">
                        {ind.activeCountries > 0 ? ind.activeCountries : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button className="w-full" onClick={applyToEur} disabled={applied}>
                {applied ? "Appliqué !" : "Appliquer à EUR"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
