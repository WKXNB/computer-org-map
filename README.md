# 2027 计算机组成原理知识图谱

本项目包含知识图谱、复习标记、学习计时和章节 PDF，支持电脑和手机访问，并通过 Gitee 私有仓库同步复习进度与学习时长。

## 为什么 404

Gitee Pages 服务已经下线，`https://gitee.com/用户名/仓库/pages` 和 `https://用户名.gitee.io/仓库/` 都已经无法继续使用。这不是仓库配置错误。

当前方案改为：

- Gitee：存放网站代码、章节 PDF，并用私有数据仓库同步数据。
- 腾讯 EdgeOne Makers Pages：把 Gitee 仓库导入后生成公网网站，电脑关闭后手机仍可访问。

## 部署到 EdgeOne

1. 在 Gitee 个人设置 -> 安全设置 -> 私人令牌 中生成令牌，勾选 `projects` 权限。
2. 双击项目根目录的 `部署到Gitee.cmd`，按提示输入 Gitee 用户名、网站仓库名、私有数据仓库名、私人令牌和 EdgeOne Pages 地址。
3. 打开 `https://console.cloud.tencent.com/edgeone/pages` 或 `https://pages.edgeone.ai`，用微信或腾讯云账号登录并开通 Makers。
4. 创建项目 -> 通过导入 Git 仓库创建 -> 关联 Gitee。
5. 仓库选择 `你的用户名/computer-org-map`，分支选 `master`，构建命令留空。
6. 加速区域建议选择“全球（不含中国大陆）”或按实际访问区域选择，点击开始部署。
7. 部署成功后复制 EdgeOne 预览地址。
8. 如果第一步没有填写地址，重新运行 `部署到Gitee.cmd` 并输入该地址，脚本会写入 `gitee-config.js` 并重新推送。
9. 手机打开 EdgeOne 地址，点“手机同步”，输入 Gitee 私人令牌一次，之后复习进度和学习时长会自动同步。

## 更新线上网站

修改代码后，在 `computer-org-map` 目录推送 Gitee `master`，EdgeOne 会自动拉取并部署。也可以重新运行部署脚本完成上传。

## 本地运行

双击 `一键启动.cmd` 可以在本地运行。

## 安全提醒

Gitee 私人令牌只应保存在你自己浏览器的“手机同步”弹窗中，不能写入公开仓库。如果你曾经把令牌发到聊天、日志或截图里，请立即到 Gitee 重新生成令牌。