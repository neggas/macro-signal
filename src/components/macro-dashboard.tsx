"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisPanel } from "./analysis-panel";
import { DataEntryPanel } from "./data-entry-panel";
import { MarketPositioningForm } from "./market-positioning-form";
import { BacktestPanel } from "./backtest-panel";
import { CountryBreakdownPanel } from "./country-breakdown-panel";
import { PerformancePanel } from "./performance-panel";
import { SyncPanel } from "./sync-panel";

export function MacroDashboard() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord Macro</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Moteur d'analyse fondamentale avec scoring macro adaptatif, probabilités de réaction des banques centrales et signaux de paires.
        </p>
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="data">Saisie des données</TabsTrigger>
          <TabsTrigger value="positioning">Positionnement marché</TabsTrigger>
          <TabsTrigger value="backtest">Backtest</TabsTrigger>
          <TabsTrigger value="countries">Pays ZE</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="sync">Auto-Sync</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <AnalysisPanel />
        </TabsContent>
        <TabsContent value="data">
          <DataEntryPanel />
        </TabsContent>
        <TabsContent value="positioning">
          <MarketPositioningForm />
        </TabsContent>
        <TabsContent value="backtest">
          <BacktestPanel />
        </TabsContent>
        <TabsContent value="countries">
          <CountryBreakdownPanel />
        </TabsContent>
        <TabsContent value="performance">
          <PerformancePanel />
        </TabsContent>
        <TabsContent value="sync">
          <SyncPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
