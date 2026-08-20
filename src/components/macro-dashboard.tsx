"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalysisPanel } from "./analysis-panel";
import { CalendarPanel } from "./calendar-panel";
import { NewsPanel } from "./news-panel";
import { LayoutDashboard, CalendarDays, Newspaper } from "lucide-react";

const TABS = [
  { value: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { value: "calendar", label: "Calendrier", icon: CalendarDays },
  { value: "news", label: "News", icon: Newspaper },
] as const;

export function MacroDashboard() {
  return (
    <div className="dashboard-ui min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-8 rounded-2xl border border-border/60 bg-gradient-to-r from-card/80 to-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Macro Signal</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
                Biais directionnel quotidien basé sur la macro-économie. Les indicateurs techniques
                (BUY, SELL, Strong, CPI, NFP…) restent en anglais ; les explications et les labels sont en français.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Filtrer Strong/Medium, capturer, puis patienter le prix sur vos zones S/D.
            </div>
          </div>
        </header>

        <Tabs defaultValue="dashboard" className="gap-6">
          <div className="overflow-x-auto pb-2 -mx-1 px-1">
            <TabsList className="h-auto min-h-11 w-max max-w-none flex-wrap gap-1 bg-muted/70 p-1.5 rounded-xl">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-2 space-y-6">
            <AnalysisPanel />
          </TabsContent>
          <TabsContent value="calendar" className="mt-2">
            <CalendarPanel />
          </TabsContent>
          <TabsContent value="news" className="mt-2">
            <NewsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
