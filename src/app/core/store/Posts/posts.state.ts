// src/app/core/store/Posts/posts.state.ts
export interface Post {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: any;
  media?: any[];
  // Other post properties
}

export interface PostsState {
  feedPosts: Post[];
  userPosts: { [username: string]: Post[] };
  currentPost: Post | null;
  isLoading: boolean;
  error: string | null;
}

export const initialPostsState: PostsState = {
  feedPosts: [],
  userPosts: {},
  currentPost: null,
  isLoading: false,
  error: null,
};
