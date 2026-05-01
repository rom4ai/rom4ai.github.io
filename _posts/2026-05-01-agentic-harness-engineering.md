---
layout: post
title: "Agentic Harness Engineering: 可观测性驱动的编码智能体 Harness 自动进化"
categories: ["research", "ai", "llm", "agent"]
author: ["Jiahang Lin", "Shichun Liu", "Chengjun Pan", "Lizhi Lin", "Shihan Dou", "Xuanjing Huang", "Hang Yan", "Zhenhua Han", "Tao Gui"]
publish_date: ["2026-04"]
original_paper: "https://arxiv.org/abs/2604.25850"
tags: ["llm-inference", "agent-systems", "world-model", "benchmark", "neural-symbolic"]
---

# Agentic Harness Engineering: 可观测性驱动的编码智能体 Harness 自动进化

> **原文链接**: [arXiv:2604.25850](https://arxiv.org/abs/2604.25850) | [PDF](https://arxiv.org/pdf/2604.25850.pdf)
> 
> **作者**: Jiahang Lin, Shichun Liu, Chengjun Pan 等 (复旦大学、北京大学、上海奇绩智风)

## 摘要

Harness（系统提示、工具、中间件等组成的智能体框架）已成为编码智能体性能的核心决定因素。然而自动化 harness 工程面临巨大挑战：异构的动作空间、稀疏且嘈杂的评估信号、数百万 token 的轨迹数据，以及难以归因的编辑效果。本文提出 **Agentic Harness Engineering (AHE)**，一个通过三大可观测性支柱实现 harness 级别自动进化的框架：

1. **组件可观测性** — 将每个可编辑 harness 组件映射为文件级表示
2. **经验可观测性** — 将数百万原始轨迹 token 蒸馏为分层可钻取证据语料库
3. **决策可观测性** — 将每次编辑与自声明预测配对，由下一轮任务级结果验证

实验表明，10 轮 AHE 迭代将 Terminal-Bench 2 的 pass@1 从 69.7% 提升至 **77.0%**，超越人工设计的 Codex-CLI (71.9%) 和自进化基线 ACE、TF-GRPO。冻结的 harness 无需重新进化即可迁移：在 SWE-bench-verified 上达到最高总体成功率，token 消耗比种子少 12%；在 Terminal-Bench 2 上跨三个模型家族获得 +5.1 至 +10.1 个百分点的增益。

---

## 1. 问题定义

编码智能体现在广泛用于长程软件工程任务，在真实 GitHub issue 解决和多步终端工作流方面取得可衡量的进展。这种进步不仅源于底层语言模型，还很大程度上依赖于周围的 **harness** —— 包括系统提示、工具、以及协调模型与文件系统、shell 和外部服务交互的中间件。

> "Harness design materially shifts task completion on long-horizon coding benchmarks, even with the base model held fixed."
> 
> —— 原文第 1 段

当前实践中，人工 harness 开发者检查轨迹、识别重复失败模式，并相应修改提示、工具或中间件。但这种手动循环未能跟上基础模型能力的进步：它昂贵、难以扩展，且难以科学研究。

**核心问题**：如何让进化智能体稳定地进化编码智能体 harness 的所有组件？

AHE 的核心洞见是：这个问题受限于**可观测性**，而非智能体能力。一旦进化智能体获得结构化上下文和清晰的动作空间，它就能可靠地收敛到更好的 harness 设计。

---

## 2. 方法框架

![AHE 方法框架](/assets/agentic-harness-engineering/_page_3_Picture_0.jpeg)
*图：AHE 将三个可观测层链接成一个闭环（来源：原文 Figure 2）*

AHE 将 harness 优化转变为另一个智能体驱动的闭环，基础模型保持不变，仅显式编辑 harness。设计原则是循环的每个阶段都必须**可观测**。

### 2.1 组件可观测性：NexAU 可编辑 Harness 基板

AHE 在 NexAU 框架上实例化 harness，暴露七种正交组件类型作为显式文件：

| 组件类型 | 文件位置 | 用途 |
|---------|---------|------|
| System Prompt | `systemprompt.md` | 行为规则、工作流指导 |
| Tool Description | `tool_descriptions/*.yaml` | 工具使用说明、示例 |
| Tool Implementation | `tools/` | 工具行为直接控制 |
| Middleware | `middleware/` | 执行级拦截/转换 |
| Skill | `skills/` | 可重用工作流模式 |
| Sub-Agent | `sub_agents/` | 专用子任务委托 |
| Long-Term Memory | `LongTermMEMORY.md` | 跨会话持久知识 |

这种解耦实现了**组件可观测性**：每个失败模式映射到单一组件类，使进化智能体拥有清晰的动作空间。

### 2.2 经验可观测性：Agent Debugger 分层证据

原始 rollout 轨迹包含数百万 token，散布在消息中。AHE 使用 Agent Debugger 框架将轨迹探索构建为可导航的、基于文件的环境：

- **Per-task analysis**: 每个任务的分析报告，包含根因和通过/失败状态
- **Benchmark-level overview**: 从所有报告聚合的单一文档，作为每轮迭代的入口点
- **原始轨迹**: 以原始形式和轻量处理后形式提供，支持*渐进式披露*

### 2.3 决策可观测性：Evolve Agent 证据驱动编辑

Evolve Agent 闭合 AHE 循环。每轮它读取 Agent Debugger 产生的分层证据语料库，决定添加、修改或删除哪些 harness 组件，并记录每次编辑背后的推理。

**两个约束实现决策可观测性**：

1. **可控性**: Evolve Agent 只在 harness workspace 内写入，runs 目录、tracer、verifier 和 LLM 配置均为只读
2. **证据驱动**: 每次更改附带 manifest 条目，命名失败证据、推断的根因、针对性修复和预测影响（预期修复和有风险的任务）

> "Each edit becomes falsifiable by the next evaluation, which replaces rationale-driven self-justification with a measurable contract between rounds."
> 
> —— 原文第 3.3 节

---

## 3. 实验结果

### 3.1 主结果：Terminal-Bench 2

![AHE 在 Terminal-Bench 2 上的表现](/assets/agentic-harness-engineering/_page_1_Figure_0.jpeg)
*图：AHE 在 Terminal-Bench 2 上超越所有人工设计和自进化基线（来源：原文 Figure 1）*

| 方法 | All (89) | Easy (4) | Medium (55) | Hard (30) |
|------|----------|----------|-------------|-----------|
| **人工设计 Harness** |||||
| opencode | 47.2% | 75.0% | 52.7% | 33.3% |
| terminus-2 | 62.9% | 75.0% | 74.5% | 40.0% |
| Codex | 71.9% | 75.0% | 80.0% | 56.7% |
| **从 NexAU⁰ 自进化** |||||
| NexAU⁰ (种子) | 69.7% | 87.5% | 78.2% | 51.7% |
| ACE | 68.9% | 91.7% | 78.2% | 48.9% |
| TF-GRPO | 72.3% | 100.0% | 79.4% | 55.6% |
| **AHE** | **77.0%** | **100.0%** | **88.2%** | 53.3% |

AHE 超越所有基线，将 pass@1 从 69.7% 提升至 **77.0%**。

**关键发现**：仅编辑系统提示的自进化方法（ACE、TF-GRPO）错过了承载 AHE 增益的组件。AHE 联合进化系统提示、工具、中间件和长期记忆，而 ACE 和 TF-GRPO 从不编辑的 harness 组件正是增益所在。

### 3.2 跨基准迁移：SWE-bench-verified

| Repo | N | ACE | TF-GRPO | NexAU⁰ | **AHE** |
|------|---|-----|---------|--------|---------|
| All | 500 | 74.6% | 74.2% | 75.2% | **75.6%** |
| django | 231 | 79.2% | 78.8% | 79.2% | **81.0%** |
| sympy | 75 | 69.3% | 68.0% | 70.7% | **70.7%** |
| sphinx-doc | 44 | 61.4% | 65.9% | 68.2% | **70.5%** |
| matplotlib | 34 | 70.6% | 70.6% | 73.5% | **73.5%** |

AHE 实现最高总体成功率，同时 token 消耗比种子少 **12%**，比 ACE 少 **32%**。

### 3.3 跨模型迁移

![跨模型迁移结果](/assets/agentic-harness-engineering/_page_7_Figure_0.jpeg)
*图：AHE harness 在五个替代基模型上的迁移效果（来源：原文 Figure 3）*

AHE 在跨家族模型上获得更大增益：
- DeepSeek-V4-Flash: **+10.1 pp** (51.7% → 61.8%)
- Qwen-3.6-Plus: **+6.3 pp** (56.2% → 62.5%)
- Gemini-3.1-Flash-Lite: **+5.1 pp** (36.5% → 41.6%)

**解读**：离饱和点更远的基础模型更依赖 AHE 固定在工具、中间件和长期记忆中的协调模式，而更强的模型能以低边际成本从提示中重新推导相同协调。

### 3.4 组件级消融

| 变体 | All | Easy | Medium | Hard |
|------|-----|------|--------|------|
| NexAU⁰ | 69.7% | 87.5% | 78.2% | 51.7% |
| + memory only | 75.3% | 50.0% | 83.6% | **63.3%** |
| + tool only | 73.0% | 75.0% | 87.3% | 46.7% |
| + middleware only | 71.9% | **100.0%** | 81.8% | 50.0% |
| + system_prompt only | 67.4% | 75.0% | 78.2% | 46.7% |
| **AHE full** | **77.0%** | **100.0%** | **88.2%** | 53.3% |

**关键发现**：
- 三个正交组件（memory、tool、middleware）各自独立承载改进
- 仅系统提示反而导致 -2.3 pp 的回归
- 组件非加性交互：三个正交增益之和为 +11.1 pp，而完整 AHE 为 +7.3 pp

### 3.5 自归因分析

![自归因精度与召回率](/assets/agentic-harness-engineering/_page_8_Figure_0.jpeg)
*图：Evolve Agent 自预测在 9 轮评估中的平均精度与召回率（来源：原文 Figure 4）*

- **修复预测**: 精度 33.7%，召回 51.4% —— 约 5 倍于随机基线
- **回归预测**: 精度 11.8%，召回 11.1% —— 仅约 2 倍于随机基线

**解读**：智能体能够解释为什么编辑应该有帮助，但无法可靠地命名同一编辑即将破坏的任务。

---

## 4. 案例研究：从失败到修复的轨迹

论文通过四个典型轨迹展示 AHE 如何工作：

### 轨迹 1: db-wal-recovery
迭代 2 的 8 条新规则中的 4 条在此任务上生效，将 SQLite WAL 恢复任务从 1/2 提升至 2/2。关键规则包括：
- **Contract first**: 测试和验证脚本是真相来源，而非 shell 历史
- **Generalize, do not overfit**: 5 行样本不足以推断缺失的 6 行
- **Mirror the evaluator**: 运行最终状态接受扫描，相信失败的检查而非理论

### 轨迹 3: mcmc-sampling-stan
迭代 6 的两项互补更改共同翻转此任务：
1. **Publish-state guard** (工具级): 将验证通过的脚本入口点标记为受保护
2. **ExecutionRiskHintsMiddleware** (中间件级): 检测七种跨步风险模式并注入提醒

### 轨迹 4: configure-git-webserver
迭代 8 的两项补丁关闭迭代 6-7 的 loophole：
1. **Hard blocks**: 删除受保护输出和重置受保护根目录现在为硬阻断
2. **FRAMEWORK reminders**: 将执行风险提示提升为下一模型回合可见的提醒

---

## 5. 优点与局限

### 优点
- **自动化 harness 进化**: 无需人工干预即可持续改进编码智能体框架
- **可迁移性**: 冻结的 harness 可跨基准和模型家族迁移
- **可审计性**: 每次编辑都有可验证的预测和归因
- **组件解耦**: 失败模式清晰映射到单一组件类

### 局限
- **评估局限**: 主要在 Terminal-Bench 2 上评估，泛化到其他环境需进一步验证
- **过拟合风险**: 多组件编辑增加了基准特定调优的机会
- **回归预测弱**: 智能体难以预测编辑可能导致的回归
- **计算开销**: 每轮迭代需要基准执行、轨迹分析和 workspace 管理

---

## 6. 总结

AHE 将 harness 编辑转化为可证伪的、文件级契约，通过三大可观测性支柱实现：解耦的组件基板、分层的轨迹蒸馏管道、以及自声明预测由下一轮任务增量验证的变更 manifest。

这项工作的方法论意义在于：如果 harness 编辑可以跨任务累积、检查和迁移，那么编码智能体可以将经验外化为显式工件，而非仅依赖隐藏参数更新。这使得测试时学习更可审计、更易于科学研究。

---

## 参考文献

1. Lin, J., Liu, S., Pan, C., et al. (2026). Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses. arXiv:2604.25850.
2. Zhang, Q., et al. (2025). Agentic Context Engineering: Evolving Contexts for Self-Improving Language Models. ICLR 2025.
3. Cai, Y., et al. (2025). Training-Free Group Relative Policy Optimization. arXiv:2510.08191.
4. Merrill, M.A., et al. (2026). Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces. arXiv:2601.11868.
5. Jimenez, C.E., et al. (2023). SWE-bench: Can Language Models Resolve Real-world GitHub Issues? ICLR 2024.

---

*本文基于 arXiv:2604.25850 自动生成，图片来源于论文原文。*
