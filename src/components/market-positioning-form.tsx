"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MPData {
  id: number;
  cotSpxNetSpec: number;
  cotUsdNetSpec: number;
  vixLevel: number;
  retailSentiment: string;
}

export function MarketPositioningForm() {
  const [data, setData] = useState<MPData>({
    id: 1,
    cotSpxNetSpec: 0,
    cotUsdNetSpec: 0,
    vixLevel: 20,
    retailSentiment: "neutral",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/market-positioning")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.id) {
          setData({
            id: d.id ?? 1,
            cotSpxNetSpec: d.cotSpxNetSpec ?? 0,
            cotUsdNetSpec: d.cotUsdNetSpec ?? 0,
            vixLevel: d.vixLevel ?? 20,
            retailSentiment: d.retailSentiment || "neutral",
          });
        }
      });
  }, []);

  const save = async () => {
    await fetch("/api/market-positioning", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Positionnement du marché</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>COT SPX Net Spec</Label>
            <Input
              type="number"
              step="any"
              value={data.cotSpxNetSpec}
              onChange={(e) => setData({ ...data, cotSpxNetSpec: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Net long = haussier risk-on, Net short = baissier</p>
          </div>
          <div className="space-y-2">
            <Label>COT USD Net Spec</Label>
            <Input
              type="number"
              step="any"
              value={data.cotUsdNetSpec}
              onChange={(e) => setData({ ...data, cotUsdNetSpec: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">Net short = haussier risk-on, Net long = baissier</p>
          </div>
          <div className="space-y-2">
            <Label>VIX Level</Label>
            <Input
              type="number"
              step="any"
              value={data.vixLevel}
              onChange={(e) => setData({ ...data, vixLevel: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground"><span dangerouslySetInnerHTML={{ __html: '&lt;' }} />20 calme, <span dangerouslySetInnerHTML={{ __html: '&gt;' }} />30 peur</p>
          </div>
          <div className="space-y-2">
            <Label>Sentiment Retail</Label>
            <Select
              value={data.retailSentiment}
              onValueChange={(v) => v && setData({ ...data, retailSentiment: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="neutral">Neutre</SelectItem>
                <SelectItem value="extreme_bearish">Extrêmement baissier</SelectItem>
                <SelectItem value="extreme_bullish">Extrêmement haussier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={save}>{saved ? "Enregistré !" : "Enregistrer le positionnement"}</Button>
      </CardContent>
    </Card>
  );
}
