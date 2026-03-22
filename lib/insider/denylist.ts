const PLATFORM_WALLET_DENYLIST: string[] = [];

function parseEnvWalletDenylist() {
  const rawValue = process.env.POLYMARKET_WALLET_DENYLIST ?? "";
  return rawValue
    .split(",")
    .map((wallet) => wallet.trim().toLowerCase())
    .filter((wallet) => wallet.length > 0);
}

const normalizedDenylist = new Set([...PLATFORM_WALLET_DENYLIST.map((wallet) => wallet.toLowerCase()), ...parseEnvWalletDenylist()]);

export function isExcludedWallet(wallet: string) {
  return normalizedDenylist.has(wallet.toLowerCase());
}

export function getExcludedWallets() {
  return [...normalizedDenylist];
}
