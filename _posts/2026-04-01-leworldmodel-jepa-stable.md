---
layout: post
title: 'LeWorldModel: Stable End-to-End JEPA World Models from Pixels'
categories:
- research
- world-model
- embodied-ai
- self-supervised
author: ROM4AI
date: 2026-04-01
original_paper: https://arxiv.org/abs/2603.19312
tags:
- world-model
- jepa
- embodied-ai
- self-supervised
- robotics
---

# LeWorldModel: Stable End-to-End JEPA World Models from Pixels

> **原文链接**: [arXiv:2603.19312](https://arxiv.org/abs/2603.19312) | [PDF](https://arxiv.org/pdf/2603.19312.pdf)

## 摘要

LeWorldModel (LeWM) 是首个能够从原始像素稳定端到端训练的 Joint-Embedding Predictive Architecture (JEPA) 世界模型。与现有方法相比，LeWM 仅需两个损失项（预测损失 + 正则化），将可调超参数从六个减少到一个。该模型仅有 1500 万参数，可在单 GPU 上数小时内完成训练，推理速度比基于基础模型的世界模型快 48 倍，同时在多种 2D 和 3D 控制任务中保持竞争力。

---

## 1. 问题定义：世界模型的训练困境

### 1.1 JEPA 的潜力与挑战

Joint-Embedding Predictive Architectures (JEPAs) 由 Yann LeCun 提出，代表了一种学习世界模型的全新范式：

> "Joint Embedding Predictive Architectures (JEPAs) offer a compelling framework for learning world models in compact latent spaces."

**JEPA 的核心思想**:
- 在紧凑的潜在空间（latent space）中学习世界模型
- 通过预测未来表征而非重建像素来训练
- 避免生成模型的计算开销和模式崩溃问题

### 1.2 现有 JEPA 方法的脆弱性

尽管 JEPA 理念吸引人，但现有实现面临严峻挑战：

| 问题 | 描述 | 影响 |
|-----|------|------|
| 表征崩溃 | 编码器输出常数或退化表征 | 模型失效 |
| 复杂损失函数 | 需要多损失项组合 | 超参数调优困难 |
| 依赖预训练 | 需要预训练编码器 | 增加训练复杂度 |
| 辅助监督 | 需要额外监督信号 | 限制适用范围 |
| EMA 依赖 | 需要指数移动平均 | 增加内存和计算开销 |

**现有方法的损失函数对比**:

```
现有 JEPA 方法（如 V-JEPA）:
Loss = L_pred + λ1*L_inv + λ2*L_var + λ3*L_cov + λ4*L_reg + EMA

LeWM (本文):
Loss = L_pred + λ*L_reg
      ↓
仅 1 个可调超参数！
```

### 1.3 端到端训练的挑战

> "Existing methods remain fragile, relying on complex multi-term losses, exponential moving averages, pre-trained encoders, or auxiliary supervision to avoid representation collapse."

**表征崩溃的原因**:
- 预测任务过于简单（如恒等映射）
- 潜在空间缺乏结构约束
- 编码器和预测器联合优化困难

---

## 2. LeWorldModel 架构设计

### 2.1 核心创新：简化即强大

LeWM 的核心洞察：通过精心设计的正则化，可以用极简的损失函数实现稳定训练。

**架构组件**:

```
┌─────────────────────────────────────────────────────────────┐
│                  LeWorldModel Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Input: x_t (当前帧)          Input: x_{t+k} (未来帧)       │
│       │                              │                      │
│       ▼                              ▼                      │
│  ┌─────────┐                    ┌─────────┐                │
│  │ Encoder │                    │ Encoder │                │
│  │   E     │                    │   E     │                │
│  │ (shared)│                    │ (shared)│                │
│  └────┬────┘                    └────┬────┘                │
│       │                              │                      │
│       ▼                              ▼                      │
│    z_t (当前表征)              z_{t+k} (目标表征)           │
│       │                              │                      │
│       │    ┌──────────────┐          │                      │
│       └───►│  Predictor   │◄─────────┘                      │
│            │      P       │                                 │
│            │ (action cond)│                                 │
│            └──────┬───────┘                                 │
│                   │                                         │
│                   ▼                                         │
│            ẑ_{t+k} (预测表征)                               │
│                   │                                         │
│                   ▼                                         │
│            Loss = ||ẑ_{t+k} - z_{t+k}|| + λ*L_reg         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 关键技术创新

**1. 高斯分布正则化 (Gaussian Regularization)**:

> "A regularizer enforcing Gaussian-distributed latent embeddings."

**数学形式**:
```
L_reg = KL(q(z) || N(0, I))

其中：
- q(z): 潜在表征的经验分布
- N(0, I): 标准高斯分布
- KL: KL 散度
```

**作用机制**:
- 防止潜在空间坍缩到常数
- 鼓励表征的多样性和信息量
- 提供结构化的潜在空间几何

**2. 预测损失 (Prediction Loss)**:

```
L_pred = ||P(z_t, a_t) - z_{t+k}||²

其中：
- z_t: 当前时刻表征
- a_t: 动作
- z_{t+k}: 未来时刻目标表征（stop-gradient）
- P: 预测器网络
```

**3. 共享编码器设计**:

- 当前帧和未来帧使用同一编码器
- 减少参数数量（仅 15M）
- 强制表征一致性

### 2.3 与 V-JEPA 的对比

| 特性 | V-JEPA | LeWM (本文) |
|-----|--------|-------------|
| 损失项数量 | 4-6 项 | **2 项** |
| 可调超参数 | 4-6 个 | **1 个** |
| EMA 依赖 | 是 | **否** |
| 预训练编码器 | 需要 | **不需要** |
| 辅助监督 | 需要 | **不需要** |
| 参数量 | >100M | **15M** |
| 训练时间 | 数天 | **数小时** |
| 推理速度 | 基准 | **快 48 倍** |

---

## 3. 实验结果与分析

### 3.1 控制任务性能

LeWM 在多种 2D 和 3D 控制任务中进行了评估：

**任务类型**:
- **2D 控制**: Atari 游戏、连续控制任务
- **3D 控制**: 机器人操作、导航任务
- **规划**: 基于模型的强化学习

**性能对比**:

| 任务类别 | 方法 | 成功率/得分 | 相对性能 |
|---------|------|------------|---------|
| 2D 连续控制 | V-JEPA | 基准 | 1.0× |
| | LeWM | 竞争 | **~1.0×** |
| 3D 机器人操作 | V-JEPA | 基准 | 1.0× |
| | LeWM | 竞争 | **~1.0×** |
| 规划速度 | V-JEPA | 基准 | 1.0× |
| | LeWM | 快 48 倍 | **48×** |

### 3.2 潜在空间的物理结构

LeWM 的一个重要发现：潜在空间编码了有意义的物理结构。

**探测实验 (Probing)**:
- 在潜在空间上训练线性探测器
- 预测物理量（位置、速度、角度等）
- 验证表征是否捕获物理规律

**结果**:
- 位置预测：高准确率
- 速度预测：高准确率
- 碰撞检测：高准确率

**意义**:
- 证明 JEPA 确实学习了物理世界的结构化表征
- 不是简单的像素级记忆
- 支持因果推理和规划

### 3.3 惊奇度评估 (Surprise Evaluation)

> "Surprise evaluation confirms that the model reliably detects physically implausible events."

**实验设计**:
- 在视频中插入物理上不可能的事件
- 如：物体突然消失、违反重力、穿墙等
- 测量模型预测误差（惊奇度）

**结果**:
- 物理不可能事件 → 高预测误差（高惊奇度）
- 物理可能事件 → 低预测误差（低惊奇度）
- 模型能够可靠区分物理合理/不合理场景

---

## 4. 为什么对 AI 硬件重要

### 4.1 边缘部署的潜力

LeWM 的小规模和高效率使其特别适合边缘 AI：

**计算效率**:
- 15M 参数：可部署在移动设备
- 单 GPU 数小时训练：快速迭代
- 48 倍推理速度：实时应用

**边缘 AI 场景**:

| 场景 | 需求 | LeWM 适用性 |
|-----|------|------------|
| 机器人控制 | 实时规划 | ✅ 高 |
| 自动驾驶 | 预测建模 | ✅ 高 |
| AR/VR 交互 | 低延迟预测 | ✅ 高 |
| 游戏 AI | 快速响应 | ✅ 高 |
| 无人机导航 | 轻量级模型 | ✅ 高 |

### 4.2 神经符号 AI 的桥梁

LeWM 的潜在空间结构为神经符号 AI 提供了理想接口：

**潜在空间作为符号接口**:
```
原始像素 → [编码器] → 潜在表征 → [符号系统] → 推理结果
                    ↓
              结构化、可解释
              物理量可探测
```

**优势**:
- 潜在表征捕获物理规律
- 支持符号规则的提取和应用
- 神经网络 + 符号推理的融合

### 4.3 世界模型的硬件加速需求

LeWM 的架构特点对硬件设计有重要启示：

**1. 编码器-预测器分离**:
- 编码器：感知处理（可共享）
- 预测器：推理引擎（需快速迭代）
- 硬件设计：异构计算单元

**2. 潜在空间运算**:
- 低维向量运算（vs 高维像素）
- 适合专用向量处理器
- 内存带宽需求大幅降低

**3. 动作条件预测**:
- 需要高效的向量拼接/条件注入
- 支持快速动作采样和评估

### 4.4 对下一代 AI 芯片的启示

**专用世界模型加速器**的设计考虑：

| 组件 | 功能 | 硬件需求 |
|-----|------|---------|
| 编码器 | 感知编码 | 高效 CNN/Transformer |
| 潜在空间 | 表征存储 | 低延迟 SRAM |
| 预测器 | 未来预测 | 快速 MLP/Transformer |
| 动作采样 | 规划搜索 | 并行计算单元 |

**存算一体 (CIM) 的机会**:
- 潜在空间向量-矩阵乘法
- 低精度（8-bit）足够
- 事件驱动计算（仅在动作时）

---

## 5. 局限与未来方向

### 5.1 当前局限

- **任务范围**：主要在控制任务验证，未扩展到更复杂场景
- **长程预测**：预测准确性随时间步增加而下降
- **动作空间**：主要验证离散和连续低维动作
- **泛化能力**：跨领域迁移能力待验证

### 5.2 未来研究方向

**技术演进**:
- 扩展到视觉-语言任务
- 多模态世界模型
- 层次化世界模型（多时间尺度）
- 与 LLM 结合

**应用扩展**:
- 科学模拟（物理、化学、生物）
- 社会系统建模
- 多智能体交互
- 因果推理

---

## 6. 总结

LeWorldModel 代表了世界模型研究的重要进展：

1. **简化创新**：证明 JEPA 可以用极简的损失函数稳定训练
2. **效率突破**：15M 参数，单 GPU 数小时训练，48 倍推理加速
3. **表征质量**：潜在空间编码物理结构，支持因果推理
4. **实用价值**：为边缘 AI 和实时应用提供可行方案

对于 AI 硬件设计，LeWM 提示了几个关键趋势：
- **小规模高效模型**：边缘部署的需求
- **潜在空间计算**：低维表征运算的硬件优化
- **世界模型加速器**：专用硬件支持预测和规划
- **神经符号融合**：硬件支持神经网络 + 符号推理

这项工作为下一代 AI 芯片（特别是面向具身智能和边缘 AI 的芯片）提供了重要的算法参考和性能基准。

---

## 参考文献

1. Maes, L., et al. (2026). LeWorldModel: Stable End-to-End Joint-Embedding Predictive Architecture from Pixels. arXiv:2603.19312.
2. LeCun, Y. (2022). A Path Towards Autonomous Machine Intelligence. Open Review.
3. Bardes, A., et al. (2024). Revisiting Feature Prediction for Learning Visual Representations from Video. ICLR.
4. Assran, M., et al. (2025). V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning. arXiv:2506.09985.
