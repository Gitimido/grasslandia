// src/app/core/store/Auth/auth.actions.ts
import { createAction, props } from '@ngrx/store';
import { User } from '@supabase/supabase-js';

export const loginSuccess = createAction(
  '[Auth] Login Success',
  props<{ user: User }>()
);

export const logout = createAction('[Auth] Logout');

export const setAuthLoading = createAction(
  '[Auth] Set Loading',
  props<{ isLoading: boolean }>()
);

export const setAuthError = createAction(
  '[Auth] Set Error',
  props<{ error: string | null }>()
);
