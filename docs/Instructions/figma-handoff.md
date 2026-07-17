# Figma 设计交接规则

## 每个页面需要的输入

- 指向精确 Frame 或组件节点的 Figma URL。
- Figma MCP 返回的设计上下文和节点信息。
- 同一节点的截图，用于视觉核对。
- 颜色、字体、间距、圆角、阴影等变量定义。
- 真实图片、SVG 或其他不可由代码合理复现的导出素材。
- 交互状态、滚动、键盘、空态、加载态和错误态说明。

如果当前环境无法连接 Figma MCP，只能完成结构性实现，并明确记录未验证视觉一致性；不能仅凭猜测声称 1:1 还原。

## 实现顺序

1. 对照现有 `packages/tokens`，只补充可复用的设计变量。
2. 对照现有 `packages/ui`，扩展可复用且无业务请求的组件。
3. 在 `apps/mobile/src/features/<domain>` 实现 Screen 和业务状态。
4. 在 `apps/mobile/app` 增加轻量路由入口并只读取路由参数。
5. 示例数据进入 `packages/api-client/src/mock-data.ts`，网络行为通过 `LineSpaceApi`。
6. 检查 iOS、Android 与 mobile web 的布局差异。
7. 运行 `pnpm typecheck`、`pnpm check:api` 和 `pnpm build:web`。

## 素材规则

- App 独占位图：`apps/mobile/assets/<domain>/`。
- 多页面复用组件或代码化图标：`packages/ui/src/`。
- 重复视觉值：`packages/tokens/src/`。
- 不把整页导出图当作界面背景。
- 不把 Mock 文案或业务对象硬编码进通用 UI。
- 移动或重命名素材后，必须扫描 import、`require()`、配置路径和文档链接。
- 未引用的原始 Figma 资产在用途不明确时归入“待确认”，不能自动删除。

## 交付核对

- 路由文件仍然轻量，Screen 位于对应 Feature。
- UI 组件不调用 `fetch`、不读取密钥、不依赖 `apps/mobile`。
- 使用 token 而非在多个页面复制同一视觉常量。
- 图片使用真实素材，图标优先复用现有代码化实现。
- Loading、Error、Empty 和无效路由参数都有可理解的表现。
- 文档记录任何有意偏离设计的地方。

## 建议任务描述

```text
实现 Figma Frame: <精确 URL>
目标路由: <apps/mobile/app/...>
要求:
1. 获取 design context、screenshot、variables 和所需 assets。
2. 复用 packages/tokens 与 packages/ui。
3. 页面状态放在 apps/mobile/src/features。
4. 数据只通过 LineSpaceApi。
5. 完成三端和生产导出验证。
```
