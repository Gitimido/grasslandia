// src/app/core/store/Posts/posts.actions.ts
import { createAction, props } from '@ngrx/store';
import { Post } from './posts.state';

// Feed Actions
export const loadFeed = createAction('[Posts] Load Feed');
export const loadFeedSuccess = createAction(
  '[Posts] Load Feed Success',
  props<{ posts: Post[] }>()
);
export const loadFeedFailure = createAction(
  '[Posts] Load Feed Failure',
  props<{ error: string }>()
);

// Real-time Actions
export const postAdded = createAction(
  '[Posts] Post Added',
  props<{ post: Post }>()
);
export const postUpdated = createAction(
  '[Posts] Post Updated',
  props<{ post: Post }>()
);
export const postDeleted = createAction(
  '[Posts] Post Deleted',
  props<{ postId: string }>()
);

// Create Post Actions
export const createPost = createAction(
  '[Posts] Create Post',
  props<{ content: string; privacy: string }>()
);
export const createPostSuccess = createAction(
  '[Posts] Create Post Success',
  props<{ post: Post }>()
);
export const createPostFailure = createAction(
  '[Posts] Create Post Failure',
  props<{ error: string }>()
);

// User Posts Actions
export const loadUserPosts = createAction(
  '[Posts] Load User Posts',
  props<{ username: string }>()
);
export const loadUserPostsSuccess = createAction(
  '[Posts] Load User Posts Success',
  props<{ username: string; posts: Post[] }>()
);
export const loadUserPostsFailure = createAction(
  '[Posts] Load User Posts Failure',
  props<{ error: string }>()
);

// src/app/core/store/Posts/posts.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { PostsState, initialPostsState } from './posts.state';
import * as PostsActions from './posts.actions';

export const postsReducer = createReducer(
  initialPostsState,

  // Feed loading
  on(PostsActions.loadFeed, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(PostsActions.loadFeedSuccess, (state, { posts }) => ({
    ...state,
    feedPosts: posts,
    isLoading: false,
  })),
  on(PostsActions.loadFeedFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Real-time updates
  on(PostsActions.postAdded, (state, { post }) => ({
    ...state,
    feedPosts: [post, ...state.feedPosts],
  })),
  on(PostsActions.postUpdated, (state, { post }) => ({
    ...state,
    feedPosts: state.feedPosts.map((p) =>
      p.id === post.id ? { ...p, ...post } : p
    ),
    currentPost:
      state.currentPost?.id === post.id
        ? { ...state.currentPost, ...post }
        : state.currentPost,
  })),
  on(PostsActions.postDeleted, (state, { postId }) => ({
    ...state,
    feedPosts: state.feedPosts.filter((p) => p.id !== postId),
    currentPost: state.currentPost?.id === postId ? null : state.currentPost,
  })),

  // Create post
  on(PostsActions.createPost, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(PostsActions.createPostSuccess, (state, { post }) => ({
    ...state,
    feedPosts: [post, ...state.feedPosts],
    isLoading: false,
  })),
  on(PostsActions.createPostFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // User posts
  on(PostsActions.loadUserPosts, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(PostsActions.loadUserPostsSuccess, (state, { username, posts }) => ({
    ...state,
    userPosts: {
      ...state.userPosts,
      [username]: posts,
    },
    isLoading: false,
  })),
  on(PostsActions.loadUserPostsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  }))
);
