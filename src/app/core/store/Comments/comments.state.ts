export interface Comment {
  id: string;
  userId: string;
  postId: string;
  parentId?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: any;
}

export interface CommentsState {
  // Comments keyed by post ID
  byPost: { [postId: string]: Comment[] };
  // Replies keyed by parent comment ID
  byParent: { [commentId: string]: Comment[] };
  isLoading: boolean;
  error: string | null;
}

export const initialCommentsState: CommentsState = {
  byPost: {},
  byParent: {},
  isLoading: false,
  error: null,
};
