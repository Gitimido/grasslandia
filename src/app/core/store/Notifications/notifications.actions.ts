import { createAction, props } from '@ngrx/store';
import { Notification } from './notifications.state';

// Load notifications
export const loadNotifications = createAction(
  '[Notifications] Load Notifications'
);
export const loadNotificationsSuccess = createAction(
  '[Notifications] Load Notifications Success',
  props<{ notifications: Notification[] }>()
);
export const loadNotificationsFailure = createAction(
  '[Notifications] Load Notifications Failure',
  props<{ error: string }>()
);

// Get unread count
export const loadUnreadCount = createAction(
  '[Notifications] Load Unread Count'
);
export const loadUnreadCountSuccess = createAction(
  '[Notifications] Load Unread Count Success',
  props<{ count: number }>()
);
export const loadUnreadCountFailure = createAction(
  '[Notifications] Load Unread Count Failure',
  props<{ error: string }>()
);

// Mark notification as read
export const markAsRead = createAction(
  '[Notifications] Mark As Read',
  props<{ notificationId: string }>()
);
export const markAsReadSuccess = createAction(
  '[Notifications] Mark As Read Success',
  props<{ notificationId: string }>()
);
export const markAsReadFailure = createAction(
  '[Notifications] Mark As Read Failure',
  props<{ error: string }>()
);

// Mark all as read
export const markAllAsRead = createAction('[Notifications] Mark All As Read');
export const markAllAsReadSuccess = createAction(
  '[Notifications] Mark All As Read Success'
);
export const markAllAsReadFailure = createAction(
  '[Notifications] Mark All As Read Failure',
  props<{ error: string }>()
);

// Real-time actions
export const notificationReceived = createAction(
  '[Notifications] Notification Received',
  props<{ notification: Notification }>()
);
export const notificationUpdated = createAction(
  '[Notifications] Notification Updated',
  props<{ notification: Notification }>()
);
