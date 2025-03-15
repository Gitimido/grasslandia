import { createFeatureSelector, createSelector } from '@ngrx/store';
import { NotificationsState } from './notifications.state';

export const selectNotificationsState =
  createFeatureSelector<NotificationsState>('notifications');

export const selectAllNotifications = createSelector(
  selectNotificationsState,
  (state) => state.items
);

export const selectUnreadCount = createSelector(
  selectNotificationsState,
  (state) => state.unreadCount
);

export const selectUnreadNotifications = createSelector(
  selectAllNotifications,
  (notifications) => notifications.filter((notification) => !notification.read)
);

export const selectIsLoadingNotifications = createSelector(
  selectNotificationsState,
  (state) => state.isLoading
);

export const selectNotificationsError = createSelector(
  selectNotificationsState,
  (state) => state.error
);
