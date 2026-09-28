// YouTube writes live chat times in the UI language's 12-hour style ("7:41 PM", "7:41 p.m.",
// "오후 7:41", "午後7:41", "下午7:41"). Replay offsets like "1:23:45" have no AM/PM marker
// and are left alone.
const SUFFIX = /^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i;
const PREFIX = /^(오전|오후|午前|午後|上午|下午)\s*(\d{1,2}):(\d{2})$/;
const PM_PREFIXES = new Set(['오후', '午後', '下午']);

/** Converts a 12-hour chat time to 24-hour ("7:41 PM" -> "19:41"); other text is returned as is. */
export function to24Hour(time: string): string {
  let hours: number, minutes: string, pm: boolean;
  const suffix = SUFFIX.exec(time.trim());
  const prefix = suffix ? null : PREFIX.exec(time.trim());
  if (suffix) {
    [hours, minutes, pm] = [Number(suffix[1]), suffix[2]!, suffix[3]!.toLowerCase() === 'p'];
  } else if (prefix) {
    [hours, minutes, pm] = [Number(prefix[2]), prefix[3]!, PM_PREFIXES.has(prefix[1]!)];
  } else {
    return time;
  }
  const h24 = (hours % 12) + (pm ? 12 : 0);
  return `${String(h24).padStart(2, '0')}:${minutes}`;
}
