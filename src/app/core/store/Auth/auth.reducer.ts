// src/app/core/store/Auth/auth.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { User } from '@supabase/supabase-js';
import * as AuthActions from './auth.actions';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const authReducer = createReducer(
  initialState,
  on(AuthActions.loginSuccess, (state, { user }) => ({
    ...state,
    user,
    isAuthenticated: true,
    error: null,
  })),
  on(AuthActions.logout, (state) => ({
    ...state,
    user: null,
    isAuthenticated: false,
    error: null,
  })),
  on(AuthActions.setAuthLoading, (state, { isLoading }) => ({
    ...state,
    isLoading,
  })),
  on(AuthActions.setAuthError, (state, { error }) => ({
    ...state,
    error,
  }))
);
