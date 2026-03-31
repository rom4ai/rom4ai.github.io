---
layout: post
title: 'PointWorld: Scaling 3D World Models for In-The-Wild Robotic Manipulation'
categories:
- research
- ai
- robotics
- 3d-vision
author: ROM4AI
date: 2026-03-16
original_paper: https://arxiv.org/abs/2601.03782
tags:
- transformer
- multi-modal
- llm-inference
- robotics
- world-model
---
# PointWorld: Scaling 3D World Models for In-The-Wild Robotic Manipulation

> **原文链接**: [arXiv:2601.03782](https://arxiv.org/abs/2601.03782) | [PDF](https://arxiv.org/pdf/2601.03782.pdf)

## 摘要

PointWorld 是一个大规模预训练的 3D 世界模型，它将状态和动作统一在共享的 3D 点流（3D point flows）表示中。给定一个或少量 RGB-D 图像以及低级别机器人动作命令，PointWorld 能够预测响应这些动作的 3D 逐像素位移。通过在真实和模拟机器人操作数据上预训练（约 2M 轨迹，500 小时），PointWorld 使单个预训练模型能够在无需任何额外演示或后训练的情况下，实现真实世界中的刚体推动、可变形物体和铰接物体操作以及工具使用。

**主要贡献**：
- 提出了 PointWorld，一个大规模预训练的 3D 世界模型，统一状态和动作为 3D 点流
- 构建并开源了一个大规模 3D 交互数据集，包含约 2M 轨迹（500 小时）
- 展示了单个预训练模型使真实机器人能够从单次 in-the-wild RGB-D 捕获执行多样化操作任务

## 1. 问题定义

> "World modeling in unstructured environments is imperative for general-purpose robots: predicting how the world evolves from what the robot sees and intends to do with its body."

通用机器人的核心挑战是**在非结构化环境中进行世界建模**：根据机器人所见和预期动作预测世界如何演变。人类能够"从一瞥和抓握中"预测变形、铰接、稳定性和接触响应，这种能力对机器人操作同样至关重要。

现有方法的局限性：

- **基于物理的模型**：虽然预测准确，但面临 sim-to-real 差距，需要特定环境的建模
- **学习型动力学模型**：通常依赖领域特定的归纳偏置（如完全可观测性、物体性先验或材料规格）
- **大规模视频生成模型**：能生成逼真预测，但缺乏显式动作条件，物理一致性不足

核心目标：**构建一个预测模型，仅从开放世界设置中的感知输入，基于视觉观察和预期动作进行空间接地、动作条件的预测**。

## 2. 方法框架

PointWorld 的核心哲学是**统一以实现扩展**：在 3D 物理空间的同一模态中表示状态和动作。

![PointWorld 概述](/assets/pointworld/pointworld-overview.png)
*图：PointWorld 整体框架（来源：原文 Figure 2）*

### 2.1 状态表示

> "State is represented by a full-scene 3D point cloud built from RGB-D captures"

状态由从 RGB-D 捕获构建的**全场景 3D 点云**表示：
- 从校准的 RGB-D 视图中，通过正向运动学（使用 URDF 和关节配置）掩蔽机器人像素
- 反投影剩余像素获得场景点 `s_t = {(p_t,i, f_i^S)}`，其中 `p_t,i ∈ R^3` 是位置，`f_i^S` 是时间不变特征
- 使用冻结的 DINOv3 编码器通过 2D 投影对场景点进行特征化

### 2.2 动作表示

> "Actions are dense 3D point trajectories instantiated from the agent's own embodiment"

动作表示为**机器人 3D 点流**：
- 给定关节配置序列 `{q_t+k}`，在时间 t 采样机器人表面点一次
- 将每个点附加到对应的连杆，通过正向运动学传播得到有序机器人点集
- 仅从夹持器采样机器人点流（每个夹持器几百个点），提高效率
- 这种表示是**embodiment-agnostic**的，能够从不同机器人构型中学习

### 2.3 动力学预测

采用多步（分块）公式，在单次前向传播中预测未来 H 步的状态：

```
F_θ^H: (s_t, a_t:t+H-1) → s_t+1:t+H
```

其中 H=10 步，每步 0.1 秒。

架构设计：
- 连接初始场景点和时间堆叠的机器人点形成单个点云
- 使用 PointTransformerV3 (PTv3) 作为骨干网络
- 共享 MLP 头预测场景点在块内每步的逐点位移
- **实时推理**：0.1 秒/批次前向传播

### 2.4 训练目标

3D 世界建模面临两个独特挑战：
1. **稀疏训练信号**：机器人通常只操作场景的一小部分，大多数点是静态的
2. **真实世界数据噪声**：需要正则化以提高鲁棒性

解决方案：

**（1）运动加权（Movement Weighting）**
```
m_k,i = σ(κ(δ_k,i - τ))
w_k,i = m_k,i / Σ m_k,i
```
根据真实运动对每个点进行软运动似然加权，聚焦于移动点。

**（2）不确定性正则化（Aleatoric Uncertainty Regularization）**
预测每个点的标量对数方差 `s_k,i`，使用 Huber 损失：

```
L = 1/2 Σ w_k,i [ρ_δ(P̂_t+k,i - P_t+k,i) * e^(-s_k,i) + s_k,i]
```

## 3. 实验结果

### 3.1 骨干网络比较

通过系统比较不同骨干网络，PointTransformerV3 (PTv3) 展现出最佳的可扩展性和效率：

| 骨干网络 | 参数量 | 内存 | FLOPs | 延迟 (ms) | ℓ2 移动 | ℓ2 静态 |
|----------|--------|------|-------|-----------|---------|---------|
| GBND (基线) | 1.00x | 1.00x | 1.00x | 13.46 | 0.0390 | 0.0066 |
| PointNet | 1.03x | 0.34x | 0.04x | 5.93 | 0.0369 | 0.0084 |
| PointNet++ | 1.07x | 0.67x | 0.06x | 327.08 | 0.0368 | 0.0073 |
| SparseConv | 33.31x | 7.18x | 1.32x | 17.70 | 0.0396 | 0.0076 |
| Transformer | 41.06x | 0.31x | 3.38x | 30.43 | 0.0339 | 0.0071 |
| PTv3-50M | 49.14x | 0.30x | 0.34x | 59.60 | 0.0331 | 0.0067 |
| PTv3-132M | 127.22x | 0.69x | 1.04x | 69.60 | 0.0324 | 0.0061 |
| PTv3-411M | 398.67x | 1.89x | 1.90x | 102.47 | 0.0315 | 0.0059 |
| **PTv3-1B** | **957.71x** | **4.30x** | **3.57x** | **123.65** | **0.0312** | **0.0056** |

**关键发现**：PTv3 可扩展到 957x 基线参数量，同时保持适度的内存和运行时增长（PTv3-1B ≈ 0.12 秒）。

### 3.2 缩放规律

> "Scaling model size from 50M to 1B parameters yields smooth, log-linear gains"

在数据和模型规模上的扩展都产生近似对数线性的收益，符合视觉和语言建模中的缩放规律观察。

### 3.3 泛化与迁移

在不同域之间的零样本和微调设置下评估泛化能力：

| 设置 | 域内 (D→D) | 域内 (B→B) | 跨域 (D→B) | 跨域 (B→D) | 保持真实 (D→H) | 保持真实 (B→H) | 联合训练 (D+B→H) |
|------|------------|------------|------------|------------|----------------|----------------|------------------|
| ℓ2 移动 ↓ | 0.0315 | 0.0087 | 0.1460 | 0.0558 | 0.0305 | 0.0531 | **0.0300** |
| ℓ2 静态 ↓ | 0.0059 | 0.0010 | 0.0050 | 0.0021 | 0.0058 | 0.0020 | **0.0055** |

**关键发现**：
- 在 DROID 和 BEHAVIOR 联合预训练的模型能够零样本泛化到未见过的真实场景
- 仅使用模拟数据预训练的模型无法零样本泛化
- 微调进一步提高了抓取物体轨迹的准确性

### 3.4 真实世界操作

PointWorld 与基于采样的 MPC 规划器（MPPI）集成，在真实机器人上实现零样本操作：

- **刚体推动**：成功推动各种物体到目标位置
- **可变形物体操作**：处理布料、绳索等柔性物体
- **铰接物体操作**：打开抽屉、门等
- **工具使用**：使用工具完成目标任务

**推理速度**：0.1 秒实时延迟，支持高效采样式 MPC

## 4. 优点与局限

### 优点

- **Embodiment-agnostic**：统一的 3D 点流表示允许从不同机器人构型中学习
- **实时推理**：单次前向传播预测整个动作块，支持高效 MPC
- **零样本泛化**：单个预训练模型能够处理未见过的场景和任务
- **密集监督**：像素级监督信号，编码广泛的机器人操作能力
- **可扩展性**：支持大规模参数扩展（高达 1B 参数）

### 局限

- **部分可观测性**：依赖单视角或少数视角的 RGB-D 输入，可能丢失遮挡区域信息
- **真实世界数据质量**：依赖 3D 标注质量，深度估计和相机姿态误差会影响性能
- **任务指定**：任务相关点需要人工通过 GUI 指定或由 VLM 提供
- **计算资源**：大规模模型训练需要显著的 GPU 资源

## 5. 总结

PointWorld 展示了通过**统一状态和动作为 3D 点流**进行大规模 3D 世界建模的可行性。通过系统性研究骨干网络设计、动作表示、学习目标、部分可观测性、数据混合、域迁移和缩放规律，作者提炼出大规模 3D 动力学学习的设计原则。

关键洞见：
- **现代点云骨干（PTv3）** 对于 3D 世界建模是有效、高效且可扩展的
- **运动加权和不确定性正则化** 对于在真实世界数据上稳定训练至关重要
- **预训练 2D 特征（DINOv3）** 提供关键的物体性先验
- **模型规模扩展** 对于吸收大规模世界建模数据是必要的

PointWorld 为通用机器人的世界建模迈出了重要一步，展示了从单次 in-the-wild 捕获实现多样化操作行为的潜力。

## 参考文献

1. Huang W, Chao Y-W, Mousavian A, Liu M-Y, Fox D, Mo K, Fei-Fei L. PointWorld: Scaling 3D World Models for In-The-Wild Robotic Manipulation. arXiv preprint arXiv:2601.03782, 2026.

2. Ai X, et al. A Survey on World Models for Embodied AI. 2025.

3. Li Y, et al. Learning Physical Dynamics with Graph Neural Networks. NeurIPS, 2023.

4. Welters A, et al. Large-Scale Video Generation for World Modeling. CVPR, 2025.

5. Chen H, et al. Sonata: Scalable 3D Representation Learning. ICCV, 2025.
