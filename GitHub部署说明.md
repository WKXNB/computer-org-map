# GitHub Pages 部署指南

这套方案让电脑关机后，手机仍能打开网站，并且复习进度和学习时长会通过 GitHub 私有仓库自动同步。

## 准备 GitHub 私人令牌

1. 打开 GitHub：`https://github.com/settings/tokens`
2. 点击 `Generate new token` -> `Generate new token (classic)`。
3. 填写名称，例如 `knowledge-map-sync`。
4. 勾选 `repo` 权限（创建仓库、读写私有数据仓库都需要它）。
5. 点击页面底部 `Generate token`，复制生成的令牌。
6. 令牌只粘贴到网站“手机同步”弹窗里，不要写进公开文件、聊天或日志。

## 一键部署

1. 双击项目根目录的 `部署到GitHub.cmd`。
2. 按提示输入：
   - GitHub 用户名
   - 网站仓库名：`computer-org-map`
   - 私有数据仓库名：`computer-org-data`
   - GitHub 私人令牌
   - GitHub Pages 地址：直接回车会自动填写 `https://你的用户名.github.io/computer-org-map/`
3. 脚本会自动：
   - 创建公开网站仓库
   - 创建私有数据仓库并初始化 `progress.json`、`study.json`
   - 写入 `sync-config.js`
   - 推送网站代码和章节 PDF 到 GitHub
   - 尝试开启 GitHub Pages

## 手机访问和同步

1. 第一次部署后等 1-3 分钟，打开：
   `https://你的用户名.github.io/computer-org-map/`
2. 手机点右上角“手机同步”。
3. 粘贴 GitHub 私人令牌并保存。
4. 之后电脑和手机都会从同一个私有数据仓库读取/写入复习进度和学习时长。

## 更新线上网站

以后修改代码后，重新双击 `部署到GitHub.cmd` 即可。也可以直接在 `computer-org-map` 目录推送 `main` 分支。

## 排障

- 网站 404：确认已等待 Pages 构建完成，并检查仓库 `Settings -> Pages -> Build and deployment -> Branch` 是否为 `main` 和 `/ (root)`。
- 手机同步失败：确认令牌有 `repo` 权限，或 Fine-grained Token 已给数据仓库 `Contents: Read and write`。
- PDF 打不开：确认 GitHub Pages 地址末尾有 `/`，或直接重新运行部署脚本。
- 令牌曾经泄露：请到 GitHub 重新生成令牌，再用新令牌在手机同步弹窗中保存一次。