import { createAction, props } from '@ngrx/store';
import { Comment } from './comments.state';

// Load post comments
export const loadComments = createAction(
  '[Comments] Load Comments',
  props<{ postId: string }>()
);
export const loadCommentsSuccess = createAction(
  '[Comments] Load Comments Success',
  props<{ postId: string; comments: Comment[] }>()
);
export const loadCommentsFailure = createAction(
  '[Comments] Load Comments Failure',
  props<{ error: string }>()
);

// Load comment replies
export const loadReplies = createAction(
  '[Comments] Load Replies',
  props<{ commentId: string }>()
);
export const loadRepliesSuccess = createAction(
  '[Comments] Load Replies Success',
  props<{ commentId: string; replies: Comment[] }>()
);
export const loadRepliesFailure = createAction(
  '[Comments] Load Replies Failure',
  props<{ error: string }>()
);

// Create comment
export const createComment = createAction(
  '[Comments] Create Comment',
  props<{ postId: string; content: string; parentId?: string }>()
);
export const createCommentSuccess = createAction(
  '[Comments] Create Comment Success',
  props<{ comment: Comment }>()
);
export const createCommentFailure = createAction(
  '[Comments] Create Comment Failure',
  props<{ error: string }>()
);

// Update comment
export const updateComment = createAction(
  '[Comments] Update Comment',
  props<{ commentId: string; content: string }>()
);
export const updateCommentSuccess = createAction(
  '[Comments] Update Comment Success',
  props<{ comment: Comment }>()
);
export const updateCommentFailure = createAction(
  '[Comments] Update Comment Failure',
  props<{ error: string }>()
);

// Delete comment
export const deleteComment = createAction(
  '[Comments] Delete Comment',
  props<{ commentId: string; postId: string; parentId?: string }>()
);
export const deleteCommentSuccess = createAction(
  '[Comments] Delete Comment Success',
  props<{ commentId: string; postId: string; parentId?: string }>()
);
export const deleteCommentFailure = createAction(
  '[Comments] Delete Comment Failure',
  props<{ error: string }>()
);

// Vote on comment
export const voteComment = createAction(
  '[Comments] Vote Comment',
  props<{ commentId: string; voteType: 'upvote' | 'downvote' | null }>()
);
export const voteCommentSuccess = createAction(
  '[Comments] Vote Comment Success',
  props<{ commentId: string; voteType: 'upvote' | 'downvote' | null }>()
);
export const voteCommentFailure = createAction(
  '[Comments] Vote Comment Failure',
  props<{ error: string }>()
);

// Real-time actions
export const commentAdded = createAction(
  '[Comments] Comment Added',
  props<{ comment: Comment }>()
);
export const commentUpdated = createAction(
  '[Comments] Comment Updated',
  props<{ comment: Comment }>()
);
export const commentDeleted = createAction(
  '[Comments] Comment Deleted',
  props<{ commentId: string; postId: string; parentId?: string }>()
);
