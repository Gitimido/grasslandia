// src/app/models/post.model.ts
import { IUser, IMedia, IComment } from './index';

export interface IPost {
  id: string;
  userId: string;
  content: string;
  privacyLevel: 'public' | 'friends' | 'only_me';
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;

  // Expanded properties (not from DB)
  user?: IUser;
  media?: IMedia[];
  comments?: IComment[];
  likes?: number;
  liked?: boolean;
}

export class Post implements IPost {
  id: string;
  userId: string;
  content: string;
  privacyLevel: 'public' | 'friends' | 'only_me';
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;

  // Expanded properties
  user?: IUser;
  media?: IMedia[];
  comments?: IComment[];
  likes?: number;
  liked?: boolean;

  constructor(post: IPost) {
    this.id = post.id;
    this.userId = post.userId;
    this.content = post.content;
    this.privacyLevel = post.privacyLevel;
    this.groupId = post.groupId;
    this.createdAt = post.createdAt;
    this.updatedAt = post.updatedAt;
    this.user = post.user;
    this.media = post.media;
    this.comments = post.comments || [];
    this.likes = post.likes || 0;
    this.liked = post.liked || false;
  }

  get hasMedia(): boolean {
    return this.media !== undefined && this.media.length > 0;
  }

  get timeSince(): string {
    // Logic to calculate time since post was created
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
