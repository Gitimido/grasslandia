// src/app/core/store/Posts/posts.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { PostsState } from './posts.state';

export const selectPostsState = createFeatureSelector<PostsState>('posts');

export const selectFeedPosts = createSelector(
  selectPostsState,
  (state) => state.feedPosts
);

export const selectIsLoading = createSelector(
  selectPostsState,
  (state) => state.isLoading
);

export const selectError = createSelector(
  selectPostsState,
  (state) => state.error
);

export const selectCurrentPost = createSelector(
  selectPostsState,
  (state) => state.currentPost
);

export const selectUserPosts = (username: string) =>
  createSelector(selectPostsState, (state) => state.userPosts[username] || []);
