import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setLanguage } from "../i18n";
import { ProfessionalPartnerSection, type ProfessionalPartner } from "./ProfessionalPartnerSection";

async function renderPartner(partner: ProfessionalPartner | null) {
  const host = document.createElement("div");
  const root = createRoot(host);
  const load = vi.fn(async () => ({ partner }));
  const apply = vi.fn();
  await act(async () => root.render(<ProfessionalPartnerSection load={load} apply={apply} />));
  await act(async () => { await Promise.resolve(); });
  return { host, root, apply };
}

describe("ProfessionalPartnerSection", () => {
  beforeEach(async () => setLanguage("pt"));

  it.each([
    ["pending", "Cadastro em análise"],
    ["rejected", "Cadastro não aprovado"],
    ["review_required", "Precisamos revisar seu cadastro"],
  ])("shows the %s state", async (verificationStatus, copy) => {
    const { host, root } = await renderPartner({
      id: "partner-1",
      professionalName: "Dra. Ana",
      crpRegion: "06",
      crpNumber: "123456",
      verificationStatus: verificationStatus as ProfessionalPartner["verificationStatus"],
      verificationNote: null,
      verifiedAt: null,
      lastVerifiedAt: null,
      active: verificationStatus !== "rejected",
      referralCode: null,
    });
    expect(host.textContent).toContain(copy);
    await act(async () => root.unmount());
  });

  it("shows a real API referral link only to a verified professional", async () => {
    const { host, root } = await renderPartner({
      id: "partner-1",
      professionalName: "Dra. Ana",
      crpRegion: "06",
      crpNumber: "123456",
      verificationStatus: "verified",
      verificationNote: null,
      verifiedAt: "2026-08-10T12:00:00.000Z",
      lastVerifiedAt: "2026-08-10T12:00:00.000Z",
      active: true,
      referralCode: "AIRIA-REAL12",
    });
    expect(host.textContent).toContain("AIRIA-REAL12");
    expect(host.textContent).toContain("airia.pro/login?ref=AIRIA-REAL12");
    expect(host.textContent).toContain("não compartilha dados das pessoas indicadas");
    expect(host.textContent).not.toContain("pacientes indicados");
    expect(host.textContent).not.toContain("comissão");
    await act(async () => root.unmount());
  });

  it("submits the CRP application and moves to pending", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const pending = {
      id: "partner-1", professionalName: "Dra. Ana", crpRegion: "06", crpNumber: "123456",
      verificationStatus: "pending", verificationNote: null, verifiedAt: null, lastVerifiedAt: null,
      active: true, referralCode: null,
    } as ProfessionalPartner;
    const apply = vi.fn(async () => ({ partner: pending }));
    await act(async () => root.render(
      <ProfessionalPartnerSection load={async () => ({ partner: null })} apply={apply} />,
    ));
    await act(async () => { await Promise.resolve(); });
    const inputs = [...host.querySelectorAll("input")];
    await act(async () => {
      for (const [input, value] of inputs.map((input, index) => [input, ["Dra. Ana", "06", "123456"][index]] as const)) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const form = host.querySelector("form");
    expect(form).toBeTruthy();
    await act(async () => { form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(apply).toHaveBeenCalledWith({ professionalName: "Dra. Ana", crpRegion: "06", crpNumber: "123456" });
    expect(host.textContent).toContain("Cadastro em análise");
    await act(async () => root.unmount());
  });
});
