'use client';

import {
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronRight, AlertCircle, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { SettingsSearchContext } from './WidgetSettingsPortal';

/**
 * Settings tree primitives modelled on Foxglove's panel settings: collapsible nodes with
 * visibility and action controls, and label/control rows that apply changes immediately.
 */

export interface TreeAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export function ActionMenu({ label, actions }: { label: string; actions: TreeAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="tree-menu" ref={ref}>
      <button
        type="button"
        className="tree-icon-button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="tree-menu-list" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? 'text-danger' : undefined}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeSection({
  title,
  keywords = '',
  defaultOpen = true,
  visible,
  onVisibleChange,
  actions,
  error,
  depth = 0,
  children,
}: {
  title: string;
  keywords?: string;
  defaultOpen?: boolean;
  /** Shows an eye toggle when provided. */
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  actions?: TreeAction[];
  error?: string;
  depth?: number;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const query = useContext(SettingsSearchContext).trim().toLowerCase();
  const matches = !query || `${title} ${keywords}`.toLowerCase().includes(query);
  const expanded = open || !!query;
  return (
    <section
      className={`tree-section ${visible === false ? 'tree-hidden' : ''}`}
      hidden={!matches}
      style={{ '--tree-depth': depth } as CSSProperties}
    >
      <div className="tree-header">
        <button
          type="button"
          className="tree-toggle-open"
          aria-expanded={expanded}
          onClick={() => setOpen(!open)}
          disabled={!children}
        >
          {children ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="w-[14px]" />
          )}
          <span className="tree-title">{title}</span>
          {error && (
            <span className="tree-error-icon" title={error} aria-label={error}>
              <AlertCircle size={13} />
            </span>
          )}
        </button>
        <div className="tree-actions">
          {visible !== undefined && onVisibleChange && (
            <button
              type="button"
              className="tree-icon-button"
              aria-label={`${visible ? 'Hide' : 'Show'} ${title}`}
              aria-pressed={visible}
              onClick={() => onVisibleChange(!visible)}
            >
              {visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          )}
          {actions && actions.length > 0 && (
            <ActionMenu label={`${title} actions`} actions={actions} />
          )}
        </div>
      </div>
      {children && expanded && <div className="tree-body">{children}</div>}
    </section>
  );
}

export function TreeField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`tree-row ${error ? 'tree-row-error' : ''}`}>
      <span className="tree-label">
        {error && (
          <span className="tree-error-icon" title={error}>
            <AlertCircle size={13} />
          </span>
        )}
        {label}
      </span>
      <span className="tree-control">{children}</span>
      {error && <span className="tree-row-message">{error}</span>}
    </div>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <TreeField label={label} error={error}>
      <span className="tree-segmented" role="radiogroup" aria-label={label}>
        {[false, true].map((option) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={value === option ? 'selected' : undefined}
            onClick={() => onChange(option)}
          >
            {option ? 'On' : 'Off'}
          </button>
        ))}
      </span>
    </TreeField>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  error?: string;
}) {
  return (
    <TreeField label={label} error={error}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </TreeField>
  );
}

/** Commits on Enter or blur, so typing never applies half-finished values. */
function useDraft<T>(value: T, format: (value: T) => string) {
  const [draft, setDraft] = useState(format(value));
  const formatted = format(value);
  useEffect(() => setDraft(formatted), [formatted]);
  return [draft, setDraft] as const;
}

const commitKeys = (commit: () => void, reset: () => void) => (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Escape') {
    event.stopPropagation();
    reset();
  }
};

export function TextField({
  label,
  value,
  onCommit,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [draft, setDraft] = useDraft(value, String);
  const commit = () => draft.trim() !== value && onCommit(draft.trim());
  return (
    <TreeField label={label} error={error}>
      <input
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={commitKeys(commit, () => setDraft(value))}
      />
    </TreeField>
  );
}

const formatNumber = (value: number) => String(Number(value.toFixed(4)));

export function NumberField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  error,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}) {
  const [draft, setDraft] = useDraft(value, formatNumber);
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(next)) return setDraft(formatNumber(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, next));
    setDraft(formatNumber(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <TreeField label={label} error={error}>
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={commitKeys(commit, () => setDraft(formatNumber(value)))}
      />
    </TreeField>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  emptyLabel,
  error,
}: {
  label: string;
  /** `#rrggbb`, or `#rrggbbaa` with alpha. */
  value: string;
  onChange: (value: string) => void;
  /** When set, the color can be cleared, e.g. to keep a model's own materials. */
  emptyLabel?: string;
  error?: string;
}) {
  const [draft, setDraft] = useDraft(value, String);
  const commit = () => {
    const next = draft.trim().toLowerCase();
    if (next === value) return;
    if (!next && emptyLabel) return onChange('');
    if (/^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(next)) return onChange(next);
    setDraft(value);
  };
  // The native picker has no alpha, so picking a color keeps the current alpha.
  const alpha = value.length === 9 ? value.slice(7) : '';
  return (
    <TreeField label={label} error={error}>
      <span className="tree-color">
        <input
          aria-label={label}
          type="color"
          value={value ? value.slice(0, 7) : '#ffffff'}
          onChange={(e) => onChange(e.target.value + alpha)}
        />
        <input
          aria-label={`${label} hex`}
          className="font-mono"
          value={draft}
          placeholder={emptyLabel}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={commitKeys(commit, () => setDraft(value))}
        />
        {emptyLabel && value && (
          <button type="button" className="tree-link" onClick={() => onChange('')}>
            Clear
          </button>
        )}
      </span>
    </TreeField>
  );
}

/** A range slider; disabled, it shows a value that is driven elsewhere (e.g. joint states). */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <TreeField label={label}>
      <span className="tree-slider">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="font-mono">{formatNumber(Number(value.toFixed(3)))}</span>
      </span>
    </TreeField>
  );
}

/** A number that may be left empty, e.g. a range bound taken from the data when unset. */
export function OptionalNumberField({
  label,
  value,
  onCommit,
  placeholder = 'auto',
  error,
}: {
  label: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  placeholder?: string;
  error?: string;
}) {
  const format = (v: number | undefined) => (v === undefined ? '' : formatNumber(v));
  const [draft, setDraft] = useDraft(value, format);
  const commit = () => {
    const text = draft.trim();
    const next = text === '' ? undefined : Number(text);
    if (next !== undefined && !Number.isFinite(next)) return setDraft(format(value));
    if (next !== value) onCommit(next);
  };
  return (
    <TreeField label={label} error={error}>
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={commitKeys(commit, () => setDraft(format(value)))}
      />
    </TreeField>
  );
}

export function Vec3Field({
  label,
  value,
  onCommit,
  step = 0.1,
}: {
  label: string;
  value: [number, number, number];
  onCommit: (value: [number, number, number]) => void;
  step?: number;
}) {
  return (
    <TreeField label={label}>
      <span className="tree-vec3">
        {(['X', 'Y', 'Z'] as const).map((axis, index) => (
          <Vec3Input
            key={axis}
            label={`${label} ${axis}`}
            value={value[index]}
            step={step}
            onCommit={(component) => {
              const next = [...value] as [number, number, number];
              next[index] = component;
              onCommit(next);
            }}
          />
        ))}
      </span>
    </TreeField>
  );
}

function Vec3Input({
  label,
  value,
  step,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useDraft(value, formatNumber);
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(next)) return setDraft(formatNumber(value));
    if (next !== value) onCommit(next);
  };
  return (
    <input
      aria-label={label}
      type="number"
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={commitKeys(commit, () => setDraft(formatNumber(value)))}
    />
  );
}
