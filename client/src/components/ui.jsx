import { useEffect, useRef, useState, Children } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertTriangle, Inbox, ChevronDown } from 'lucide-react';
import { SEVERITY_COLOR, STATUS_COLOR } from '../utils/constants';
import { label, clsx } from '../utils/format';

export function Button({ variant = 'secondary', size, className, children, loading, disabled, ...rest }) {
  return (
    <button
      type="button"
      className={clsx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}
      {...rest}
      disabled={disabled || loading}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Tag({ color = '#8593a3', children, className, title }) {
  return (
    <span className={clsx('tag', className)} style={{ color, borderColor: `${color}66`, backgroundColor: `${color}1a` }} title={title}>
      {children}
    </span>
  );
}

export const SeverityTag = ({ severity }) => <Tag color={SEVERITY_COLOR[severity] || '#8593a3'}>{severity}</Tag>;
export const StatusTag = ({ status }) => <Tag color={STATUS_COLOR[status] || '#8593a3'}>{label(status)}</Tag>;

export function Panel({ title, actions, children, className, bodyClassName, flush }) {
  return (
    <section className={clsx('panel flex min-h-0 flex-col', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="panel-title">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('min-h-0 flex-1', !flush && 'p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label: text, value, hint, accent }) {
  return (
    <div className="panel px-4 py-3" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>
      <div className="panel-title">{text}</div>
      <div className="mt-1 font-mono text-2xl font-medium text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Field({ label: text, hint, error, children, className }) {
  return (
    <div className={className}>
      <label className="label">{text}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-faint">{hint}</p>}
      {error && <p className="mt-1 text-xs text-crit">{error}</p>}
    </div>
  );
}

export function Select({ value, onChange, children, className = 'input', disabled, id, ...props }) {
  const trigger = useRef(null);
  const menu = useRef(null);
  const pendingFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const options = Children.toArray(children).flatMap((child) => Array.isArray(child) ? child : [child]).filter(Boolean);
  const selected = options.find((option) => String(option.props.value) === String(value));

  useEffect(() => {
    if (!open || !position || !pendingFocus.current || !menu.current) return;
    pendingFocus.current = false;
    const index = Math.max(0, options.findIndex((option) => String(option.props.value) === String(value)));
    menu.current.querySelectorAll('[role="option"]')[index]?.focus();
  }, [open, position, options, value]);

  useEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = trigger.current.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const height = Math.min(320, Math.max(below, above));
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width, top: below >= Math.min(240, above) ? rect.bottom + 4 : rect.top - height - 4, height });
    };
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  const choose = (next) => {
    onChange({ target: { value: next } });
    setOpen(false);
    trigger.current.focus();
  };

  return (
    <>
      <button
        {...props}
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        className={clsx(className, 'flex items-center justify-between gap-2 text-left disabled:opacity-50')}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pendingFocus.current = true;
            setOpen(true);
          }
        }}
      >
        <span className="min-w-0 truncate">{selected?.props.children ?? 'Select'}</span>
        <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
      </button>
      {open && position && createPortal(
        <div
          ref={menu}
          role="listbox"
          aria-label={props['aria-label'] || 'Options'}
          className="fixed z-[100] overflow-y-auto rounded border border-ink-500 bg-ink-800 py-1 shadow-xl"
          style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.height }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); trigger.current.focus(); }
            const items = [...menu.current.querySelectorAll('[role="option"]')];
            const current = items.indexOf(document.activeElement);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
              items[next]?.focus();
            }
          }}
        >
          {options.map((option) => (
            <button
              key={option.key || option.props.value}
              type="button"
              role="option"
              aria-selected={String(option.props.value) === String(value)}
              tabIndex={-1}
              className="block w-full px-3 py-2 text-left text-sm text-fg hover:bg-ink-600 focus:bg-ink-600 focus:outline-none aria-selected:bg-accent-soft"
              onClick={() => choose(option.props.value)}
            >
              {option.props.children}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function Modal({ title, onClose, children, footer, width = 'max-w-lg' }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement;
    if (ref.current) ref.current.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[6vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={clsx('w-full rounded border border-line bg-ink-800 outline-none', width)}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-fg" aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Spinner({ text = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" /> {text}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Inbox size={22} className="text-faint" />
      <div className="text-sm font-medium text-fg">{title}</div>
      {children && <div className="max-w-sm text-xs text-muted">{children}</div>}
    </div>
  );
}

export function ErrorNote({ children, className }) {
  if (!children) return null;
  return (
    <div className={clsx('flex items-start gap-2 rounded border border-crit/40 bg-crit/10 px-3 py-2 text-sm text-red-200', className)} role="alert">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-crit" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function Segmented({ options, value, onChange, getColor }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-ink-500" role="radiogroup">
      {options.map((opt) => {
        const active = value === opt.value;
        const color = getColor ? getColor(opt.value) : '#4aa3df';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="border-r border-ink-500 px-3 py-1.5 text-xs font-medium last:border-r-0 hover:bg-ink-600"
            style={active ? { backgroundColor: `${color}30`, color } : { color: '#8593a3' }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, loading }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}
