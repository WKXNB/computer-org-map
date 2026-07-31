# 2027 计算机组成原理知识图谱

本项目包含知识图谱、复习标记、学习计时和章节 PDF，支持电脑和手机访问，并通过 GitHub 私有仓库同步复习进度与学习时长。

## 为什么不用 Gitee Pages

Gitee Pages 已停止服务，`https://gitee.com/用户名/仓库/pages` 和 `https://用户名.gitee.io/仓库/` 都无法继续使用。

当前方案改为：

- GitHub Pages：托管公开网站、章节 PDF，电脑关闭后手机仍可访问。
- GitHub 私有数据仓库：保存复习进度和学习时长，电脑和手机共享同一份数据。

## 部署到 GitHub Pages

1. 打开 `https://github.com/settings/tokens`，生成一个 Personal Access Token (classic)，勾选 `repo` 权限。
2. 双击项目根目录的 `部署到GitHub.cmd`。
3. 按提示输入 GitHub 用户名、网站仓库名、私有数据仓库名、私人令牌；Pages 地址直接回车会自动填写。
4. 脚本会创建公开网站仓库、私有数据仓库，初始化云数据，推送网站代码和 PDF，并尝试开启 GitHub Pages。
5. 等 1-3 分钟构建完成后，打开 `https://你的用户名.github.io/computer-org-map/`。
6. 手机打开该地址，点“手机同步”，粘贴 GitHub 私人令牌一次，之后复习进度和学习时长会自动同步。

更详细的说明见 `GitHub部署说明.md`。

## 更新线上网站

重新双击 `部署到GitHub.cmd` 即可。也可以在 `computer-org-map` 目录推送 `main` 分支。

## 本地运行

双击 `一键启动.cmd` 可以在本地运行。

## 安全提醒

GitHub 私人令牌只应保存在你自己浏览器的“手机同步”弹窗中，不能写入公开仓库。如果你曾经把令牌发到聊天、日志或截图里，请立即到 GitHub 重新生成令牌。