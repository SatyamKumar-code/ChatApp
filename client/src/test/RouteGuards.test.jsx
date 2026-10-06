import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import PublicRoute from '../components/PublicRoute.jsx';
import { AuthContext } from '../context/AuthContext.jsx';

describe('Route Guards – ProtectedRoute & PublicRoute', () => {
  describe('ProtectedRoute', () => {
    it('renders spinner when loading is true', () => {
      render(
        <AuthContext.Provider value={{ user: null, loading: true }}>
          <MemoryRouter>
            <ProtectedRoute>
              <div>Dashboard Content</div>
            </ProtectedRoute>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.queryByText('Dashboard Content')).toBeNull();
    });

    it('redirects to /login when user is not authenticated', () => {
      render(
        <AuthContext.Provider value={{ user: null, loading: false }}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div>Dashboard Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText('Login Page')).toBeDefined();
      expect(screen.queryByText('Dashboard Content')).toBeNull();
    });

    it('renders child component when user is authenticated', () => {
      render(
        <AuthContext.Provider value={{ user: { _id: 'u1', name: 'Alice' }, loading: false }}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <ProtectedRoute>
              <div>Dashboard Content</div>
            </ProtectedRoute>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText('Dashboard Content')).toBeDefined();
    });
  });

  describe('PublicRoute', () => {
    it('renders child component for guests when user is null', () => {
      render(
        <AuthContext.Provider value={{ user: null, loading: false }}>
          <MemoryRouter initialEntries={['/login']}>
            <PublicRoute>
              <div>Login Form</div>
            </PublicRoute>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText('Login Form')).toBeDefined();
    });

    it('redirects authenticated user away from public route to home', () => {
      render(
        <AuthContext.Provider value={{ user: { _id: 'u1' }, loading: false }}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <div>Login Form</div>
                  </PublicRoute>
                }
              />
              <Route path="/" element={<div>Home Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText('Home Page')).toBeDefined();
      expect(screen.queryByText('Login Form')).toBeNull();
    });
  });
});
