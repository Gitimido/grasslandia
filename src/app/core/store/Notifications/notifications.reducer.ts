import { createReducer, on } from '@ngrx/store';
import {
  NotificationsState,
  initialNotificationsState,
} from './notifications.state';
import * as NotificationsActions from './notifications.actions';

export const notificationsReducer = createReducer(
  initialNotificationsState,

  // Load notifications
  on(NotificationsActions.loadNotifications, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(
    NotificationsActions.loadNotificationsSuccess,
    (state, { notifications }) => ({
      ...state,
      items: notifications,
      isLoading: false,
      unreadCount: notifications.filter((notification) => !notification.read)
        .length,
    })
  ),
  on(NotificationsActions.loadNotificationsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Load unread count
  on(NotificationsActions.loadUnreadCount, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(NotificationsActions.loadUnreadCountSuccess, (state, { count }) => ({
    ...state,
    unreadCount: count,
    isLoading: false,
  })),
  on(NotificationsActions.loadUnreadCountFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Mark as read
  on(NotificationsActions.markAsRead, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(NotificationsActions.markAsReadSuccess, (state, { notificationId }) => {
    const updatedItems = state.items.map((notification) =>
      notification.id === notificationId
        ? { ...notification, read: true }
        : notification
    );

    return {
      ...state,
      items: updatedItems,
      unreadCount: updatedItems.filter((notification) => !notification.read)
        .length,
      isLoading: false,
    };
  }),
  on(NotificationsActions.markAsReadFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Mark all as read
  on(NotificationsActions.markAllAsRead, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(NotificationsActions.markAllAsReadSuccess, (state) => ({
    ...state,
    items: state.items.map((notification) => ({ ...notification, read: true })),
    unreadCount: 0,
    isLoading: false,
  })),
  on(NotificationsActions.markAllAsReadFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Real-time updates
  on(NotificationsActions.notificationReceived, (state, { notification }) => {
    // Only add if not already in items
    if (state.items.some((item) => item.id === notification.id)) {
      return state;
    }

    return {
      ...state,
      items: [notification, ...state.items],
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    };
  }),
  on(NotificationsActions.notificationUpdated, (state, { notification }) => {
    const wasUnread =
      state.items.find((item) => item.id === notification.id)?.read === false;
    const isNowRead = notification.read;

    return {
      ...state,
      items: state.items.map((item) =>
        item.id === notification.id ? notification : item
      ),
      unreadCount: state.unreadCount + (wasUnread && isNowRead ? -1 : 0),
    };
  })
);
