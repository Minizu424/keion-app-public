import type { SelectHTMLAttributes } from "react";

type SelectOption = {
  label: string;
  value: string;
};

type SelectBoxProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helperText?: string;
};

export function SelectBox({
  label,
  options,
  placeholder = "選択してください",
  error,
  helperText,
  className = "",
  id,
  value,
  defaultValue,
  ...props
}: SelectBoxProps) {
  const selectId = id ?? props.name;

  const valueProps =
    value !== undefined
      ? { value }
      : { defaultValue: defaultValue ?? "" };

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1.5 block text-sm font-semibold text-blue-950"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          className={[
            "h-11 w-full appearance-none rounded-lg border bg-white px-3 pr-10 text-sm text-blue-950 outline-none transition",
            "placeholder:text-slate-400",
            "focus:border-blue-600 focus:ring-2 focus:ring-blue-100",
            "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
            error ? "border-red-400" : "border-slate-300",
            className,
          ].join(" ")}
          {...valueProps}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}

          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          ▾
        </span>
      </div>

      {error ? (
        <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}