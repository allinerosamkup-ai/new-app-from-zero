/**
 * Hotmart integration — livro "Antes de se cobrar" (produto id 8031043).
 *
 * Autentica via OAuth client_credentials e consulta a API de vendas.
 * Credenciais em .env: HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_BASIC.
 *
 * O token dura ~48h; guardamos em cache em memória e renovamos com folga.
 */

const OAUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const API_BASE = 'https://developers.hotmart.com/payments/api/v1';

export interface HotmartSale {
  transaction: string;
  status: string;
  productId: number;
  productName: string;
  buyerEmail: string;
  buyerName: string;
  price: number;
  currency: string;
  isSubscription: boolean;
  orderDate: number; // epoch ms
  approvedDate: number | null; // epoch ms
  paymentMethod: string;
}

export interface HotmartSalesResult {
  sales: HotmartSale[];
  totalResults: number;
  raw: unknown;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

function requireEnv(): { clientId: string; clientSecret: string; basic: string } {
  const clientId = process.env.HOTMART_CLIENT_ID;
  const clientSecret = process.env.HOTMART_CLIENT_SECRET;
  const basic = process.env.HOTMART_BASIC;
  if (!clientId || !clientSecret || !basic) {
    throw new Error(
      'Hotmart não configurado: defina HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET e HOTMART_BASIC no .env',
    );
  }
  return { clientId, clientSecret, basic };
}

/** Retorna um access token válido, renovando pelo cache quando faltar < 5 min. */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret, basic } = requireEnv();
  const url =
    `${OAUTH_URL}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: basic, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Hotmart OAuth falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Hotmart OAuth: resposta sem access_token');
  }

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  cachedToken = { accessToken: data.access_token, expiresAt: now + expiresInMs };
  return data.access_token;
}

function mapSale(item: any): HotmartSale {
  const purchase = item?.purchase ?? {};
  const price = purchase?.price ?? {};
  const payment = purchase?.payment ?? {};
  const product = item?.product ?? {};
  const buyer = item?.buyer ?? {};
  return {
    transaction: purchase?.transaction ?? '',
    status: purchase?.status ?? 'UNKNOWN',
    productId: product?.id ?? 0,
    productName: product?.name ?? '',
    buyerEmail: buyer?.email ?? '',
    buyerName: buyer?.name ?? '',
    price: typeof price?.value === 'number' ? price.value : 0,
    currency: price?.currency_code ?? 'BRL',
    isSubscription: Boolean(purchase?.is_subscription),
    orderDate: purchase?.order_date ?? 0,
    approvedDate: purchase?.approved_date ?? null,
    paymentMethod: payment?.type ?? '',
  };
}

/**
 * Consulta o histórico de vendas.
 * @param opts.maxResults  quantidade por página (default 50)
 * @param opts.productId   filtra por produto (ex.: 8031043 = "Antes de se cobrar")
 * @param opts.startDate   epoch ms — vendas a partir de
 * @param opts.endDate     epoch ms — vendas até
 */
export async function getSalesHistory(opts: {
  maxResults?: number;
  productId?: number;
  startDate?: number;
  endDate?: number;
} = {}): Promise<HotmartSalesResult> {
  const token = await getAccessToken();
  const params = new URLSearchParams();
  params.set('max_results', String(opts.maxResults ?? 50));
  if (opts.productId) params.set('product_id', String(opts.productId));
  if (opts.startDate) params.set('start_date', String(opts.startDate));
  if (opts.endDate) params.set('end_date', String(opts.endDate));

  const res = await fetch(`${API_BASE}/sales/history?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Hotmart sales/history falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { items?: any[]; page_info?: { total_results?: number } };
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    sales: items.map(mapSale),
    totalResults: data.page_info?.total_results ?? items.length,
    raw: data,
  };
}
