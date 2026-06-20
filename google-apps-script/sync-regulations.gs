// ============================================================
// Regulyze — Google Sheet → Supabase Regulation Sync
// ============================================================
//
// HOW TO INSTALL (one-time setup):
//
// 1. Open your Regulyze regulation Google Sheet
// 2. Click Extensions → Apps Script
// 3. Delete any existing code, paste THIS entire file
// 4. Set SYNC_SECRET below to match the REGULATION_SYNC_SECRET
//    you added in Supabase → Edge Functions → sync-regulations → Secrets
// 5. Click Save (floppy disk icon)
// 6. Run setupTriggers() once  → authorise when prompted
// 7. Run syncAllTabs() once    → populates Supabase with current sheet data
//
// After that, every time you edit a cell in any regulation tab,
// Supabase is updated automatically within ~30 seconds.
// ============================================================

// ── Configuration ────────────────────────────────────────────
var SUPABASE_FUNC_URL = 'https://afttrokqchfcpjcekuyh.supabase.co/functions/v1/sync-regulations';
var SYNC_SECRET = 'YOUR_REGULATION_SYNC_SECRET_HERE'; // Replace with your secret

var REGULATION_TABS = [
  'Sched_I_Vitamins',
  'Sched_I_Minerals',
  'Sched_I_AminoAcids',
  'Sched_I_Nucleotides',
  'Sched_I_Overages_TableC',
  'Schedule_II',
  'Schedule_III_A',
  'Schedule_III_B',
  'Sched_IV_Prebiotics',
  'Sched_IV_Probiotics',
  'Additives_HS_Nutra_PrePro',
  'Additives_Tab_Cap_Syrup',
  'RDA_2020',
  'GMP_Codex_Additives',
  'GMP_FSSR_Additives',
  'NSF_Approved',
  'NSF_Rejected',
  'FSSR_Permitted',
  'Trade_Name_Mapper',
  'Not_Permitted_Ingredients',
  'Mineral_Conversions',
  'Vitamin_Conversions'
];

// ── Per-edit trigger (debounced ~30 seconds) ─────────────────
// Installed automatically by setupTriggers(). Do not rename.
// NOTE: Do NOT run this from the editor — it only works when a real sheet edit fires it.
function onEditTrigger(e) {
  if (!e || !e.range) return; // guard: called without event (e.g. manual Run)
  var tabName = e.range.getSheet().getName();
  if (REGULATION_TABS.indexOf(tabName) < 0) return; // ignore non-regulation tabs

  // Remember which tab was last edited
  PropertiesService.getScriptProperties().setProperty('PENDING_SYNC_TAB', tabName);

  // Cancel any existing pending sync (reset the 30s window)
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncPendingTab') ScriptApp.deleteTrigger(t);
  });

  // Schedule the actual sync 30 seconds from now
  ScriptApp.newTrigger('syncPendingTab').timeBased().after(30 * 1000).create();
}

// Called ~30s after the last edit. Syncs only the edited tab.
function syncPendingTab() {
  var props = PropertiesService.getScriptProperties();
  var tabName = props.getProperty('PENDING_SYNC_TAB');
  if (!tabName) return;
  props.deleteProperty('PENDING_SYNC_TAB');

  // Clean up this time trigger
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncPendingTab') ScriptApp.deleteTrigger(t);
  });

  try {
    syncTab(tabName);
    Logger.log('Auto-sync complete: ' + tabName);
  } catch (e) {
    Logger.log('Auto-sync ERROR for ' + tabName + ': ' + e.message);
  }
}

// ── Sync a single tab to Supabase ────────────────────────────
function syncTab(tabName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    Logger.log('Tab not found: ' + tabName);
    return;
  }

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) {
    Logger.log('Tab has no data rows (only header or empty): ' + tabName);
    return;
  }

  // First row = headers, remaining rows = data
  var headers = rows[0].map(function(h) { return String(h).trim(); });
  var dataRows = rows.slice(1)
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = String(row[i] === null || row[i] === undefined ? '' : row[i]).trim();
      });
      return obj;
    })
    .filter(function(r) {
      // Keep only rows where at least one column has a value (skip blank rows)
      return Object.values(r).some(function(v) { return v !== ''; });
    });

  var payload = JSON.stringify({ tab_name: tabName, rows: dataRows });
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + SYNC_SECRET },
    payload: payload,
    muteHttpExceptions: true
  };

  var resp = UrlFetchApp.fetch(SUPABASE_FUNC_URL, options);
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  Logger.log('[' + tabName + '] HTTP ' + code + ' — ' + dataRows.length + ' rows — ' + body);
  if (code !== 200) throw new Error('Sync failed for ' + tabName + ': HTTP ' + code + ' — ' + body);
}

// ── Full sync: run once to populate Supabase ─────────────────
// Run this from Extensions → Apps Script → Run → syncAllTabs
function syncAllTabs() {
  Logger.log('=== Starting full sync: ' + REGULATION_TABS.length + ' tabs ===');
  var errors = [];
  REGULATION_TABS.forEach(function(tabName) {
    try {
      syncTab(tabName);
      Utilities.sleep(300); // brief pause between tabs to avoid rate limits
    } catch (e) {
      errors.push(tabName + ': ' + e.message);
      Logger.log('ERROR: ' + e.message);
    }
  });
  if (errors.length > 0) {
    Logger.log('=== Sync complete with errors: ===');
    errors.forEach(function(e) { Logger.log('  ' + e); });
  } else {
    Logger.log('=== Full sync complete — all tabs OK ===');
  }
}

// ── Setup: run once after pasting this script ────────────────
// Installs the onEdit trigger. Safe to run multiple times.
function setupTriggers() {
  // Remove any existing onEdit triggers for this script to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getEventType() === ScriptApp.EventType.ON_EDIT) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log('onEdit trigger installed successfully.');
  Logger.log('Next step: run syncAllTabs() to populate Supabase with current sheet data.');
}
