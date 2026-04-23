"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import clsx from "clsx";

interface SelectWithOtherProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  optionLabels?: Record<string, string>;
  placeholder?: string;
  required?: boolean;
  size?: "sm" | "md";
  allowOther?: boolean;
}

export default function SelectWithOther({
  label,
  value,
  onChange,
  options,
  optionLabels,
  placeholder = "Select an option",
  required = false,
  size = "md",
  allowOther = true,
}: SelectWithOtherProps) {
  const isOther = value !== "" && !options.includes(value);
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(isOther);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const labelFor = (opt: string) => (optionLabels && optionLabels[opt]) || opt;

  useEffect(() => {
    if (value && !options.includes(value)) setShowCustom(true);
  }, [value, options]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => {
    const term = search.toLowerCase();
    return o.toLowerCase().includes(term) || labelFor(o).toLowerCase().includes(term);
  });

  const displayValue = showCustom ? "Other..." : (value ? labelFor(value) : "");

  const py = size === "sm" ? "py-2" : "py-3";

  return (
    <div>
      <label className="block text-sm font-medium text-dark-200 auth-label mb-2">{label}</label>
      <div ref={ref} className="relative">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={clsx(
            "glass-input w-full px-4 text-left flex items-center justify-between gap-2 text-sm",
            py,
            !value && !showCustom && "text-white/30"
          )}
        >
          <span className={clsx("truncate select-dropdown-text", (value || showCustom) && "select-dropdown-value")}>
            {displayValue || placeholder}
          </span>
          <ChevronDown className={clsx("w-4 h-4 shrink-0 text-dark-400 transition-transform", open && "rotate-180")} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden select-dropdown-panel"
          >
            {/* Search */}
            <div className="p-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-2 text-sm rounded-lg select-dropdown-search outline-none focus:border-accent-purple/50"
                autoFocus
              />
            </div>

            {/* Options list */}
            <div className="max-h-48 overflow-y-auto px-1 pb-1">
              {filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setShowCustom(false);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    value === opt && !showCustom
                      ? "bg-accent-purple/20 text-accent-purple"
                      : "text-dark-100 hover:bg-white/5"
                  )}
                >
                  {labelFor(opt)}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-dark-400">No matches found</p>
              )}
            </div>

            {/* Other divider + option */}
            {allowOther && (
              <div className="border-t border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom(true);
                    onChange("");
                    setOpen(false);
                    setSearch("");
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className={clsx(
                    "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    showCustom
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-dark-200 hover:bg-white/5"
                  )}
                >
                  Other (type your own)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom text input */}
      {showCustom && (
        <div className="relative mt-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className={clsx("glass-input w-full px-4 pr-9 text-sm", py)}
            placeholder="Type your own..."
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setShowCustom(false);
              onChange("");
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden required input for form validation */}
      {required && !value && (
        <input
          tabIndex={-1}
          className="opacity-0 absolute h-0 w-0"
          required
          value=""
          onChange={() => {}}
        />
      )}
    </div>
  );
}
