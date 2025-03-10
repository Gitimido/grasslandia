// src/app/models/comment.model.ts

import { IUser } from './user.model';

export interface IComment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;

  // Expanded properties
  user?: IUser;
  likes?: number;
  liked?: boolean;
}

export class Comment implements IComment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;

  // Expanded properties
  user?: IUser;
  likes?: number;
  liked?: boolean;

  constructor(comment: IComment) {
    this.id = comment.id;
    this.userId = comment.userId;
    this.postId = comment.postId;
    this.parentId = comment.parentId;
    this.content = comment.content;
    this.createdAt = comment.createdAt;
    this.updatedAt = comment.updatedAt;
    this.user = comment.user;
    this.likes = comment.likes || 0;
    this.liked = comment.liked || false;
  }

  get timeSince(): string {
    // Logic to calculate time since comment was created (same as post)
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
