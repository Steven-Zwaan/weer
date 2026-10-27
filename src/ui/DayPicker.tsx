import { useEffect } from 'react';
import type { Day } from '@/domain/types';
import { pickerLabel } from '@/domain/days';
import { longDate } from '@/domain/format';
import { useDragScroll } from '@/app/hooks';

/** Ten day buttons (§2.3); the selected one is accent with white text and scrolls into view. */
export function DayPicker({ days, selected, tz, onSelect }: { days: Day[]; selected: number; tz: string; onSelect(i: number): void }) {
  const ref = useDragScroll<HTMLDivElement>();
  useEffect(() => {
    const btn = ref.current?.children[selected] as HTMLElement | undefined;
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  return (
    <div className="daypicker" ref={ref} data-noswipe>
      {days.map((d, i) => {
        const l = pickerLabel(d, i, tz);
        return (
          <button key={d.key} type="button" className="daybtn" aria-pressed={i === selected} aria-label={longDate(d.date, tz)} onClick={() => onSelect(i)}>
            <span className="s">{l.short}</span>
            <span className="n">{l.num}</span>
          </button>
        );
      })}
    </div>
  );
}
