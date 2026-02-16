/**
 * Migration Script: Old Fund Request System → New Fund Request System
 *
 * READ-ONLY on old DB. Writes only to new DB.
 * Safe to run multiple times — skips existing users/permissions/requests,
 * and UPDATES existing workflows with real data from old system.
 *
 * Usage: node migrate.mjs [--dry-run]
 */

import mongoose from "mongoose";

// ─── Connection strings ───────────────────────────────────────────────
const OLD_URI =
  "mongodb+srv://yusif:yusif123@cluster0.y4yjo.mongodb.net/test?retryWrites=true&w=majority";
const NEW_URI =
  "mongodb+srv://AliMushtaq:Aaa1234@fundreq.bh5dwbd.mongodb.net/FundRrq?retryWrites=true&w=majority&appName=FundReq";

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Company name mapping: Old Arabic → New companyKey ────────────────
const COMPANY_MAP = {
  الغدير: "Al-Ghadeer",
  الرضا: "Al-Rida",
  الميزان: "Al-Mezan",
  "بدور النجف": "badur-Al-najaf",
  "بدور بغداد": "Badur-Baghdad",
  "طيبة النجف": "Tiba-Al-najaf",
  "غدير كربلاء": "Ghadeer-Karbala",
};

// Old approvalworkflow transactionType → old Arabic companyName
const TRANSACTION_TYPE_TO_COMPANY = {
  "Al Ghadeer": "الغدير",
  "طلبات الغدير محاسبين": "الغدير",
  "AL Rida": "الرضا",
  "AL Mezan": "الميزان",
  "Bodor Al Najaf": "بدور النجف",
  "Budor Baghdad": "بدور بغداد",
  "Budor Baghdad 2": "بدور بغداد",
  "Teba Al Najaf": "طيبة النجف",
  "Teba Al Najaf 2": "طيبة النجف",
  "Ghadeer Karbala": "غدير كربلاء",
};

// ─── Stats tracking ──────────────────────────────────────────────────
const stats = {
  users: { migrated: 0, skipped: 0, errors: 0 },
  permissions: { migrated: 0, skipped: 0, errors: 0 },
  workflows: { migrated: 0, updated: 0, skipped: 0, errors: 0 },
  requests: { migrated: 0, skipped: 0, errors: 0 },
};

// ─── Helpers ─────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
function logSection(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

// ─── Permission name mapping ─────────────────────────────────────────
function mapPermissions(oldPerms) {
  const mapping = {
    Create_FundRequest: "CREATE_REQUEST",
    Approve_FundRequest: "APPROVE_REQUEST",
    Reject_FundRequest: "REJECT_REQUEST",
    Cancel_FundRequest: "CANCEL_REQUEST",
    View_FundRequest: "VIEW_REQUEST",
    View_FundRequests: "VIEW_REQUESTS",
    Create_Workflow: "MANAGE_WORKFLOWS",
    View_Workflows: "VIEW_WORKFLOWS",
    Manage_AssignedWorkflow: "MANAGE_WORKFLOWS",
    Manage_AssignedWorkflowUsers: "MANAGE_WORKFLOWS",
    Fund_Req: "VIEW_REQUESTS",
    Work_Flow: "VIEW_WORKFLOWS",
    Report: "VIEW_REPORTS",
    view_roles: "MANAGE_PERMISSIONS",
    delete_roles: "MANAGE_PERMISSIONS",
    remove_roles: "MANAGE_PERMISSIONS",
    assign_roles: "MANAGE_PERMISSIONS",
    add_role_group: "MANAGE_PERMISSIONS",
    add_roles: "MANAGE_PERMISSIONS",
    List_Admin_Users: "MANAGE_USERS",
    Create_admin: "MANAGE_USERS",
  };

  const newPerms = new Set();
  for (const p of oldPerms) {
    if (mapping[p]) newPerms.add(mapping[p]);
    if (p.startsWith("FundRequest_Report_") || p.startsWith("Fund_Req_"))
      newPerms.add("VIEW_REPORTS");
  }
  return [...newPerms];
}

// ─── Build a new-format request document from old data ───────────────
function buildNewRequest(fr, aw, companyKey, oldIdToNewId, oldIdToUsername) {
  const newItems = (fr.items || []).map((item) => ({
    desc: item.name || "",
    qty: item.quantity || 0,
    price: item.price || 0,
  }));

  const newAttachments = (fr.documents || []).map((url) => {
    const parts = decodeURIComponent(url).split("/");
    const fileName = parts[parts.length - 1] || "attachment";
    // key is null so the API skips signed-URL generation
    // and the frontend uses the original public URL directly
    return { key: null, name: fileName, url };
  });

  let newStatus = fr.status;
  if (newStatus === "Canceled") newStatus = "Cancelled";

  let workflowData = { name: "", steps: [] };
  let currentStep = 0;
  const approvalHistory = [];

  if (aw) {
    workflowData.name = aw.transactionType || "";
    workflowData.steps = (aw.steps || []).map((step) => {
      const stepStatus =
        step.status === "Canceled" ? "Cancelled" : step.status || "Pending";
      return {
        users: (step.approvers || [])
          .map((aid) => oldIdToNewId[aid.toString()])
          .filter(Boolean),
        status: stepStatus,
        actedBy: step.approvedBy
          ? oldIdToNewId[step.approvedBy.toString()] || null
          : null,
        actedAt: step.approvedAt || null,
        comment: step.comments || "",
      };
    });

    currentStep = Math.max(0, (aw.currentLevel || 1) - 1);

    for (const step of aw.steps || []) {
      if (step.approvedBy && step.approvedAt) {
        approvalHistory.push({
          user: oldIdToUsername[step.approvedBy.toString()] || "Unknown",
          action: step.status || "Approved",
          note: step.comments || "",
          date: step.approvedAt,
        });
      }
    }
  }

  const createdByUsername =
    oldIdToUsername[fr.requestedBy?.toString()] ||
    fr.requestedBy?.toString() ||
    "Unknown";

  return {
    companyKey,
    requestCode: fr.uniqueCode,
    requestType: fr.requestFundType || "",
    description: fr.description || "",
    currency: fr.currency || "IQD",
    department: fr.department || "",
    items: newItems,
    createdBy: createdByUsername,
    createdAt: fr.createdAt || fr.requestDate || new Date(),
    attachments: newAttachments,
    workflow: workflowData,
    currentStep,
    status: newStatus,
    cancelledAt: null,
    cancelledNote: "",
    approvalHistory,
    updatedAt: new Date(),
    _oldId: fr._id.toString(),
    _oldAmount: fr.amount,
    _oldProjectName: fr.projectName || "",
    _oldDetails: fr.details || "",
  };
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) log("DRY RUN MODE — no writes will happen");

  log("Connecting to OLD database...");
  const oldConn = await mongoose.createConnection(OLD_URI).asPromise();
  log("Connected to OLD database");

  log("Connecting to NEW database...");
  const newConn = await mongoose.createConnection(NEW_URI).asPromise();
  log("Connected to NEW database");

  const oldDb = oldConn.db;
  const newDb = newConn.db;

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: Migrate admins → users
  // ═══════════════════════════════════════════════════════════════════
  logSection("STEP 1: Migrating admins → users");

  const oldAdmins = await oldDb.collection("admins").find({}).toArray();
  const existingUsers = await newDb.collection("users").find({}).toArray();
  const existingUsernames = new Set(existingUsers.map((u) => u.username));

  const oldIdToNewId = {};
  const oldIdToUsername = {};

  for (const admin of oldAdmins) {
    oldIdToUsername[admin._id.toString()] = admin.name;
    const existing = existingUsers.find((u) => u.username === admin.name);
    if (existing) oldIdToNewId[admin._id.toString()] = existing._id;
  }

  for (const admin of oldAdmins) {
    const adminIdStr = admin._id.toString();

    if (existingUsernames.has(admin.name)) {
      stats.users.skipped++;
      continue;
    }

    const newUser = {
      username: admin.name,
      password: admin.password,
      email: admin.email || "",
      permissions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      if (!DRY_RUN) {
        const result = await newDb.collection("users").insertOne(newUser);
        oldIdToNewId[adminIdStr] = result.insertedId;
      }
      stats.users.migrated++;
      log(`  + User: ${admin.name} (${admin.email})`);
    } catch (err) {
      stats.users.errors++;
      log(`  x Error inserting user ${admin.name}: ${err.message}`);
    }
  }

  // Refresh ID map after inserts
  if (!DRY_RUN) {
    const allNewUsers = await newDb.collection("users").find({}).toArray();
    for (const admin of oldAdmins) {
      const match = allNewUsers.find((u) => u.username === admin.name);
      if (match) oldIdToNewId[admin._id.toString()] = match._id;
    }
  }

  log(
    `Users: ${stats.users.migrated} migrated, ${stats.users.skipped} skipped, ${stats.users.errors} errors`
  );

  // ═══════════════════════════════════════════════════════════════════
  // STEP 2: Migrate roles → permissions
  // ═══════════════════════════════════════════════════════════════════
  logSection("STEP 2: Migrating roles → permissions");

  const oldRoles = await oldDb.collection("roles").find({}).toArray();
  const existingPerms = await newDb.collection("permissions").find({}).toArray();
  const existingPermNames = new Set(existingPerms.map((p) => p.name));

  const roleToAdminIds = {};
  for (const admin of oldAdmins) {
    if (admin.entityRoles) {
      for (const er of admin.entityRoles) {
        for (const roleId of er.roles) {
          const rIdStr = roleId.toString();
          if (!roleToAdminIds[rIdStr]) roleToAdminIds[rIdStr] = [];
          roleToAdminIds[rIdStr].push(admin._id.toString());
        }
      }
    }
  }

  for (const role of oldRoles) {
    const roleIdStr = role._id.toString();

    if (existingPermNames.has(role.name)) {
      stats.permissions.skipped++;
      continue;
    }

    const adminIds = roleToAdminIds[roleIdStr] || [];
    const newUserIds = adminIds
      .map((aid) => oldIdToNewId[aid])
      .filter(Boolean);

    const companies = [];
    const permList = role.permissions || [];
    if (
      permList.some(
        (p) =>
          p.includes("algadeer") ||
          p.includes("Algadeer") ||
          p === "Fund_Req"
      )
    )
      companies.push("Al-Ghadeer");
    if (permList.some((p) => p.includes("alrida") || p.includes("Alrida")))
      companies.push("Al-Rida");
    if (permList.some((p) => p.includes("mezan") || p.includes("Mezan")))
      companies.push("Al-Mezan");
    if (
      permList.some(
        (p) => p.includes("bdoor_alnajaf") || p.includes("alnajaf")
      )
    )
      companies.push("badur-Al-najaf");
    if (
      permList.some(
        (p) => p.includes("bdoor_baghdad") || p.includes("Baghdad")
      )
    )
      companies.push("Badur-Baghdad");
    if (permList.some((p) => p.includes("tiba") || p.includes("Tiba")))
      companies.push("Tiba-Al-najaf");
    if (permList.some((p) => p.includes("karbala") || p.includes("Karbala")))
      companies.push("Ghadeer-Karbala");

    const newPermissions = mapPermissions(permList);

    const newPerm = {
      name: role.name,
      permissions: newPermissions,
      users: newUserIds,
      companies,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      if (!DRY_RUN) {
        await newDb.collection("permissions").insertOne(newPerm);
      }
      stats.permissions.migrated++;
      log(
        `  + Permission group: ${role.name} (${newUserIds.length} users, ${companies.length} companies)`
      );
    } catch (err) {
      stats.permissions.errors++;
      log(`  x Error inserting permission ${role.name}: ${err.message}`);
    }
  }

  log(
    `Permissions: ${stats.permissions.migrated} migrated, ${stats.permissions.skipped} skipped, ${stats.permissions.errors} errors`
  );

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: Migrate assignedworkflows → workflows (upsert)
  // ═══════════════════════════════════════════════════════════════════
  logSection("STEP 3: Migrating workflows (insert or update existing)");

  const oldAssignedWFs = await oldDb
    .collection("assignedworkflows")
    .find({})
    .toArray();
  const existingWFs = await newDb.collection("workflows").find({}).toArray();
  const existingWFByCompany = {};
  for (const wf of existingWFs) {
    existingWFByCompany[wf.company] = wf;
  }

  // Pick one primary workflow per company from old system
  const bestOldWF = {};
  for (const aw of oldAssignedWFs) {
    const arabicName = TRANSACTION_TYPE_TO_COMPANY[aw.transactionType];
    if (!arabicName) continue;
    const companyKey = COMPANY_MAP[arabicName];
    if (!companyKey) continue;
    if (!bestOldWF[companyKey]) bestOldWF[companyKey] = aw;
  }

  const processedCompanies = new Set();

  for (const [companyKey, oldWF] of Object.entries(bestOldWF)) {
    if (processedCompanies.has(companyKey)) continue;
    processedCompanies.add(companyKey);

    const newSteps = (oldWF.steps || []).map((step) => ({
      users: (step.approvers || [])
        .map((aid) => oldIdToNewId[aid.toString()])
        .filter(Boolean),
      status: "Pending",
      actedBy: null,
      actedAt: null,
      comment: "",
    }));

    const existing = existingWFByCompany[companyKey];

    if (existing) {
      // UPDATE existing workflow with real data
      if (!DRY_RUN) {
        await newDb.collection("workflows").updateOne(
          { _id: existing._id },
          {
            $set: {
              name: oldWF.transactionType,
              steps: newSteps,
              updatedAt: new Date(),
            },
          }
        );
      }
      stats.workflows.updated++;
      log(
        `  ~ Updated: ${companyKey} "${existing.name}" → "${oldWF.transactionType}" (${newSteps.length} steps)`
      );
    } else {
      // INSERT new workflow
      const newWorkflow = {
        name: oldWF.transactionType,
        company: companyKey,
        steps: newSteps,
        createdAt: oldWF.createdAt || new Date(),
        updatedAt: oldWF.updatedAt || new Date(),
      };
      try {
        if (!DRY_RUN) {
          await newDb.collection("workflows").insertOne(newWorkflow);
        }
        stats.workflows.migrated++;
        log(
          `  + Inserted: ${oldWF.transactionType} → ${companyKey} (${newSteps.length} steps)`
        );
      } catch (err) {
        stats.workflows.errors++;
        log(`  x Error inserting workflow for ${companyKey}: ${err.message}`);
      }
    }
  }

  log(
    `Workflows: ${stats.workflows.migrated} inserted, ${stats.workflows.updated} updated, ${stats.workflows.errors} errors`
  );

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: Migrate fundrequests + approvalworkflows → requests_*
  // ═══════════════════════════════════════════════════════════════════
  logSection("STEP 4: Migrating fund requests");

  // Build approvalworkflow lookup by transactionId
  const allApprovalWFs = await oldDb
    .collection("approvalworkflows")
    .find({})
    .toArray();
  const awByTransId = {};
  for (const aw of allApprovalWFs) {
    awByTransId[aw.transactionId.toString()] = aw;
  }

  // Get all fund requests from old DB
  const allFundRequests = await oldDb
    .collection("fundrequests")
    .find({})
    .toArray();

  // Collect existing requestCodes in new DB to skip duplicates
  const skipCols = ["requests_deleteall", "requests_all", "requests"];
  const newCollections = (await newDb.listCollections().toArray())
    .map((c) => c.name)
    .filter((c) => c.startsWith("requests_") && skipCols.indexOf(c) === -1);

  const existingCodes = new Set();
  for (const colName of newCollections) {
    const docs = await newDb
      .collection(colName)
      .find({}, { projection: { requestCode: 1 } })
      .toArray();
    for (const d of docs) {
      if (d.requestCode) existingCodes.add(d.requestCode);
    }
  }

  log(`Existing request codes in new DB: ${existingCodes.size}`);

  const byCompany = {};

  for (const fr of allFundRequests) {
    const companyKey = COMPANY_MAP[fr.companyName];
    if (!companyKey) {
      log(
        `  ? Unknown company "${fr.companyName}" for request ${fr.uniqueCode}, skipping`
      );
      stats.requests.skipped++;
      continue;
    }

    if (existingCodes.has(fr.uniqueCode)) {
      stats.requests.skipped++;
      continue;
    }

    const aw = awByTransId[fr._id.toString()];
    const newRequest = buildNewRequest(
      fr,
      aw,
      companyKey,
      oldIdToNewId,
      oldIdToUsername
    );

    const collName = `requests_${companyKey.toLowerCase()}`;

    try {
      if (!DRY_RUN) {
        await newDb.collection(collName).insertOne(newRequest);
      }
      stats.requests.migrated++;
      if (!byCompany[companyKey]) byCompany[companyKey] = 0;
      byCompany[companyKey]++;
    } catch (err) {
      stats.requests.errors++;
      log(`  x Error inserting request ${fr.uniqueCode}: ${err.message}`);
    }
  }

  for (const [company, count] of Object.entries(byCompany)) {
    log(`  ${company}: ${count} requests migrated`);
  }

  log(
    `Requests: ${stats.requests.migrated} migrated, ${stats.requests.skipped} skipped, ${stats.requests.errors} errors`
  );

  // ═══════════════════════════════════════════════════════════════════
  // STEP 5: Verification & Report
  // ═══════════════════════════════════════════════════════════════════
  logSection("STEP 5: Verification");

  if (!DRY_RUN) {
    const finalWFs = await newDb.collection("workflows").find({}).toArray();
    for (const wf of finalWFs) {
      const stepCount = (wf.steps || []).length;
      const approverCount = (wf.steps || []).reduce(
        (s, st) => s + (st.users || []).length,
        0
      );
      log(
        `  Workflow ${wf.company}: "${wf.name}" - ${stepCount} steps, ${approverCount} approvers`
      );
    }

    const finalCols = (await newDb.listCollections().toArray())
      .map((c) => c.name)
      .filter((c) => c.startsWith("requests_") && skipCols.indexOf(c) === -1);
    let totalFinal = 0;
    for (const c of finalCols) {
      const count = await newDb.collection(c).countDocuments();
      if (count > 0) {
        totalFinal += count;
        log(`  ${c}: ${count} requests`);
      }
    }
    log(`  Total requests: ${totalFinal}`);
    log(
      `  Total users: ${await newDb.collection("users").countDocuments()}`
    );
    log(
      `  Total permissions: ${await newDb.collection("permissions").countDocuments()}`
    );
  }

  // Final report table
  console.log("\n┌──────────────┬──────────┬─────────┬─────────┬────────┐");
  console.log("│ Collection   │ Migrated │ Updated │ Skipped │ Errors │");
  console.log("├──────────────┼──────────┼─────────┼─────────┼────────┤");
  console.log(
    `│ users        │ ${String(stats.users.migrated).padEnd(8)} │ ${String("-").padEnd(7)} │ ${String(stats.users.skipped).padEnd(7)} │ ${String(stats.users.errors).padEnd(6)} │`
  );
  console.log(
    `│ permissions  │ ${String(stats.permissions.migrated).padEnd(8)} │ ${String("-").padEnd(7)} │ ${String(stats.permissions.skipped).padEnd(7)} │ ${String(stats.permissions.errors).padEnd(6)} │`
  );
  console.log(
    `│ workflows    │ ${String(stats.workflows.migrated).padEnd(8)} │ ${String(stats.workflows.updated).padEnd(7)} │ ${String(stats.workflows.skipped).padEnd(7)} │ ${String(stats.workflows.errors).padEnd(6)} │`
  );
  console.log(
    `│ requests     │ ${String(stats.requests.migrated).padEnd(8)} │ ${String("-").padEnd(7)} │ ${String(stats.requests.skipped).padEnd(7)} │ ${String(stats.requests.errors).padEnd(6)} │`
  );
  console.log("└──────────────┴──────────┴─────────┴─────────┴────────┘");

  if (DRY_RUN) {
    console.log("\nDRY RUN — No data was written to the new database.");
    console.log("Run without --dry-run to execute the migration.\n");
  } else {
    console.log("\nMigration completed successfully.");
    console.log("Old database was NOT modified (read-only).\n");
  }

  await oldConn.close();
  await newConn.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});