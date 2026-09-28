# Google Drive → GitHub 一键同步

这个仓库把 Google Drive 中的 Yahari Script 项目目录作为日常工作源。配置一次后，之后只需在 GitHub Actions 点一次 **Run workflow**。

## 一次性配置

### 1. 在 Google Cloud 创建 Service Account

1. 打开 Google Cloud Console，选择或新建一个项目。
2. 在 **APIs & Services** 中启用 **Google Drive API**。
3. 打开 **IAM & Admin → Service Accounts**，新建一个 Service Account。
4. 进入这个 Service Account 的 **Keys** 页面，选择 **Add key → Create new key → JSON**。
5. 保存下载的 JSON。不要提交到仓库。

### 2. 把 Drive 项目目录共享给 Service Account

打开 JSON，找到 `client_email`，它通常类似：

`name@project-id.iam.gserviceaccount.com`

把 Google Drive 中的 **Yahari Script 项目文件夹**共享给这个邮箱，**Viewer / 查看者权限即可**。

当前 workflow 默认使用的 Drive 文件夹 ID：

`1K0jzA4zaq_nt2gTqPhg6id3zUSyZE3-r`

如果以后换了 Drive 根目录，可在 GitHub **Settings → Secrets and variables → Actions → Variables** 新建 `GDRIVE_FOLDER_ID` 覆盖默认值。

### 3. 把 JSON 放进 GitHub Secret

GitHub 仓库中进入：

**Settings → Secrets and variables → Actions → Secrets → New repository secret**

名称必须是：

`GDRIVE_SERVICE_ACCOUNT_JSON`

值：粘贴刚刚下载的 **完整 JSON 内容**。

## 日常使用

1. 打开仓库的 **Actions**。
2. 左侧选择 **Sync from Google Drive**。
3. 点 **Run workflow**。
4. commit message 可以不改，直接再次点绿色 **Run workflow**。

工作流会自动：

1. 从 Drive 下载当前项目树；
2. 镜像覆盖 GitHub 工作树；
3. 删除 GitHub 中 Drive 已经删除的普通项目文件；
4. 保护 `.git`、`.github`、`node_modules`、`dist`、`out`、`.env*`；
5. 运行 `npm ci` 和 `npm run check`；
6. **只有验证通过才 commit + push 到 main**；
7. 再触发现有的 **Verify** workflow 和 GitHub Pages 部署；
8. 如果 Drive 与 GitHub 没有差异，则不产生 commit。

## 安全边界

- Service Account 只请求 Google Drive **只读**权限。
- Service Account JSON 只在“下载 Drive”那一步注入，不暴露给项目的 npm 脚本。
- checkout 禁用了持久化 GitHub 凭据；GitHub token 只在验证通过后的 push 步骤注入。
- 如果 Drive 根目录缺少 `package.json`、`package-lock.json` 或 `apps/editor/index.html`，同步立即失败，避免错误目录把仓库清空。
- Google Docs / Sheets / Drive shortcut 不会被偷偷转换；脚本遇到这类原生 Google 文件会直接失败。项目目录应保持普通文件和文件夹结构。
