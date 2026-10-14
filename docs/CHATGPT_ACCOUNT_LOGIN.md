# ChatGPT 账号登录与订阅额度

更新：2026-10-12。使用 OpenAI 官方 Sign in with ChatGPT 本地个人项目授权流程。

## 使用

1. 双击 `project/双击启动本地版.cmd`。使用 `http://127.0.0.1:4173/apps/editor/`，保持启动窗口运行。
2. 「目录」→「AI 连接设置」→「ChatGPT 账号」→ **Continue with ChatGPT**。
3. 在 OpenAI 官方页面登录，选择账号及工作区，审核并允许应用使用 ChatGPT 订阅额度。此应用显示为 **Yahari Script**。
4. 回到原编辑器。设置会显示验证后的账号和授权状态，并获取该账号的模型目录。
5. 选择模型，点击「测试生成（一次短请求）」。只有收到生成完成事件且内容校验通过，才显示身份、授权和文本生成均已验证。
6. 「故事转剧本」选择「ChatGPT 账户额度」，使用当前账号可用的模型。生成仍走人物绑定、事实与场景校验和新作品导入流程。

登录和授权需用户亲自在官方页面完成。符合条件的 Plus / Pro 账号可使用此通道；实际可用性取决于账号、工作区、模型和官方当前开放情况。获得身份并不等于已获订阅额度权限，获得模型目录也不等于生成已验证。

## 保存和退出

- 每份本地项目安装生成稳定 host ID；不同账号/工作区连接各自保存已注册 client ID、验证后的身份及凭据，支持切换与重新登录。
- 连接记录存在本地服务的 `.local/chatgpt/`。Windows 用当前用户的 DPAPI 加密凭据；Unix 文件权限为 0600。该目录不在 Git 中，也不能从静态文件服务读取。
- 网页只收到安全的账号摘要与模型目录；访问、刷新及身份 token 均不进入浏览器网站存储、作品、生成草稿或导出文件。
- 本地服务串行刷新凭据，保存最新的旋转 refresh token。重启后保留连接与默认模型；清除浏览器网站数据不清除这里的账号连接。
- 「退出当前连接」尝试撤销远程刷新会话并清除本地 token；保留账号注册映射以便重新登录。远程撤销未确认时会提示去 ChatGPT 设置断开应用。
- OpenRouter 仍使用独立的浏览器连接设置，保存行为见故事生成文档。

## 当前边界

- 仅本地服务实现登录与推理。纯静态线上部署没有此后端。远程或付费托管应用须另行满足 OpenAI 的接入条件。
- 订阅通道调用公开 `/v1/models` 和 `/v1/responses`。每次生成使用 `store:false`、`stream:true`，包含当前请求所需上下文，不使用 ChatGPT 网页私有接口。
- 当前官方预览不支持图片生成。角色图片使用 OpenRouter 或手动上传。
- 同一账号在其他应用的使用会影响共享订阅额度；具体额度与管理入口以 ChatGPT 设置为准。
- 请求最多等待 180 秒。中断、失败、额度错误或不完整流不会被当作成功作品。

## 验证证据

- 官方 OIDC discovery 端点已真实读取，确认 issuer、授权、token、JWKS 和撤销地址；当前签名算法为 RS256。
- 本地回归涵盖 PKCE/state/nonce、注册 ID、签名/issuer/audience/过期校验、回调重放、登录但未授权、模型选择、刷新、退出、跨站请求拒绝、分块 SSE 与迟到的额度失败。
- Windows DPAPI 的加密、磁盘重载及 host ID 重用已真实验证；测试只用假凭据。
- 实际浏览器点击设置中的登录按钮已跳转到 `auth.openai.com`；自动浏览器停在人机验证页面，需用户在日常浏览器完成验证与登录。
- `npm run check`：125 项测试通过，51 个浏览器模块引用及素材和文件导入导出检查通过。
- **真实账号验收通过（2026-10-12）**：用户在日常浏览器完成官方登录和订阅额度授权；本地服务验证身份后取得 7 个账号模型。重启服务成功恢复加密连接；`gpt-6.1-sol` 的短 JSON 请求收到 `response.completed`，内容检查通过。没有使用 OpenAI API Key。
- 首次生成 HTTP 400 定位为 JSON 模式要求 `input` 消息包含 “JSON”，仅在 `instructions` 中声明不足。已在 JSON 请求的输入中加入格式指令，并用真实请求及回归验证修复。账号通道的完整长篇生成和多工作区真实切换仍待后续验收。
- 浏览器 UI 模拟验证了模型偏好保存、设置内短请求和故事通道短请求；私有 `.local`、`.env`、`.git` 路径返回 403。测试浏览器已关闭，本地服务保留供用户继续使用。

## 官方参考

- [接入范围与本地项目示例](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [注册、登录和身份校验](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [模型目录与完成事件](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [账号、刷新和撤销](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [官方预览限制](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)
