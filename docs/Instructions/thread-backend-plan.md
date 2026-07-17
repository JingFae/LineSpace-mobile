# Thread 后端完整实现规划

本文档用于规划 LineSpace Thread 模块的正式后端实现。本次前端版本只接入 Mock 与兼容的 API 占位，不执行数据库迁移，不接入真实 AI 判断，也不改动线上数据。

## 1. 数据模型

### users

- `id`
- `handle`
- `displayName`
- `avatarUrl`
- `avatarColor`
- `createdAt`
- `status`

用户表应继续复用现有账号体系。Thread 只读取作者展示信息，不在 Thread 模块内另建用户身份。

### threads

- `id`
- `authorId`
- `content`
- `community`
- `topic`
- `coverUrl`
- `status`
- `likeCount`
- `continuationCount`
- `shareCount`
- `viewCount`
- `createdAt`
- `updatedAt`
- `deletedAt`

Thread 是一棵共同创作树的根节点。`content` 可以是 prompt、首句、短诗或创作邀请，但公开回应必须通过 Continuation 表达。

### continuations

- `id`
- `threadId`
- `parentContinuationId`
- `authorId`
- `content`
- `status`
- `likeCount`
- `childContinuationCount`
- `shareCount`
- `createdAt`
- `updatedAt`
- `deletedAt`

`parentContinuationId` 为空表示直接 Continue 根 Thread；有值表示 Continue 某一条已有创作。不要把普通评论写入该表，除非产品未来明确将其定义为创作节点。

### likes

- `id`
- `userId`
- `targetType`: `thread` 或 `continuation`
- `targetId`
- `createdAt`

需要对 `userId + targetType + targetId` 建唯一约束，防止重复点赞。

### follows（可选）

- `followerId`
- `followingId`
- `createdAt`

用于 Following 排序和通知过滤，不是 Thread 第一版的强依赖。

### shares 或 activity_logs（可选）

- `id`
- `userId`
- `targetType`
- `targetId`
- `channel`
- `createdAt`

第一版可以只记录分享次数；后续如果需要审计或推荐归因，应保留事件日志。

## 2. 树状关系

- Thread 根节点由 `threads.id` 表示。
- 所有子创作节点放在 `continuations`。
- `continuations.threadId` 必须指向根 Thread。
- `continuations.parentContinuationId` 为空时，是根 Thread 的直接一级 Continue。
- `continuations.parentContinuationId` 有值时，必须指向同一 `threadId` 下的另一条 Continuation。

### 查询规则

- Thread 详情页只查询 `parentContinuationId IS NULL` 的直接一级节点。
- Continue 详情页查询：
  - 根 Thread。
  - 从根到当前 Continuation 的祖先路径。
  - 当前 Continuation。
  - `parentContinuationId = current.id` 的直接子节点。
- 不要一次返回整棵大树。

### 防止循环引用

- 创建或更新 `parentContinuationId` 时，必须校验父节点属于同一 Thread。
- 不允许把节点的父节点设置为自己。
- 如未来支持移动节点，必须检查新父节点不是当前节点的后代。
- 第一版建议不开放移动节点能力。

### 最大深度

第一版可以不限制深度，但需要监控深层路径查询成本。若社区内容变深，可设置软限制，例如 20 层后提示用户开启新 Thread。

## 3. API 规划

所有页面必须通过 `lineSpaceApi` 和 `packages/api-client` 访问数据。前端不得直接 `fetch` 业务接口。

### Thread 信息流

`GET /v1/threads`

参数：

- `sort`: `top`、`latest`、`following`
- `cursor`
- `limit`
- `viewerId` 或从认证中解析 viewer

返回：

- `items: PoetryThread[]`
- `pageInfo: { nextCursor?: string; hasMore: boolean }`

### Thread 详情

`GET /v1/threads/:threadId`

返回：

- `thread`
- `continuations`: 仅直接一级 Continue
- `pageInfo`

### Continue 详情

`GET /v1/continuations/:continuationId`

返回：

- `thread`
- `path`: 根到当前节点之前的 Continuation 祖先
- `current`
- `children`: 当前节点直接子节点
- `pageInfo`

### 创建 Continue

`POST /v1/threads/:threadId/continuations`

请求：

- `content`

语义：直接 Continue 根 Thread。

`POST /v1/continuations/:continuationId/continuations`

请求：

- `content`

语义：Continue 某一条已有创作。

返回：新建的 `ThreadContinuation`。

### Like

`POST /v1/threads/:threadId/likes`

`DELETE /v1/threads/:threadId/likes`

`POST /v1/continuations/:continuationId/likes`

`DELETE /v1/continuations/:continuationId/likes`

返回目标最新计数和 viewer 状态。前端可以做乐观更新，但服务端返回值应作为最终状态。

### Share

`POST /v1/threads/:threadId/share`

`POST /v1/continuations/:continuationId/share`

返回：

- `targetId`
- `shareCount`
- 可选 `shareUrl`

### 错误码

- `400`: 参数错误、空内容、非法 parent。
- `401`: 未登录。
- `403`: 没有发布、点赞或查看权限。
- `404`: Thread 或 Continuation 不存在。
- `409`: 重复点赞、状态冲突、循环关系。
- `422`: 内容不符合长度或格式要求。
- `429`: 频率限制。
- `500`: 服务端错误。

## 4. 数据库索引

建议索引：

- `threads(createdAt DESC)`
- `threads(authorId, createdAt DESC)`
- `threads(topic, createdAt DESC)`
- `threads(status, createdAt DESC)`
- `continuations(threadId, parentContinuationId, createdAt DESC)`
- `continuations(parentContinuationId, createdAt DESC)`
- `continuations(threadId, createdAt DESC)`
- `likes(userId, targetType, targetId)` 唯一索引
- `likes(targetType, targetId, createdAt DESC)`
- 可选 `threads(likeCount, continuationCount, createdAt)` 或热度字段索引

计数字段可以反范式存储，但必须通过事务、队列或可重算任务保证一致性。

## 5. Like 机制

- 点赞必须幂等。
- 同一用户对同一目标只能有一条 Like。
- 取消点赞时如果记录不存在，应返回当前未点赞状态，不应报破坏性错误。
- 前端可以乐观更新数字和高亮状态。
- 服务端返回最新 `likeCount` 与 `likedByCurrentUser`。
- 如果计数异常，需要可通过 likes 表重新聚合修复。

## 6. 权限与认证

- 发起 Thread、Continue、Like、Share 必须登录。
- 游客可以只读公开内容，具体范围由产品策略决定。
- 删除权限：
  - 作者可以删除自己的 Thread 或 Continuation。
  - 管理员或审核系统可以隐藏违规内容。
- 编辑权限：
  - 建议第一版不允许公开内容编辑，或只允许短时间窗口内编辑并记录版本。
- 被删除节点对子节点的影响：
  - 不建议物理删除已有树节点。
  - 可用 `status = deleted`，内容展示为已删除，但保留下游创作关系。
  - 如果根 Thread 被隐藏，整棵树默认不可公开访问。

## 7. 通知

需要支持以下事件：

- 有人 Continue 我的 Thread。
- 有人 Continue 我的句子。
- 有人 Like 我的 Thread。
- 有人 Like 我的 Continuation。
- 我关注的人发起了新的 Thread。

通知应避免重复轰炸，例如同一用户短时间连续点赞只保留一条或合并。

## 8. 内容安全

- 支持举报 Thread 与 Continuation。
- 支持屏蔽用户。
- 支持隐藏、删除、恢复和申诉。
- 支持审核状态：`active`、`hidden`、`deleted`、`under_review`。
- 未来可以加入“这更像反馈而不是创作”的温和提示。
- AI 判断只能作为建议或审核辅助，不应在无提示的情况下自动移动、删除或重新分类用户内容。
- 不应把普通聊天、感谢或评价自动改写成创作。

## 9. 性能

- 信息流必须分页，不一次返回所有 Thread。
- Thread 详情只返回一级 Continue，子分支按需加载。
- Continue 详情只返回祖先路径和当前节点直接子节点。
- 深层路径查询可使用递归查询、闭包表、物化路径或缓存，正式选型需结合数据库。
- 热门分支可以缓存，但缓存失效必须考虑 Like、Continue 和删除状态。
- 对热门 Thread 的计数更新可使用队列聚合，接口返回需避免明显延迟。

## 10. 未来功能

- Thread 结束与共同作品定稿。
- 作者署名与贡献追踪。
- 分支选择和主线合并。
- 导出共同作品。
- Prompt Thread 与 Chain Thread 的进一步区分。
- 实时协作和在线状态。
- 内容版本记录。
- 分支收藏、引用和推荐。
- 贡献者通知设置。
- 面向社区的精选 Thread。
