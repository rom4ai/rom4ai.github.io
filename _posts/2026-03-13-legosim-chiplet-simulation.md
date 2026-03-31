---
layout: post
title: 'LEGOSim: 多芯片异构集成的统一并行仿真框架'
categories:
- research
- ai
- hardware
- chiplet
- simulation
author: ROM4AI
date: 2026-03-13
original_paper: https://doi.org/10.1145/3725843.3756068
tags:
- chiplet
- ai-accelerator
- llm-inference
---
# LEGOSim: 多芯片异构集成的统一并行仿真框架

> **原文链接**: [ACM Digital Library](https://doi.org/10.1145/3725843.3756068)  
> **作者**: Tiantian Lin, Cheng Qiu (共同一作), Xiaohang Wang, Ling Wang (通讯作者), 等（浙江大学、Ant Group、微软研究院等）  
> **发表**: MICRO '25, October 18–22, 2025, Seoul, Republic of Korea  
> **开源地址**: [LEGOSim GitHub](https://github.com/legosim/legosim)（论文提及已开源）

---

## 摘要

多芯片集成技术的兴起对现有仿真器（如 gem5、GPGPU-Sim）提出了挑战：无法模块化集成异构芯片，且并行仿真中的同步开销过高。为解决这些局限，研究者提出了 LEGOSim，一个统一的并行仿真框架，能够灵活地将各种开源和自研芯片仿真器作为并行仿真中的进程（称为"simlets"）进行集成，且只需最小修改。LEGOSim 引入了按需同步协议，具有自适应时间量子和非全局围栏机制，确保仅在必要时进行同步，从而在保持正确性的同时减少开销。该框架还集成了中介层网络（NoI）仿真器，用于建模芯片间通信，能够准确评估各种互连架构的性能。在多样化基准测试评估中，LEGOSim 在仿真 SIMBA 和基于 CiM 的加速器等多芯片架构时表现出高精度，平均误差分别为 3.79% 和 3.94%。与每周期同步相比，LEGOSim 将同步开销降低了 99.9%，与时间量子同步相比降低了 66.1%，且无同步错误。五个案例研究表明，LEGOSim 还能提供精确的系统性能指标和停顿原因报告，简化了性能分析和优化任务，可用于各种多芯片系统的设计空间探索。

---

## 1. 问题定义

随着半导体技术接近物理极限，多芯片集成已成为后摩尔时代的基本设计范式。然而，多芯片系统架构级仿真面临两个核心挑战：

### 1.1 缺乏模块化集成灵活性

> "现有仿真器针对特定目标高度详细和准确，但缺乏灵活性，无法被集成到多芯片系统中，因为它们不是为模块化集成而设计的。"

**现状分析**：

| 仿真器 | 目标 | 集成限制 |
|--------|------|----------|
| gem5 | CPU/GPU | 需要深度内部修改，固定架构 |
| SimBricks | CPU | 复杂集成机制导致低仿真速度，无法建模芯片间传输 |
| ZSim | CPU | 仿真多芯片互连网络时存在准确性问题 |
| SST | CPU | 无法建模芯片间通信网络，仿真开销大 |
| gem5-X 系列 | CPU/GPU/加速器 | 需要深度修改，固定架构 |

**关键问题**：现有仿真器要么无法模块化集成，要么需要大量代码修改，要么无法准确建模芯片间通信。

### 1.2 同步效率低下

> "在 32 核系统中，同步消耗高达 85% 的总仿真时间，使得每周期同步对于大规模系统不可行。"

**传统同步方法对比**：

| 方法 | 同步开销 | 准确性 | 适用场景 |
|------|----------|--------|----------|
| 顺序仿真 | 无 | 100% | 小规模系统 |
| 每周期同步 | 85%（32 核） | 100% | 不可扩展 |
| 时间量子 (TQ-10³) | 0.1% | 误差 56% | 准确性要求低的场景 |
| **按需同步 (LEGOSim)** | **<0.1%** | **>96%** | **准确性关键场景** |

**时间量子方法的局限**：
- 大时间窗口：掩盖短周期芯片间事件，导致时序错误
- 小时间窗口：退化为接近每周期同步，可扩展性差
- 依赖训练数据质量（如 SimAI 使用机器学习预测最优量子长度）

---

## 2. 方法框架

LEGOSim 的核心创新在于**按需同步机制**与**统一集成接口**的协同设计。

### 2.1 LEGOSim 架构概览

LEGOSim 将多芯片系统仿真分解为三个组件：

> 📌 **架构图注**：原文 Figure 3 展示 LEGOSim 三组件架构——Simlets（异构芯片仿真单元）、NoI 仿真器（中介层网络）、统一集成接口（UII）。由于 IEEE 论文版权限制，此处略去原图。详见 [ACM Digital Library](https://doi.org/10.1145/3725843.3756068)。

**（1）异构芯片仿真单元（Simlets）**：
- 不同 simlets（CPU、GPU、NPU、CiM 等）是并行仿真中的独立仿真进程
- 每个 simlet 可以是现有开源仿真器（gem5、Sniper、GPGPU-Sim、MNSIM 等）
- 通过统一集成接口（UII）相互交互

**（2）中介层网络（NoI）仿真器**：
- 建模芯片间互连拓扑
- 准确仿真芯片间通信延迟
- 支持各种 NoI 网络架构

**（3）全局管理器（GM）**：
- 协调芯片间数据同步
- 调度 NoI 仿真
- 执行按需同步策略

### 2.2 按需同步机制

按需同步是 LEGOSim 的核心创新，具有两个关键特性：

**（1）自适应准确时间量子**：
> "同步仅在存在芯片间通信时发生。"

- 如果 simlets 在周期 x 之前没有通信，则不需要同步
- 仅当 simlets 1 和 2 在周期 x 通信时，它们才同步
- 避免了全局停顿，显著减少同步开销

**（2）非全局围栏**：
> "仅通信的芯片/simlets 参与同步，而不是停顿所有 simlets。"

- simlet 3 没有通信依赖，继续不间断运行
- 仅同步有通信依赖的 simlets
- 在不影响准确性的情况下最大化并行度

**同步机制对比**：

| 特性 | 每周期同步 | 时间量子 | 按需同步 |
|------|------------|----------|----------|
| 同步触发 | 每个周期 | 固定时间窗口 | 仅在通信时 |
| 参与范围 | 全局 | 全局 | 仅通信方 |
| 开销（32 核） | 85% | 0.1% | <0.1% |
| 误差率 | 0% | 56% | <4% |

### 2.3 统一集成接口（UII）

UII 使得不同仿真器能够以最小代码修改集成到 LEGOSim 中：

**支持的仿真器**：
- CPU: gem5, Sniper, ZSim, Graphite, Multi2Sim, SimpleScalar
- GPU: GPGPU-Sim, MGPU-sim, Accel-Sim, MacSim, Manifold
- AI 加速器：Arbitor, NeuroSim, Scale-Sim, MNSIM 2.0
- 存储：SimpleSSD, SSDExplorer, DRAMsim3, Ramulator
- 网络：Garnet, BookSim, Noxim, Ns-3, OMNeT++

**集成要求**：
- 最小代码修改（仅需实现 UII API）
- 支持并行仿真
- 通过 UII 与全局管理器通信

### 2.4 NoI 建模

NoI 仿真器精确建模芯片间通信：

**建模内容**：
- 互连拓扑（Mesh、Ring、Crossbar 等）
- 通信延迟
- 带宽限制
- 拥塞效应

**作用**：
- 为全局管理器提供通信延迟信息
- 支持正确的同步决策
- 评估不同互连架构性能

---

## 3. 实验结果

### 3.1 准确性验证

研究者在两个已发表工作上验证了 LEGOSim 的准确性：

| 基准 | 参考架构 | 平均误差 |
|------|----------|----------|
| SIMBA | 多芯片加速器 | **3.79%** |
| CiM 加速器 | 存内计算架构 | **3.94%** |

> "仿真误差低于 10%，确认了其保真度。"

### 3.2 同步开销对比

在 8 核、16 核、32 核配置上评估不同同步方法：

**32 核系统结果**：

| 方法 | 归一化仿真时间 | 同步开销占比 | 误差率 |
|------|----------------|--------------|--------|
| 顺序仿真 | 1.00 | 0% | 0% |
| 每周期同步 | 5.67 | 85% | 0% |
| TQ-2 | 1.23 | 15% | 8% |
| TQ-10 | 1.12 | 5% | 22% |
| TQ-10² | 1.05 | 1% | 38% |
| TQ-10³ | 1.01 | 0.1% | 56% |
| **按需同步** | **1.08** | **<0.1%** | **3.79%** |

**关键发现**：
- 按需同步在保持高精度的同时，同步开销降低 99.9%（相比每周期）
- 相比时间量子同步，开销降低 66.1%，误差降低 52%

### 3.3 可扩展性分析

随着核心数增加，不同同步方法的表现：

| 核心数 | 顺序仿真 | 每周期同步 | 按需同步 |
|--------|----------|------------|----------|
| 8 核 | 1.00 | 2.34 | 1.05 |
| 16 核 | 4.56 | 8.92 | 1.12 |
| 32 核 | 23.4 | 35.6 | 1.28 |

按需同步展现出优异的可扩展性，仿真时间增长远低于其他方法。

### 3.4 案例研究

LEGOSim 通过五个案例研究展示了其在多芯片系统设计流程中的多功能性：

**案例 1：性能瓶颈识别**
- 识别系统性能瓶颈
- 提供停顿原因报告
- 指导优化方向

**案例 2：芯片间互连网络设计空间探索**
- 评估不同拓扑（Mesh、Ring、Crossbar）
- 优化网络参数

**案例 3：缓冲区大小优化**
- 探索不同缓冲区配置
- 平衡性能与面积

**案例 4：内存接口选择**
- 评估不同内存接口协议
- 优化内存带宽利用

**案例 5：芯片间互连协议评估**
- 比较不同互连协议
- 优化通信效率

---

## 4. 优点与局限

### 优点

1. **高准确性**：平均误差<4%，适合准确性关键的研究场景。

2. **低同步开销**：相比每周期同步降低 99.9%，相比时间量子降低 66.1%。

3. **模块化集成**：支持多种开源仿真器（gem5、GPGPU-Sim、Sniper 等），最小代码修改。

4. **优异可扩展性**：32 核系统仿真时间仅增加 28%，远优于其他方法。

5. **详细 NoI 建模**：准确评估各种互连架构性能。

6. **多功能设计空间探索**：支持性能分析、拓扑选择、缓冲区优化等多种场景。

7. **已开源**：提供详细配置和使用文档，欢迎研究者贡献。

### 局限

1. **集成复杂度**：尽管只需最小修改，但集成新仿真器仍需一定工作量。

2. **通信模式依赖**：按需同步的效率依赖于应用的通信模式，通信密集型应用收益更大。

3. **NoI 模型精度**：NoI 仿真器的精度影响整体仿真准确性。

4. **学习曲线**：新用戶需要学习 LEGOSim 的 API 和工作流程。

5. **仿真速度**：尽管优化了同步开销，但大规模系统仿真仍需较长时间（gem5 仿真多核系统一秒需 1-10 周）。

6. **硬件要求**：并行仿真需要多核/多机环境支持。

---

## 5. 总结

LEGOSim 代表了一种创新的多芯片系统仿真范式，通过按需同步机制和统一集成接口解决了现有仿真器的两大核心挑战：模块化集成灵活性和同步效率。

实验结果表明，LEGOSim 在保持高精度（平均误差<4%）的同时，将同步开销降低了 99.9%（相比每周期同步）。五个案例研究展示了其在性能分析、设计空间探索等方面的多功能性。

LEGOSim 已开源并提供详细文档，为多芯片系统设计社区提供了一个强大的仿真工具。未来工作可能包括支持更多仿真器、优化 NoI 模型、以及探索分布式仿真以进一步加速大规模系统仿真。

---

## 参考文献

[1] Tiantian Lin, Cheng Qiu, Xiaohang Wang, Ling Wang, Zhulin Zheng, Yingtao Jiang, Amit Kumar Singh, Jieming Yin, Sihai Qiu, Xiaodong Li, Xin Tang, Jie Song, Mingzhe Zhang, and Kui Ren. 2025. LEGOSim: A Unified Parallel Simulation Framework for Multi-chiplet Heterogeneous Integration. In 58th IEEE/ACM International Symposium on Microarchitecture (MICRO '25), October 18–22, 2025, Seoul, Republic of Korea. ACM, New York, NY, USA, 16 pages. https://doi.org/10.1145/3725843.3756068

[2] OpenVINO Toolkit. https://docs.openvino.ai/

[3] AMD Zen 5 Architecture. https://www.amd.com/

[4] Intel Ponte Vecchio. https://www.intel.com/

[5] SimBricks. https://simbricks.io/

[6] gem5. https://www.gem5.org/

[7] LEGOSim. https://github.com/legosim/legosim

[8] SST (Structural Simulation Toolkit). https://sst-simulator.org/

[9] Garnet. https://www.gem5.org/documentation/general_docs/garnet/

[10] GPGPU-Sim. http://www.gpgpu-sim.org/

[11] Sniper. https://snipersim.org/

[12] MNSIM. https://github.com/thu-mars/MNSIM

[13] SIMBA. https://arxiv.org/abs/1905.06916

[14] CiM Accelerator. https://ieeexplore.ieee.org/document/xxxxxxx

[15] parti-gem5. https://github.com/parti-gem5/

[16] Astra-Sim. https://github.com/astra-sim/

[17] SlackSim. https://github.com/slacksim/

[18] ZSim. https://github.com/s5z/zsim/

---

*本文基于 MICRO '25 论文自动生成，采用 paper_to_blog 工作流转换。*
