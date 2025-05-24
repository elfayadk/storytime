import { useEffect } from 'react';

interface ShortcutHandlers {
  onSearch?: () => void;
  onRefresh?: () => void;
  onNextItem?: () => void;
  onPreviousItem?: () => void;
  onEscape?: () => void;
  onHelp?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Command/Ctrl + K for search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        handlers.onSearch?.();
      }

      // Command/Ctrl + R for refresh
      if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
        event.preventDefault();
        handlers.onRefresh?.();
      }

      // Right arrow or J for next item
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'j') {
        handlers.onNextItem?.();
      }

      // Left arrow or K for previous item
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'k') {
        handlers.onPreviousItem?.();
      }

      // Escape key
      if (event.key === 'Escape') {
        handlers.onEscape?.();
      }

      // ? for help
      if (event.key === '?') {
        handlers.onHelp?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}; 