'use client';

import { ChevronDown } from 'lucide-react';
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  type Key,
} from 'react-aria-components';

import { themeSchema, type Theme } from '@/shared/theme/theme';

import { THEME_ORDER, ThemeLabel, useSystemTheme } from './use-theme';

interface ThemeSelectProps {
  theme: Theme | null;
  onThemeChange: (theme: Theme) => void;
}

export function ThemeSelect({ theme, onThemeChange }: ThemeSelectProps) {
  const systemTheme = useSystemTheme();

  function handleSelectChange(key: Key | null) {
    const nextTheme = themeSchema.safeParse(key);

    if (nextTheme.success) {
      onThemeChange(nextTheme.data);
    }
  }

  return (
    <Select
      aria-label="Тема"
      className="shrink-0 px-2"
      placeholder={systemTheme === null ? 'Тема' : ThemeLabel[systemTheme]}
      value={theme}
      onChange={handleSelectChange}
    >
      <Button className="inline-flex h-8 min-w-28 items-center justify-between gap-2 rounded-md px-2 text-sm text-text-muted outline-none hover:text-text data-focus-visible:ring-2 data-focus-visible:ring-focus data-pressed:bg-surface">
        <SelectValue />
        <ChevronDown aria-hidden className="size-4" />
      </Button>
      <Popover className="min-w-(--trigger-width) rounded-lg border border-border bg-surface p-1 shadow-lg">
        <ListBox className="outline-none">
          {THEME_ORDER.map((themeOption) => (
            <ListBoxItem
              key={themeOption}
              className="cursor-default rounded-md px-3 py-2 text-sm text-text outline-none data-focused:bg-surface-muted data-selected:font-medium"
              id={themeOption}
            >
              {ThemeLabel[themeOption]}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
