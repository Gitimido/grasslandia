export interface Notification {
  id: string;
  userId: string;
  type:
    | 'like'
    | 'comment'
    | 'friend_request'
    | 'friend_accepted'
    | 'group_invite';
  content: string;
  icon?: string;
  actorId: string;
  resourceId: string;
  resourceType: string;
  read: boolean;
  createdAt: Date;
  actor?: any; // Actor user details
}

export interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

export const initialNotificationsState: NotificationsState = {
  items: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
};
