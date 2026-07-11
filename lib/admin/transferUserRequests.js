import mongoose from "mongoose";
import { getModelForCompany } from "@/models/Request";
import RequestOldData from "@/models/RequestOldData";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function oidStr(v) {
  if (v == null) return "";
  if (typeof v === "object" && v._id != null) return String(v._id);
  return String(v);
}

export function buildTransferMatchFilter({ fromUsername, fromUserId, options }) {
  const fromOid = new mongoose.Types.ObjectId(String(fromUserId));
  const parts = [];

  if (options.transferCreatedBy && fromUsername) {
    parts.push({ createdBy: fromUsername });
  }

  if (options.transferWorkflow) {
    parts.push(
      { "workflow.steps.users": fromOid },
      { "workflow.steps.voucherDelegateTo": fromOid },
      { "workflow.steps.voucherProcessedBy": fromOid },
      { "workflow.steps.voucherDelegatedBy": fromOid }
    );
    if (fromUsername) {
      parts.push(
        { "workflow.steps.voucherDelegateToUsername": fromUsername },
        { "workflow.steps.voucherDelegatedByUsername": fromUsername },
        { "workflow.steps.voucherProcessedByUsername": fromUsername }
      );
    }
  }

  if (!parts.length) return { _id: null };
  return parts.length === 1 ? parts[0] : { $or: parts };
}

function patchWorkflowSteps(steps, { fromOid, toOid, fromUsername, toUsername, options }) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { changed: false, steps: steps || [] };
  }

  let changed = false;
  const next = steps.map((raw) => {
    const step =
      raw && typeof raw.toObject === "function"
        ? raw.toObject({ flattenMaps: true })
        : { ...raw };

    if (options.transferWorkflow && Array.isArray(step.users)) {
      const seen = new Set();
      const users = [];
      for (const u of step.users) {
        const id = oidStr(u);
        const nextId = id === fromOid ? toOid : id;
        if (!nextId || !isValidObjectId(nextId)) continue;
        if (id === fromOid) changed = true;
        if (!seen.has(nextId)) {
          seen.add(nextId);
          users.push(new mongoose.Types.ObjectId(nextId));
        }
      }
      step.users = users;
    }

    const oidFields = [
      "voucherDelegateTo",
      "voucherDelegatedBy",
      "voucherProcessedBy",
    ];
    if (options.transferWorkflow) {
      for (const key of oidFields) {
        if (step[key] && oidStr(step[key]) === fromOid) {
          step[key] = new mongoose.Types.ObjectId(toOid);
          changed = true;
        }
      }
    }

    const usernameFields = [
      "voucherDelegateToUsername",
      "voucherDelegatedByUsername",
      "voucherProcessedByUsername",
    ];
    if (options.transferWorkflow && fromUsername && toUsername) {
      for (const key of usernameFields) {
        if (String(step[key] || "").trim() === fromUsername) {
          step[key] = toUsername;
          changed = true;
        }
      }
    }

    delete step._id;
    return step;
  });

  return { changed, steps: next };
}

async function scanCollection(Model, filter) {
  const ids = await Model.find(filter).select("_id companyKey requestCode createdBy").lean();
  return ids.map((d) => ({
    id: String(d._id),
    companyKey: d.companyKey || "",
    requestCode: d.requestCode || "",
    createdBy: d.createdBy || "",
  }));
}

async function applyToCollection(
  Model,
  { fromUsername, fromUserId, toUsername, toUserId, options, companyKey }
) {
  const fromOid = String(fromUserId);
  const toOid = String(toUserId);
  const filter = buildTransferMatchFilter({ fromUsername, fromUserId, options });

  let createdByUpdated = 0;
  if (options.transferCreatedBy && fromUsername && toUsername) {
    const res = await Model.updateMany(
      { createdBy: fromUsername },
      { $set: { createdBy: toUsername } }
    );
    createdByUpdated = res.modifiedCount || 0;
  }

  const workflowFilter = options.transferWorkflow
    ? filter
    : { _id: null };

  const docs = options.transferWorkflow
    ? await Model.find(workflowFilter).select("workflow companyKey requestCode createdBy")
    : [];

  let workflowDocsUpdated = 0;
  for (const doc of docs) {
    const { changed, steps } = patchWorkflowSteps(doc.workflow?.steps, {
      fromOid,
      toOid,
      fromUsername,
      toUsername,
      options,
    });
    if (!changed) continue;

    doc.workflow = doc.workflow || {};
    doc.workflow.steps = steps;
    doc.markModified("workflow");
    await doc.save();
    workflowDocsUpdated += 1;
  }

  const matched = await Model.countDocuments(filter);
  return {
    companyKey,
    matched,
    createdByUpdated,
    workflowDocsUpdated,
  };
}

export async function previewTransferUserRequests({
  allowedCompanies,
  fromUsername,
  fromUserId,
  toUserId,
  companyFilter = "",
  options,
}) {
  const filter = buildTransferMatchFilter({ fromUsername, fromUserId, options });
  const companies = companyFilter
    ? allowedCompanies.filter((c) => c === companyFilter)
    : allowedCompanies;

  const byCompany = [];
  let totalMatched = 0;

  for (const companyKey of companies) {
    const Model = getModelForCompany(companyKey);
    const matched = await Model.countDocuments(filter);
    if (matched > 0) {
      const samples = await scanCollection(Model, filter);
      byCompany.push({
        companyKey,
        matched,
        samples: samples.slice(0, 5),
      });
      totalMatched += matched;
    }
  }

  let oldDataMatched = 0;
  let oldDataSamples = [];
  if (options.includeOldData) {
    oldDataMatched = await RequestOldData.countDocuments(filter);
    if (oldDataMatched > 0) {
      oldDataSamples = await scanCollection(RequestOldData, filter);
      oldDataSamples = oldDataSamples.slice(0, 5);
    }
  }

  return {
    totalMatched: totalMatched + oldDataMatched,
    byCompany,
    oldData: { matched: oldDataMatched, samples: oldDataSamples },
  };
}

export async function executeTransferUserRequests({
  allowedCompanies,
  fromUsername,
  fromUserId,
  toUsername,
  toUserId,
  companyFilter = "",
  options,
}) {
  const companies = companyFilter
    ? allowedCompanies.filter((c) => c === companyFilter)
    : allowedCompanies;

  const results = [];
  let totalCreatedBy = 0;
  let totalWorkflow = 0;
  let totalMatched = 0;

  for (const companyKey of companies) {
    const Model = getModelForCompany(companyKey);
    const row = await applyToCollection(Model, {
      fromUsername,
      fromUserId,
      toUsername,
      toUserId,
      options,
      companyKey,
    });
    if (row.matched > 0) {
      results.push(row);
      totalMatched += row.matched;
      totalCreatedBy += row.createdByUpdated;
      totalWorkflow += row.workflowDocsUpdated;
    }
  }

  if (options.includeOldData) {
    const row = await applyToCollection(RequestOldData, {
      fromUsername,
      fromUserId,
      toUsername,
      toUserId,
      options,
      companyKey: "old-data",
    });
    if (row.matched > 0) {
      results.push(row);
      totalMatched += row.matched;
      totalCreatedBy += row.createdByUpdated;
      totalWorkflow += row.workflowDocsUpdated;
    }
  }

  return {
    totalMatched,
    totalCreatedByUpdated: totalCreatedBy,
    totalWorkflowDocsUpdated: totalWorkflow,
    byCompany: results,
  };
}
