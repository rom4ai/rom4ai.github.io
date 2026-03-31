---
layout: post
title: 'Synthesis-in-the-Loop Evaluation of LLMs for RTL Generation: Quality, Reliability,
  and Failure Modes'
categories:
- research
- ai
- hardware
author: ROM4AI
date: 2026-03-14
original_paper: https://arxiv.org/abs/2603.11287
tags:
- transformer
- llm-inference
- ai-accelerator
- training
- benchmark
---
# Synthesis-in-the-Loop Evaluation of LLMs for RTL Generation: Quality, Reliability, and Failure Modes

> **原文链接**: [arXiv:2603.11287](https://arxiv.org/abs/2603.11287) | [PDF](https://arxiv.org/pdf/2603.11287.pdf)

## 摘要

这篇论文首次对 32 个语言模型在 RTL 生成任务上进行了全面的合成感知评估。研究者提出了 Hardware Quality Index (HQI) 指标，综合考量综合后的面积、延迟和警告数量，揭示了当前 LLM 在硬件设计自动化方面的能力边界和失败模式。

## 1. 问题定义

RTL 生成与软件代码合成有着本质区别：

> "RTL generation demands more than software code synthesis: designs must be syntactically valid, synthesizable, functionally correct, and hardware-efficient."

现有评估大多停留在功能正确性层面，忽略了可综合性和实现质量的测量。这导致一个关键问题：**一个在仿真中工作的 Verilog 代码，在综合后可能完全无法实现为实际硬件**。

论文要解决的核心问题是：如何系统评估 LLM 生成的 RTL 代码质量，不仅看功能正确性，还要看综合后的实际硬件实现质量？

## 2. 方法框架

研究者提出了一个完整的评估框架，包含以下关键组件：

### 2.1 Hardware Quality Index (HQI)

HQI 是一个 0-100 的综合指标，计算公式整合了：
- 综合后面积（area）
- 关键路径延迟（delay）
- 综合警告数量（warning count）

所有指标都相对于专家编写的参考设计进行归一化，在 Nangate45 45nm 工艺库下进行综合评估。

### 2.2 评估数据集

- **VerilogEval**: 包含多种难度的 Verilog 编程任务
- **RTLLM**: 专注于硬件设计任务的基准数据集
- 共 202 个 Verilog 任务，每个任务允许模型尝试 5 次

### 2.3 评估流程

```
LLM 生成 Verilog → 语法检查 → 综合 → 提取 PPA 指标 → 计算 HQI
```

关键创新在于"synthesis-in-the-loop"：每个生成的设计都实际通过综合工具，确保评估结果反映真实硬件实现质量。

## 3. 实验结果

### 3.1 模型性能分层

实验揭示了三个明显的性能层级：

| 性能层级 | 模型数量 | Global HQI 范围 | 代表模型 |
|----------|----------|-----------------|----------|
| 前沿模型 | 13 | > 71 | Gemini-3-Pro (85.1) |
| 中等模型 | 11 | 53-68 | - |
| 落后模型 | 8 | < 53 | - |

### 3.2 顶尖模型表现

| 模型 | 覆盖率 | HQI 得分 |
|------|--------|----------|
| **Gemini-3-Pro** | 87.5% | **85.1** |
| 其他前沿模型 | - | 71-80 |

### 3.3 多次尝试的收益

研究发现"能力 - 部署差距"（capability-to-deployment gap）：

| 策略 | HQI 提升 |
|------|----------|
| Best-of-5 vs Single | +3.8 ~ 22.1 分 |

这表明多采样策略对于生产部署至关重要。

### 3.4 失败模式分析

通过对 195 个真实综合失败案例的分类分析，发现了系统性差异：

| 模型类型 | 失败阶段 | 典型失败模式 |
|----------|----------|--------------|
| 专有模型 | 后期失败 | 细化错误、综合超时 |
| 开源模型 | 早期失败 | 缺少模块封装、不可综合结构 |

> "open-weight models fail early through missing module wrappers and non-synthesizable constructs, consistent with training on simulation-grade rather than synthesis-grade RTL"

这一发现揭示了开源模型训练数据的关键缺陷：它们主要学习的是仿真级 RTL，而非可综合的 RTL。

### 3.5 跨工艺库一致性

在三种不同工艺库下的评估显示排名高度一致：

| 比较 | Spearman ρ |
|------|------------|
| 三工艺库间 | > 0.99 |

这表明评估结果具有很好的鲁棒性。

## 4. 优点与局限

### 优点

1. **首次合成感知评估**：突破了以往仅评估功能正确性的局限
2. **全面的模型覆盖**：评估了 32 个模型，包括前沿和开源模型
3. **HQI 指标创新**：提供了硬件质量的综合度量标准
4. **失败模式洞察**：揭示了不同模型类型的系统性缺陷
5. **实用指导价值**：为 LLM 在 EDA 领域的部署提供了明确方向

### 局限

1. **工艺库限制**：主要在 45nm 工艺下评估，先进工艺下的表现待验证
2. **任务规模**：评估任务相对较小，大型设计的生成能力未充分测试
3. **优化空间**：未探索 prompt 工程和微调对生成质量的提升潜力
4. **时序约束**：评估未充分考虑复杂时序约束下的表现

## 5. 总结

这篇论文为 LLM 在 RTL 生成领域的评估设立了新标准。关键发现包括：

- **Gemini-3-Pro 在 RTL 生成任务上表现最佳**，HQI 达到 85.1
- **开源模型与专有模型存在明显差距**，主要源于训练数据质量
- **多采样策略能显著提升部署效果**，best-of-5 可带来 3.8-22.1 分的 HQI 提升
- **失败模式具有系统性特征**，为模型改进提供了明确方向

对于 AI 硬件设计自动化领域，这项工作的重要性在于：

> 它首次证明了 LLM 生成的 RTL 代码可以通过综合验证，并且质量可以量化评估。这为未来 LLM 在 EDA 工具中的集成应用奠定了基础。

未来的研究方向包括：改进开源模型的训练数据质量、探索专门的 RTL 预训练策略、以及将评估扩展到更大规模和更复杂的设计任务。

## 参考文献

1. Fu, W., Wang, Z., Shao, M., Karri, R., Shafique, M., Knechtel, J., Sinanoglu, O., & Guo, X. Synthesis-in-the-Loop Evaluation of LLMs for RTL Generation: Quality, Reliability, and Failure Modes. arXiv preprint arXiv:2603.11287, 2026.

2. VerilogEval: Evaluating Large Language Models for Verilog Generation. arXiv:2309.07157, 2023.

3. RTLLM: A Benchmark for Large Language Models in RTL Generation. arXiv:2402.16847, 2024.
