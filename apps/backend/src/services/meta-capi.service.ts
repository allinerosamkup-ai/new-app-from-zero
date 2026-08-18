/**
 * Meta Conversions API (CAPI) — envio server-side de eventos ao Pixel do livro.
 *
 * Fecha o furo do funil: quando a compra do livro acontece na Hotmart, o evento
 * Purchase é enviado direto do backend para o Meta (não depende do browser do
 * comprador), com deduplicação por event_id contra o Pixel do navegador.
 *
 * Env: META_CAPI_PIXEL_ID, META_CAPI_ACCESS_TOKEN, META_CAPI_TEST_EVENT_CODE (opcional).
 */
import crypto from 'crypto';

const GRAPH_VERSION = 'v21.0';

/** Normaliza + SHA-256 (exigência do Meta para dados pessoais). */
function hash(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export interface CapiEventInput {
  email?: string;
  firstName?: string;
  value: number;
  currency: string;
  eventId: string; // usado para deduplicação com o Pixel do browser
  eventTime?: number; // epoch segundos; default = agora
  eventSourceUrl?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
}

/** @deprecated use CapiEventInput */
export type CapiPurchaseInput = CapiEventInput;

export interface CapiResult {
  sent: boolean;
  skipped?: string;
  status?: number;
  response?: unknown;
}

/**
 * Envia um evento de conversão para a Conversions API.
 * Se META_CAPI_ACCESS_TOKEN não estiver setado, não quebra — retorna { sent:false, skipped }.
 */
export async function sendConversionEvent(
  eventName: 'Purchase' | 'Subscribe',
  input: CapiEventInput,
): Promise<CapiResult> {
  const pixelId = process.env.META_CAPI_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    return { sent: false, skipped: 'META_CAPI_PIXEL_ID/ACCESS_TOKEN não configurados' };
  }

  const userData: Record<string, unknown> = {};
  const em = hash(input.email);
  const fn = hash(input.firstName);
  if (em) userData.em = [em];
  if (fn) userData.fn = [fn];
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: 'website',
        event_source_url: input.eventSourceUrl,
        user_data: userData,
        custom_data: { currency: input.currency, value: input.value },
      },
    ],
  };
  if (testEventCode) body.test_event_code = testEventCode;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const response = await res.json().catch(() => null);
  if (!res.ok) {
    return { sent: false, status: res.status, response };
  }
  return { sent: true, status: res.status, response };
}

/** Purchase (compra do livro via Hotmart). */
export function sendPurchaseEvent(input: CapiEventInput): Promise<CapiResult> {
  return sendConversionEvent('Purchase', input);
}

/** Subscribe (assinatura Airia Pro confirmada pela Cakto). */
export function sendSubscribeEvent(input: CapiEventInput): Promise<CapiResult> {
  return sendConversionEvent('Subscribe', input);
}
