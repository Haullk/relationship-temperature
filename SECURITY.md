# Security Policy

GeoPrizm 是一个公开数据看板项目。请不要在 Issue、Pull Request、评论或截图中公开 API key、数据库连接串、服务器地址、cookie、token 或其他敏感信息。

## 报告安全问题

如果你发现安全问题，请优先通过邮件联系维护者：

```text
helioshulk@gmail.com
```

请在邮件中包含：

- 受影响的组件或页面
- 复现步骤
- 可能的影响范围
- 你建议的修复方向

## 依赖与密钥

- `.env.local` 不应提交到仓库
- 生产环境密钥应保存在服务器环境变量或受控 secret 管理中
- 贡献者提交 PR 前请确认没有把本地日志、数据库导出或密钥文件加入 Git
