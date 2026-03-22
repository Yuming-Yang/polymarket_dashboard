export const activeGammaMarketFixture = {
  id: "gamma-market-1",
  conditionId: "condition-1",
  question: "Will it rain?",
  slug: "will-it-rain",
  active: true,
  closed: false,
  resolved: false,
  volume24hr: "250000",
  clobTokenIds: '["token-yes","token-no"]',
  outcomes: '["YES","NO"]',
};

export const resolvedGammaMarketFixture = {
  id: "gamma-market-2",
  conditionId: "condition-2",
  question: "Resolved market",
  slug: "resolved-market",
  active: false,
  closed: true,
  resolved: true,
  volume24hr: "0",
  clobTokenIds: '["winner-token","loser-token"]',
  outcomes: '["YES","NO"]',
  winner: "YES",
};

export const unresolvedWinnerGammaMarketFixture = {
  id: "gamma-market-3",
  conditionId: "condition-3",
  question: "Missing winner market",
  slug: "missing-winner-market",
  active: false,
  closed: true,
  resolved: true,
  volume24hr: "0",
  clobTokenIds: '["token-a","token-b"]',
  outcomes: '["YES","NO"]',
};
