// src/app/store/user-data.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UserDataState } from './user-data.reducer';

export const selectUserData = createFeatureSelector<UserDataState>('userData');

export const selectCurrentUser = createSelector(
  selectUserData,
  (state) => state.currentUser
);
