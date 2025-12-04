import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey;
        const shiftMatches = shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey;
        const altMatches = shortcut.altKey === undefined || event.altKey === shortcut.altKey;
        const metaMatches = shortcut.metaKey === undefined || event.metaKey === shortcut.metaKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches && metaMatches) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);
}

export function KeyboardShortcutsHelp({ shortcuts }: { shortcuts: KeyboardShortcut[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground mb-3">Keyboard Shortcuts</h3>
      {shortcuts.map((shortcut, index) => (
        <div key={index} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{shortcut.description}</span>
          <div className="flex gap-1">
            {shortcut.ctrlKey && (
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground font-mono">Ctrl</kbd>
            )}
            {shortcut.shiftKey && (
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground font-mono">Shift</kbd>
            )}
            {shortcut.altKey && (
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground font-mono">Alt</kbd>
            )}
            {shortcut.metaKey && (
              <kbd className="px-2 py-1 bg-secondary rounded text-foreground font-mono">⌘</kbd>
            )}
            <kbd className="px-2 py-1 bg-secondary rounded text-foreground font-mono">
              {shortcut.key.toUpperCase()}
            </kbd>
          </div>
        </div>
      ))}
    </div>
  );
}
