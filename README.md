# NPC 小剧场

一个适用于 SillyTavern 的纯前端第三方扩展。它在每次角色回复后，用一次独立模型请求分析当前场景中的全部在场 NPC，并为每个 NPC 显示独立的状态、心理和日记卡片。

## 功能

- 一次请求批量生成所有实际在场 NPC，严格排除玩家 / Persona。
- 每个 NPC 一张独立美化卡片，包含状态、心声、日记三个页签。
- 好感、信任、戒备、兴趣、压力五项连续关系数值；非重大事件每轮最多变化 8 点。
- 心声和日记每轮都是一份独立的新小剧场：新结果直接覆盖旧结果，不保留、续写或回传历史内容。
- NPC 离场后隐藏；再次登场时仅恢复关系数值的连续性。
- 数据按聊天写入 `chat_metadata`，不会加入或回注主聊天 Prompt。
- 圆形入口按钮支持鼠标与触屏拖动并记忆位置；悬浮窗始终贴着入口出现，并与入口绑定移动。
- 支持自动生成、Swipe 后更新、手动刷新、停止、失败重试和 API 测试。
- 独立系统提示词、Temperature、Max Tokens、上下文条数和 JSON Schema 开关。
- 自定义 OpenAI-Compatible API 会自动从 `/models` 拉取模型列表供下拉选择，并保留手动模型 ID 兜底。
- 输出 JSON 结构会始终附在请求提示词中，因此未开启原生 JSON Schema 的 Gemini、Claude 等 Connection Profile 也能正常生成。

## 兼容性

推荐 SillyTavern 1.18.0 或更高版本。Connection Profile 模式依赖 SillyTavern 内置的 Connection Manager 与 `ConnectionManagerRequestService`。

## 安装

### 链接安装（推荐）

在 SillyTavern 中打开“扩展 → 安装扩展”，粘贴以下仓库地址：

```text
https://github.com/zhanghaoyu2365-ship-it/sillytavern-npc-theater
```

### 本地安装

1. 将整个 `npc-theater` 文件夹复制到：

   ```text
   SillyTavern/public/scripts/extensions/third-party/npc-theater
   ```

2. 重启 SillyTavern，并刷新浏览器页面。
3. 打开“扩展”，确认“NPC 小剧场”已启用。

## 推荐配置：Connection Profile

1. 在 SillyTavern 的 Connection Manager 中新建专用于小剧场的连接配置，例如“NPC 小剧场 · Gemini Flash”。
2. 在“扩展 → NPC 小剧场 → 独立 API”中选择 `SillyTavern Connection Profile`。
3. 选择刚才建立的 Profile，设置 Temperature、Max Tokens 与上下文条数。
4. 点击“测试 API”。测试成功后，可以开启自动生成。

这种模式不会切换主聊天当前连接，密钥继续由 SillyTavern 的 Secret / Connection Profile 系统管理。

## 自定义 OpenAI-Compatible 模式

填写完整 Chat Completions Endpoint（例如 `https://example.com/v1/chat/completions`）和 API Key。扩展会自动推导 `/v1/models` 地址并拉取模型列表，随后从下拉框选择模型；若服务不支持模型列表接口，也可手动填写 Model ID。

注意：

- 请求由浏览器直接发出，服务端必须允许当前 SillyTavern 页面发起 CORS 请求。
- API Key 只保存在当前标签页的 `sessionStorage`，不会写入扩展设置；关闭标签页后需要重新输入。
- 如果服务不支持 `response_format: json_schema`，请关闭“JSON Schema 结构化输出”。
- 对于常用远端服务，优先创建 SillyTavern Connection Profile。

## 数据与隐私

- 扩展仅读取设置中指定数量的最近聊天消息，并将它们发送给所选的小剧场 API。
- 当前一轮小剧场状态与关系连续性数据存放在当前聊天的元数据键 `npc_theater_v1`；旧心声与旧日记不会累计保存。
- 扩展不会读取 SillyTavern 密钥，也不会把小剧场内容插入主聊天上下文。
- 自定义直连模式的 Key 仅保存在 `sessionStorage`。

## 使用

- 点击页面右下角的 `🎭` 打开小剧场。
- 点击标题栏 `↻` 手动刷新；生成中该按钮会变成 `■`，可停止请求。
- 点击角色卡标题可折叠；每张卡可独立切换状态、心声和日记。
- 拖动圆形 🎭 入口或悬浮窗标题栏时，两者会作为一组同步移动并记忆位置。
- 圆球可在屏幕内自由横向或纵向拖动；窗口打开时会实时跟随圆球重新贴靠，并单独避让屏幕边缘。
- 圆形入口是开关：轻点一次打开，再点一次关闭；手机端不使用遮罩或 Bottom Sheet。
- 悬浮窗会自动出现在圆球上方；上方空间不足时改为出现在圆球下方，并始终限制在屏幕内。
- 设置页可清除“当前聊天”的全部小剧场数据，不影响聊天正文。

## 开发验证

无需安装依赖：

```bash
npm test
npm run check
```

## 已知限制

- “是否实际在场”由模型根据最近上下文和非玩家发言者候选判断；最近亲自说话、行动或与玩家互动的主角色会被明确要求生成。
- JSON Schema 能力取决于所选模型 / 提供商。扩展仍会在前端执行 JSON 解析、字段清理、玩家排除和关系限幅。
- 自定义直连 API 可能被浏览器 CORS 策略拦截。

## 许可证

MIT。见 `LICENSE`。
