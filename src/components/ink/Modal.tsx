"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { ReactNode, useEffect, useRef, useState } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="sheet-panel"
        style={wide ? { maxWidth: 820 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="panel-head">
            <div className="ph-title">{title}</div>
            <button className="iconbtn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        )}
        <div className="panel-body">{children}</div>
        {footer && <div className="panel-foot">{footer}</div>}
      </div>
    </div>
  );
}

// Clean, top-anchored prompt dialog. Title + input at top, two perfect
// full-width buttons at the bottom. Proper outer margins. No label clutter.
export function PromptModal({
  open,
  onClose,
  onSubmit,
  title,
  placeholder,
  initialValue,
  submitLabel,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [val, setVal] = useState(initialValue || "");

  useEffect(() => {
    if (open) {
      setVal(initialValue || "");
      // focus next tick so the dialog is mounted
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        const v = (inputRef.current?.value ?? "").trim();
        if (v) onSubmit(v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onSubmit]);

  if (!open) return null;

  const submit = () => {
    const v = val.trim();
    if (v) onSubmit(v);
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="dialog-head">{title}</div>
        <div className="dialog-body">
          <input
            ref={inputRef}
            className="dialog-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        <div className="dialog-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            {cancelLabel || "Cancel"}
          </button>
          <button className="btn btn-primary" onClick={submit}>
            {submitLabel || "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
