-- Sexo autorrelatado no onboarding.
--
-- Existe por um motivo só: decidir se as perguntas de ciclo menstrual aparecem
-- no onboarding e no check-in. Nenhuma outra parte do produto ramifica por ele.
--
-- Aditiva e idempotente: coluna nova, anulável, sem default e sem backfill.
-- NULL significa "ainda não perguntado" — usuárias que já passaram pelo
-- onboarding continuam vendo o bloco de ciclo como viam antes, e respondem
-- quando quiserem em Preferências. Nenhum dado é reescrito ou removido, então
-- a migration é compatível com o rollback automático do deploy.

ALTER TABLE public.onboarding_responses
  ADD COLUMN IF NOT EXISTS biological_sex text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_responses_biological_sex_check'
  ) THEN
    ALTER TABLE public.onboarding_responses
      ADD CONSTRAINT onboarding_responses_biological_sex_check
      CHECK (biological_sex IS NULL OR biological_sex IN ('female', 'male'));
  END IF;
END $$;

COMMENT ON COLUMN public.onboarding_responses.biological_sex IS
  'Autorrelato: female | male. NULL = nao perguntado. Usado apenas para ligar ou desligar o rastreamento de ciclo menstrual.';
