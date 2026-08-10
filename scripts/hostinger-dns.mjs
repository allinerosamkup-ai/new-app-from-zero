#!/usr/bin/env node
/**
 * DNS da Hostinger pela API, para quando não há navegador nem hPanel à mão.
 *
 * Existe porque a alteração de DNS que este projeto precisa (registro TXT de
 * verificação do Search Console, AAAA para IPv6) sempre dependeu de alguém
 * entrar no painel. A API responde de dentro do container do Claude Code —
 * `developers.hostinger.com` devolve 401 com token falso, ou seja, a rota de
 * rede existe e só falta credencial. O que NÃO responde é a porta 22: ela é
 * bloqueada na saída do container (`github.com:22` também dá timeout), então
 * SSH por aqui está fora, com ou sem chave.
 *
 * Uso:
 *   HOSTINGER_API_TOKEN=... node scripts/hostinger-dns.mjs show airia.pro
 *   HOSTINGER_API_TOKEN=... node scripts/hostinger-dns.mjs add airia.pro TXT @ "google-site-verification=..."
 *   HOSTINGER_API_TOKEN=... node scripts/hostinger-dns.mjs add airia.pro TXT @ "..." --apply
 *
 * O token sai de hPanel → Conta → API → gerar token. Ele dá acesso de escrita
 * ao DNS: guarde como variável de ambiente, nunca no repositório.
 *
 * ── Por que `--apply` é obrigatório para escrever ────────────────────────────
 * A API da Hostinger grava zona com `PUT`, que **substitui** o conjunto de
 * registros. Um payload montado errado não devolve erro: ele apaga o que não
 * foi enviado. Como o `A` da raiz e o `CNAME` do `www` são o que mantém o site
 * no ar, um engano aqui tira o app do ar e o e-mail junto.
 *
 * Então: sem `--apply` o script só mostra o que enviaria. E antes de enviar ele
 * confere que o payload contém todos os registros que já existiam — se sumiu
 * algum, ele aborta em vez de gravar. A trava é sobre o payload, não sobre a
 * intenção de quem chamou.
 */

const API = 'https://developers.hostinger.com';
const TOKEN = process.env.HOSTINGER_API_TOKEN;

function morrer(mensagem) {
  console.error(`ERRO: ${mensagem}`);
  process.exit(1);
}

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(opcoes.headers ?? {}),
    },
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    if (resposta.status === 401) morrer('token recusado (401). Gere outro em hPanel → Conta → API.');
    morrer(`${opcoes.method ?? 'GET'} ${caminho} devolveu HTTP ${resposta.status}: ${texto.slice(0, 400)}`);
  }
  return texto ? JSON.parse(texto) : null;
}

/** A zona vem como lista de {name, type, ttl, records:[{content}]}. */
async function lerZona(dominio) {
  const zona = await api(`/api/dns/v1/zones/${encodeURIComponent(dominio)}`);
  if (!Array.isArray(zona)) morrer(`resposta inesperada da API: ${JSON.stringify(zona).slice(0, 400)}`);
  return zona;
}

function descrever(entrada) {
  const conteudos = (entrada.records ?? []).map((r) => r.content).join(' | ');
  return `${entrada.type.padEnd(6)} ${String(entrada.name).padEnd(24)} ttl=${String(entrada.ttl ?? '').padEnd(6)} ${conteudos}`;
}

async function comandoShow(dominio) {
  const zona = await lerZona(dominio);
  console.log(`Zona de ${dominio} — ${zona.length} entradas\n`);
  for (const entrada of zona) console.log('  ' + descrever(entrada));
}

/**
 * Monta o payload de gravação e diz o que ele perderia.
 *
 * Função pura e exportada porque é aqui que mora o risco: a parte que fala com
 * a rede é boba, mas esta decide o que sobrevive na zona. `hostinger-dns.test.mjs`
 * exercita justamente a perda — payload que apaga registro tem que ser barrado
 * antes de virar `PUT`.
 */
export function montarPayload(zona, novo) {
  const chave = (e) => `${e.type}::${e.name}`;
  const jaExiste = zona.some((e) => chave(e) === chave(novo));

  // Mesmo nome e tipo: acrescenta conteúdo em vez de trocar. Vários TXT no
  // mesmo nome é o caso normal — verificação de busca, SPF e afins convivem.
  const payload = jaExiste
    ? zona.map((e) =>
        chave(e) === chave(novo)
          ? { ...e, records: [...e.records, ...novo.records] }
          : e,
      )
    : [...zona, novo];

  const perdidos = zona
    .filter((e) => !payload.some((p) => chave(p) === chave(e)))
    .map(chave);

  const conteudosDepois = new Set(payload.flatMap((e) => e.records.map((r) => `${chave(e)}=${r.content}`)));
  const sumiram = zona
    .flatMap((e) => e.records.map((r) => `${chave(e)}=${r.content}`))
    .filter((c) => !conteudosDepois.has(c));

  return { payload, perdidos, sumiram, jaExiste };
}

async function comandoAdd(dominio, tipo, nome, conteudo, aplicar) {
  const zona = await lerZona(dominio);
  const novo = { name: nome, type: tipo, ttl: 3600, records: [{ content: conteudo }] };
  const { payload, perdidos, sumiram, jaExiste } = montarPayload(zona, novo);

  if (jaExiste) console.log(`Já existe ${tipo} em "${nome}". O conteúdo novo entra junto, sem substituir.\n`);

  console.log('Payload que seria enviado:\n');
  for (const entrada of payload) console.log('  ' + descrever(entrada));

  if (perdidos.length > 0) {
    morrer(`o payload perderia ${perdidos.length} registro(s): ${perdidos.join(', ')}. Nada foi enviado.`);
  }
  if (sumiram.length > 0) {
    morrer(`o payload perderia conteúdo existente: ${sumiram.join(', ')}. Nada foi enviado.`);
  }

  if (!aplicar) {
    console.log('\nEnsaio. Nada foi enviado. Repita com --apply para gravar.');
    return;
  }

  await api(`/api/dns/v1/zones/${encodeURIComponent(dominio)}`, {
    method: 'PUT',
    body: JSON.stringify({ overwrite: true, zone: payload }),
  });
  console.log('\nGravado. A propagação segue o TTL; consulte com `show` para conferir.');
}

// O CLI só roda quando o arquivo é chamado direto. Importado pelo teste, o
// módulo entrega as funções puras e não toca em `process.argv` nem na rede.
const chamadoDireto = process.argv[1]?.endsWith('hostinger-dns.mjs') ?? false;

if (chamadoDireto) {
  const [comando, dominio, ...resto] = process.argv.slice(2);
  const aplicar = resto.includes('--apply');
  const argumentos = resto.filter((a) => a !== '--apply');

  if (!TOKEN) morrer('defina HOSTINGER_API_TOKEN (hPanel → Conta → API).');
  if (!comando || !dominio) {
    morrer('uso: hostinger-dns.mjs show <dominio> | add <dominio> <TIPO> <nome> <conteudo> [--apply]');
  }

  if (comando === 'show') {
    await comandoShow(dominio);
  } else if (comando === 'add') {
    const [tipo, nome, conteudo] = argumentos;
    if (!tipo || !nome || !conteudo) morrer('uso: add <dominio> <TIPO> <nome> <conteudo> [--apply]');
    await comandoAdd(dominio, tipo.toUpperCase(), nome, conteudo, aplicar);
  } else {
    morrer(`comando desconhecido: ${comando}`);
  }
}
