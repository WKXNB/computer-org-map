# 2027 408 考研知识图谱

本项目包含 2027 四门 408 专业课的知识图谱、复习标记、学习计时和章节 PDF，支持电脑和手机访问，并通过 GitHub 私有仓库同步复习进度与学习时长。

## 科目入口

- 首页：`./index.html`
- 计算机组成原理：`./computer.html`
- 操作系统：`./os.html`
- 数据结构：`./data-structure.html`
- 计算机网络：`./network.html`

每个页面都按教材书签顺序建立知识图谱，点击章节或小节可查看知识点，并能直接跳转到对应 PDF 页面。知识点可以标记为已复习，进度会同步到 GitHub 私有数据仓库。

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