import { createReducer, on } from '@ngrx/store';
import { UIState, initialUIState } from './ui.state';
import * as UIActions from './ui.actions';

export const uiReducer = createReducer(
  initialUIState,

  // Sidebar actions
  on(UIActions.toggleSidebar, (state) => ({
    ...state,
    sidebar: {
      ...state.sidebar,
      isCollapsed: !state.sidebar.isCollapsed,
    },
  })),
  on(UIActions.setSidebarState, (state, { isCollapsed }) => ({
    ...state,
    sidebar: {
      ...state.sidebar,
      isCollapsed,
    },
  })),

  // Modal actions
  on(UIActions.openModal, (state, { modalId }) => ({
    ...state,
    modals: {
      ...state.modals,
      [modalId]: true,
    },
  })),
  on(UIActions.closeModal, (state, { modalId }) => ({
    ...state,
    modals: {
      ...state.modals,
      [modalId]: false,
    },
  })),

  // Toast actions
  on(UIActions.showToast, (state, { message, toastType }) => ({
    // Changed from 'type' to 'toastType'
    ...state,
    toast: {
      show: true,
      message,
      toastType, // Changed from 'type' to 'toastType'
    },
  })),
  on(UIActions.hideToast, (state) => ({
    ...state,
    toast: {
      ...state.toast,
      show: false,
    },
  }))
);
