import { useTranslation } from "react-i18next";
import { CONCERN_KEYS } from "./concerns";

/** Intake multi-select: pick which preset concerns the customer reported. */
export function ConcernsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const { t } = useTranslation();
  const toggle = (k: string) =>
    onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CONCERN_KEYS.map((k) => (
        <label
          key={k}
          className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink-2 transition-colors hover:bg-paper-2"
        >
          <input
            type="checkbox"
            checked={value.includes(k)}
            onChange={() => toggle(k)}
            className="h-4 w-4 rounded border-line-strong accent-ink"
          />
          {t(`concerns.${k}`)}
        </label>
      ))}
    </div>
  );
}
