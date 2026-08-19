import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { useLocalizedCopy } from "../i18n";
import { api } from "../lib/api";

export type ProfessionalPartner = {
  id: string;
  professionalName: string;
  crpRegion: string;
  crpNumber: string;
  verificationStatus: "pending" | "verified" | "rejected" | "review_required";
  verificationNote: string | null;
  verifiedAt: string | null;
  lastVerifiedAt: string | null;
  active: boolean;
  referralCode: string | null;
};

type PartnerResponse = { partner: ProfessionalPartner | null };
type Application = { professionalName: string; crpRegion: string; crpNumber: string };

type Props = {
  load?: () => Promise<PartnerResponse>;
  apply?: (input: Application) => Promise<PartnerResponse>;
};

function statusCopy(status: ProfessionalPartner["verificationStatus"], l: ReturnType<typeof useLocalizedCopy>) {
  if (status === "pending") return l("Cadastro em análise", "Application under review");
  if (status === "rejected") return l("Cadastro não aprovado", "Application not approved");
  if (status === "review_required") return l("Precisamos revisar seu cadastro", "Your application needs review");
  return l("Cadastro profissional verificado", "Professional account verified");
}

export function ProfessionalPartnerSection({ load, apply }: Props) {
  const l = useLocalizedCopy();
  const loadPartner = useCallback(
    () => load?.() ?? api.get("/professional-partners/me") as Promise<PartnerResponse>,
    [load],
  );
  const applyPartner = apply ?? ((input: Application) => (
    api.post("/professional-partners/apply", input) as Promise<PartnerResponse>
  ));
  const [partner, setPartner] = useState<ProfessionalPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Application>({ professionalName: "", crpRegion: "", crpNumber: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPartner()
      .then(({ partner: loaded }) => {
        if (!alive) return;
        setPartner(loaded);
        if (loaded) setForm({ professionalName: loaded.professionalName, crpRegion: loaded.crpRegion, crpNumber: loaded.crpNumber });
      })
      .catch(() => { if (alive) setError("load_failed"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadPartner]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await applyPartner(form);
      setPartner(response.partner);
      setEditing(false);
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : null;
      setError(message === "professional_crp_already_registered" ? "duplicate" : "submit_failed");
    } finally {
      setSubmitting(false);
    }
  }

  const referralLink = partner?.verificationStatus === "verified" && partner.active && partner.referralCode
    ? `https://airia.pro/login?ref=${encodeURIComponent(partner.referralCode)}`
    : null;

  async function shareLink() {
    if (!referralLink) return;
    if (navigator.share) {
      await navigator.share({
        title: "Airia",
        text: l("Você recebeu 14 dias Pro pela indicação de uma profissional verificada.", "You received 14 Pro days through a verified professional referral."),
        url: referralLink,
      }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
  }

  const showForm = !partner || editing;

  return (
    <section style={{ padding: 18, borderRadius: 20, background: "rgba(255,253,249,.97)", border: "1px solid var(--warm-border)", display: "grid", gap: 12 }}>
      <div>
        <strong>{l("Programa para psicólogas", "Program for psychologists")}</strong>
        <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--text-2)" }}>
          {l("Profissionais com CRP ativo podem usar a Airia Pro sem custo e oferecer 14 dias Pro por indicação.", "Professionals with an active CRP can use Airia Pro for free and offer 14 Pro days by referral.")}
        </p>
      </div>

      {loading ? <span role="status">{l("Carregando cadastro...", "Loading application...")}</span> : showForm ? (
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <label>
            <span>{l("Nome profissional", "Professional name")}</span>
            <input required minLength={3} value={form.professionalName} onChange={(event) => setForm((current) => ({ ...current, professionalName: event.target.value }))} style={{ width: "100%", minHeight: 42 }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
            <label>
              <span>{l("Região CRP", "CRP region")}</span>
              <input required inputMode="numeric" pattern="\d{2}" maxLength={2} value={form.crpRegion} onChange={(event) => setForm((current) => ({ ...current, crpRegion: event.target.value.replace(/\D/g, "") }))} style={{ width: "100%", minHeight: 42 }} />
            </label>
            <label>
              <span>{l("Número CRP", "CRP number")}</span>
              <input required inputMode="numeric" pattern="\d{4,8}" maxLength={8} value={form.crpNumber} onChange={(event) => setForm((current) => ({ ...current, crpNumber: event.target.value.replace(/\D/g, "") }))} style={{ width: "100%", minHeight: 42 }} />
            </label>
          </div>
          <small>{l("A aprovação confirma o registro profissional ativo. A Airia não comprova vínculo terapêutico.", "Approval confirms an active professional registration. Airia does not verify a therapeutic relationship.")}</small>
          <button type="submit" disabled={submitting} style={{ minHeight: 44, borderRadius: 999, border: 0, background: "var(--accent-peach)", color: "#fff", fontWeight: 900 }}>
            {submitting ? l("Enviando...", "Sending...") : l("Enviar cadastro", "Submit application")}
          </button>
        </form>
      ) : partner ? (
        <div style={{ display: "grid", gap: 10 }}>
          <strong>{statusCopy(partner.verificationStatus, l)}</strong>
          <span style={{ fontSize: 12 }}>{partner.professionalName} · CRP {partner.crpRegion}/{partner.crpNumber}</span>
          {partner.verificationNote && <p style={{ margin: 0, fontSize: 12 }}>{partner.verificationNote}</p>}
          {referralLink ? (
            <>
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(134,183,154,.08)", wordBreak: "break-all" }}>
                <strong>{partner.referralCode}</strong><br />{referralLink}
              </div>
              <button type="button" onClick={shareLink} style={{ minHeight: 42, borderRadius: 999, border: 0, background: "var(--accent-sage)", color: "#fff", fontWeight: 800 }}>
                {copied ? <><Check size={14} /> {l("Link copiado", "Link copied")}</> : <><Share2 size={14} /> {l("Compartilhar link profissional", "Share professional link")}</>}
              </button>
              {!navigator.share && <Copy size={14} aria-hidden="true" />}
              <small>{l("A Airia não compartilha dados das pessoas indicadas com a profissional.", "Airia does not share referred people's data with the professional.")}</small>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)} style={{ minHeight: 40 }}>
              {l("Atualizar cadastro", "Update application")}
            </button>
          )}
        </div>
      ) : null}

      {error && <p role="alert" style={{ margin: 0, color: "var(--danger, #9b3d3d)" }}>
        {error === "duplicate"
          ? l("Este CRP já está cadastrado.", "This CRP is already registered.")
          : l("Não consegui salvar o cadastro agora. Tente novamente.", "The application could not be saved. Try again.")}
      </p>}
    </section>
  );
}
