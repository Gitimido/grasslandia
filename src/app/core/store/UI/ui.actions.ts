import { createAction, props } from '@ngrx/store';

// Sidebar actions
export const toggleSidebar = createAction('[UI] Toggle Sidebar');
export const setSidebarState = createAction(
  '[UI] Set Sidebar State',
  props<{ isCollapsed: boolean }>()
);

// Modal actions
export const openModal = createAction(
  '[UI] Open Modal',
  props<{ modalId: string }>()
);
export const closeModal = createAction(
  '[UI] Close Modal',
  props<{ modalId: string }>()
);

// Toast actions
export const showToast = createAction(
  '[UI] Show Toast',
  props<{
    message: string;
    toastType: 'success' | 'error' | 'info' | 'warning';
  }>() // Changed from 'type' to 'toastType'
);
export const hideToast = createAction('[UI] Hide Toast');
