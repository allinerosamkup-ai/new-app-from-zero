# INFRA_ACCESS — o que dá para fazer de onde

> Camada A. **O que cada ambiente alcança, medido, e o caminho que funciona
> quando o óbvio não funciona.** Consulte antes de dizer que algo é impossível —
> e antes de tentar um caminho que já foi medido como fechado.

Medições de **2026-08-10**, do container do Claude Code na nuvem.

---

## O container do Claude Code na nuvem não tem SSH. Isto não se contorna.

A saída de rede é **só HTTPS, por um proxy com política** (`HTTPS_PROXY` →
`127.0.0.1:41441`). A porta 22 não passa:

| Teste | Resultado |
|---|---|
| TCP para `195.35.17.102:22` | timeout |
| TCP para `github.com:22` | **timeout também** |
| `~/.ssh` | vazio |
| `ssh-agent` / `SSH_AUTH_SOCK` | não existe |

O segundo teste é o que decide: **o bloqueio é na saída do container, não no
firewall da VPS**. Cliente `ssh` instalado, chave gerada, chave cadastrada na
Hostinger — nada disso muda o resultado. Não gaste rodada tentando.

O ambiente local (Windows da Alline) tem SSH normal. A skill
`.agents/skills/deploy-airia/SKILL.md` descreve **aquele** ambiente; ela não
vale aqui.

---

## Deploy sem SSH: `.github/workflows/deploy.yml`

O runner do GitHub alcança a porta 22. É a ponte.

**Aba Actions → "Deploy VPS" → Run workflow.** Roda `git pull` + `deploy.sh` na
VPS e imprime o estado de `airia.pro`, `www.airia.pro` e `/api/health` no fim,
mesmo se o deploy falhar no meio.

Não dispara sozinho no push, de propósito: deploy tem consequência para quem
está usando o app agora, e quem aperta é uma pessoa.

Precisa destes segredos do repositório (Settings → Secrets and variables →
Actions). Enquanto faltarem, o workflow falha no **primeiro** passo dizendo qual
falta, em vez de morrer com `Permission denied (publickey)`:

| Segredo | Conteúdo |
|---|---|
| `VPS_SSH_KEY` | chave **privada** com acesso root na VPS, conteúdo inteiro |
| `VPS_HOST` | IP ou host da VPS |
| `VPS_USER` | opcional, padrão `root` |

`deploy.sh` cancela sozinho se o checkout da VPS divergir de `origin/master` —
o script é a autoridade sobre isso, o workflow não duplica a regra.

---

## DNS pela API da Hostinger: `scripts/hostinger-dns.mjs`

**Esta rota funciona do container.** Medido: `developers.hostinger.com` devolve
**401** com token falso em `/api/dns/v1/zones/airia.pro`,
`/api/vps/v1/virtual-machines` e `/api/domains/v1/portfolio` — ou seja, a rede
chega e só falta credencial.

Dois enganos que custam tempo:
- `api.hostinger.com` é o host errado — devolve erro 1016 da Cloudflare.
- `hpanel.hostinger.com` responde **403 com desafio da Cloudflare** para IP de
  datacenter. Navegador headless cai no mesmo desafio. O painel não é caminho
  daqui; a API é.

```bash
export HOSTINGER_API_TOKEN=...        # hPanel → Conta → API
node scripts/hostinger-dns.mjs show airia.pro
node scripts/hostinger-dns.mjs add airia.pro TXT @ "google-site-verification=..."
node scripts/hostinger-dns.mjs add airia.pro TXT @ "..." --apply
```

**Sem `--apply` nada é enviado.** A API grava zona com `PUT`, que substitui o
conjunto: payload errado não dá erro, apaga em silêncio. E o que está na zona é
o `A` da raiz e o `CNAME` do `www` — o app no ar. Por isso o script recusa
qualquer payload que perca registro **ou** que perca um conteúdo dentro de um
registro que continua existindo (o caso do SPF, que quebra e-mail sem quebrar
site). `scripts/hostinger-dns.test.mjs` exercita justamente essas perdas; roda
sem rede e sem dependência.

O token dá escrita no DNS: variável de ambiente, nunca no repositório.

**Não testado contra a API real** — só contra o 401. O primeiro `--apply` merece
um `show` antes e outro depois.

---

## Estado do domínio, medido

`airia.pro` → `A 195.35.17.102`. `www.airia.pro` → `CNAME airia.pro`.
Nameservers `ns1/ns2.dns-parking.com` (Hostinger). Certificado Let's Encrypt
cobre os dois hosts. `http://` de cada um faz 301 para o próprio `https://`.
TLS 1.2 e 1.3 aceitos, HTTP/2 nos dois.

**Os dois hosts servem 200 de propósito** — o PWA está instalado no `www` e
redirecionar já quebrou a produção uma vez. A consolidação é por `rel=canonical`.
Ver `LEARNINGS.md`.

Faltando, e por quê:

| Pendência | Onde | Efeito |
|---|---|---|
| Propriedade de **domínio** no Search Console | TXT no DNS | hoje a propriedade é `https://airia.pro/` (prefixo de URL); tudo que o Google resolver atribuir ao `www` fica invisível no relatório e sem como pedir indexação |
| Registro **AAAA** | DNS | sem IPv6, aparelho em rede IPv6-only depende de NAT64/DNS64 da operadora |

O token de verificação do Search Console nasce dentro da conta Google no momento
em que a propriedade é criada — não há como gerá-lo por fora.
