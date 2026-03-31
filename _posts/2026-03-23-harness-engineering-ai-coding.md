---
layout: post
title: 模型够聪明之后，工程师该做什么：Harness Engineering 实战指南
categories:
- engineering
- ai
- productivity
author: ROM4AI
date: 2026-03-23
tags:
- memory-system
- ai-accelerator
- llm-inference
---
# 模型够聪明之后，工程师该做什么：Harness Engineering 实战指南

> **原文来源**: [小红书 - 模型够聪明之后，工程师该做什么](https://www.xiaohongshu.com/discovery/item/69ba69d8000000001d01ede6)

最近科技圈在疯传一个数字：**OpenAI 的 3 个工程师用 5 个月生成了 100 万行生产代码，没有一行是人手写的。**

他们给这种工作方式起了个名字：**Harness Engineering**（编排工程）。

这句话点破了本质：

> 模型已经够聪明了，问题出在你给它的环境不够好。

同一个模型，换个环境设计，性能能差 **64%**。不是 AI 不行，是你没给它搭好"跑道"。

---

## Harness Engineering 的 6 个层次

### 1️⃣ 持久状态 — 解决 AI"失忆"问题

每次对话 AI 都是白纸一张，你得用文件让它记住做到哪了。

**实战要点**：
- 使用 `memory/` 目录保存会话状态
- 每个任务创建独立的上下文文件
- 用 Git 跟踪状态变更历史

```markdown
# memory/task-state.md
- [x] 需求分析完成
- [ ] 代码实现中 (进度：3/5 模块)
- [ ] 测试用例编写
```

### 2️⃣ 执行环境 — 给 AI 手和脚

不只是能写代码，还得能跑代码、看页面、查日志。

**实战要点**：
- 配置沙箱执行环境（Docker/容器）
- 提供日志访问权限
- 支持浏览器自动化（Playwright/Puppeteer）

### 3️⃣ 上下文工程 — 对抗信息污染

200K 的窗口实际可用只有 160K，信息越多推理越差。

**实战要点**：
- 只加载当前任务相关的文件
- 用摘要代替完整历史
- 定期清理过期上下文

```bash
# 示例：只加载相关文件
find src -name "*.py" | grep -E "(core|api)" | head -20
```

### 4️⃣ 反馈验证 — 闭合回路

AI 说"做完了"不算数，测试通过了才算数。

**实战要点**：
- 每个任务必须有自动化测试
- CI/CD 流水线集成
- 失败时自动回滚 + 错误报告

### 5️⃣ 架构约束 — 防止代码漂移

AI 会复制坏模式，必须用规则机械化地拦住。

**实战要点**：
- 用 linter 强制执行代码规范
- 架构决策记录（ADR）
- 代码审查 checklist

```yaml
# .github/copilot-rules.yaml
allowed_patterns:
  - "async/await for I/O"
  - "type hints required"
forbidden_patterns:
  - "global mutable state"
  - "bare except:"
```

### 6️⃣ 编排协调 — 跨会话接力

一个会话做不完的事，怎么让下一个 AI 接着做。

**实战要点**：
- 标准化的交接文档格式
- 任务队列管理
- 会话间状态同步机制

---

## 关键洞察：判断力才是核心竞争力

> 工具层的配置很快就能学会，真正拉开差距的是**判断力**——你能不能定义什么叫"好"、什么叫"做完了"、什么架构约束是必须守住的。

**AI 擅长生成和执行，人擅长判断和决策。**

最好的方式不是跟 AI 抢同一件事，而是各司其职：

| AI 负责 | 人负责 |
|--------|-------|
| 代码生成 | 定义验收标准 |
| 测试执行 | 判断测试是否充分 |
| 文档草稿 | 审核技术准确性 |
| 重构建议 | 评估架构影响 |

---

## 判断力从哪里来？

> 判断力来自对计算机科学体系化的理解 + 持续和 AI 协作的实践。

不需要你手写排序算法，但你得知道：
- 这个复杂度在当前规模下行不行
- 这个架构选择对扩展性意味着什么
- 这个技术债将来要花多少代价

---

## 行动清单

如果你今天开始实践 Harness Engineering：

1. **搭建持久状态系统** — 创建 `memory/` 目录和状态跟踪模板
2. **配置执行环境** — 确保 AI 能跑代码、看日志、访问测试
3. **定义架构约束** — 写清楚什么能做、什么不能做
4. **建立反馈闭环** — 每个任务必须有自动化验证
5. **设计交接协议** — 标准化跨会话协作格式

---

## 写在最后

Harness Engineering 不是要取代工程师，而是要**放大工程师的价值**。

当 AI 处理生成和执行时，你可以把精力集中在：
- 理解用户需求
- 设计系统架构
- 做出关键决策
- 探索创新方向

这才是工程师该做的事。

---

## 相关资源

- [Claude Code Documentation](https://docs.anthropic.com/claude-code/)
- [Context Engineering Best Practices](https://github.com/context-engineering/awesome-context-engineering)
- [AI-Assisted Development Patterns](https://github.com/rome/ai-dev-patterns)

---

*Posted on 2026-03-23 | Categories: Engineering, AI, Productivity*
