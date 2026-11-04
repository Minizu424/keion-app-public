import type { InputHTMLAttributes, ReactNode } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = "",
  id,
  ...props
}: TextInputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-semibold text-blue-950"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          className={[
            "h-11 w-full rounded-lg border bg-white px-3 text-sm text-blue-950 outline-none transition",
            "placeholder:text-slate-400",
            "focus:border-blue-600 focus:ring-2 focus:ring-blue-100",
            "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
            error ? "border-red-400" : "border-slate-300",
            leftIcon ? "pl-10" : "",
            rightIcon ? "pr-10" : "",
            className,
          ].join(" ")}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-1 text-xs font-medium text-red-500">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}