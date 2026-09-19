/** Once most of a reporter's decided reports turn out false, their reporting pauses for a while. */
export const REPORT_BLOCK_MIN_DISMISSED = 5;
export const REPORT_BLOCK_SCORE = 0.2;
export const REPORT_BLOCK_DAYS = 30;

/** Share of decided reports that moderators confirmed, smoothed so a new reporter starts at 0.5 (0..1). */
export const reporterCredibility = (confirmed: number, dismissed: number) =>
  (confirmed + 1) / (confirmed + dismissed + 2);

export const isTrustedReporter = (confirmed: number, dismissed: number) =>
  confirmed >= 3 && reporterCredibility(confirmed, dismissed) >= 0.8;
