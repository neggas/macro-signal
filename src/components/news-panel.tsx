"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Newspaper, RefreshCw, ExternalLink } from "lucide-react";

interface NewsArticle {
  symbol: string | null;
  publishedDate: string;
  publisher: string;
  title: string;
  image: string | null;
  site: string;
  text: string;
  url: string;
}

interface FMPArticle {
  title: string;
  date: string;
  content: string;
  tickers: string | null;
  image: string | null;
  link: string;
  author: string;
  site: string;
}

interface NewsData {
  general: NewsArticle[];
  crypto: NewsArticle[];
  forex: NewsArticle[];
  fmpArticles: FMPArticle[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxLen = 200): string {
  const clean = text.replace(/<[^>]*>/g, "").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen) + "...";
}

function ArticleCard({ article }: { article: NewsArticle }) {
  return (
    <Card className="overflow-hidden border-border/60 transition-colors hover:border-border">
      <div className="flex flex-col sm:flex-row">
        {article.image && (
          <div className="sm:w-32 sm:min-w-[128px] h-32 sm:h-auto shrink-0 overflow-hidden bg-muted">
            <img
              src={article.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug">{article.title}</h3>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {truncateText(article.text, 180)}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-normal">
              {article.site}
            </Badge>
            <span>{formatDate(article.publishedDate)}</span>
            {article.symbol && (
              <span className="font-mono text-[10px]">{article.symbol}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function FMPArticleCard({ article }: { article: FMPArticle }) {
  return (
    <Card className="overflow-hidden border-border/60 transition-colors hover:border-border">
      <div className="flex flex-col sm:flex-row">
        {article.image && (
          <div className="sm:w-32 sm:min-w-[128px] h-32 sm:h-auto shrink-0 overflow-hidden bg-muted">
            <img
              src={article.image}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug">{article.title}</h3>
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
            {truncateText(article.content, 180)}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-normal">
              {article.site}
            </Badge>
            <span>{formatDate(article.date)}</span>
            {article.tickers && (
              <span className="font-mono text-[10px]">{article.tickers}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PaginatedList<T>({
  items,
  pageSize,
  page,
  onPage,
  onPageSize,
  render,
  emptyMessage,
  loading,
}: {
  items: T[];
  pageSize: number;
  page: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
  render: (item: T) => React.ReactNode;
  emptyMessage?: string;
  loading?: boolean;
}) {
  const pages = Math.ceil(items.length / pageSize);
  const slice = items.slice(page * pageSize, (page + 1) * pageSize);

  if (items.length === 0 && !loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          {emptyMessage ?? "Aucun article disponible."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {slice.map((item, i) => (
        <div key={i}>{render(item)}</div>
      ))}
      <div className="rounded-lg border border-border/70">
        <PaginationControls
          page={page}
          pages={pages}
          pageSize={pageSize}
          onPage={onPage}
          onPageSize={onPageSize}
          pageSizeOptions={[6, 10, 20, 30]}
        />
      </div>
    </div>
  );
}

export function NewsPanel() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [generalPage, setGeneralPage] = useState(0);
  const [forexPage, setForexPage] = useState(0);
  const [cryptoPage, setCryptoPage] = useState(0);
  const [fmpPage, setFmpPage] = useState(0);
  const [allPage, setAllPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const loadNews = useCallback(() => {
    setLoading(true);
    fetch(`/api/news?category=all`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    setGeneralPage(0);
    setForexPage(0);
    setCryptoPage(0);
    setFmpPage(0);
    setAllPage(0);
  }, [activeTab, pageSize]);

  const general = data?.general ?? [];
  const crypto = data?.crypto ?? [];
  const forex = data?.forex ?? [];
  const fmpArticles = data?.fmpArticles ?? [];

  const allArticles = useMemo(() => {
    return [
      ...fmpArticles.map((a) => ({ ...a, _type: "fmp" as const })),
      ...forex.map((a) => ({ ...a, _type: "forex" as const })),
      ...crypto.map((a) => ({ ...a, _type: "crypto" as const })),
      ...general.map((a) => ({ ...a, _type: "general" as const })),
    ];
  }, [general, crypto, forex, fmpArticles]);

  const allPages = Math.ceil(allArticles.length / pageSize);
  const allSlice = allArticles.slice(allPage * pageSize, (allPage + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">News &amp; Analyse</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Actualités macro, forex, crypto et analyses FMP. Source : Financial Modeling Prep API.
          </p>
        </div>
        <Button onClick={loadNews} disabled={loading} size="sm" variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Chargement..." : "Rafraîchir"}
        </Button>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-lg bg-muted/70 p-1 flex-wrap h-auto">
          <TabsTrigger value="all" className="rounded-md text-sm flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" />
            Tout
          </TabsTrigger>
          <TabsTrigger value="general" className="rounded-md text-sm">
            Macro &amp; Géopolitique
          </TabsTrigger>
          <TabsTrigger value="forex" className="rounded-md text-sm">
            Forex
          </TabsTrigger>
          <TabsTrigger value="crypto" className="rounded-md text-sm">
            Crypto
          </TabsTrigger>
          <TabsTrigger value="fmp" className="rounded-md text-sm">
            Analyses FMP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {allSlice.length === 0 && !loading && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Aucun article disponible.
              </CardContent>
            </Card>
          )}
          {allSlice.map((item, i) => {
            if ("content" in item) {
              return <FMPArticleCard key={i} article={item as FMPArticle} />;
            }
            return <ArticleCard key={i} article={item as NewsArticle} />;
          })}
          {allArticles.length > 0 && (
            <div className="rounded-lg border border-border/70">
              <PaginationControls
                page={allPage}
                pages={allPages}
                pageSize={pageSize}
                onPage={setAllPage}
                onPageSize={setPageSize}
                pageSizeOptions={[6, 10, 20, 30]}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <PaginatedList
            items={general}
            pageSize={pageSize}
            page={generalPage}
            onPage={setGeneralPage}
            onPageSize={setPageSize}
            render={(a) => <ArticleCard article={a} />}
            emptyMessage="Aucun article macro disponible."
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="forex" className="mt-4">
          <PaginatedList
            items={forex}
            pageSize={pageSize}
            page={forexPage}
            onPage={setForexPage}
            onPageSize={setPageSize}
            render={(a) => <ArticleCard article={a} />}
            emptyMessage="Aucun article forex disponible."
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="crypto" className="mt-4">
          <PaginatedList
            items={crypto}
            pageSize={pageSize}
            page={cryptoPage}
            onPage={setCryptoPage}
            onPageSize={setPageSize}
            render={(a) => <ArticleCard article={a} />}
            emptyMessage="Aucun article crypto disponible."
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="fmp" className="mt-4">
          <PaginatedList
            items={fmpArticles}
            pageSize={pageSize}
            page={fmpPage}
            onPage={setFmpPage}
            onPageSize={setPageSize}
            render={(a) => <FMPArticleCard article={a} />}
            emptyMessage="Aucune analyse FMP disponible."
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
