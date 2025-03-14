// src/app/models/comment.model.ts

export enum VoteType {
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote',
}
// In src/app/models/comment.model.ts
// Add this interface to represent a simplified user for comments
export interface ICommentUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  email?: string;
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

  // Voting properties
  upvotes?: number;
  downvotes?: number;
  score?: number;
  userVote?: VoteType | null;
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

  // Voting properties
  upvotes: number;
  downvotes: number;
  score: number;
  userVote?: VoteType | null;

  constructor(comment: IComment) {
    this.id = comment.id;
    this.userId = comment.userId;
    this.postId = comment.postId;
    this.parentId = comment.parentId;
    this.content = comment.content;
    this.createdAt = comment.createdAt;
    this.updatedAt = comment.updatedAt;

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

    // Initialize voting properties
    this.upvotes = comment.upvotes || 0;
    this.downvotes = comment.downvotes || 0;
    this.score = comment.score || 0;
    this.userVote = comment.userVote || null;
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
}
