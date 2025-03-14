// src/app/core/services/notification.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environment';
import { Observable, from, throwError, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Notification, INotification } from '../../models';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private supabase: SupabaseClient;

  constructor(private authService: AuthService) {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  /**
   * Get notifications for the current user
   * @param limit Number of notifications to fetch
   * @param offset Offset for pagination
   * @returns Observable with array of notifications
   */
  getNotifications(
    limit: number = 20,
    offset: number = 0
  ): Observable<Notification[]> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of([]);
    }

    return from(
      this.supabase
        .from('notifications')
        .select(
          `
          *,
          actor:actor_id(id, username, full_name, avatar_url)
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        if (!data) return [];

        return data.map(
          (item) =>
            new Notification({
              id: item.id,
              userId: item.user_id,
              type: item.type,
              content: item.content,
              icon: item.icon,
              actorId: item.actor_id,
              resourceId: item.resource_id,
              resourceType: item.resource_type,
              read: item.read,
              createdAt: new Date(item.created_at),
              actor: item.actor,
            })
        );
      }),
      catchError((error) => {
        console.error('Error fetching notifications:', error);
        return of([]);
      })
    );
  }

  /**
   * Create a new notification
   * @param notification The notification to create
   * @returns Observable indicating success
   */
  createNotification(notification: Partial<INotification>): Observable<void> {
    if (!notification.userId) {
      return throwError(
        () => new Error('User ID is required for notifications')
      );
    }

    return from(
      this.supabase.from('notifications').insert({
        user_id: notification.userId,
        type: notification.type,
        content: notification.content,
        icon: notification.icon,
        actor_id: notification.actorId,
        resource_id: notification.resourceId,
        resource_type: notification.resourceType,
        read: notification.read || false,
        created_at: new Date(),
      })
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error creating notification:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Mark a notification as read
   * @param notificationId The ID of the notification to mark as read
   * @returns Observable indicating success
   */
  markAsRead(notificationId: string): Observable<void> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return throwError(
        () => new Error('You must be logged in to update notifications')
      );
    }

    return from(
      this.supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError((error) => {
        console.error('Error marking notification as read:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get the number of unread notifications
   * @returns Observable with the count of unread notifications
   */
  getUnreadCount(): Observable<number> {
    const userId = this.authService.user?.id;
    if (!userId) {
      return of(0);
    }

    return from(
      this.supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)
    ).pipe(
      map(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
      catchError((error) => {
        console.error('Error getting unread notification count:', error);
        return of(0);
      })
    );
  }
}
