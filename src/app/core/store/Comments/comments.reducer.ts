import { createReducer, on } from '@ngrx/store';
import { CommentsState, initialCommentsState } from './comments.state';
import * as CommentsActions from './comments.actions';

export const commentsReducer = createReducer(
  initialCommentsState,

  // Load comments
  on(CommentsActions.loadComments, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CommentsActions.loadCommentsSuccess, (state, { postId, comments }) => ({
    ...state,
    byPost: {
      ...state.byPost,
      [postId]: comments,
    },
    isLoading: false,
  })),
  on(CommentsActions.loadCommentsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Load replies
  on(CommentsActions.loadReplies, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CommentsActions.loadRepliesSuccess, (state, { commentId, replies }) => ({
    ...state,
    byParent: {
      ...state.byParent,
      [commentId]: replies,
    },
    isLoading: false,
  })),
  on(CommentsActions.loadRepliesFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Create comment
  on(CommentsActions.createComment, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CommentsActions.createCommentSuccess, (state, { comment }) => {
    // If it's a top-level comment
    if (!comment.parentId) {
      const postComments = state.byPost[comment.postId] || [];
      return {
        ...state,
        byPost: {
          ...state.byPost,
          [comment.postId]: [comment, ...postComments],
        },
        isLoading: false,
      };
    }
    // If it's a reply
    else {
      const parentReplies = state.byParent[comment.parentId] || [];
      return {
        ...state,
        byParent: {
          ...state.byParent,
          [comment.parentId]: [comment, ...parentReplies],
        },
        isLoading: false,
      };
    }
  }),
  on(CommentsActions.createCommentFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Update comment
  on(CommentsActions.updateComment, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CommentsActions.updateCommentSuccess, (state, { comment }) => {
    // Create a new state with the updated comment
    const newState = { ...state, isLoading: false };

    // Update in byPost if present
    if (comment.postId && state.byPost[comment.postId]) {
      newState.byPost = {
        ...state.byPost,
        [comment.postId]: state.byPost[comment.postId].map((c) =>
          c.id === comment.id ? comment : c
        ),
      };
    }

    // Update in byParent if present and has a parent
    if (comment.parentId && state.byParent[comment.parentId]) {
      newState.byParent = {
        ...state.byParent,
        [comment.parentId]: state.byParent[comment.parentId].map((c) =>
          c.id === comment.id ? comment : c
        ),
      };
    }

    return newState;
  }),
  on(CommentsActions.updateCommentFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Delete comment
  on(CommentsActions.deleteComment, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(
    CommentsActions.deleteCommentSuccess,
    (state, { commentId, postId, parentId }) => {
      const newState = { ...state, isLoading: false };

      // Remove from byPost if present
      if (postId && state.byPost[postId]) {
        newState.byPost = {
          ...state.byPost,
          [postId]: state.byPost[postId].filter((c) => c.id !== commentId),
        };
      }

      // Remove from byParent if present and has a parent
      if (parentId && state.byParent[parentId]) {
        newState.byParent = {
          ...state.byParent,
          [parentId]: state.byParent[parentId].filter(
            (c) => c.id !== commentId
          ),
        };
      }

      // Also remove any replies to this comment
      // This is important: we need to remove the parent's entries when the parent is deleted
      if (state.byParent[commentId]) {
        const { [commentId]: _, ...remainingParents } = state.byParent;
        newState.byParent = remainingParents;
      }

      return newState;
    }
  ),
  on(CommentsActions.deleteCommentFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Vote comment
  on(CommentsActions.voteComment, (state) => ({
    ...state,
    // No loading state needed for optimistic updates
  })),

  // Real-time updates handlers
  on(CommentsActions.commentAdded, (state, { comment }) => {
    if (!comment.parentId) {
      // Top-level comment
      const postComments = state.byPost[comment.postId] || [];

      // Avoid duplicate comments
      if (postComments.some((c) => c.id === comment.id)) {
        return state;
      }

      return {
        ...state,
        byPost: {
          ...state.byPost,
          [comment.postId]: [comment, ...postComments],
        },
      };
    } else {
      // Reply
      const parentReplies = state.byParent[comment.parentId] || [];

      // Avoid duplicate replies
      if (parentReplies.some((c) => c.id === comment.id)) {
        return state;
      }

      return {
        ...state,
        byParent: {
          ...state.byParent,
          [comment.parentId]: [comment, ...parentReplies],
        },
      };
    }
  }),
  on(CommentsActions.commentUpdated, (state, { comment }) => {
    // Create a new state
    const newState = { ...state };

    // Update in byPost if present
    if (comment.postId && state.byPost[comment.postId]) {
      newState.byPost = {
        ...state.byPost,
        [comment.postId]: state.byPost[comment.postId].map((c) =>
          c.id === comment.id ? comment : c
        ),
      };
    }

    // Update in byParent if present and has a parent
    if (comment.parentId && state.byParent[comment.parentId]) {
      newState.byParent = {
        ...state.byParent,
        [comment.parentId]: state.byParent[comment.parentId].map((c) =>
          c.id === comment.id ? comment : c
        ),
      };
    }

    return newState;
  }),
  on(
    CommentsActions.commentDeleted,
    (state, { commentId, postId, parentId }) => {
      const newState = { ...state };

      // Remove from byPost if present
      if (postId && state.byPost[postId]) {
        newState.byPost = {
          ...state.byPost,
          [postId]: state.byPost[postId].filter((c) => c.id !== commentId),
        };
      }

      // Remove from byParent if present and has a parent
      if (parentId && state.byParent[parentId]) {
        newState.byParent = {
          ...state.byParent,
          [parentId]: state.byParent[parentId].filter(
            (c) => c.id !== commentId
          ),
        };
      }

      // Also remove any replies to this comment
      if (state.byParent[commentId]) {
        const { [commentId]: _, ...remainingParents } = state.byParent;
        newState.byParent = remainingParents;
      }

      return newState;
    }
  )
);
