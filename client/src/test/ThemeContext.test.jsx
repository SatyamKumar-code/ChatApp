import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme, THEME_MODES, ACCENT_PALETTES } from '../context/ThemeContext.jsx';

function TestConsumer() {
  const { themeMode, resolvedTheme, accentColor, changeThemeMode, changeAccentColor } = useTheme();
  return (
    <div>
      <span data-testid="mode">{themeMode}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="accent">{accentColor}</span>
      <button data-testid="btn-dark" onClick={() => changeThemeMode(THEME_MODES.DARK)}>Dark</button>
      <button data-testid="btn-light" onClick={() => changeThemeMode(THEME_MODES.LIGHT)}>Light</button>
      <button data-testid="btn-accent" onClick={() => changeAccentColor('#2563eb')}>Blue Accent</button>
    </div>
  );
}

describe('ThemeContext – Theme & Accent Color State', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('renders default system mode and default purple accent', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe(THEME_MODES.SYSTEM);
    expect(screen.getByTestId('accent').textContent).toBe('#7c3aed');
  });

  it('switches theme to dark and sets DOM attributes', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByTestId('btn-dark').click();
    });

    expect(screen.getByTestId('mode').textContent).toBe(THEME_MODES.DARK);
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(localStorage.getItem('chatapp_theme_mode')).toBe(THEME_MODES.DARK);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('switches theme to light and updates DOM classes', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByTestId('btn-light').click();
    });

    expect(screen.getByTestId('mode').textContent).toBe(THEME_MODES.LIGHT);
    expect(screen.getByTestId('resolved').textContent).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('updates accent color palette and CSS custom properties', () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    act(() => {
      screen.getByTestId('btn-accent').click();
    });

    expect(screen.getByTestId('accent').textContent).toBe('#2563eb');
    expect(localStorage.getItem('chatapp_accent')).toBe('#2563eb');
    expect(document.documentElement.style.getPropertyValue('--accent-primary')).toBe('#2563eb');
  });
});
