---
layout: post
title: 'GPU-FPGA 异构系统加速 LLM 推理中的内存处理'
categories:
- research
- ai
- hardware
- llm-inference
author:
- Zifan He
- Rui Ma
- Yizhou Sun
- Jason Cong
date: 2026-04-03
original_paper: https://arxiv.org/abs/2603.29002
tags:
- ai-accelerator
- llm-inference
- edge-ai
- memory-system
- heterogeneous-computing
---

# GPU-FPGA 异构系统加速 LLM 推理中的内存处理

> **原文链接**: [arXiv:2603.29002](https://arxiv.org/abs/2603.29002) | [PDF](https://arxiv.org/pdf/2603.29002.pdf)  
> **作者**: Zifan He, Rui Ma, Yizhou Sun, Jason Cong (UCLA, Microsoft Research Asia)

---

## 摘要

现代大语言模型（LLM）越来越依赖高效的长上下文处理和生成机制，包括稀疏注意力、检索增强生成（RAG）和压缩上下文记忆。本文将这些优化方法统一为一个**四步内存处理流水线**：**准备内存**、**计算相关性**、**检索**和**应用于推理**。通过系统性分析，作者发现内存处理在 LLM 推理中占据了 **22%-97%** 的延迟开销，并且具有强烈的计算异构性。基于这一洞察，作者提出了 GPU-FPGA 异构系统方案，将稀疏、不规则和内存受限的操作卸载到 FPGA，而保留计算密集型操作在 GPU 上执行。在 AMD MI210 GPU 和 Alveo U55C FPGA 上的评估表明，该系统可实现 **1.04-2.2 倍** 的加速和 **1.11-4.7 倍** 的能耗降低。

---

## 1. 问题定义

> "现代 LLM 推理涉及一个内存处理流水线，内存处理占据了 22%-97% 的总延迟。"

### 1.1 长上下文 LLM 推理的挑战

随着 LLM 能力的扩展，模型需要处理越来越长的上下文（从 128K 到 1M tokens）。传统 Transformer 将所有上下文维护为 KV 缓存，导致巨大的硬件成本和运行时开销：

- **存储开销**：1M tokens 的 KV 缓存需要高达 **69 GB** GPU 内存（以 GPU-OSS-120B 模型为例）
- **访问开销**：自回归解码阶段反复访问缓存，进一步放大内存压力

### 1.2 现有优化方法缺乏系统性理解

当前 LLM 推理优化主要包括：

| 优化类型 | 代表方法 | 核心思想 |
|----------|----------|----------|
| **稀疏注意力** | DeepSeek Attention, SeerAttention-R, LServe | 选择性关注部分 tokens |
| **检索增强生成 (RAG)** | FLARE, DRAGIN | 将静态知识卸载到外部数据库 |
| **压缩上下文记忆** | MemAgent, Titans/HMT | 将信息压缩为紧凑嵌入 |
| **测试时训练 (TTT)** | TTT, LaCT | 将模型参数作为内部记忆 |

**关键问题**：这些方法被孤立对待，缺乏对其计算特性和硬件效率影响的系统性理解。

---

## 2. 方法框架

### 2.1 统一的四步内存处理流水线

![四步内存处理流水线](/assets/gpu-fpga-heterogeneous-llm-inference/_page_2_Figure_6.jpeg)
*图：四步内存处理流水线（来源：原文 Figure 2）*

> "内存处理流水线包含四个步骤：准备内存、计算相关性、检索、应用于推理。"

作者将各种 LLM 推理优化统一到一个通用的四步流水线：

**Step 1: 准备内存 (Prepare Memory)**
- 将原始内存预处理为紧凑或结构化格式
- 示例：DeepSeek Attention 将 KV 向量投影为轻量级索引向量

**Step 2: 计算相关性 (Compute Relevancy)**
- 利用处理后的内存和当前输入，识别哪些部分相关
- 输出相关性分数，分数越高表示相关性越强
- 示例：计算索引向量与查询向量的多头点积

**Step 3: 检索 (Retrieval)**
- 根据分数和启发式策略选择内存子集或构建精炼内存
- 示例：Top-k 选择、阈值筛选

**Step 4: 应用于推理 (Apply to Inference)**
- 将检索到的内存整合到后续计算中
- 示例：将选中的 KV 嵌入用于 MLA 计算

### 2.2 各类方法的流水线映射

![GPU-FPGA 异构系统概览](/assets/gpu-fpga-heterogeneous-llm-inference/_page_0_Figure_9.jpeg)
*图：GPU-FPGA 异构系统在不同 LLM 优化方法上的加速效果（来源：原文 Figure 1）*

| LLM 优化方法 | 准备内存 | 计算相关性 | 检索 | 应用于推理 |
|--------------|----------|------------|------|------------|
| **DeepSeek Attention** | 线性投影 + RoPE | 多头内积 | Top-k | 细粒度稀疏注意力 |
| **SeerAttention-R** | 线性投影 + 池化 | 内积 | Top-k / 阈值 | 块稀疏注意力 |
| **LServe** | 页级 Min/Max 池化 | 内积 + Max 归约 | Top-k | 块稀疏注意力 |
| **RAG (单阶段)** | 分词/嵌入 | BM25 | Top-k | 追加到查询 |
| **RAG (两阶段)** | 嵌入模型 | 内积/BM25 + 重排序 | Top-k | 追加到查询 |
| **MemAgent** | 模型解码 | N/A | 最近邻检索 | 模型预填充 |
| **Memory as Context** | 前向传播 | 线性投影 + 内积 | Top-k / 加权和 | 追加到段 |

---

## 3. 核心发现：内存处理的时间关键性

### 3.1 内存处理占据主要延迟

![稀疏注意力的内存处理延迟占比](/assets/gpu-fpga-heterogeneous-llm-inference/_page_3_Figure_4.jpeg)
*图：稀疏注意力方法中内存处理的延迟占比。在 1M tokens 时，内存处理可占解码时间的 22%-81%（来源：原文 Figure 3）*

**稀疏注意力**：
- 4K tokens：内存处理占 1-11%
- 1M tokens：内存处理占 **22-81%**

![RAG 的内存处理延迟占比](/assets/gpu-fpga-heterogeneous-llm-inference/_page_3_Figure_9.jpeg)
*图：RAG 方法中内存处理的延迟占比。处理 20M 文档时占 40-61%（来源：原文 Figure 4）*

**RAG**：
- 处理 20M 文档时，内存处理占 **40-61%**
- 两阶段 RAG 中，重排序器主导内存处理延迟

![参数化记忆和合成记忆的内存处理延迟占比](/assets/gpu-fpga-heterogeneous-llm-inference/_page_3_Figure_11.jpeg)
*图：左：参数化记忆（Titans/HMT, LaCT）的内存处理延迟占比；右：MemAgent 的内存处理延迟占比（来源：原文 Figure 5）*

**MemAgent**：
- 准备内存步骤（LLM 解码生成文本记忆）占高达 **97%** 延迟

### 3.2 内存处理流水线的计算异构性

![计算异构性分析](/assets/gpu-fpga-heterogeneous-llm-inference/_page_5_Figure_1.jpeg)
*图：GPU-FPGA 系统上的内核映射和数据通信。稀疏注意力和 RAG 采用通用设置；MemAgent 采用预填充-解码解耦；Memory as Context 针对数据局部性优化（来源：原文 Figure 6）*

**定量分析（算术强度 FLOPs/byte）**：

| 步骤 | 稀疏注意力 | RAG | MemAgent | Memory as Context |
|------|------------|-----|----------|-------------------|
| **准备内存** | 10-100 (计算密集) | 1-100 | 1-10 (内存密集) | >100 (计算密集) |
| **计算相关性** | 1-10 (内存密集) | 1-10 | - | 1-10 |
| **检索** | 1 (内存密集) | 1 | 0 | 1 |
| **应用于推理** | 10-100 | 0 | >100 | 0 |

**定性分析**：
- **准备内存 & 应用于推理**：规则访问、独立计算、计算密集
- **计算相关性 & 检索**：不规则访问、数据依赖、内存密集

---

## 4. GPU-FPGA 异构系统设计

### 4.1 为什么需要异构系统？

> "FPGA 在稀疏、不规则和内存受限工作负载上具有速度和能效优势。"

**GPU 的局限**：
- 在处理不规则数据访问和内存受限操作时，计算资源利用率低
- 调度开销大，难以充分利用片外内存带宽

**FPGA 的优势**：
1. **更大的 SRAM 容量和更高带宽**（U55C 提供 40MB 片上内存，带宽 21.8 TB/s）
2. **灵活的数据控制**，最小化调度开销
3. **低功耗**，具有竞争力的性能

### 4.2 系统架构

![FPGA 内核架构](/assets/gpu-fpga-heterogeneous-llm-inference/_page_5_Figure_9.jpeg)
*图：通用设置的 FPGA 内核架构。采用流式数据流设计，连接计算相关性模块（使用 BRAM+URAM+HBM 存储压缩键）和检索模块（Top-k 检索器）（来源：原文 Figure 7）*

**通用设置（稀疏注意力 & RAG）**：
- **GPU**：执行准备内存和应用于推理（密集线性代数）
- **FPGA**：执行融合的计算相关性 + 检索内核（不规则、内存受限操作）
- **数据传输**：仅传输压缩索引向量和检索到的索引，最小化 PCIe 开销

**MemAgent（合成记忆）**：
- **FPGA**：执行准备内存（LLM 解码）
- **GPU**：执行应用于推理（LLM 预填充）
- 采用预填充-解码解耦策略

**Memory as Context**：
- 内存仅存储在 FPGA 上
- 检索到的记忆嵌入传输到 GPU
- 输出直接流式传输到准备内存步骤

### 4.3 FPGA 内核设计

**计算相关性模块**：
- 三级物理内存层次：BRAM (21.8 TB/s) → URAM (10.4 TB/s) → HBM (460 GB/s)
- 内积引擎流式计算查询头与键向量的分数

**检索模块**：
- 归约单元聚合部分和
- Top-k 检索器使用并行归约树维护运行中的 Top-k 列表

---

## 5. 实验结果

### 5.1 硬件配置

| 设备 | 型号 | 内存 | 工艺 |
|------|------|------|------|
| CPU | AMD EPYC 7v13 @ 2.5GHz | 1 TB | 7 nm |
| GPU | AMD Instinct MI210 | 64 GB HBM (1.6 TB/s) | 6 nm |
| FPGA | AMD Alveo U55C | 16 GB HBM (460 GB/s) | 16 nm |

*注：U55C 采用较老的 16nm 工艺，成本约为 GPU 的一半。新一代 FPGA（如 AMD Versal V80）可进一步提升性能。*

### 5.2 延迟加速

![稀疏注意力的端到端加速](/assets/gpu-fpga-heterogeneous-llm-inference/_page_6_Figure_17.jpeg)
*图：稀疏注意力机制在 GPU-FPGA 异构系统上的端到端加速（来源：原文 Figure 8）*

**稀疏注意力**：

| 方法 | 内存处理加速 | 端到端加速 |
|------|--------------|------------|
| DeepSeek Attention | 1.3-2.2× | 1.1-1.2× |
| SeerAttention-R (Top-k) | 1.8-2.2× | 1.04-1.25× |
| SeerAttention-R (阈值) | 2.6-4.9× | 1.12-1.47× |
| LServe | 1.2-5.6× | 1.15-1.49× |

![RAG 的端到端加速](/assets/gpu-fpga-heterogeneous-llm-inference/_page_7_Figure_1.jpeg)
*图：左：RAG 的端到端加速；右：单阶段 RAG 和两阶段 RAG 的内存处理加速（来源：原文 Figure 10）*

**RAG**：

| 方法 | 内存处理加速 | 端到端加速 |
|------|--------------|------------|
| DRAGIN | 5.16× | 1.14-1.92× |
| FLARE | 5.7× | 1.19-2.11× |
| FS-RAG | 6.6× | 1.26-2.10× |
| 两阶段 RAG | 1.1-2.1× | 1.16-1.37× |

![Memory as Context 的加速](/assets/gpu-fpga-heterogeneous-llm-inference/_page_7_Figure_11.jpeg)
*图：左：Memory as Context 的端到端延迟；右：Memory as Context 的内存处理延迟（来源：原文 Figure 11）*

**Memory as Context**：
- 内存处理加速：**3.1-4.0×**
- 端到端加速：**1.3-1.6×**

![MemAgent 的加速](/assets/gpu-fpga-heterogeneous-llm-inference/_page_7_Figure_13.jpeg)
*图：左：MemAgent 的端到端延迟；右：MemAgent 的内存处理延迟（来源：原文 Figure 12）*

**MemAgent**：
- 端到端加速：**1.8×**（得益于 FPGA 更快的解码速度）

### 5.3 能效提升

| 类别 | 方法 | GPU-FPGA (J/req) | 基线 (J/req) | 最大提升 |
|------|------|------------------|--------------|----------|
| **稀疏注意力** | DeepSeek Attention | 15.86 | 25.62 | **1.69×** |
| | SeerAttention-R (阈值) | 0.30 | 0.34 | **1.26×** |
| | SeerAttention-R (Top-k) | 0.32 | 0.36 | **1.21×** |
| | LServe | 0.29 | 0.43 | **1.62×** |
| **RAG** | DRAGIN | 328.16 | 362.57 | **1.34×** |
| | FLARE | 241.99 | 275.53 | **1.45×** |
| | FS-RAG | 259.88 | 315.25 | **1.71×** |
| **合成记忆** | MemAgent | 3202 | 13662 | **4.66×** |
| **Memory as Context** | HMT/Titans | 16.55 | 27.31 | **1.74×** |

### 5.4 批处理扩展性

| 方法 | BS=1 | BS=2 | BS=4 | BS=8 | BS=32 |
|------|------|------|------|------|-------|
| **稀疏注意力** | 1.02-1.19× | 1.05-1.34× | 1.09-1.51× | 1.14-1.67× | 1.15-1.83× |
| **RAG** | 1.14-1.26× | 1.20-1.32× | 1.28-1.42× | 1.32-1.58× | 1.37-2.11× |
| **MemAgent** | 1.85× | 1.65× | 0.93× | 0.49× | 0.13× |
| **Memory as Context** | 1.48× | 1.47× | 1.45× | 1.38× | 1.15× |

**关键洞察**：
- 稀疏注意力和 RAG 的加速随批大小增加而提升（检索操作无法跨样本共享）
- MemAgent 在大批处理时出现性能下降（GPU 批处理对密集操作更有效）
- 系统可动态选择最优配置（如 MemAgent 批大小 >2 时回退到 GPU-only）

 **统一的内存处理框架**：首次将 diverse 的 LLM 推理优化方法统一到一个四步流水线，为系统性加速奠定基础

2. **异构计算的优势验证**：证明了 FPGA 在稀疏、不规则、内存受限工作负载上的显著优势（速度提升 1.3-7.65×，能效提升 1.1-4.7×）

3. **实用的系统实现**：基于现成设备（AMD MI210 + Alveo U55C）的完整实现，包含优化的数据流和通信机制

4. **广泛的适用性**：覆盖稀疏注意力、RAG、压缩记忆、测试时训练等多种方法，具有通用性

### 6.2 局限

1. **PCIe 通信开销**：尽管通过最小化数据传输和 P2P DMA 优化，跨设备通信仍是瓶颈

2. **FPGA 资源限制**：U55C 的片上内存（40MB）限制了可处理的序列长度（>1M tokens 时需回退到 GPU）

3. **开发复杂度**：FPGA 内核开发需要大量工程投入，限制了快速迭代和新方法适配

4. **批处理限制**：某些方法（如 MemAgent）在大批处理时性能下降

---

## 7. 总结

本文提出了一个统一的**四步内存处理流水线**框架，将现代 LLM 推理中的 diverse 优化方法（稀疏注意力、RAG、压缩记忆等）纳入统一的分析视角。通过系统性分析，作者发现内存处理占据了 **22%-97%** 的推理延迟，并且具有强烈的**计算异构性**——某些步骤是计算密集型的规则访问，而另一些则是内存密集型的不规则访问。

基于这一洞察，作者设计了 **GPU-FPGA 异构系统**，将稀疏、不规则、内存受限的操作卸载到 FPGA，而保留计算密集型操作在 GPU 上。实验结果表明：

- **速度提升**：1.04-2.2× 端到端加速
- **能效提升**：1.11-4.7× 能耗降低
- **批处理扩展**：稀疏注意力和 RAG 随批大小增加而提升，MemAgent 需动态回退

这项工作为未来的异构硬件设计提供了重要启示：**针对内存处理流水线的异构特性进行专门优化，可以显著提升 LLM 推理效率**。虽然原型使用现成设备，但异构 ASIC 设计有望进一步提升能效并消除跨设备通信开销。

---

## 参考文献

[1] He, Z., Ma, R., Sun, Y., & Cong, J. (2026). Understand and Accelerate Memory Processing Pipeline for Disaggregated LLM Inference. arXiv preprint arXiv:2603.29002.

[2] Liu, A., et al. (2025). Deepseek-v3.2: Pushing the frontier of open large language models. arXiv preprint arXiv:2512.02556.

[3] Gao, Y., et al. (2025). Seerattention-r: Sparse attention adaptation for long reasoning. arXiv preprint arXiv:2506.08889.

[4] Yang, S., et al. (2025). Lserve: Efficient long-sequence llm serving with unified sparse attention. arXiv preprint arXiv:2502.14866.

[5] Su, W., et al. (2024). Dragin: dynamic retrieval augmented generation based on the information needs of large language models. arXiv preprint arXiv:2403.10081.

[6] Behrouz, A., Zhong, P., & Mirrokni, V. (2025). Titans: Learning to memorize at test time. arXiv preprint arXiv:2501.00663.

[7] Yu, H., et al. (2025). Memagent: Reshaping long-context llm with multi-conv rl-based memory agent. arXiv preprint arXiv:2507.02259.

[8] Song, L., et al. (2022). Serpens: A high bandwidth memory based accelerator for general-purpose sparse matrix-vector multiplication. DAC '22.

[9] Zeng, S., et al. (2024). Flightllm: Efficient large language model inference with a complete mapping flow on fpgas. FPGA '24.

---

*本文基于 arXiv:2603.29002 论文自动生成，采用 paper_to_blog 工作流转换。*