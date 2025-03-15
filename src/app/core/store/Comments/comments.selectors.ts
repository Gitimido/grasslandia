import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CommentsState } from './comments.state';

export const selectCommentsState =
  createFeatureSelector<CommentsState>('comments');

export const selectIsLoading = createSelector(
  selectCommentsState,
  (state) => state.isLoading
);

export const selectError = createSelector(
  selectCommentsState,
  (state) => state.error
);

export const selectPostComments = (postId: string) =>
  createSelector(selectCommentsState, (state) => state.byPost[postId] || []);

export const selectCommentReplies = (commentId: string) =>
  createSelector(
    selectCommentsState,
    (state) => state.byParent[commentId] || []
  );

export const selectCommentsCount = (postId: string) =>
  createSelector(selectPostComments(postId), (comments) => comments.length);
