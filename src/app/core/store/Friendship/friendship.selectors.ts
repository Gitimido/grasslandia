import { createFeatureSelector, createSelector } from '@ngrx/store';
import { FriendshipState, FriendshipStatus } from './friendship.state';

export const selectFriendshipState =
  createFeatureSelector<FriendshipState>('friendship');

export const selectFriends = createSelector(
  selectFriendshipState,
  (state) => state.friends
);

export const selectPendingRequests = createSelector(
  selectFriendshipState,
  (state) => state.pendingRequests
);

export const selectSentRequests = createSelector(
  selectFriendshipState,
  (state) => state.sentRequests
);

export const selectPendingRequestsCount = createSelector(
  selectPendingRequests,
  (requests) => requests.length
);

export const selectFriendshipsMap = createSelector(
  selectFriendshipState,
  (state) => state.friendships
);

export const selectFriendshipStatus = (userId: string) =>
  createSelector(
    selectFriendshipsMap,
    (friendships) => friendships.get(userId) || null
  );

export const selectIsFriend = (userId: string) =>
  createSelector(selectFriendshipsMap, (friendships) => {
    const status = friendships.get(userId);
    return status?.status === FriendshipStatus.ACCEPTED;
  });

export const selectIsLoadingFriendship = createSelector(
  selectFriendshipState,
  (state) => state.isLoading
);

export const selectFriendshipError = createSelector(
  selectFriendshipState,
  (state) => state.error
);
