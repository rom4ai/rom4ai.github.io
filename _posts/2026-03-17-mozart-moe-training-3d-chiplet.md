---
layout: post
title: 'Mozart: Modularized and Efficient MoE Training on 3.5D Wafer-Scale Chiplet
  Architectures'
categories:
- research
- ai
- ml
- systems
author: ROM4AI
date: 2026-03-17
original_paper: https://arxiv.org/abs/2603.07006
tags:
- edge-ai
- transformer
- llm-inference
- ai-accelerator
- training
---
# Mozart: Modularized and Efficient MoE Training on 3.5D Wafer-Scale Chiplet Architectures

> **原文链接**: [arXiv:2603.07006](https://arxiv.org/abs/2603.07006) | [PDF](https://arxiv.org/pdf/2603.07006.pdf)

## 摘要

Mixture-of-Experts (MoE) 架构通过模块化计算为大语言模型 (LLMs) 提供了更高的效率，但其固有的稀疏性带来了显著的硬件部署挑战，包括内存局部性问题、通信开销和计算资源利用效率低下。受人类大脑模块化组织的启发，作者提出了 **Mozart**——一个专为 3.5D 晶圆级 Chiplet 架构上高效训练 MoE 大模型设计的新型算法 - 硬件协同设计框架。在算法侧，Mozart 利用 Chiplet 的固有模块化特性，引入了专家分配策略和细粒度调度机制；在架构侧，Mozart 自适应地在专用 Chiplet 上协同放置异构模块，采用 2.5D NoP-Tree 拓扑和分层内存结构。在三个主流 MoE 模型上的评估显示了显著的效率提升。

## 1. 问题定义

> "Mixture-of-Experts (MoEs) 的规模和异构性对传统硬件平台（如 GPU 或 CPU）提出了重大挑战，包括光刻掩模限制的可扩展性、晶体管缩放极限、糟糕的内存局部性、高模块间通信开销，以及由于动态和不均匀的计算工作负载导致的资源利用效率低下。"

随着大语言模型规模的不断增长，MoE 架构通过动态激活专门的子网络来处理输入，实现了模型容量的扩展而不会按比例增加计算成本。然而，这种稀疏性和模块化特性在传统硬件上面临以下核心问题：

- **内存局部性差**：专家参数分散存储，导致频繁的片外内存访问
- **通信开销高**：All-to-All 通信需要同步所有并行单元，受通信带宽限制
- **资源利用效率低**：动态和不均匀的计算工作负载导致硬件资源浪费
- **可扩展性受限**：传统单片集成受光刻掩模尺寸和晶体管缩放极限限制

2.5D/3.5D 异构 Chiplet 架构因其可扩展性和模块化而受到关注，但现有工作主要关注稠密均匀计算，忽略了 MoE 的细粒度模块化特性，导致过多的片间通信和低效的资源利用。

## 2. 方法框架

![Mozart 算法 - 硬件协同设计架构图](/assets/mozart/architecture-overview.png)
*图：Mozart 算法 - 硬件协同设计框架（来源：原文 Figure 2）*

Mozart 通过算法 - 硬件协同设计来解决 MoE 大模型在 Chiplet 系统上后训练过程的关键瓶颈。

### 2.1 算法侧优化

**专家聚类与分配（Expert Clustering and Allocation）**：首先对指令微调数据集进行 profiling，使用预训练模型获取专家协作模式先验。然后通过以下两步优化专家布局：

> "我们将单个专家聚类为专家 -Chiplet 分配的候选，旨在增强簇内协作同时最小化簇间协作。"

- **Stage-1 专家聚类**：受点云学习中最远点采样算法启发，将频繁共激活的专家聚类到同一簇中
- **Stage-2 专家簇分配**：将簇 -Chiplet 分配形式化为二元整数规划问题，优化目标是最小化工作负载分布的不平衡度

**细粒度调度（Fine-grained Scheduling）**：通过流式传输 token 和专家来重叠 DRAM 通信开销与片上计算：

- **流式专家**：根据 profiling 的工作负载分布，优先加载计算工作负载更重的专家簇
- **流式 Token**：将全局 token 批次划分为微批次，实现 DRAM 通信（保存激活值）与片上计算的重叠

### 2.2 硬件侧设计

**3.5D 晶圆级 Chiplet 架构**具有以下关键特性：

> "我们提出了一种 3.5D 晶圆级 Chiplet 架构，采用 2.5D NoP-Tree 互连和分层内存结构，支持低延迟片上激活重用、通信感知专家聚类和针对稀疏 MoE 计算定制的通信 - 计算交错执行。"

- **2.5D NoP-Tree 拓扑**：将注意力 Chiplet 组织为中央调度器，专家 Chiplet 作为叶节点，交换机支持网络内 MoE 聚合
- **分层内存结构**：模型权重存储在分布式 DRAM 中，激活值缓存在本地 SRAM 中
- **3D 逻辑 - 内存堆叠**：每个计算 Chiplet 通过混合键合垂直堆叠计算芯片和 SRAM 芯片，实现快速本地访问

## 3. 核心模块

### 3.1 专家协作优化 All-to-All 通信

All-to-All 通信是专家并行中的关键瓶颈。Mozart 通过优化专家布局来增加共激活专家在同一 Chiplet 上的概率，从而减少通信数据量。

> "通过优化专家布局以增加这种共定位的可能性，CT（每个 token 的平均复制次数）可以进一步最小化，从而降低 all-to-all 通信的开销。"

在标准专家并行框架中，CT = k（top-k 路由）。Mozart 通过专家聚类策略，将频繁共激活的专家放在同一 Chiplet 上，使得某些 token 只需要一个副本，从而减少 CT。

### 3.2 细粒度调度流水线

![细粒度调度流水线](/assets/mozart/scheduling-pipeline.png)
*图：前向传播中的细粒度调度流水线（来源：原文 Figure 4）*

Mozart 的细粒度调度主要在两个方面重叠通信和计算：

1. **加载高激活簇 & 注意力计算**：在注意力模块计算时，并行加载高激活专家簇
2. **加载低激活簇 & 高激活簇计算**：在高激活簇计算时，并行加载低激活簇

这种调度策略有效隐藏了 DRAM 通信延迟，提高了训练吞吐量。

### 3.3 3.5D Chiplet 物理架构

![3.5D Chiplet 架构图](/assets/mozart/chiplet-architecture.png)
*图：Mozart 的 3.5D Chiplet 架构（来源：原文 Figure 5）*

- **3D Chiplet 堆叠**：每个计算 Chiplet 集成逻辑芯片和 SRAM 芯片，支持注意力或 MoE-FFN 操作
- **2.5D NoP-Tree 拓扑**：16 个专家簇 Chiplet 分为 4 个交换机连接的组，注意力 Chiplet 位于中心作为调度节点
- **内存层次**：两级内存层次，权重存储在 DRAM，激活值缓存在 SRAM

## 4. 实验设置

实验使用了三个不同规模的 MoE 模型，配置如下表所示：

| 模型 | 总参数量 | 激活参数量 | 路由专家数 | 共享专家数 | 隐藏层维度 | 层数 | 路由策略 |
|------|----------|------------|------------|------------|------------|------|----------|
| Qwen3-30B-A3B | 30.5B | 3.3B | 128 | 0 | 2048 | 48 | top-8 |
| OLMoE-1B-7B-0924 | 6.92B | 1.3B | 64 | 0 | 2048 | 16 | top-8 |
| DeepSeek-MoE-16B | 16.4B | 2.7B | 64 | 2 | 2048 | 28 | top-6 |

**数据集**：Alpaca（52K 样本的指令微调数据集）

**评估指标**：延迟和能耗

**硬件配置**：
- 16 个专家簇 Chiplet + 1 个专用注意力 Chiplet
- 每个 MoE/注意力 Chiplet 有 36-100 个 tile，每个 tile 包含 16 个 systolic arrays
- 6 个 HBM2-based DRAM（4 个共享给专家组，2 个专用于注意力 Chiplet）
- 28nm 工艺，1GHz 时钟频率

## 5. 实验结果

### 5.1 优化技术有效性

下表展示了 Mozart 四种配置的性能对比：

| 优化技术 | Baseline | Mozart-A | Mozart-B | Mozart-C |
|----------|----------|----------|----------|----------|
| 专用专家布局（4.2 节） | ✗ | ✗ | ✗ | ✓ |
| 高效 All-to-All 通信（4.2 节） | ✗ | ✗ | ✓ | ✓ |
| 通信 - 计算重叠（4.3 节） | ✗ | ✓ | ✓ | ✓ |

**加速比结果**：

| 模型 | Baseline | Mozart-A | Mozart-B | Mozart-C |
|------|----------|----------|----------|----------|
| Qwen3-30B-A3B | 1.0× | 1.33× | 1.69× | **1.92×** |
| OLMoE-1B-7B-0924 | 1.0× | 1.58× | 2.05× | **2.37×** |
| DeepSeek-MoE-16B | 1.0× | 1.49× | 1.89× | **2.17×** |

### 5.2 All-to-All 通信复杂度与延迟相关性

| 指标 | Qwen3-30B-A3B | OLMoE-1B-7B-0924 | DeepSeek-MoE-16B |
|------|---------------|------------------|------------------|
| 方法 | Mozart-A / B / C | Mozart-A / B / C | Mozart-A / B / C |
| 归一化延迟 | 0.73 / 0.59 / 0.52 | 0.63 / 0.48 / 0.42 | 0.67 / 0.56 / 0.46 |
| CT（通信复杂度） | 8 / 6.58 / 5.77 | 8 / 6.84 / 5.63 | 6 / 5.56 / 4.32 |

实验结果表明，all-to-all 通信数据量与端到端训练延迟呈正相关。

### 5.3 序列长度和 DRAM 带宽影响

**序列长度影响**：随着序列长度从 128 增加到 512，训练延迟增加。Baseline 设计从 3.88s（长度 128）增加到 7.64s（长度 512），而 Mozart-C 在所有序列长度下都保持最低延迟，在长度 512 时实现 2.34×加速，在长度 128 时实现 1.47×加速。

**DRAM 带宽影响**：使用 HBM2（256GB/s）相比 SSD（15.8GB/s）所有配置都实现了更低的延迟。值得注意的是，Mozart 优化在 HBM2 下的相对加速比更高，因为更快的流式传输允许更好地利用计算 - 通信重叠。

## 6. 优点与局限

### 优点

- **显著的性能提升**：在三个 MoE 模型上实现 1.92×-2.37×的加速比
- **算法 - 硬件协同设计**：充分利用 Chiplet 架构的模块化特性，与 MoE 的逻辑模块化天然互补
- **通信效率优化**：通过专家聚类和细粒度调度，显著减少 all-to-all 通信数据量
- **可扩展性**：3.5D 晶圆级架构支持大规模 MoE 模型的高效部署
- **兼容性强**：与 LoRA、QLoRA 等参数高效微调方法正交兼容

### 局限

- **注意力模块资源受限**：注意力模块分配给单个 Chiplet，可能导致次优延迟，可通过数据或张量并行进一步改进
- **交换机可能成为瓶颈**：在高通信需求下，交换机可能成为性能瓶颈，需要分配更多 Chiplet 面积和带宽
- **内存绑定**：Mozart 是内存绑定而非计算绑定，系统整体延迟受限于顺序的 MoE 权重加载过程
- **硬件升级需求**：权重加载吞吐量无法在当前硬件约束下大幅提升，需要硬件资源升级

## 7. 总结

Mozart 是一个用于在 Chiplet 系统上高效后训练 MoE 大模型的算法 - 硬件协同设计框架。通过联合优化专家分配、细粒度调度和异构 Chiplet 映射，Mozart 在 3.5D 晶圆级架构上显著提高了通信效率和硬件利用率。

> "Mozart 在 3.5D 晶圆级架构上对 Qwen3-30B-A3B-Base 实现了 1.92×的性能提升，对 OLMoE-1B-7B-0924 实现了 2.37×的提升，对 DeepSeek-MoE-16B-Base 实现了 2.17×的提升，展示了其在增强并行化效率和优化大规模模块化 MoE 大模型后训练部署资源利用方面的潜力。"

Mozart 的核心洞察是：通过充分利用 MoE 的专家专业化（expert specialization）和专家协作（expert collaboration）现象，结合 3.5D Chiplet 架构的物理模块化特性，可以实现算法与硬件的完美匹配，从而突破传统硬件在稀疏 MoE 计算上的效率瓶颈。

## 参考文献

1. Luo, S., Ye, H., Li, P., Qin, J., Peng, J., Zhao, Y., Cao, Y., & Chen, T. Mozart: Modularized and Efficient MoE Training on 3.5D Wafer-Scale Chiplet Architectures. arXiv preprint arXiv:2603.07006, 2026.
2. Dai, D., et al. DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models. arXiv preprint arXiv:2401.06066, 2024.
3. Jiang, A. Q., et al. Mixtral of Experts. arXiv preprint arXiv:2401.04088, 2024.
4. Fedus, W., Zoph, B., & Shazeer, N. Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity. Journal of Machine Learning Research, 23(120):1-39, 2022.
5. Gale, T., Narayanan, D., Young, C., & Zaharia, M. MegaBlocks: Efficient Sparse Training with Mixture-of-Experts. Proceedings of Machine Learning and Systems, 5:288-304, 2023.
6. Lepikhin, D., et al. GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding. International Conference on Learning Representations, 2021.
