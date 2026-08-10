# Onboarding, assinatura e profissionais parceiros — design aprovado

**Data:** 2026-08-10

**Status:** aprovado pela Alline

**Escopo:** web, backend, banco, Stripe e programa inicial de profissionais parceiros

## Objetivo

Consolidar o onboarding atual da Airia em um único fluxo, iniciar uma experiência
Pro gradual depois que a usuária recebe valor, cobrar com Stripe de forma
confiável e criar a fundação de um programa de psicólogas verificadas pelo CRP.

## Diagnóstico confirmado

- O onboarding atual está em `/comecar`, mas Configurações e outros atalhos ainda
  abrem `/onboarding/guiado`; o formulário legado continua em `/onboarding`.
- O onboarding atual grava perfil operacional, objetivos e primeiro check-in,
  mas não marca `profiles.onboarding_done`. Só o fluxo antigo faz isso.
- A tela de billing trata `?status=success` como assinatura ativada antes da
  confirmação do servidor.
- O Stripe live tem produto e preços de R$ 29,90/mês e R$ 249/ano, mas ainda
  não tem a oferta vitalícia de R$ 99 pedida pela Alline. A conta também está com
  cobranças desabilitadas, sem webhook e sem portal configurado.
- `STRIPE_PRICE_ID_ANNUAL` aponta para um preço ativo; `STRIPE_PRICE_ID` não.
- O convite atual é apenas um hash local do `userId`; não há atribuição,
  persistência, benefício nem prevenção de fraude.

## Decisões de produto

### Usuária comum

- Recebe 7 dias de Airia Pro sem cartão ao concluir o onboarding.
- O fim do onboarding mostra o valor já criado e informa o período Pro.
- `Entrar na minha Airia` é a ação principal; `Ver planos` é secundária.
- Não há interrupção de pagamento nos dois primeiros dias.
- Lembretes aparecem depois de valor real, com limite de frequência.
- Depois do período Pro, o núcleo gratuito permanece disponível e os dados são
  preservados. Recursos Pro mostram uma oferta contextual, nunca um bloqueio
  enganoso.

### Usuária indicada por profissional verificada

- Recebe 14 dias de Airia Pro sem cartão.
- O benefício é vinculado no servidor uma única vez e não pode ser acumulado.
- A comunicação diz que é um benefício da assinatura Airia. Não é desconto no
  atendimento psicológico nem promessa clínica.

### Profissional parceira

- Informa nome profissional, estado e número do CRP.
- O cadastro começa como `pending` e só recebe benefício após confirmação de
  inscrição ativa no Cadastro Nacional de Profissionais de Psicologia.
- A verificação inicial pode ser manual assistida porque não há contrato de API
  oficial identificado para consulta automática confiável.
- Enquanto `verified`, a profissional recebe acesso Pro gratuito e um link de
  indicação persistente.
- Não há comissão financeira nesta fase.
- Uma nova checagem periódica pode alterar o estado para `review_required` sem
  apagar dados nem cancelar silenciosamente uma assinatura paga existente.

## Experiência da usuária

### Entrada e onboarding

1. Cadastro ou conta nova chega ao onboarding canônico `/comecar`.
2. `/onboarding`, `/onboarding/guiado` e etapas antigas redirecionam para
   `/comecar`, preservando links antigos sem manter fluxos duplicados.
3. `Refazer onboarding` limpa apenas o rascunho da experiência atual e abre
   `/comecar`; agenda, hábitos, metas, assinatura e indicação permanecem.
4. A conclusão chama um contrato idempotente de backend que marca
   `onboardingDone` e concede o período Pro apenas na primeira conclusão.
5. O último quadro informa a data final do acesso Pro e oferece entrada no app.

### Conversão gradual

- Dias 1–2: nenhuma oferta automática.
- A partir do dia 3: uma oferta discreta somente depois de um momento de valor
  registrado, como check-in concluído ou resposta útil da Airia.
- Dia 5: lembrete de dois dias, com resumo baseado em uso real.
- Dia 7/14: tela de continuidade com mensal, anual e vitalício. Nenhuma opção
  fica escondida. O vitalício de R$ 99 é tratado como oferta especial
  controlável, porque seu valor é inferior ao anual e tende a canibalizar as
  assinaturas se ficar disponível sem estratégia de encerramento.
- Depois do vencimento: núcleo gratuito + paywalls contextuais com cooldown.
- Ações de segurança, privacidade, exportação e acesso aos próprios dados nunca
  ficam atrás de paywall.

## Arquitetura e dados

### `BillingAccount`

Nova relação 1:1 com `Profile`, separada de `OnboardingResponse`:

- `userId` único;
- `stripeCustomerId` e `stripeSubscriptionId` únicos e opcionais;
- `status`, `plan` (`monthly`, `annual` ou `lifetime`), `priceId` e
  `currentPeriodEnd`;
- `trialStartedAt`, `trialEndsAt` e `trialSource`;
- `cancelAtPeriodEnd`;
- timestamps.

O acesso é calculado no servidor a partir de assinatura paga, período Pro ou
profissional verificada. Campos Stripe antigos permanecem temporariamente para
compatibilidade e são migrados antes de remoção futura.

### `ProfessionalPartner`

- `userId` único;
- `professionalName`, `crpRegion`, `crpNumber`;
- `verificationStatus` (`pending`, `verified`, `rejected`, `review_required`);
- `verifiedAt`, `lastVerifiedAt`, `verificationNote` sem documentos sensíveis;
- `referralCode` aleatório e único;
- `active` e timestamps.

### `ReferralAttribution`

- `referredUserId` único;
- `professionalPartnerId`;
- código utilizado, origem e data;
- benefício concedido e duração;
- data de conversão paga, quando houver.

O registro representa atribuição comercial, não relação terapeuta–paciente.

### `StripeWebhookEvent`

- `stripeEventId` único;
- tipo, modo e timestamps de processamento;
- resultado resumido sem payload financeiro sensível.

Esse registro impede efeitos duplicados quando o Stripe reenvia eventos.

## Contratos de API

- `POST /api/onboarding/complete` — conclui o onboarding e concede o período Pro
  de forma idempotente.
- `GET /api/billing/status` — devolve fonte de acesso, dias restantes, plano,
  estado da assinatura e capacidades da interface.
- `POST /api/billing/checkout` — valida plano no servidor e cria Checkout.
- `GET /api/billing/checkout-session/:id` — confirma que a sessão pertence à
  usuária antes de mostrar sucesso.
- `POST /api/billing/portal` — abre o portal somente para customer válido.
- `POST /api/billing/webhook` — valida assinatura, registra evento idempotente e
  sincroniza assinatura/faturas.
- `POST /api/referrals/claim` — aplica indicação válida uma única vez.
- `GET /api/referrals/me` — devolve atribuição e benefício atuais.
- `POST /api/professional-partners/apply` — envia cadastro de CRP.
- `GET /api/professional-partners/me` — devolve estado e link da profissional.
- Rotas administrativas de aprovação usam a proteção administrativa já adotada
  pelo backend e nunca ficam disponíveis apenas com autenticação comum.

## Stripe

- Checkout usa somente IDs de preço definidos e validados no servidor.
- Mensal e anual usam Checkout `subscription`; vitalício usa Checkout `payment`
  e só concede acesso permanente depois da confirmação server-side do pagamento.
- `success_url` inclui `{CHECKOUT_SESSION_ID}`; a UI mostra `processando` até a
  confirmação do servidor/webhook.
- A sessão recebe `client_reference_id`, metadata de usuário e plano e chave de
  idempotência por tentativa lógica.
- Eventos mínimos: `checkout.session.completed`,
  `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.
- Portal permite atualizar pagamento, consultar faturas e cancelar assinatura.
- O webhook live aponta para `https://airia.pro/api/billing/webhook`.
- O preço mensal local é alinhado ao preço ativo de R$ 29,90, o anual permanece
  R$ 249 e o vitalício é um pagamento único de R$ 99.
- Nenhuma tela afirma sucesso apenas porque recebeu um parâmetro de URL.

## Estados de erro

- Falha no Stripe não impede a conclusão do onboarding nem o período Pro local.
- Código inválido mantém os 7 dias normais e explica o erro sem perder respostas.
- Cadastro CRP pendente mantém o plano normal até aprovação.
- Webhook duplicado responde com sucesso sem repetir concessões ou eventos.
- Assinatura `past_due`, `incomplete` ou `unpaid` não é tratada como ativa.
- Toda chamada tem loading, erro visível e retry seguro.

## Comunicação e ética

- Airia permanece complementar e não substitui atendimento psicológico.
- Não usar `cupom de terapia`, `desconto da psicóloga` ou promessa de resultado
  clínico.
- Não pagar comissão por paciente nesta fase.
- Não registrar diagnóstico, conteúdo terapêutico ou identidade do profissional
  nos eventos de marketing.
- Antes de publicidade pública do programa, termos e mensagens passam por
  revisão jurídica/ética específica.

## Eventos e métricas

- `onboarding_completed`
- `pro_trial_started`
- `pro_trial_reminder_shown`
- `paywall_viewed` com contexto não sensível
- `checkout_started`, `checkout_confirmed`, `checkout_failed`
- `referral_claimed`, `referral_converted`
- `professional_application_submitted`, `professional_verified`

Métricas principais: conclusão do onboarding, ativação no período Pro, retenção
no dia 3/7, abertura de oferta, início/conclusão de Checkout e conversão por
indicação.

## Verificação e lançamento

- TDD para regras de trial, entitlement, indicação, CRP e webhook.
- Contratos frontend/backend e migração Prisma testados.
- Testes de rota autenticada e isolamento por `userId`.
- Browser mobile: cadastro → onboarding → período Pro → lembrete → checkout →
  retorno pendente → assinatura ativa → portal → reload.
- Browser: Configurações → Refazer onboarding abre o fluxo atual.
- Stripe test mode cobre pagamento e webhooks; live mode só é declarado ativo
  depois de `charges_enabled=true`, métodos disponíveis e endpoint saudável.
- Liberação protegida por flags até backend, migração, frontend e Stripe estarem
  sincronizados.

## Fora desta fase

- Comissão ou afiliado pago para psicólogas.
- Licença B2B para clínicas.
- Desconto público permanente.
- Verificação automática por scraping frágil do Cadastro Nacional.
- Diagnóstico, prontuário ou compartilhamento de dados da usuária com a
  profissional.
