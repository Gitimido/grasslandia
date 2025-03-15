export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
}

export interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    username: string;
    fullName?: string;
    avatarUrl?: string;
  };
}

export interface FriendshipState {
  friends: string[]; // Array of friend user IDs
  pendingRequests: FriendRequest[]; // Friend requests awaiting response
  sentRequests: FriendRequest[]; // Requests sent by the current user
  friendships: Map<
    string,
    {
      status: FriendshipStatus;
      id: string;
      initiatedByMe: boolean;
    }
  >; // Map of user IDs to friendship status
  isLoading: boolean;
  error: string | null;
}

export const initialFriendshipState: FriendshipState = {
  friends: [],
  pendingRequests: [],
  sentRequests: [],
  friendships: new Map(),
  isLoading: false,
  error: null,
};
