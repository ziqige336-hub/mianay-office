import { useRef, useEffect, useState, useCallback } from 'react';
import { TextEditingController, SelectionRange } from './TextEditingController';

export interface UseTextEditingOptions {
  value: string;
  onChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  onCancel?: () => void;
}

/**
 * useTextEditing
 * Custom React hook that binds a TextEditingController to an input/textarea.
 * Ensures zero cursor reset, perfect IME composition, and stable editing state.
 */
export function useTextEditing({
  value,
  onChange,
  onCommit,
  onCancel,
}: UseTextEditingOptions) {
  const controllerRef = useRef<TextEditingController>(new TextEditingController(value));
  const [internalValue, setInternalValue] = useState<string>(value);
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const elementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Synchronize when external value changes and user is NOT actively typing
  useEffect(() => {
    const controller = controllerRef.current;
    if (value !== controller.getValue() && !controller.getIsFocused()) {
      controller.setValue(value);
      setInternalValue(value);
    }
  }, [value]);

  // Subscribe to controller state changes
  useEffect(() => {
    const controller = controllerRef.current;
    const unsubscribe = controller.subscribe((val, _sel, composing) => {
      setInternalValue(val);
      setIsComposing(composing);
      onChange?.(val);
    });
    return unsubscribe;
  }, [onChange]);

  const bindRef = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    elementRef.current = el;
    controllerRef.current.bindElement(el);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    controllerRef.current.handleInput(e);
  }, []);

  const handleCompositionStart = useCallback(() => {
    controllerRef.current.handleCompositionStart();
  }, []);

  const handleCompositionUpdate = useCallback(() => {
    controllerRef.current.handleCompositionUpdate();
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    controllerRef.current.handleCompositionEnd(e);
  }, []);

  const handleFocus = useCallback(() => {
    controllerRef.current.handleFocus();
  }, []);

  const handleBlur = useCallback(() => {
    controllerRef.current.handleBlur();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (isComposing) return;

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onCommit?.(controllerRef.current.getValue());
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (controllerRef.current.redo()) e.preventDefault();
        } else {
          if (controllerRef.current.undo()) e.preventDefault();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (controllerRef.current.redo()) e.preventDefault();
      }
    },
    [isComposing, onCommit, onCancel]
  );

  return {
    value: internalValue,
    isComposing,
    controller: controllerRef.current,
    elementRef,
    bindRef,
    inputProps: {
      ref: bindRef as any,
      value: internalValue,
      onChange: handleInputChange,
      onCompositionStart: handleCompositionStart,
      onCompositionUpdate: handleCompositionUpdate,
      onCompositionEnd: handleCompositionEnd,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
  };
}
