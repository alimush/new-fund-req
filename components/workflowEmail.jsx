// components/workflowEmail.js

function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  function stepLabel(stepIndex) {
    const n = Number(stepIndex);
    if (Number.isNaN(n)) return "-";
    return String(n + 1);
  }
  
  function actionText(action) {
    if (action === "approve") return { label: "Approved ✅", tone: "success" };
    if (action === "reject") return { label: "Rejected ❌", tone: "danger" };
    return { label: String(action || "Updated"), tone: "neutral" };
  }
  
  function toneColors(tone) {
    if (tone === "success") return { bg: "#dcfce7", fg: "#166534" };
    if (tone === "danger") return { bg: "#fee2e2", fg: "#991b1b" };
    return { bg: "#e5e7eb", fg: "#111827" };
  }
  
  /**
   * buildWorkflowEmail
   * يرجع { subject, html }
   */
  export function buildWorkflowEmail({
    action,     // approve | reject
    company,    // company name
    requestId,  // request id
    stepFrom,   // index 0-based
    stepTo,     // index 0-based
    actorName,  // username
    note,       // comment
    appUrl,     // optional URL button
  }) {
    const { label, tone } = actionText(action);
    const colors = toneColors(tone);
  
    const safeCompany = escapeHtml(company || "-");
    const safeRequestId = escapeHtml(requestId || "-");
    const safeActor = actorName ? escapeHtml(actorName) : "";
    const safeNote = note ? escapeHtml(note).replaceAll("\n", "<br/>") : "";
    const safeAppUrl = appUrl ? escapeHtml(appUrl) : "";
  
    const fromStep = stepLabel(stepFrom);
    const toStep = stepLabel(stepTo);
  
    const subject = `Workflow | ${label} | ${company || ""} | ${requestId || ""}`;
  
    const html = `
    <div style="background:#f1f5f9;padding:24px;font-family:Inter,Arial,sans-serif">
      <div style="max-width:660px;margin:0 auto">
  
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px">
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:6px">Workflow System</div>
            <div style="font-size:20px;font-weight:800;color:#0f172a">Workflow Update</div>
          </div>
  
          <div style="padding:8px 12px;border-radius:999px;background:${colors.bg};color:${colors.fg};font-weight:800;font-size:12px;white-space:nowrap">
            ${escapeHtml(label)}
          </div>
        </div>
  
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden">
          <div style="padding:16px 18px;border-bottom:1px solid #eef2f7;background:linear-gradient(180deg,#f8fafc,#ffffff)">
            <div style="font-size:12px;color:#64748b">Request moved</div>
            <div style="font-size:15px;color:#0f172a;font-weight:800;margin-top:4px">
              Step ${fromStep} → Step ${toStep}
            </div>
          </div>
  
          <div style="padding:18px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:14px;padding:12px">
                <div style="font-size:11px;color:#64748b">Company</div>
                <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:4px">${safeCompany}</div>
              </div>
  
              <div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:14px;padding:12px">
                <div style="font-size:11px;color:#64748b">Request ID</div>
                <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:4px">${safeRequestId}</div>
              </div>
  
              ${
                safeActor
                  ? `<div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:14px;padding:12px">
                       <div style="font-size:11px;color:#64748b">Action By</div>
                       <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:4px">${safeActor}</div>
                     </div>`
                  : `<div></div>`
              }
  
              <div style="background:#f8fafc;border:1px solid #eef2f7;border-radius:14px;padding:12px">
                <div style="font-size:11px;color:#64748b">Status</div>
                <div style="font-size:14px;font-weight:800;color:#0f172a;margin-top:4px">${escapeHtml(label)}</div>
              </div>
            </div>
  
            ${
              safeNote
                ? `<div style="margin-top:12px;background:#ffffff;border:1px solid #eef2f7;border-radius:14px;padding:12px">
                     <div style="font-size:11px;color:#64748b;margin-bottom:6px">Note</div>
                     <div style="font-size:13px;color:#0f172a;line-height:1.6">${safeNote}</div>
                   </div>`
                : ""
            }
  
            ${
              safeAppUrl
                ? `<div style="margin-top:14px">
                     <a href="${safeAppUrl}"
                        style="display:inline-block;padding:10px 14px;border-radius:14px;background:#111827;color:#fff;text-decoration:none;font-weight:800;font-size:13px">
                        Open Request
                     </a>
                   </div>`
                : ""
            }
  
            <div style="margin-top:16px;border-top:1px solid #eef2f7;padding-top:12px;color:#64748b;font-size:11px">
              Auto email from workflow system.
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  
    return { subject, html };
  }