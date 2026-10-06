import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { PwaProvider, usePwa } from '../context/PwaContext.jsx';

function PwaTestConsumer() {
  const { isInstalled, isBannerDismissed, dismissBanner, openInstallModal, showInstallModal } = usePwa();
  return (
    <div>
      <span data-testid="installed">{String(isInstalled)}</span>
      <span data-testid="dismissed">{String(isBannerDismissed)}</span>
      <span data-testid="modal">{String(showInstallModal)}</span>
      <button data-testid="btn-dismiss" onClick={dismissBanner}>Dismiss Banner</button>
      <button data-testid="btn-modal" onClick={openInstallModal}>Open Modal</button>
    </div>
  );
}

describe('PwaContext – PWA Installation and Detection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with default PWA state', () => {
    render(
      <PwaProvider>
        <PwaTestConsumer />
      </PwaProvider>
    );

    expect(screen.getByTestId('installed').textContent).toBe('false');
    expect(screen.getByTestId('dismissed').textContent).toBe('false');
    expect(screen.getByTestId('modal').textContent).toBe('false');
  });

  it('dismisses banner and persists choice in localStorage', () => {
    render(
      <PwaProvider>
        <PwaTestConsumer />
      </PwaProvider>
    );

    act(() => {
      screen.getByTestId('btn-dismiss').click();
    });

    expect(screen.getByTestId('dismissed').textContent).toBe('true');
    expect(localStorage.getItem('chatapp_pwa_banner_seen')).toBe('true');
  });

  it('opens install modal on demand', () => {
    render(
      <PwaProvider>
        <PwaTestConsumer />
      </PwaProvider>
    );

    act(() => {
      screen.getByTestId('btn-modal').click();
    });

    expect(screen.getByTestId('modal').textContent).toBe('true');
  });
});
