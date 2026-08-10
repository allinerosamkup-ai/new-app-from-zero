# Onboarding, Billing and Professional Partners Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the duplicated onboarding with one canonical flow, grant a server-side 7/14-day Pro experience, add verified professional referrals, and make Stripe subscriptions reliable.

**Architecture:** Add dedicated billing, professional-partner, referral-attribution, and Stripe-event records related to `Profile`. Keep entitlement decisions in one backend service, expose typed API summaries to the web, and treat Stripe webhooks as the source of truth for paid access. Legacy onboarding and billing fields remain readable during migration but stop receiving new writes.

**Tech Stack:** React 18, React Router, TypeScript, Express, Prisma/PostgreSQL, Supabase Auth/RLS, Stripe Billing/Checkout, Vitest, Node assert tests.

---

## Delivery invariants

- TDD: every behavior starts with a failing test that fails for the intended reason.
- No route or query trusts a `userId` from the request body.
- Redoing onboarding never restarts a trial, changes a referral, or deletes product data.
- A URL parameter never activates paid access.
- Stripe events are idempotent and verified from the raw request body.
- CRP data is professional registration data, not proof of a therapeutic relationship.
- Safety, privacy, export, and access to existing user data remain outside paywalls.
- No external Stripe mutation is performed until the code and endpoint are ready.

### Task 1: Persist billing, partner, referral, and webhook state

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `supabase/migrations/20260810130000_add_billing_trials_and_professional_partners.sql`
- Modify: `apps/backend/src/contracts/schema-alignment.test.ts`
- Modify: `apps/backend/src/contracts/migration-chain-safety.test.ts`

**Step 1: Write the failing schema alignment tests**

Assert that Prisma and SQL both declare:

```ts
const requiredTables = [
  'billing_accounts',
  'professional_partners',
  'referral_attributions',
  'stripe_webhook_events',
];
```

Also assert unique constraints for `stripe_customer_id`,
`stripe_subscription_id`, `referral_code`, `referred_user_id`, and
`stripe_event_id`.

**Step 2: Run tests and verify RED**

Run:

```powershell
npx ts-node-transpile-only apps/backend/src/contracts/schema-alignment.test.ts
npx ts-node-transpile-only apps/backend/src/contracts/migration-chain-safety.test.ts
```

Expected: FAIL because the four tables and migration do not exist.

**Step 3: Add the Prisma models**

Use these domain fields:

```prisma
model BillingAccount {
  userId               String    @id @map("user_id") @db.Uuid
  stripeCustomerId     String?   @unique @map("stripe_customer_id")
  stripeSubscriptionId String?   @unique @map("stripe_subscription_id")
  subscriptionStatus   String?   @map("subscription_status")
  subscriptionPlan     String?   @map("subscription_plan")
  priceId              String?   @map("price_id")
  currentPeriodEnd     DateTime? @map("current_period_end") @db.Timestamptz(6)
  cancelAtPeriodEnd    Boolean   @default(false) @map("cancel_at_period_end")
  trialStartedAt       DateTime? @map("trial_started_at") @db.Timestamptz(6)
  trialEndsAt          DateTime? @map("trial_ends_at") @db.Timestamptz(6)
  trialSource          String?   @map("trial_source")
  createdAt            DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  user                 Profile   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("billing_accounts")
}

model ProfessionalPartner {
  id                 String   @id @default(uuid()) @db.Uuid
  userId             String   @unique @map("user_id") @db.Uuid
  professionalName   String   @map("professional_name")
  crpRegion          String   @map("crp_region")
  crpNumber          String   @map("crp_number")
  verificationStatus String   @default("pending") @map("verification_status")
  verificationNote   String?  @map("verification_note")
  verifiedAt         DateTime? @map("verified_at") @db.Timestamptz(6)
  lastVerifiedAt     DateTime? @map("last_verified_at") @db.Timestamptz(6)
  referralCode       String   @unique @map("referral_code")
  active             Boolean  @default(true)
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  user               Profile  @relation(fields: [userId], references: [id], onDelete: Cascade)
  referrals          ReferralAttribution[]
  @@unique([crpRegion, crpNumber])
  @@map("professional_partners")
}

model ReferralAttribution {
  id                    String   @id @default(uuid()) @db.Uuid
  referredUserId        String   @unique @map("referred_user_id") @db.Uuid
  professionalPartnerId String   @map("professional_partner_id") @db.Uuid
  referralCode          String   @map("referral_code")
  benefitDays           Int      @default(14) @map("benefit_days")
  claimedAt             DateTime @default(now()) @map("claimed_at") @db.Timestamptz(6)
  convertedAt           DateTime? @map("converted_at") @db.Timestamptz(6)
  referredUser          Profile  @relation("ReferredUser", fields: [referredUserId], references: [id], onDelete: Cascade)
  professionalPartner   ProfessionalPartner @relation(fields: [professionalPartnerId], references: [id], onDelete: Restrict)
  @@index([professionalPartnerId, claimedAt(sort: Desc)])
  @@map("referral_attributions")
}

model StripeWebhookEvent {
  stripeEventId String   @id @map("stripe_event_id")
  eventType     String   @map("event_type")
  livemode      Boolean
  result        String?
  processedAt   DateTime @default(now()) @map("processed_at") @db.Timestamptz(6)
  @@map("stripe_webhook_events")
}
```

Add the corresponding `Profile` relations. In SQL, enable RLS and restrict
direct client access; authenticated product reads/writes happen through backend
routes.

**Step 4: Generate and rerun tests**

```powershell
npm run generate -w packages/database
npx ts-node-transpile-only apps/backend/src/contracts/schema-alignment.test.ts
npx ts-node-transpile-only apps/backend/src/contracts/migration-chain-safety.test.ts
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add packages/database/prisma/schema.prisma supabase/migrations/20260810130000_add_billing_trials_and_professional_partners.sql apps/backend/src/contracts/schema-alignment.test.ts apps/backend/src/contracts/migration-chain-safety.test.ts
git commit -m "feat(billing): add trial and partner persistence"
```

### Task 2: Centralize entitlement and trial rules

**Files:**
- Create: `apps/backend/src/services/billing-access.service.ts`
- Create: `apps/backend/src/services/billing-access.service.test.ts`

**Step 1: Write failing tests for precedence and idempotency**

Cover:

```ts
assert.equal(resolveAccess({ subscriptionStatus: 'active' }).source, 'paid');
assert.equal(resolveAccess({ professionalVerified: true }).source, 'professional');
assert.equal(resolveAccess({ trialEndsAt: future }).source, 'trial');
assert.equal(resolveAccess({ trialEndsAt: past }).source, 'free');
```

Add service tests proving:

- first onboarding completion grants 7 days;
- a valid professional referral grants 14 days;
- repeated completion preserves the original dates;
- redo does not restart an expired trial;
- paid and professional access are never downgraded by trial creation.

**Step 2: Run and verify RED**

```powershell
npx ts-node-transpile-only apps/backend/src/services/billing-access.service.test.ts
```

Expected: FAIL because the service is missing.

**Step 3: Implement the service**

Expose:

```ts
export type BillingAccessSummary = {
  access: 'pro' | 'free';
  source: 'paid' | 'professional' | 'trial' | 'free';
  subscriptionStatus: string | null;
  plan: 'monthly' | 'annual' | null;
  periodEnd: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  checkoutAvailable: boolean;
};

export class BillingAccessService {
  grantInitialTrial(userId: string, now?: Date): Promise<BillingAccessSummary>;
  getSummary(userId: string, now?: Date): Promise<BillingAccessSummary>;
}
```

Compute days with calendar-safe ceiling and use a transaction around referral
lookup and `billingAccount.upsert`.

**Step 4: Run and verify GREEN**

```powershell
npx ts-node-transpile-only apps/backend/src/services/billing-access.service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/backend/src/services/billing-access.service.ts apps/backend/src/services/billing-access.service.test.ts
git commit -m "feat(billing): centralize access and trial rules"
```

### Task 3: Add canonical onboarding completion

**Files:**
- Modify: `apps/backend/src/index.ts`
- Create: `apps/backend/src/index.onboarding-completion.test.ts`
- Modify: `apps/web/src/features/aura/onboarding.ts`
- Modify: `apps/web/src/features/aura/onboarding.test.ts`

**Step 1: Write failing backend route tests**

Test `POST /api/onboarding/complete` with injected auth and Prisma:

- marks `Profile.onboardingDone=true`;
- grants 7 or 14 days through `BillingAccessService`;
- returns the same dates when repeated;
- ignores any `userId` in the body;
- does not mutate agenda, habits, objectives, or existing subscription fields.

**Step 2: Write the failing frontend route test**

Change the expected restart destination:

```ts
expect(calls).toEqual(['reset', 'navigate:/comecar']);
```

Add an exported canonical constant:

```ts
export const CANONICAL_ONBOARDING_ROUTE = '/comecar';
```

**Step 3: Run and verify RED**

```powershell
npx ts-node-transpile-only apps/backend/src/index.onboarding-completion.test.ts
npm run test -w apps/web -- src/features/aura/onboarding.test.ts
```

Expected: both fail because the route/constant do not exist and restart still
opens the guided flow.

**Step 4: Implement minimal completion and navigation**

Inject `billingAccessService` through `AppDependencies`, add the authenticated
route, and change `restartOnboardingFlow` to the canonical route.

**Step 5: Run and verify GREEN**

Run the two commands from Step 3. Expected: PASS.

**Step 6: Commit**

```powershell
git add apps/backend/src/index.ts apps/backend/src/index.onboarding-completion.test.ts apps/web/src/features/aura/onboarding.ts apps/web/src/features/aura/onboarding.test.ts
git commit -m "fix(onboarding): complete the canonical flow"
```

### Task 4: Remove duplicate onboarding entry points

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/routes/aura-layout.tsx`
- Modify: `apps/web/src/routes/aura-chat-page.tsx`
- Modify: `apps/web/src/routes/planner-page.tsx`
- Modify: `apps/web/src/routes/routine-builder-page.tsx`
- Modify: `apps/web/src/features/routine-builder/import-routine-dialog.test.tsx`
- Create: `apps/web/src/routes/onboarding-routing.test.tsx`

**Step 1: Write a failing source/route test**

Assert:

```ts
for (const legacy of ['/onboarding', '/onboarding/guiado', '/onboarding/energy', '/onboarding/cycle', '/onboarding/sleep', '/onboarding/preferences', '/onboarding/done']) {
  expect(renderedDestination(legacy)).toBe('/comecar');
}
```

Also scan production source and reject imperative navigation to any legacy route.

**Step 2: Run and verify RED**

```powershell
npm run test -w apps/web -- src/routes/onboarding-routing.test.tsx src/features/routine-builder/import-routine-dialog.test.tsx
```

Expected: FAIL with the current guided/form routes.

**Step 3: Replace routes and callers**

Keep legacy paths as `<Navigate to="/comecar" replace />`. Do not delete the old
files yet; first remove all product callers and prove no route renders them.
Change the onboarding prompt to `/comecar` and make its pathname guard include
both `/comecar` and `/onboarding`.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/web/src/App.tsx apps/web/src/routes/aura-layout.tsx apps/web/src/routes/aura-chat-page.tsx apps/web/src/routes/planner-page.tsx apps/web/src/routes/routine-builder-page.tsx apps/web/src/features/routine-builder/import-routine-dialog.test.tsx apps/web/src/routes/onboarding-routing.test.tsx
git commit -m "fix(onboarding): route every entry to the current experience"
```

### Task 5: Finish onboarding with a real Pro period

**Files:**
- Modify: `apps/web/src/routes/story-onboarding-page.tsx`
- Create: `apps/web/src/routes/story-onboarding-page.test.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Write failing UI tests**

Test that the done step:

- calls `/api/onboarding/complete` once after persistence;
- renders 7 or 14 days from the server response;
- keeps `Entrar na minha Airia` as the primary action;
- offers `Ver planos` as secondary;
- displays retry if completion fails and never pretends the trial started.

**Step 2: Run and verify RED**

```powershell
npm run test -w apps/web -- src/routes/story-onboarding-page.test.tsx
```

Expected: FAIL because completion and access summary are absent.

**Step 3: Implement the minimal UI**

Store the returned `BillingAccessSummary`, track `pro_trial_started` only after
server success, and refresh the Aura store so `onboardingDone` is current before
navigating home.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/web/src/routes/story-onboarding-page.tsx apps/web/src/routes/story-onboarding-page.test.tsx apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(onboarding): start Pro access after real completion"
```

### Task 6: Build professional application and referral contracts

**Files:**
- Create: `apps/backend/src/contracts/professional-partner.contract.ts`
- Create: `apps/backend/src/contracts/professional-partner.contract.test.ts`
- Create: `apps/backend/src/services/professional-partner.service.ts`
- Create: `apps/backend/src/services/professional-partner.service.test.ts`
- Create: `apps/backend/src/services/referral.service.ts`
- Create: `apps/backend/src/services/referral.service.test.ts`

**Step 1: Write failing validation tests**

Cover normalized region/number, duplicate CRP, random code uniqueness,
self-referral rejection, inactive/unverified code rejection, claim-once behavior,
and no trial extension after the original grant.

Use a contract like:

```ts
export const ProfessionalApplicationSchema = z.object({
  professionalName: z.string().trim().min(3).max(120),
  crpRegion: z.string().trim().regex(/^\d{2}$/),
  crpNumber: z.string().trim().regex(/^\d{4,8}$/),
});
```

**Step 2: Run and verify RED**

```powershell
npx ts-node-transpile-only apps/backend/src/contracts/professional-partner.contract.test.ts
npx ts-node-transpile-only apps/backend/src/services/professional-partner.service.test.ts
npx ts-node-transpile-only apps/backend/src/services/referral.service.test.ts
```

Expected: FAIL because contracts/services are missing.

**Step 3: Implement contracts and services**

Generate referral codes with cryptographic randomness, never from `userId`.
Return public partner identity only after verification. Do not store patient
health data or expose the list of referred users to the professional.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/backend/src/contracts/professional-partner.contract.ts apps/backend/src/contracts/professional-partner.contract.test.ts apps/backend/src/services/professional-partner.service.ts apps/backend/src/services/professional-partner.service.test.ts apps/backend/src/services/referral.service.ts apps/backend/src/services/referral.service.test.ts
git commit -m "feat(partners): validate CRP applications and referrals"
```

### Task 7: Expose authenticated partner and referral routes

**Files:**
- Modify: `apps/backend/src/index.ts`
- Create: `apps/backend/src/index.partners.test.ts`
- Modify: `docs/product/api-contracts.md`

**Step 1: Write failing route tests**

Cover:

- `POST/GET /api/professional-partners/*` uses authenticated user only;
- `POST /api/referrals/claim` cannot self-claim or claim twice;
- `GET /api/referrals/me` reveals benefit, not professional private fields;
- admin verification rejects a missing/wrong `x-admin-key`;
- approval stamps `verifiedAt/lastVerifiedAt`, rejection stores a short reason;
- no route exposes a list of referred patients to the professional.

**Step 2: Run and verify RED**

```powershell
npx ts-node-transpile-only apps/backend/src/index.partners.test.ts
```

Expected: FAIL because the routes are absent.

**Step 3: Implement routes**

Reuse the existing `x-admin-key` protection pattern and move repeated key checks
to a small helper if needed. Never log CRP application bodies.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/backend/src/index.ts apps/backend/src/index.partners.test.ts docs/product/api-contracts.md
git commit -m "feat(partners): expose secure application and referral APIs"
```

### Task 8: Refactor Stripe behind a testable adapter

**Files:**
- Modify: `apps/backend/src/services/stripe.service.ts`
- Create: `apps/backend/src/services/stripe.service.test.ts`
- Modify: `apps/backend/src/index.ts`
- Create: `apps/backend/src/index.billing.test.ts`

**Step 1: Write failing service tests**

Inject a narrow Stripe client interface and test:

- customer creation uses `BillingAccount`, not `OnboardingResponse`;
- monthly/annual map only to configured active IDs;
- checkout includes `client_reference_id`, user/plan metadata,
  `{CHECKOUT_SESSION_ID}` in success URL, and idempotency options;
- checkout session verification checks owner and payment/subscription state;
- webhook signature failure makes no database writes;
- repeated `stripeEventId` produces no repeated side effect;
- created/updated/deleted and paid/failed events synchronize access;
- `past_due`, `incomplete`, `incomplete_expired`, `unpaid`, and `paused` are not Pro.

**Step 2: Run and verify RED**

```powershell
npx ts-node-transpile-only apps/backend/src/services/stripe.service.test.ts
npx ts-node-transpile-only apps/backend/src/index.billing.test.ts
```

Expected: FAIL because Stripe is a module singleton and billing uses onboarding
storage.

**Step 3: Implement the adapter and routes**

Use a constructor/factory that receives Prisma and Stripe clients. Keep raw-body
webhook registration before `express.json()`. Validate `plan` with Zod and return
specific safe error codes (`billing_unavailable`, `invalid_plan`,
`checkout_failed`, `no_subscription`).

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/backend/src/services/stripe.service.ts apps/backend/src/services/stripe.service.test.ts apps/backend/src/index.ts apps/backend/src/index.billing.test.ts
git commit -m "fix(billing): make Stripe the reliable paid-access source"
```

### Task 9: Upgrade subscription state and paywalls in the web app

**Files:**
- Modify: `apps/web/src/hooks/useSubscription.ts`
- Create: `apps/web/src/hooks/useSubscription.test.tsx`
- Modify: `apps/web/src/components/PremiumGate.tsx`
- Create: `apps/web/src/components/PremiumGate.test.tsx`
- Modify: `apps/web/src/routes/billing-page.tsx`
- Create: `apps/web/src/routes/billing-page.test.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Write failing UI tests**

Cover free, trial, professional, paid, pending Checkout, past due, canceled, and
API error. Assert that:

- `isPro` comes from `access === 'pro'`, not a front-end status guess;
- success UI waits for server-confirmed Checkout ownership/state;
- retry and `Continuar gratuitamente` are visible;
- trial copy uses server days/dates;
- dismissing a paywall does not navigate or lose work.

**Step 2: Run and verify RED**

```powershell
npm run test -w apps/web -- src/hooks/useSubscription.test.tsx src/components/PremiumGate.test.tsx src/routes/billing-page.test.tsx
```

Expected: FAIL because the current contract is only status/plan/periodEnd.

**Step 3: Implement the typed summary and screens**

Use the backend summary verbatim. On `session_id`, poll with bounded retries and
show pending instead of activated until confirmed. Keep monthly and annual
prices explicit and accessible.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/web/src/hooks/useSubscription.ts apps/web/src/hooks/useSubscription.test.tsx apps/web/src/components/PremiumGate.tsx apps/web/src/components/PremiumGate.test.tsx apps/web/src/routes/billing-page.tsx apps/web/src/routes/billing-page.test.tsx apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(billing): show gradual trial and verified upgrade states"
```

### Task 10: Replace the fake referral card with real partner UX

**Files:**
- Modify: `apps/web/src/components/ReferralCard.tsx`
- Create: `apps/web/src/components/ReferralCard.test.tsx`
- Create: `apps/web/src/components/ProfessionalPartnerSection.tsx`
- Create: `apps/web/src/components/ProfessionalPartnerSection.test.tsx`
- Modify: `apps/web/src/routes/preferences-page.tsx`
- Create: `apps/web/src/features/referrals/capture.ts`
- Create: `apps/web/src/features/referrals/capture.test.ts`
- Modify: `apps/web/src/routes/login-page.tsx`
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

**Step 1: Write failing tests**

Assert:

- referral code/link comes from API, never a hash of `userId`;
- `?ref=` is captured before signup and claimed after auth;
- claim failure never blocks login/onboarding;
- application supports pending/verified/rejected/review-required;
- verified professionals see a share link but no patient list or commission copy;
- regular users keep a customer referral action separate from the professional
  partner program.

**Step 2: Run and verify RED**

```powershell
npm run test -w apps/web -- src/components/ReferralCard.test.tsx src/components/ProfessionalPartnerSection.test.tsx src/features/referrals/capture.test.ts
```

Expected: FAIL because the current card generates a local fake code.

**Step 3: Implement the real flow**

Persist only the pending code in local storage until authentication, then claim
server-side and remove it. The professional form explains that approval checks
active CRP registration and that Airia does not share patient data.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/web/src/components/ReferralCard.tsx apps/web/src/components/ReferralCard.test.tsx apps/web/src/components/ProfessionalPartnerSection.tsx apps/web/src/components/ProfessionalPartnerSection.test.tsx apps/web/src/routes/preferences-page.tsx apps/web/src/features/referrals/capture.ts apps/web/src/features/referrals/capture.test.ts apps/web/src/routes/login-page.tsx apps/web/src/i18n/locales/pt.json apps/web/src/i18n/locales/en.json
git commit -m "feat(partners): add verified professional referral UX"
```

### Task 11: Add privacy, product, and regression guards

**Files:**
- Modify: `apps/backend/src/services/privacy-redaction.allowlist.ts`
- Modify: `apps/backend/src/services/privacy-allowlist.test.ts`
- Modify: `apps/backend/src/services/privacy-export.service.test.ts`
- Modify: `apps/backend/src/lib/product-guardrails.test.ts`
- Modify: `docs/product/airia-product-contract.md`
- Modify: `docs/product/api-contracts.md`
- Modify: `.env.example`

**Step 1: Write failing privacy/guardrail assertions**

Require export of the user's own billing/trial/partner/referral status without
Stripe secrets, admin notes, other users, or raw webhook payloads. Reject copy
that calls Airia therapy or promises clinical outcomes.

**Step 2: Run and verify RED**

```powershell
npx ts-node-transpile-only apps/backend/src/services/privacy-allowlist.test.ts
npx ts-node-transpile-only apps/backend/src/services/privacy-export.service.test.ts
npx ts-node-transpile-only apps/backend/src/lib/product-guardrails.test.ts
```

Expected: FAIL until new tables/copy are classified.

**Step 3: Update allowlists and contracts**

Document `STRIPE_PRICE_ID`, `STRIPE_PRICE_ID_ANNUAL`,
`STRIPE_WEBHOOK_SECRET`, `APP_URL`, and any billing feature flag as names only;
never add real credentials.

**Step 4: Run and verify GREEN**

Run Step 2. Expected: PASS.

**Step 5: Commit**

```powershell
git add apps/backend/src/services/privacy-redaction.allowlist.ts apps/backend/src/services/privacy-allowlist.test.ts apps/backend/src/services/privacy-export.service.test.ts apps/backend/src/lib/product-guardrails.test.ts docs/product/airia-product-contract.md docs/product/api-contracts.md .env.example
git commit -m "docs: define billing and partner privacy boundaries"
```

### Task 12: Configure Stripe through the API

**Files:**
- No tracked secret files.
- Update only ignored runtime environment files after code verification.

**Step 1: Validate account and resource state read-only**

Confirm live account ID, `charges_enabled`, capabilities, active product/prices,
existing webhook endpoints, and portal configurations. Never print secret keys.

**Step 2: Stop if account identity action is required**

If Stripe requires identity, banking, tax, or representative confirmation that
cannot be completed from existing verified data, record exact blocker in
`CURRENT_STATE.md`. Do not fabricate or submit legal information.

**Step 3: Align runtime price IDs**

Set monthly to the active BRL monthly price and annual to the active BRL annual
price. Verify both through Stripe API before updating runtime env.

**Step 4: Create/update webhook endpoint**

Target:

```text
https://airia.pro/api/billing/webhook
```

Subscribe only to the six events listed in the design. Store the returned
signing secret in the ignored runtime environment; do not commit it.

**Step 5: Configure customer portal**

Enable payment-method updates, invoice history, and cancellation. Use
`https://airia.pro/billing` as return URL. Do not enable unimplemented plan
switching.

**Step 6: Verify endpoint and delivery**

Use Stripe test mode/CLI or API fixtures first, then confirm live endpoint
status without making a real charge. A live purchase test requires explicit
confirmation because it creates a financial transaction.

### Task 13: Full verification and feature closure

**Files:**
- Modify: `docs/agent-memory/CURRENT_STATE.md`
- Modify: `docs/agent-memory/WORKTREES.md`
- Modify: `docs/agent-memory/LEARNINGS.md` only for reusable discoveries

**Step 1: Run focused tests**

Run every test introduced above individually and confirm RED evidence exists in
the task log/commits before implementation.

**Step 2: Run repository gates**

```powershell
npm run generate -w packages/database
npm run build -w packages/database
npm run build -w apps/backend
npm run build -w apps/web
npm run typecheck -w apps/web
npm run test:auth -w apps/backend
npm run test -w apps/backend
npm run test -w apps/web
```

Expected: all pass; inspect full backend output for suites that log expected
errors.

**Step 3: Apply the Airia PR/feature checklist**

Read and apply:

```text
docs/product/pr-review-skill-roadmap.md
skills/airia-pr-review/SKILL.md
```

Check final-product vs demo, grounding, frontend/backend sync, timezone, privacy,
release hygiene, and migration safety.

**Step 4: Verify browser behavior mobile-first**

Authenticated scenarios:

1. new user → `/comecar` → completion → 7-day Pro → Home;
2. valid verified referral → completion → 14-day Pro;
3. Configurations → redo → `/comecar` without new trial or data loss;
4. day-5/expired fixtures → gradual reminder/paywall with escape hatch;
5. Checkout cancel → state preserved;
6. Checkout return → pending until confirmed → active after webhook;
7. reload/back/forward → same access state;
8. professional application → pending → admin verification → free Pro + real link;
9. Stripe/API failure → useful error, onboarding still completes.

Capture screenshots and network/console evidence. Confirm no user/CRP/health data
appears in analytics payloads.

**Step 5: Verify production only after deployment authorization**

If deployment is authorized, confirm the same SHA on branch/GitHub/VPS, apply
the migration, check `/api/health` and `/home`, then repeat the critical browser
path against production. Without this evidence, mark production activation
`BLOQUEADO`, not complete.

**Step 6: Close Git and worktree gates**

```powershell
git diff --check
git status --short --branch
git log -1 --oneline
git worktree list --porcelain
```

Every file must be committed, consciously removed, or documented as blocked.
Set the worktree to `READY_TO_MERGE` only after all required evidence exists.
