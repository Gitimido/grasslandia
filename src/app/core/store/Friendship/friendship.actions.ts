import { createAction, props } from '@ngrx/store';
import { FriendRequest, FriendshipStatus } from './friendship.state';

// Load friends
export const loadFriends = createAction('[Friendship] Load Friends');
export const loadFriendsSuccess = createAction(
  '[Friendship] Load Friends Success',
  props<{ friends: string[] }>()
);
export const loadFriendsFailure = createAction(
  '[Friendship] Load Friends Failure',
  props<{ error: string }>()
);

// Load pending requests
export const loadPendingRequests = createAction(
  '[Friendship] Load Pending Requests'
);
export const loadPendingRequestsSuccess = createAction(
  '[Friendship] Load Pending Requests Success',
  props<{ requests: FriendRequest[] }>()
);
export const loadPendingRequestsFailure = createAction(
  '[Friendship] Load Pending Requests Failure',
  props<{ error: string }>()
);

// Load sent requests
export const loadSentRequests = createAction('[Friendship] Load Sent Requests');
export const loadSentRequestsSuccess = createAction(
  '[Friendship] Load Sent Requests Success',
  props<{ requests: FriendRequest[] }>()
);
export const loadSentRequestsFailure = createAction(
  '[Friendship] Load Sent Requests Failure',
  props<{ error: string }>()
);

// Send friend request
export const sendFriendRequest = createAction(
  '[Friendship] Send Friend Request',
  props<{ friendId: string }>()
);
export const sendFriendRequestSuccess = createAction(
  '[Friendship] Send Friend Request Success',
  props<{ request: FriendRequest }>()
);
export const sendFriendRequestFailure = createAction(
  '[Friendship] Send Friend Request Failure',
  props<{ error: string }>()
);

// Accept friend request
export const acceptFriendRequest = createAction(
  '[Friendship] Accept Friend Request',
  props<{ requestId: string }>()
);
export const acceptFriendRequestSuccess = createAction(
  '[Friendship] Accept Friend Request Success',
  props<{ request: FriendRequest }>()
);
export const acceptFriendRequestFailure = createAction(
  '[Friendship] Accept Friend Request Failure',
  props<{ error: string }>()
);

// Reject friend request
export const rejectFriendRequest = createAction(
  '[Friendship] Reject Friend Request',
  props<{ requestId: string }>()
);
export const rejectFriendRequestSuccess = createAction(
  '[Friendship] Reject Friend Request Success',
  props<{ request: FriendRequest }>()
);
export const rejectFriendRequestFailure = createAction(
  '[Friendship] Reject Friend Request Failure',
  props<{ error: string }>()
);

// Remove friendship
export const removeFriendship = createAction(
  '[Friendship] Remove Friendship',
  props<{ friendId: string }>()
);
export const removeFriendshipSuccess = createAction(
  '[Friendship] Remove Friendship Success',
  props<{ friendId: string }>()
);
export const removeFriendshipFailure = createAction(
  '[Friendship] Remove Friendship Failure',
  props<{ error: string }>()
);

// Check friendship status
export const checkFriendshipStatus = createAction(
  '[Friendship] Check Friendship Status',
  props<{ userId: string }>()
);
export const updateFriendshipStatus = createAction(
  '[Friendship] Update Friendship Status',
  props<{
    userId: string;
    status: FriendshipStatus | null;
    friendshipId: string | null;
    initiatedByMe: boolean;
  }>()
);

// Real-time updates
export const friendRequestReceived = createAction(
  '[Friendship] Friend Request Received',
  props<{ request: FriendRequest }>()
);
export const friendRequestAccepted = createAction(
  '[Friendship] Friend Request Accepted',
  props<{ request: FriendRequest }>()
);
export const friendRequestRejected = createAction(
  '[Friendship] Friend Request Rejected',
  props<{ request: FriendRequest }>()
);
export const friendshipRemoved = createAction(
  '[Friendship] Friendship Removed',
  props<{ userId: string }>()
);
