import { createFeatureSelector, createSelector } from '@ngrx/store';
import { UIState } from './ui.state';

export const selectUIState = createFeatureSelector<UIState>('ui');

export const selectSidebarState = createSelector(
  selectUIState,
  (state) => state.sidebar
);

export const selectIsSidebarCollapsed = createSelector(
  selectSidebarState,
  (sidebar) => sidebar.isCollapsed
);

export const selectModalState = (modalId: string) =>
  createSelector(selectUIState, (state) => state.modals[modalId] || false);

export const selectToast = createSelector(
  selectUIState,
  (state) => state.toast
);
