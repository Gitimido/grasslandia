// src/app/models/comment.model.ts
export interface ICommentUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  email?: string;

  displayUsername?: string;
}

export interface IComment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;

  // Change user type to ICommentUser
  user?: ICommentUser;
  likes?: number;
  liked?: boolean;
  replies?: IComment[];
  replyingToUsername?: string;
}

export class Comment implements IComment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;

  // Use ICommentUser interface
  user?: ICommentUser;
  likes?: number;
  liked?: boolean;
  replies?: Comment[];
  replyingToUsername?: string;

  constructor(comment: IComment) {
    this.id = comment.id;
    this.userId = comment.userId;
    this.postId = comment.postId;
    this.parentId = comment.parentId;
    this.content = comment.content;
    this.createdAt = comment.createdAt;
    this.updatedAt = comment.updatedAt;
    this.replyingToUsername = comment.replyingToUsername;

    // Copy user object as-is
    this.user = comment.user;

    this.likes = comment.likes || 0;
    this.liked = comment.liked || false;

    // Handle replies properly by converting from IComment to Comment
    this.replies = comment.replies
      ? comment.replies.map((reply) =>
          reply instanceof Comment ? reply : new Comment(reply)
        )
      : [];
  }

  get timeSince(): string {
    // Logic to calculate time since comment was created
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

  get userDisplayName(): string {
    if (!this.user) return 'Anonymous';

    // Format username to remove email-like parts
    if (this.user.username) {
      return this.user.username.split('@')[0].split('.')[0];
    }

    return 'User';
  }
}
