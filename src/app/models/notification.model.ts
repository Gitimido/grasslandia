// src/app/models/notification.model.ts

export interface INotification {
  id: string;
  userId: string;
  type:
    | 'like'
    | 'comment'
    | 'friend_request'
    | 'friend_accepted'
    | 'group_invite'; // Added 'friend_accepted'
  content: string;
  icon?: string;
  actorId: string;
  resourceId: string;
  resourceType: string;
  read: boolean;
  createdAt: Date;

  // Expanded properties
  actor?: any;
}

export class Notification implements INotification {
  id: string;
  userId: string;
  type:
    | 'like'
    | 'comment'
    | 'friend_request'
    | 'friend_accepted'
    | 'group_invite'; // Added 'friend_accepted'
  content: string;
  icon?: string;
  actorId: string;
  resourceId: string;
  resourceType: string;
  read: boolean;
  createdAt: Date;
  actor?: any;

  constructor(notification: INotification) {
    this.id = notification.id;
    this.userId = notification.userId;
    this.type = notification.type;
    this.content = notification.content;
    this.icon = notification.icon;
    this.actorId = notification.actorId;
    this.resourceId = notification.resourceId;
    this.resourceType = notification.resourceType;
    this.read = notification.read;
    this.createdAt = notification.createdAt;
    this.actor = notification.actor;
  }

  get timeSince(): string {
    // Same time calculation as other models
    const now = new Date();
    const seconds = Math.floor(
      (now.getTime() - this.createdAt.getTime()) / 1000
    );

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + 'y';

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + 'mo';

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + 'd';

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + 'h';

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + 'm';

    return Math.floor(seconds) + 's';
  }
}
