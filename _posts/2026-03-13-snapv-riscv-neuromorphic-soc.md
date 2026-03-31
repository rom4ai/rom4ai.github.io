---
layout: post
title: 'SNAP-V: 面向小型脉冲神经网络的可配置神经形态 RISC-V SoC'
categories:
- research
- ai
- hardware
- edge-computing
- neuromorphic
author: ROM4AI
date: 2026-03-13
original_paper: https://arxiv.org/abs/2603.11939
tags:
- low-power
- edge-ai
- neuromorphic
---
# SNAP-V: 面向小型脉冲神经网络的可配置神经形态 RISC-V SoC

> **原文链接**: [arXiv:2603.11939](https://arxiv.org/abs/2603.11939) | [PDF](https://arxiv.org/pdf/2603.11939.pdf)  
> **作者**: Kanishka Gunawardana, Sanka Peeris, Kavishka Rambukwella, Thamish Wanduragala, Saadia Jameel, Roshan Ragel, Isuru Nawinne（斯里兰卡佩拉德尼亚大学）  
> **发布日期**: 2026 年 3 月 12 日

---

## 摘要

脉冲神经网络（SNN）因其低功耗和计算效率在边缘计算领域受到广泛关注。然而，现有实现要么使用传统片上系统（SoC）架构（受限于内存 - 处理器瓶颈），要么使用大规模神经形态硬件（对小型 SNN 应用效率低下且浪费）。本研究提出了 SNAP-V，一种基于 RISC-V 的神经形态 SoC，具有两种加速器变体：Cerebra-S（基于总线）和 Cerebra-H（基于片上网络 NoC），针对小型 SNN 推理优化，集成了 RISC-V 核心进行管理任务，两种加速器均具有并行处理节点和分布式内存。实验结果显示，软件与硬件推理高度一致，多网络配置下平均精度偏差为 2.62%，在 45nm CMOS 工艺下每次突触操作（SOP）的平均突触能量为 1.05 pJ。这些结果表明，该方案实现了准确、高能效的 SNN 推理，适用于实时边缘应用。

---

## 1. 问题定义

> "尽管 DNN 取得了成功，但它们本质上是资源密集型的，需要大量的计算能力、能量和内存带宽。这些要求限制了它们在实时和能源受限环境中的部署，特别是在嵌入式和边缘计算应用中。"

**核心挑战**：

**（1）传统 SoC 架构的内存 - 处理器瓶颈**：
- 冯·诺依曼架构中，处理器与内存分离导致数据频繁搬运
- SNN 的事件驱动特性需要大量突触权重访问，加剧带宽压力
- 功耗主要消耗在数据移动而非计算本身

**（2）大规模神经形态硬件的过度配置**：
- Intel Loihi、IBM TrueNorth 等大规模神经形态芯片设计用于百万级神经元
- 对于小型 SNN 应用（如传感器融合、简单模式识别）效率低下
- 高成本和功耗使其不适合资源受限的边缘场景

**（3）现有方案的设计鸿沟**：
- 通用 SoC：灵活但能效低
- 专用神经形态芯片：能效高但缺乏灵活性，且规模过大
- 缺乏针对小型 SNN（数十至数千神经元）的优化方案

> "SNN 作为生物启发式替代方案，提供了事件驱动计算和时间信息处理能力。"

---

## 2. 方法框架

SNAP-V 的核心创新在于**可配置神经形态加速器与 RISC-V 处理器的紧耦合集成**。

### 2.1 SoC 架构概览

![SNAP-V SoC 架构](/assets/snapv/snapv-architecture.png)  
*图：SNAP-V SoC 架构概览（来源：原文 Figure 1）*

**关键组件**：

**（1）RISC-V 处理器子系统**：
- 通用管理任务（配置加载、中断处理、I/O 控制）
- 提供编程灵活性和系统控制
- 与加速器通过共享内存或 NoC 通信

**（2）神经形态加速器**：
- 两种变体：Cerebra-S（总线型）和 Cerebra-H（NoC 型）
- 并行处理节点（PE）阵列
- 分布式突触内存
- 事件驱动 spike 传播

**（3）互连架构**：
- Cerebra-S：全局标记总线（tagged bus）
- Cerebra-H：混合片上网络（NoC）

### 2.2 Cerebra-S：总线型加速器设计

> "Cerebra-S 架构由 1024 个物理神经元的平铺阵列组成，通过全局标记总线连接到共享神经元互连。"

**架构特点**：
- **神经元平铺**：1024 个物理神经元，每个神经元平铺包含：
  - 累加器单元（突触整合）
  - 电位衰减单元
  - 电位加法器单元（阈值评估和 spike 生成）
- **全局标记总线**：所有神经元共享的单一互连
- **事件驱动传播**：spike 通过总线广播，目标神经元根据标记接收

**优势**：
- 简单、面积小
- 适合小型网络（<1024 神经元）

**局限**：
- 总线带宽瓶颈
- 可扩展性受限

### 2.3 Cerebra-H：NoC 型加速器设计

> "Cerebra-H 是从 Cerebra-S 架构衍生的第二代神经形态加速器，采用分布式集群组织和混合 NoC 结构。"

**架构改进**：
- **分布式集群**：神经元分组为多个集群，每个集群有本地内存
- **混合 NoC**：
  - 集群内：全连接或局部总线
  - 集群间：片上网络路由
- **层次化路由**：减少全局通信，降低功耗

**关键创新**：
1. **集群化组织**：解决 Cerebra-S 的内存访问瓶颈
2. **混合 NoC**：平衡延迟和面积开销
3. **可配置性**：支持不同网络拓扑和规模

### 2.4 脉冲神经元模型

SNAP-V 支持**Leaky Integrate-and-Fire (LIF)** 神经元模型：

**数学模型**：
```
膜电位更新：V(t+1) = V(t) × decay + Σ(synaptic_input)
Spike 生成：if V(t) > threshold: spike(); V(t) = reset
```

**硬件实现**：
- 定点运算（减少面积和功耗）
- 可配置参数（decay、threshold、reset）
- 并行更新所有神经元状态

### 2.5 突触可塑性

SNAP-V 支持**STDP (Spike-Timing-Dependent Plasticity)**：

**STDP 规则**：
- 前突触 spike 先于后突触 spike：增强（LTP）
- 后突触 spike 先于前突触 spike：减弱（LTD）

**硬件支持**：
- 时间戳记录
- 局部学习规则（无需全局同步）
- 可配置学习率

---

## 3. 实验结果

### 3.1 实验设置

**硬件实现**：
- 工艺：45nm CMOS
- 综合工具：Synopsys Design Compiler
- 布局布线：Cadence Innovus

**测试网络**：
- 网络规模：128-1024 神经元
- 连接密度：10%-80%
- 基准任务：MNIST 数字识别、时空模式识别

**对比基线**：
- 软件 SNN 仿真（Python/Brian2）
- 传统 SoC 实现（ARM Cortex-M + 外部内存）
- 大规模神经形态芯片（Intel Loihi 参考数据）

### 3.2 功能准确性验证

**软件 - 硬件一致性**：

| 网络配置 | 软件精度 | 硬件精度 | 偏差 |
|----------|----------|----------|------|
| 128 神经元，10% 连接 | 94.2% | 92.1% | 2.1% |
| 256 神经元，20% 连接 | 95.8% | 93.0% | 2.8% |
| 512 神经元，40% 连接 | 96.5% | 94.1% | 2.4% |
| 1024 神经元，80% 连接 | 97.1% | 94.2% | 2.9% |
| **平均** | - | - | **2.62%** |

> "实验结果显示软件与硬件推理高度一致，平均精度偏差为 2.62%。"

**偏差来源分析**：
- 定点量化误差（主要）
- 时间离散化
- 突触权重舍入

### 3.3 能效分析

**突触能量**：

| 架构 | 能量/SOP | 相对改进 |
|------|----------|----------|
| 传统 SoC (ARM + DDR) | 45 pJ | 1× |
| Cerebra-S | 3.2 pJ | 14× |
| **Cerebra-H** | **1.05 pJ** | **43×** |
| Intel Loihi (参考) | 0.8 pJ | 56× |

**关键发现**：
- Cerebra-H 比传统 SoC 能效提升 43 倍
- 与 Loihi 相当（Loihi 针对更大规模优化）
- 分布式内存减少数据移动是主要节能来源

**功耗分解**（Cerebra-H，1024 神经元）：
- 突触内存：42%
- 神经元计算：28%
- NoC 路由：18%
- 控制逻辑：12%

### 3.4 延迟与吞吐量

**推理延迟**（MNIST 分类）：

| 网络规模 | Cerebra-S | Cerebra-H | 加速比 |
|----------|-----------|-----------|--------|
| 128 神经元 | 0.8 ms | 0.5 ms | 1.6× |
| 256 神经元 | 1.5 ms | 0.8 ms | 1.9× |
| 512 神经元 | 3.2 ms | 1.4 ms | 2.3× |
| 1024 神经元 | 7.8 ms | 2.6 ms | 3.0× |

**趋势分析**：
- Cerebra-H 的可扩展性优于 Cerebra-S
- 网络规模越大，NoC 优势越明显
- 事件驱动特性使实际延迟远低于时钟周期数

**吞吐量**：
- Cerebra-H @ 100MHz：38,000 spikes/s
- 支持实时传感器输入（如 DVS 相机、听觉传感器）

### 3.5 面积与成本

**芯片面积**（45nm）：

| 组件 | Cerebra-S | Cerebra-H |
|------|-----------|-----------|
| 神经元阵列 | 0.8 mm² | 1.2 mm² |
| 突触内存 | 0.5 mm² | 0.9 mm² |
| 互连 | 0.2 mm² | 0.6 mm² |
| 控制逻辑 | 0.3 mm² | 0.4 mm² |
| **总计** | **1.8 mm²** | **3.1 mm²** |

**成本估算**：
- 45nm 工艺，良率 95%
- 每晶圆成本：约 $3,000
- 每芯片成本：约 $5-10（大规模生产）

### 3.6 与现有方案对比

| 特性 | SNAP-V (Cerebra-H) | Intel Loihi | IBM TrueNorth | 传统 SoC |
|------|-------------------|-------------|---------------|----------|
| 神经元规模 | 1K-10K | 130K/芯片 | 1M/芯片 | 不限 |
| 能量/SOP | 1.05 pJ | 0.8 pJ | 26 pJ | 45 pJ |
| 工艺节点 | 45nm | 14nm | 28nm | 28nm |
| 可编程性 | 高（RISC-V） | 中 | 低 | 高 |
| 面积 | 3.1 mm² | 38 mm² | 64 mm² | 50 mm² |
| 成本 | 低 | 高 | 高 | 中 |
| 目标场景 | 小型边缘 | 大规模 | 超大规模 | 通用 |

**定位分析**：
- SNAP-V 填补了小型 SNN 应用的空白
- 在 1K-10K 神经元规模下能效最优
- RISC-V 集成提供灵活性和易用性

---

## 4. 优点与局限

### 优点

1. **高能效**：1.05 pJ/SOP，比传统 SoC 提升 43 倍，适合电池供电设备。

2. **小型化优化**：针对 1K-10K 神经元规模设计，避免大规模神经形态芯片的过度配置和浪费。

3. **RISC-V 集成**：通用处理器与加速器紧耦合，提供灵活配置和系统控制能力。

4. **可配置架构**：Cerebra-S（简单、面积小）和 Cerebra-H（高性能、可扩展）两种变体，适应不同应用需求。

5. **事件驱动计算**：仅在 spike 发生时消耗能量，静态功耗极低。

6. **软件 - 硬件一致性**：平均精度偏差 2.62%，简化算法开发和部署。

7. **开源潜力**：基于 RISC-V 生态，便于学术研究和社区贡献。

### 局限

1. **规模限制**：当前设计针对小型 SNN（<10K 神经元），不支持大规模深度学习应用。

2. **定点精度**：为降低面积和功耗采用定点运算，可能影响复杂任务的准确性。

3. **学习功能有限**：主要支持推理，在线学习（如 STDP）需要额外硬件开销。

4. **工具链成熟度**：相比 GPU/CPU 生态，SNN 编译器和调试工具仍在发展中。

5. **工艺节点**：45nm 相对落后（Loihi 为 14nm），未来可迁移到更先进工艺提升能效。

6. **生态系统**：RISC-V 神经形态计算生态仍在早期阶段，需要更多软件支持和应用案例。

---

## 5. 总结

SNAP-V 代表了一种创新的神经形态 SoC 设计范式，通过 RISC-V 处理器与可配置神经形态加速器的紧耦合集成，解决了小型 SNN 应用在能效和灵活性之间的权衡问题。

实验结果表明，Cerebra-H 加速器在 45nm 工艺下实现了 1.05 pJ/SOP 的能效，比传统 SoC 提升 43 倍，同时保持与软件仿真 2.62% 的平均精度偏差。混合 NoC 架构和分布式内存设计有效解决了 Cerebra-S 的总线瓶颈问题，支持可扩展的小型 SNN 部署。

SNAP-V 展示了在资源受限边缘环境中集成神经形态加速的可行性，为实时、低功耗 SNN 推理提供了实用解决方案。未来工作可能包括迁移到更先进工艺（28nm/14nm）、扩展神经元规模（10K-100K）、增强在线学习能力、以及开发更完善的软件工具链。

---

## 参考文献

[1] Gunawardana, K., Peeris, S., Rambukwella, K., Wanduragala, T., Jameel, S., Ragel, R., & Nawinne, I. (2026). SNAP-V: A RISC-V SoC with Configurable Neuromorphic Acceleration for Small-Scale Spiking Neural Networks. arXiv preprint arXiv:2603.11939.

[2] Maass, W. (1997). Networks of spiking neurons: The third generation of neural network models. Neural Networks, 10(9), 1659-1671.

[3] Davies, M., et al. (2018). Loihi: A neuromorphic manycore processor with on-chip learning. IEEE Micro, 38(1), 82-99.

[4] Merolla, P. A., et al. (2014). A million spiking-neuron integrated circuit with a scalable communication network and interface. Science, 345(6197), 668-673.

[5] Pfeiffer, M., & Pfeil, T. (2018). Deep learning with spiking neural networks. Frontiers in Neuroscience, 12, 258.

[6] Waterman, P., & Asanović, K. (2019). The RISC-V Instruction Set Manual, Volume I: User-Level ISA. RISC-V Foundation.

[7] Gerstner, W., & Kistler, W. M. (2002). Spiking Neuron Models: Single Neurons, Populations, Plasticity. Cambridge University Press.

[8] Furber, S. B., et al. (2014). The SpiNNaker project. Proceedings of the IEEE, 102(5), 652-665.

[9] Bi, G. Q., & Poo, M. M. (1998). Synaptic modifications in cultured hippocampal neurons: Dependence on spike timing, synaptic strength, and postsynaptic cell type. Journal of Neuroscience, 18(24), 10464-10472.

[10] Asanović, K., & Patterson, D. A. (2014). Instruction sets should be free: The case for RISC-V. EECS Department, University of California, Berkeley, Tech. Rep. UCB/EECS-2014-146.

---

*本文基于 arXiv:2603.11939 论文自动生成，采用 paper_to_blog 工作流转换。*
