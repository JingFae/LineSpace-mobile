import type {
  UpdateUserFollowInput,
  UpdateUserProfileInput,
  UserConnectionKind,
  UserConnectionPage,
  UserConnectionQuery,
  UserFollowResult,
  UserProfileDetails,
  UserSearchPage,
  UserSearchQuery,
  UserSearchResult
} from "@linespace/api-client";

export type ProfileChanges = Omit<UpdateUserProfileInput, "userId">;

export type RecentContactsPagination = {
  limit?: number;
  cursor?: string;
};

export interface ProfileRepository {
  getProfile(userId: string): Promise<UserProfileDetails | null>;
  updateProfile(
    actorUserId: string,
    targetUserId: string,
    changes: ProfileChanges
  ): Promise<UserProfileDetails>;
  searchUsers(
    actorUserId: string,
    query: string,
    options?: UserSearchQuery
  ): Promise<UserSearchPage>;
  listConnections(
    actorUserId: string,
    targetUserId: string,
    kind: UserConnectionKind,
    query?: UserConnectionQuery
  ): Promise<UserConnectionPage>;
  listRecentContacts(
    actorUserId: string,
    pagination?: RecentContactsPagination
  ): Promise<UserSearchResult[]>;
  setUserFollow(input: UpdateUserFollowInput): Promise<UserFollowResult>;
}
