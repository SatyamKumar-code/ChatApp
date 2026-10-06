import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AlertProvider, useAlert } from '../context/AlertContext.jsx';

function AlertTestConsumer() {
  const { showAlert, closeAlert } = useAlert();
  return (
    <div>
      <button data-testid="show-info" onClick={() => showAlert('Test Info Alert', 'info')}>
        Show Info
      </button>
      <button data-testid="show-error" onClick={() => showAlert('Test Error Alert', 'error')}>
        Show Error
      </button>
      <button data-testid="close-alert" onClick={closeAlert}>
        Close
      </button>
    </div>
  );
}

describe('AlertContext – Custom Alert Notification System', () => {
  it('renders children and displays stylish alert when triggered', () => {
    render(
      <AlertProvider>
        <AlertTestConsumer />
      </AlertProvider>
    );

    expect(screen.queryByText('Test Info Alert')).toBeNull();

    act(() => {
      screen.getByTestId('show-info').click();
    });

    expect(screen.getByText('Test Info Alert')).toBeDefined();
  });

  it('closes alert when closeAlert is invoked', () => {
    render(
      <AlertProvider>
        <AlertTestConsumer />
      </AlertProvider>
    );

    act(() => {
      screen.getByTestId('show-error').click();
    });
    expect(screen.getByText('Test Error Alert')).toBeDefined();

    act(() => {
      screen.getByTestId('close-alert').click();
    });
    expect(screen.queryByText('Test Error Alert')).toBeNull();
  });

  it('intercepts window.alert and shows stylish alert', () => {
    render(
      <AlertProvider>
        <AlertTestConsumer />
      </AlertProvider>
    );

    act(() => {
      window.alert('Saved successfully!');
    });

    expect(screen.getByText('Saved successfully!')).toBeDefined();
  });
});
