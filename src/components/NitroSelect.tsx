import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export type NitroSelectOption<T extends string> = {
  value: T;
  label: string;
};

type NitroSelectProps<T extends string> = {
  value: T;
  options: Array<NitroSelectOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
};

type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function optionHeight(): number {
  return window.innerWidth <= 560 ? 46 : 38;
}

export function NitroSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
}: NitroSelectProps<T>) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const gap = 6;
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = clamp(rect.left, viewportPadding, window.innerWidth - width - viewportPadding);
    const listHeight = Math.min(options.length * optionHeight(), 268);
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const openUp = availableBelow < Math.min(listHeight, 180) && availableAbove > availableBelow;
    const availableSpace = Math.max(96, openUp ? availableAbove - gap : availableBelow - gap);
    const maxHeight = Math.min(listHeight, availableSpace);
    const top = openUp
      ? Math.max(viewportPadding, rect.top - Math.min(maxHeight, listHeight) - gap)
      : Math.min(window.innerHeight - viewportPadding - maxHeight, rect.bottom + gap);

    setPosition({
      left,
      top,
      width,
      maxHeight,
      placement: openUp ? 'top' : 'bottom',
    });
  }, [options.length]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    if (disabled) {
      return;
    }

    setActiveIndex(selectedIndex);
    setIsOpen(true);
  }, [disabled, selectedIndex]);

  const selectOption = useCallback(
    (index: number) => {
      const option = options[index];

      if (!option) {
        return;
      }

      onChange(option.value);
      close();
      requestAnimationFrame(() => triggerRef.current?.focus());
    },
    [close, onChange, options],
  );

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      close();
    }

    function handleResizeOrScroll() {
      updatePosition();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [close, isOpen, updatePosition]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      close();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (isOpen) {
        setActiveIndex((current) => Math.max(0, current - 1));
      } else {
        open();
        setActiveIndex(Math.max(0, selectedIndex - 1));
      }
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (isOpen) {
        setActiveIndex((current) => Math.min(options.length - 1, current + 1));
      } else {
        open();
      }
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();

      if (isOpen) {
        selectOption(activeIndex);
      } else {
        open();
      }
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(options.length - 1, current + 1));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(activeIndex);
    }
  }

  return (
    <div className={`nitro-select${isOpen ? ' nitro-select-open' : ''}`}>
      <button
        ref={triggerRef}
        id={`${id}-button`}
        className="nitro-select-trigger"
        type="button"
        role="combobox"
        aria-controls={`${id}-listbox`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={isOpen ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            close();
          } else {
            open();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="nitro-select-value">{selectedOption?.label ?? 'Selecionar'}</span>
        <ChevronDown className="nitro-select-chevron h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen && position && createPortal(
        <div
          ref={menuRef}
          id={`${id}-listbox`}
          className={`nitro-select-menu nitro-select-menu-${position.placement}`}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-button`}
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            maxHeight: position.maxHeight,
          }}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((option, index) => (
            <button
              className={`nitro-select-option${option.value === value ? ' nitro-select-option-selected' : ''}${index === activeIndex ? ' nitro-select-option-active' : ''}`}
              id={`${id}-option-${index}`}
              key={option.value || 'empty-option'}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectOption(index)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
