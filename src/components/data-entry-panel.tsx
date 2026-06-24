"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Currency {
  id: number;
  code: string;
  name: string;
}

interface IndicatorRow {
  id: number;
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

export function DataEntryPanel() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<IndicatorRow[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const loadCurrencies = () => {
    fetch("/api/currencies")
      .then((r) => r.json())
      .then((d) => setCurrencies(d));
  };

  useEffect(() => {
    loadCurrencies();
  }, []);

  useEffect(() => {
    if (selectedCurrency) {
      fetch(`/api/indicators?currencyId=${selectedCurrency}`)
        .then((r) => r.json())
        .then((d) => setIndicators(d));
    }
  }, [selectedCurrency]);

  const addCurrency = async () => {
    if (!newCode || !newName) return;
    await fetch("/api/currencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode, name: newName }),
    });
    setNewCode("");
    setNewName("");
    loadCurrencies();
  };

  const updateIndicator = (id: number, field: keyof IndicatorRow, value: number | string) => {
    setIndicators((prev) =>
      prev.map((ind) => (ind.id === id ? { ...ind, [field]: value } : ind))
    );
  };

  const handleDateChange = async (indId: number, indName: string, newDate: string) => {
    if (!selectedCurrency || !newDate) return;
    updateIndicator(indId, "releaseDate", newDate);

    const res = await fetch(`/api/indicators?currencyId=${selectedCurrency}&date=${newDate}`);
    const rows: IndicatorRow[] = await res.json();
    const found = rows.find((r) => r.name === indName);

    if (found) {
      setIndicators((prev) =>
        prev.map((ind) =>
          ind.id === indId
            ? {
              ...ind,
              previous: found.previous,
              forecast: found.forecast,
              actual: found.actual,
              sigma: found.sigma,
              releaseDate: found.releaseDate,
            }
            : ind
        )
      );
    } else {
      // no data for this date → clear inputs
      setIndicators((prev) =>
        prev.map((ind) =>
          ind.id === indId
            ? { ...ind, previous: 0, forecast: 0, actual: 0, sigma: 0, releaseDate: newDate }
            : ind
        )
      );
    }
  };

  const saveIndicators = async () => {
    for (const ind of indicators) {
      await fetch("/api/indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currencyId: selectedCurrency,
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
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    // refresh latest
    if (selectedCurrency) {
      fetch(`/api/indicators?currencyId=${selectedCurrency}`)
        .then((r) => r.json())
        .then((d) => setIndicators(d));
    }
  };

  const grouped = {
    Growth: indicators.filter((i) => i.category === "Growth"),
    Inflation: indicators.filter((i) => i.category === "Inflation"),
    Labor: indicators.filter((i) => i.category === "Labor"),
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Devises</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Dialog>
              <DialogTrigger render={<Button variant="secondary">+ Ajouter une devise</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter une devise</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Code (ex. EUR)</Label>
                    <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="EUR" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Euro" />
                  </div>
                  <Button onClick={addCurrency}>Ajouter</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {selectedCurrency && indicators.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>
                Saisie des données : {currencies.find((c) => c.id === selectedCurrency)?.code}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Chaque indicateur a sa propre date. Changez la date pour charger ou vider les données.
              </p>
            </div>
            <Button onClick={saveIndicators}>{saved ? "Enregistré !" : "Tout enregistrer"}</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat) => (
              <div key={cat} className="space-y-2">
                <Badge variant="outline" className="text-sm">
                  {cat}
                </Badge>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grouped[cat].map((ind) => (
                    <div key={ind.id} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{ind.name}</div>
                        <div className="space-y-0">
                          <Label className="text-[10px] text-muted-foreground">Date de publication</Label>
                          <Input
                            type="date"
                            className="h-7 text-xs w-[130px]"
                            value={ind.releaseDate || today}
                            onChange={(e) => handleDateChange(ind.id, ind.name, e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Précédent</Label>
                          <Input
                            type="number"
                            step="any"
                            value={ind.previous}
                            onChange={(e) =>
                              updateIndicator(ind.id, "previous", Number(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prévision</Label>
                          <Input
                            type="number"
                            step="any"
                            value={ind.forecast}
                            onChange={(e) =>
                              updateIndicator(ind.id, "forecast", Number(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Actuel</Label>
                          <Input
                            type="number"
                            step="any"
                            value={ind.actual}
                            onChange={(e) =>
                              updateIndicator(ind.id, "actual", Number(e.target.value))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Sigma</Label>
                          <Input
                            type="number"
                            step="any"
                            value={ind.sigma}
                            onChange={(e) =>
                              updateIndicator(ind.id, "sigma", Number(e.target.value))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
