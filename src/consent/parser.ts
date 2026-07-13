// Absorbed from contenders/second-ask/parser.ts — tournament verdict absorb #1
// (predict-then-ask consent layer). The contender copy remains for its standalone demo.
/**
 * Second Ask — deterministic reply parser. NO LLM.
 *
 * Intent + date extraction is pure regex + calendar arithmetic, so it:
 *   - runs fully offline (demo can never die on stage),
 *   - costs $0 per message at any scale,
 *   - is reproducible — the exact parse of the payer's words is shown to the
 *     judges in the API pane (a PARSE pseudo-call), same honesty contract as
 *     the rest of the repo.
 *
 * Understands (relative to `now`, AU conventions, day-first dates):
 *   weekdays ("friday", "next tue"), "tomorrow"/"today", "in 3 days/2 weeks/
 *   a fortnight", "next week", "week after next", "end of the month",
 *   day-of-month ("the 28th", "28th of july"), "28/7", "july 28",
 *   payday talk ("when I get paid"), hardship ("can't pay this week"),
 *   split requests ("half now half on the 28th"), CHANGE / PAUSE / STOP,
 *   and negated proposals ("can't do friday, monday works" → monday).
 */

export type IntentType =
  | 'optout'
  | 'pause'
  | 'hardship'
  | 'split'
  | 'change'
  | 'confirm'
  | 'date'
  | 'payday_no_date'
  | 'unknown';

export type Intent =
  | { type: 'optout' }
  | { type: 'pause' }
  | { type: 'hardship' }
  | { type: 'split' }
  | { type: 'change' }
  | { type: 'confirm' }
  | { type: 'date'; date: Date; label: string; payday: boolean; split: boolean; quote: string }
  | { type: 'payday_no_date' }
  | { type: 'unknown' };

interface Hit {
  date: Date;
  label: string;
  index: number;
  end: number;
  /** explicit(3) > relative(2) > weekday/dom(1) — wins overlap dedupe */
  prio: number;
  kind: 'explicit' | 'relative' | 'weekday' | 'dom';
}

export interface DateHit { date: Date; label: string; index: number; kind: Hit['kind'] }

const WD: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tues: 2, tue: 2,
  wednesday: 3, weds: 3, wed: 3, thursday: 4, thurs: 4, thur: 4, thu: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTH: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const NUMWORD: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, 'couple of': 2, few: 3,
};

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function plusDays(from: Date, n: number): Date {
  const d = midnight(from);
  d.setDate(d.getDate() + n);
  return d;
}

function nextWeekday(now: Date, target: number, plusWeek: boolean): Date {
  let delta = (target - now.getDay() + 7) % 7;
  if (delta === 0) delta = 7; // "monday" said on a Monday = next Monday
  if (plusWeek) delta += 7;
  return plusDays(now, delta);
}

/** Next future occurrence of a day-of-month; skips months that lack it (e.g. the 31st). */
function nextDom(now: Date, dom: number): Date | null {
  const today = midnight(now);
  for (let k = 0; k < 4; k++) {
    const cand = new Date(now.getFullYear(), now.getMonth() + k, dom);
    if (cand.getDate() !== dom) continue; // overflowed into the next month
    if (cand > today) return cand;
  }
  return null;
}

export function extractDates(text: string, now: Date): DateHit[] {
  const t = text.toLowerCase();
  const today = midnight(now);
  const hits: Hit[] = [];
  const push = (m: RegExpMatchArray, date: Date | null, prio: number, kind: Hit['kind']) => {
    if (!date) return;
    const index = m.index ?? 0;
    hits.push({ date, label: m[0].trim(), index, end: index + m[0].length, prio, kind });
  };

  // dd/mm or dd/mm/yyyy — AU day-first
  for (const m of t.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const d = +m[1], mo = +m[2] - 1;
    if (d < 1 || d > 31 || mo < 0 || mo > 11) continue;
    const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
    let date = new Date(y, mo, d);
    if (!m[3] && date <= today) date = new Date(y + 1, mo, d);
    push(m, date, 3, 'explicit');
  }

  // "july 28" / "28th of july"
  const monthDate = (moName: string, d: number): Date | null => {
    const mo = MONTH[moName.slice(0, 3)];
    if (mo == null || d < 1 || d > 31) return null;
    let date = new Date(now.getFullYear(), mo, d);
    if (date <= today) date = new Date(now.getFullYear() + 1, mo, d);
    return date.getDate() === d ? date : null;
  };
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/g)) {
    push(m, monthDate(m[1], +m[2]), 3, 'explicit');
  }
  for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g)) {
    push(m, monthDate(m[2], +m[1]), 3, 'explicit');
  }

  // today / tomorrow
  for (const m of t.matchAll(/\btoday\b/g)) push(m, today, 2, 'relative');
  for (const m of t.matchAll(/\btomorrow\b|\btmrw\b|\btomoz\b/g)) push(m, plusDays(now, 1), 2, 'relative');

  // "in 3 days" / "in two weeks" / "in a fortnight"
  for (const m of t.matchAll(/\bin\s+(couple of|a|an|one|two|three|four|five|six|seven|eight|nine|ten|few|\d+)\s*(day|week|fortnight)s?(?:\s+time)?\b/g)) {
    const n = NUMWORD[m[1]] ?? +m[1];
    if (!Number.isFinite(n)) continue;
    const unit = m[2] === 'day' ? 1 : m[2] === 'week' ? 7 : 14;
    push(m, plusDays(now, n * unit), 2, 'relative');
  }

  // "week after next" / "next week" / "end of the month"
  for (const m of t.matchAll(/\bweek after next\b/g)) push(m, plusDays(now, 14), 2, 'relative');
  for (const m of t.matchAll(/\bnext week\b/g)) push(m, plusDays(now, 7), 2, 'relative');
  for (const m of t.matchAll(/\bend of (?:the )?month\b/g)) {
    push(m, new Date(now.getFullYear(), now.getMonth() + 1, 0), 2, 'relative');
  }

  // weekdays ("friday", "next tue")
  for (const m of t.matchAll(/\b(next\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/g)) {
    push(m, nextWeekday(now, WD[m[2]], !!m[1]), 1, 'weekday');
  }

  // day-of-month: "the 28th" / "28th" / "the 28"
  for (const m of t.matchAll(/\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/g)) {
    push(m, nextDom(now, +m[1]), 1, 'dom');
  }
  for (const m of t.matchAll(/\bthe\s+(\d{1,2})\b/g)) {
    push(m, nextDom(now, +m[1]), 1, 'dom');
  }

  // Dedupe overlapping spans — higher priority wins ("28th of july" beats "28th").
  hits.sort((a, b) => a.index - b.index || b.prio - a.prio);
  const kept: Hit[] = [];
  for (const h of hits) {
    const clashAt = kept.findIndex((k) => h.index < k.end && h.end > k.index);
    if (clashAt === -1) kept.push(h);
    else if (h.prio > kept[clashAt].prio) kept[clashAt] = h;
  }

  // "friday the 28th" — weekday immediately followed by a day-of-month:
  // the explicit date wins, the weekday was just how the payer said it.
  for (let i = 0; i < kept.length - 1; i++) {
    if (kept[i].kind === 'weekday' && kept[i + 1].kind === 'dom' && kept[i + 1].index <= kept[i].end + 5) {
      kept.splice(i, 1, { ...kept[i + 1], label: `${kept[i].label} ${kept[i + 1].label}`, index: kept[i].index });
      kept.splice(i + 1, 1);
    }
  }

  return kept.map(({ date, label, index, kind }) => ({ date, label, index, kind }));
}

export function classify(text: string, now: Date): Intent {
  const t = text.toLowerCase().trim();

  if (/^stop[\s.!]*$/.test(t) || /\bopt\s*-?\s*out\b|\bunsubscribe\b|\bstop (texting|messaging|contacting)/.test(t)) {
    return { type: 'optout' };
  }
  if (/^pause[\s.!]*$/.test(t) || /\bpause (it|everything|the payment)\b/.test(t)) {
    return { type: 'pause' };
  }

  const hits = extractDates(t, now);
  const wantsSplit = /\bsplit\b|\bhalf\b|\bhalves\b|\btwo payments\b|\binstal?lments?\b/.test(t);
  const payday = /\bpay\s*day\b|\bget(s|ting)? paid\b|\bi'?m paid\b|\bmy pay\b|\bpay (comes in|lands|hits)\b/.test(t);
  const neg = /can'?t|cannot|won'?t work|no good|doesn'?t work|\bnot\b/.exec(t);
  const hardship = /can'?t (afford|pay)|cannot (afford|pay)|\bno money\b|\bhardship\b|\bstruggling\b|\blost my job\b|\bout of work\b|\bbroke\b|\bskint\b|tight (week|month|right now)/.test(t);

  if (hits.length > 0) {
    let chosen = hits[0];
    if (neg && neg.index < hits[0].index) {
      // "can't do friday, monday works" → monday. "can't do friday" alone → ask again.
      if (hits.length >= 2) chosen = hits[1];
      else return hardship ? { type: 'hardship' } : { type: 'change' };
    }
    return { type: 'date', date: chosen.date, label: chosen.label, payday, split: wantsSplit, quote: text.trim() };
  }

  if (hardship) return { type: 'hardship' };
  if (wantsSplit) return { type: 'split' };
  if (/\bchange\b|\bdifferent day\b|\banother day\b|resched|\bmove it\b|\bpick another\b/.test(t)) return { type: 'change' };
  if (payday) return { type: 'payday_no_date' };
  if (/^(yes|yep|yeah|ya|yup|ok|okay|sure|sounds good|good|great|perfect|awesome|all good|thanks|thank you|cheers|no worries)[\s.!]*$/.test(t)) {
    return { type: 'confirm' };
  }
  return { type: 'unknown' };
}

/** BECS debits don't process on weekends — roll forward to the next banking day. */
export function rollForward(date: Date): { date: Date; rolled: boolean } {
  const d = new Date(date);
  let rolled = false;
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
    rolled = true;
  }
  return { date: d, rolled };
}

/** Local-timezone YYYY-MM-DD (never toISOString — UTC shifts the day in AEST evenings). */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function human(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
}
