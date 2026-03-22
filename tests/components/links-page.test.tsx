import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LinksPage } from "@/components/LinksPage";

const expectedOfficialDashboards = [
  {
    name: "Fed Rates",
    href: "https://polymarket.com/dashboards/fed-rates",
  },
  {
    name: "Macro",
    href: "https://polymarket.com/dashboards/macro",
  },
  {
    name: "Global Elections",
    href: "https://polymarket.com/dashboards/global-elections",
  },
] as const;

const expectedToolNames = [
  "Dune — Prediction Markets",
  "Polymarket Analytics",
  "PolyAlertHub",
  "Polywhaler",
  "Polysights",
  "Hashdive",
  "Tremor",
  "PredictFolio",
  "Prediedge",
  "Unusual Whales",
] as const;

const expectedChineseDescriptions = [
  "预测市场的链上数据看板，覆盖交易量、活跃用户、市场增长趋势等核心指标，是最全面的原始数据来源。",
  "面向专业交易者的综合数据平台，追踪交易员历史盈亏、交易模式，并提供 Polymarket 与 Kalshi 之间的跨市场套利扫描。曾被 WSJ 和 CoinDesk 引用，数据由 Goldsky 驱动，近实时更新。",
  "Polymarket 官方认证的 Build Partner。提供完整的提醒与分析终端，包括巨鲸提醒、内幕交易检测、模拟交易和市场浏览器，追踪 15,000+ 市场，已累计发送超 1000 万条提醒。",
  "专注巨鲸与内幕交易追踪。实时展示大额交易及其冲击评分（高/中/低），标记新钱包、隐秘交易，并对每笔交易给出内幕概率评分，附带聪明钱钱包排行榜。",
  "AI 驱动的分析平台，内置 Insider Finder、30+ 自定义指标、市场摘要和执行终端（Beta），底层使用 Vertex AI 和 Gemini 进行信号提取。",
  "面向 Polymarket 和 Kalshi 的机构级分析终端。独创 Smart Score（−100 到 +100）量化交易员质量，过滤噪音找出真正的聪明钱，并支持 RSI/MACD 风格图表和流动性/量能筛选器。",
  "生态内数据深度最强的终端。基于 ClickHouse 的 SQL 查询引擎，覆盖 14 万+ 活跃市场，支持 Claude AI 自然语言转 SQL 查询，适合自定义深度研究。",
  "免费的交易员 Portfolio 追踪工具。输入任意钱包地址可查看历史盈亏、胜负率、持仓和交易记录，收录 240 万+ 交易员、$50 亿+ 交易量，适合研究特定钱包或追踪聪明钱。",
  "覆盖 Polymarket 和 Kalshi 的实时巨鲸与大单监控，标记 $1,000 以上的异常交易，提供内幕/可疑模式评分和新钱包检测，专注于信号捕捉速度。",
  "以美股期权流著称，现已扩展至预测市场。提供 Z-score 异常检测、账户注册时间分析，以及 Smart Gap 可视化（聪明钱与大众预期的偏离程度），适合跨资产研究参考。",
] as const;

describe("LinksPage", () => {
  it("renders the official dashboard cards in order with the right external links", () => {
    render(<LinksPage />);

    const officialList = screen.getByRole("list", { name: "Polymarket official dashboards" });
    const officialItems = within(officialList).getAllByRole("listitem");

    expect(officialItems).toHaveLength(3);
    expect(
      officialItems.map((item) => within(item).getByRole("heading", { level: 3 }).textContent),
    ).toEqual(expectedOfficialDashboards.map((dashboard) => dashboard.name));

    for (const dashboard of expectedOfficialDashboards) {
      const link = screen.getByRole("link", { name: `Open ${dashboard.name}` });
      expect(link).toHaveAttribute("href", dashboard.href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });

  it("renders the ecosystem tools in the provided order with verbatim Chinese descriptions", () => {
    render(<LinksPage />);

    const toolsList = screen.getByRole("list", { name: "Ecosystem tools" });
    const toolItems = within(toolsList).getAllByRole("listitem");

    expect(toolItems).toHaveLength(10);
    expect(toolItems.map((item) => within(item).getByRole("heading", { level: 3 }).textContent)).toEqual(expectedToolNames);

    for (const description of expectedChineseDescriptions) {
      expect(screen.getByText(description)).toBeInTheDocument();
    }
  });

  it("shows external affordances on representative dashboard and tool links", () => {
    render(<LinksPage />);

    const dashboardLink = screen.getByRole("link", { name: "Open Fed Rates" });
    const toolLink = screen.getByRole("link", { name: "Open PolyAlertHub" });

    expect(dashboardLink).toHaveTextContent("polymarket.com/dashboards/fed-rates");
    expect(dashboardLink.querySelector("svg")).not.toBeNull();
    expect(toolLink).toHaveTextContent("polyalerthub.com");
    expect(toolLink).toHaveAttribute("target", "_blank");
    expect(toolLink.querySelector("svg")).not.toBeNull();
  });
});
