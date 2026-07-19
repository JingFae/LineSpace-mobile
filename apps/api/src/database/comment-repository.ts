import type {
  CreatePoemCommentInput,
  PoemComment,
  PoemCommentEngagementResult,
  UpdateCommentCollectionInput
} from "@linespace/api-client";
import { PostRepository } from "./post-repository";

/**
 * Comment-specific persistence boundary.
 *
 * The SQL tables and counters live with the post domain, but comment
 * authorization and mapping are intentionally exposed through this separate
 * repository so routes do not need to know that implementation detail.
 */
export class CommentRepository {
  constructor(private readonly posts: PostRepository) {}

  createComment(input: CreatePoemCommentInput): Promise<PoemComment> {
    return this.posts.createPoemComment(input);
  }

  listComments(postId: string): Promise<PoemComment[]> {
    return this.posts.listComments(postId);
  }

  setCollection(
    input: UpdateCommentCollectionInput
  ): Promise<PoemCommentEngagementResult> {
    return this.posts.setCommentCollection(input);
  }
}
