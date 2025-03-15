import { createReducer, on } from '@ngrx/store';
import {
  FriendshipState,
  initialFriendshipState,
  FriendshipStatus,
} from './friendship.state';
import * as FriendshipActions from './friendship.actions';

export const friendshipReducer = createReducer(
  initialFriendshipState,

  // Load friends
  on(FriendshipActions.loadFriends, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.loadFriendsSuccess, (state, { friends }) => ({
    ...state,
    friends,
    isLoading: false,
  })),
  on(FriendshipActions.loadFriendsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Load pending requests
  on(FriendshipActions.loadPendingRequests, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.loadPendingRequestsSuccess, (state, { requests }) => ({
    ...state,
    pendingRequests: requests,
    isLoading: false,
  })),
  on(FriendshipActions.loadPendingRequestsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Load sent requests
  on(FriendshipActions.loadSentRequests, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.loadSentRequestsSuccess, (state, { requests }) => ({
    ...state,
    sentRequests: requests,
    isLoading: false,
  })),
  on(FriendshipActions.loadSentRequestsFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Send friend request
  on(FriendshipActions.sendFriendRequest, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.sendFriendRequestSuccess, (state, { request }) => {
    // Create new friendships Map with updated status
    const newFriendships = new Map(state.friendships);
    newFriendships.set(request.friendId, {
      status: FriendshipStatus.PENDING,
      id: request.id,
      initiatedByMe: true,
    });

    return {
      ...state,
      sentRequests: [...state.sentRequests, request],
      friendships: newFriendships,
      isLoading: false,
    };
  }),
  on(FriendshipActions.sendFriendRequestFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Accept friend request
  on(FriendshipActions.acceptFriendRequest, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.acceptFriendRequestSuccess, (state, { request }) => {
    // Find the user ID from the accepted request
    const pendingRequest = state.pendingRequests.find(
      (r) => r.id === request.id
    );
    if (!pendingRequest) return state;

    const userId = pendingRequest.userId;

    // Create new friendships Map with updated status
    const newFriendships = new Map(state.friendships);
    newFriendships.set(userId, {
      status: FriendshipStatus.ACCEPTED,
      id: request.id,
      initiatedByMe: false,
    });

    return {
      ...state,
      friends: [...state.friends, userId],
      pendingRequests: state.pendingRequests.filter((r) => r.id !== request.id),
      friendships: newFriendships,
      isLoading: false,
    };
  }),
  on(FriendshipActions.acceptFriendRequestFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Reject friend request
  on(FriendshipActions.rejectFriendRequest, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.rejectFriendRequestSuccess, (state, { request }) => {
    // Find the user ID from the rejected request
    const pendingRequest = state.pendingRequests.find(
      (r) => r.id === request.id
    );
    if (!pendingRequest) return state;

    const userId = pendingRequest.userId;

    // Create new friendships Map with updated status
    const newFriendships = new Map(state.friendships);
    newFriendships.set(userId, {
      status: FriendshipStatus.REJECTED,
      id: request.id,
      initiatedByMe: false,
    });

    return {
      ...state,
      pendingRequests: state.pendingRequests.filter((r) => r.id !== request.id),
      friendships: newFriendships,
      isLoading: false,
    };
  }),
  on(FriendshipActions.rejectFriendRequestFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Remove friendship
  on(FriendshipActions.removeFriendship, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(FriendshipActions.removeFriendshipSuccess, (state, { friendId }) => {
    // Create new friendships Map with removed friendship
    const newFriendships = new Map(state.friendships);
    newFriendships.delete(friendId);

    return {
      ...state,
      friends: state.friends.filter((id) => id !== friendId),
      friendships: newFriendships,
      isLoading: false,
    };
  }),
  on(FriendshipActions.removeFriendshipFailure, (state, { error }) => ({
    ...state,
    error,
    isLoading: false,
  })),

  // Update friendship status
  on(
    FriendshipActions.updateFriendshipStatus,
    (state, { userId, status, friendshipId, initiatedByMe }) => {
      // Create new friendships Map with updated status
      const newFriendships = new Map(state.friendships);

      if (status === null) {
        newFriendships.delete(userId);
      } else {
        newFriendships.set(userId, {
          status,
          id: friendshipId || '',
          initiatedByMe,
        });
      }

      return {
        ...state,
        friendships: newFriendships,
      };
    }
  ),

  // Real-time updates
  on(FriendshipActions.friendRequestReceived, (state, { request }) => {
    // Only add if not already in pendingRequests
    if (state.pendingRequests.some((r) => r.id === request.id)) {
      return state;
    }

    // Create new friendships Map with updated status
    const newFriendships = new Map(state.friendships);
    newFriendships.set(request.userId, {
      status: FriendshipStatus.PENDING,
      id: request.id,
      initiatedByMe: false,
    });

    return {
      ...state,
      pendingRequests: [...state.pendingRequests, request],
      friendships: newFriendships,
    };
  }),
  on(FriendshipActions.friendRequestAccepted, (state, { request }) => {
    // Find sent request that was accepted
    const sentRequest = state.sentRequests.find((r) => r.id === request.id);
    if (!sentRequest) return state;

    // Create new friendships Map with updated status
    const newFriendships = new Map(state.friendships);
    newFriendships.set(sentRequest.friendId, {
      status: FriendshipStatus.ACCEPTED,
      id: request.id,
      initiatedByMe: true,
    });

    return {
      ...state,
      friends: [...state.friends, sentRequest.friendId],
      sentRequests: state.sentRequests.filter((r) => r.id !== request.id),
      friendships: newFriendships,
    };
  }),
  on(FriendshipActions.friendRequestRejected, (state, { request }) => {
    // Create new friendships Map with updated status
    const newFriendships = new Map(state.friendships);

    // Handle both sent and received requests
    const sentRequest = state.sentRequests.find((r) => r.id === request.id);
    if (sentRequest) {
      newFriendships.set(sentRequest.friendId, {
        status: FriendshipStatus.REJECTED,
        id: request.id,
        initiatedByMe: true,
      });

      return {
        ...state,
        sentRequests: state.sentRequests.filter((r) => r.id !== request.id),
        friendships: newFriendships,
      };
    }

    return state;
  }),
  on(FriendshipActions.friendshipRemoved, (state, { userId }) => {
    // Create new friendships Map with removed friendship
    const newFriendships = new Map(state.friendships);
    newFriendships.delete(userId);

    return {
      ...state,
      friends: state.friends.filter((id) => id !== userId),
      friendships: newFriendships,
    };
  })
);
