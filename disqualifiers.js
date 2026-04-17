/**
 * disqualifiers.js — hard-reject layer for the picks pipeline.
 *
 * Unlike risk-flags.js (which subtracts a penalty from the score but keeps
 * the stock in the list), disqualifiers pull a stock OUT of the picks list
 * entirely. Used for conditions severe enough that no score adjustment
 * could make the stock ownable:
 *
 *   - extreme promoter pledge (>75% — margin-call cascade risk)
 *   - auditor resignation / qualified opinion (governance breakdown)
 *   - SEBI action / ban flagged in screener data
 *   - extreme leverage on a non-financial (D/E > 5)
 *   - confirmed zero / missing critical data
 *
 * Returns { code, reason, severity } or null.
 *
 * Disqualified stocks still appear in the full `stocks` array (for
 * transparency / search) but are filtered out of picksRebound /
 * picksMomentum / picksLongTerm before those arrays hit the UI.
 */

'use strict';

function checkDisqualifiers(f) {
  if (!f) return null;

  // 1. Extreme promoter pledge — margin-call cascade risk that no
  // operational quality can offset. 75% is a five-sigma event.
  if (Number.isFinite(f.pledged) && f.pledged >= 75) {
    return {
      code: 'PLEDGE_EXTREME',
      reason: `Promoter pledge ${f.pledged.toFixed(0)}% — margin-call cascade risk`,
      severity: 'DISQUALIFY',
    };
  }

  // 2. Extreme leverage on a non-bank/non-NBFC. Financial sector has its own
  // leverage profile so skip that check there.
  const isFinancial = f.sector && /bank|financ|nbfc|insur/i.test(String(f.sector));
  if (!isFinancial && Number.isFinite(f.debtToEq) && f.debtToEq >= 5) {
    return {
      code: 'LEVERAGE_EXTREME',
      reason: `D/E ${f.debtToEq.toFixed(1)}x — balance-sheet distress`,
      severity: 'DISQUALIFY',
    };
  }

  // 3. Auditor resignation / qualified opinion (if Screener exposes the flag)
  if (f.auditorQualified === true || f.auditorResigned === true) {
    return {
      code: 'AUDITOR_FLAG',
      reason: 'Auditor resigned or issued qualified opinion — governance concern',
      severity: 'DISQUALIFY',
    };
  }

  // 4. SEBI action / regulatory ban flag
  if (f.sebiAction === true || f.regulatoryBan === true) {
    return {
      code: 'REGULATORY_ACTION',
      reason: 'SEBI action or regulatory ban flagged',
      severity: 'DISQUALIFY',
    };
  }

  // 5. Persistently negative operating margin — structurally unprofitable
  // and not a turnaround candidate (no growth signal).
  if (Number.isFinite(f.operatingMargin) && f.operatingMargin <= -5
      && Number.isFinite(f.operatingMargin5yAvg) && f.operatingMargin5yAvg <= 0) {
    return {
      code: 'PERSISTENT_LOSSES',
      reason: `Operating margin ${f.operatingMargin.toFixed(1)}%, 5Y avg ${f.operatingMargin5yAvg.toFixed(1)}% — structural losses`,
      severity: 'DISQUALIFY',
    };
  }

  // 6. Data floor — a pick with <30% data completeness is not defensible.
  // (Soft penalty handled elsewhere for 30-50%; this is the hard floor.)
  if (Number.isFinite(f.dataCompleteness) && f.dataCompleteness < 0.30) {
    return {
      code: 'INSUFFICIENT_DATA',
      reason: `Data completeness ${(f.dataCompleteness * 100).toFixed(0)}% — cannot score confidently`,
      severity: 'DISQUALIFY',
    };
  }

  return null;
}

module.exports = { checkDisqualifiers };
