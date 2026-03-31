---
layout: post
title: "Hummingbird: A Smaller and Faster Large Language Model Accelerator on Embedded FPGA"
categories: [research, ai, ml]
author: ROM4AI
date: 2026-03-31
original_paper: "https://arxiv.org/abs/2507.03308"
tags: ["ai-accelerator", "llm-inference", "edge-ai", "quantization", "memory-system"]
---

# Hummingbird: A Smaller and Faster Large Language Model Accelerator on Embedded FPGA

> **原文链接**: [arXiv:2507.03308](https://arxiv.org/abs/2507.03308) | [PDF](https://arxiv.org/pdf/2507.03308.pdf)

## 摘要

在边缘设备上部署大语言模型（LLM）仍然是一个重大挑战，因为LLM对计算和内存的需求很高，而边缘设备的硬件资源有限。虽然嵌入式FPGA在传统深度神经网络中已展现出性能和能效优势，但其在LLM推理中的潜力尚未被充分挖掘。现有研究主要依赖昂贵的高端云级FPGA硬件，且仅在相对较小的LLM上取得成果，限制了实际应用价值。

本文提出 **Hummingbird**，一种专为嵌入式FPGA设计的LLM加速器。Hummingbird 更小——在KV260和ZCU104平台上相比现有研究节省67% LUT、39% DSP和42%功耗；更强——支持LLaMA3-8B和更长上下文，通过卸载策略突破嵌入式FPGA典型的4GB内存限制；更快——在KV260和ZCU104上分别实现4.8 token/s和8.6 token/s的LLaMA3-8B推理速度，模型带宽利用率达到93-94%，超越先前LLaMA2-7B基线的4.9 token/s和84%带宽利用率。

## 1. 问题定义

> "Deploying LLM onto embedded FPGA has become more daunting than ever before. Existing research has primarily focused on deploying relatively small LLM on high-end, cloud FPGAs."

边缘AI应用（如隐私保护聊天界面和具身AI系统）需要在设备端直接支持LLM推理，而非依赖云端。FPGA长期以来被认为是加速深度学习工作负载的高效边缘解决方案，但LLM规模的爆炸性增长带来了前所未有的挑战。

现有研究存在以下关键局限：

1. **硬件成本高昂**：主要依赖配备HBM的云级FPGA（如Alveo U280/U250），不适合边缘部署
2. **模型规模受限**：最大仅支持7B参数模型，且上下文长度受限（通常仅1K tokens）
3. **带宽利用率低**：现有设计带宽利用率仅70-84%，存在显著优化空间
4. **资源消耗过大**：无法在低成本嵌入式FPGA上部署

Hummingbird 针对三个核心研究问题：
- 如何进一步降低资源消耗，使加速器能在更小、更便宜的嵌入式FPGA上部署？
- 如何实现更快的解码吞吐量和更高的内存带宽利用率？
- 如何在不依赖进一步压缩技术的情况下，部署比LLaMA2-7B更大、更强的模型并支持更长token序列？

## 2. 方法框架

![Hummingbird系统架构](/assets/hummingbird-fpga-llm-accelerator/system-overview.png)
*图：Hummingbird在KV260和ZCU104平台上的系统架构（来源：原文 Figure 1）*

Hummingbird的整体架构包含三个核心组件：

**内存管理单元（MMU）**：协调片上和片外内存访问，包括KV Cache的缓冲管理。

**向量处理单元（VPU）**：执行密集的通用矩阵-向量乘法（GEMV）操作，这是LLM推理的核心计算。

**标量处理单元（SPU）**：处理逐元素操作，包括旋转位置编码（RoPE）、softmax、层归一化、SiLU激活和量化。

### 2.1 核心创新点

![优化技术概览](/assets/hummingbird-fpga-llm-accelerator/optimizations.png)
*图：嵌入式FPGA上LLM加速器的现有低效问题和提出的改进方案（来源：原文 Figure 2）*

Hummingbird提出三项关键优化：

**1. DSP优化计算引擎**：采用INT24定点整数实现，在完整DSP链（触发器密集）和MAC树（DSP低效）之间取得平衡。通过分段DSP链混合架构，实现67% LUT、39% DSP和42%功耗节省。

**2. 列对齐内存访问策略**：针对Zynq内存控制器中AXI端口仲裁导致的带宽损失问题，提出列对齐内存访问策略，将模型带宽利用率从SOTA的84%提升至93-94%。

**3. 嵌入表卸载与GQA支持**：将存储密集的嵌入表卸载到外部闪存，并设计支持分组查询注意力（GQA）的高效数据流，将支持的上下文长度扩展至4096 tokens。

## 3. 实验结果

### 3.1 资源消耗对比

| 架构 | LUT | FFs | DSP | 激活重用 | AXPY支持 |
|------|-----|-----|-----|----------|----------|
| FP16 MAC Tree | 31,872 | 44,809 | 256 | No | No |
| INT24 MAC Tree | 0 | 9,936 | 256 | No | No |
| INT24 MAC Chain | 0 | 59,535 | 128 | No | No |
| Hybrid | 0 | 8,784 | 160 | No | No |
| Hybrid+ (无优化) | 6,570 | 11,856 | 160 | Yes | Yes |
| **Hybrid+ (有优化)** | **1,962** | **4,355** | **148** | **Yes** | **Yes** |

*表：计算引擎资源利用率对比（来源：原文 Table I）*

### 3.2 带宽利用率提升

| 平台 | 理论带宽 | 现有利用率 | Hummingbird利用率 | 提升 |
|------|----------|------------|-------------------|------|
| KV260 | 19.2 GB/s | 84% | **94%** | +10% |
| ZCU104 | 34.1 GB/s | - | **93%** | - |

*表：带宽利用率对比*

### 3.3 与现有加速器性能对比

| 加速器 | 设备 | 带宽(GB/s) | 模型 | 量化 | Token/s | 带宽效率 | 功耗效率 |
|--------|------|------------|------|------|---------|----------|----------|
| FlightLLM | U280 | 460 | LLaMA2-7B | W4 | 55 | 65% | 1.22 |
| Chen et al. | U280 | 460 | GPT2-345M | W8 | 204 | 23% | 0.66 |
| LoopLynx | U50 | 201 | GPT2-345M | W8 | 260 | 59% | 0.63 |
| ChatOPU | U200 | 76.8 | OPT-1.3B | SparseW16 | 43.2 | 72% | - |
| LightMamba | VCK190 | 12/76.8 | Mamba2-2.7B | W4 | 166.2 | 66% | - |
| Li et al. [11] | KV260 | 19.2 | LLaMA2-7B | W4 | 4.9 | 84% | 0.74 |
| LlamaF | ZCU102 | 19.2 | LLaMA-1.1B | W8 | 1.48 | 8% | 0.09 |
| **Hummingbird (KV260)** | **KV260** | **19.2** | **LLaMA3-8B** | **W4** | **4.8** | **94%** | **1.44** |
| **Hummingbird (ZCU104)** | **ZCU104** | **34.1** | **LLaMA3-8B** | **W4** | **8.6** | **93%** | **1.39** |

*表：不同FPGA平台上LLM加速器性能对比（来源：原文 Table V）*

### 3.4 与Jetson GPU对比

| 平台 | 带宽(GB/s) | Token/s | 带宽效率 | 功耗效率 |
|------|------------|---------|----------|----------|
| Jetson Orin Nano | 68 | 15 | 79% | 1.0 |
| Jetson Orin AGX | 204.8 | 40 | 71% | 0.66 |
| **Hummingbird (KV260)** | **19.2** | **4.8** | **94%** | **1.44** |
| **Hummingbird (ZCU104)** | **34.1** | **8.6** | **93%** | **1.39** |

*表：与Jetson Orin系列GPU对比（来源：原文 Table VI）*

## 4. 优点与局限

### 优点

1. **极致资源效率**：通过DSP优化计算引擎，实现67% LUT、39% DSP和42%功耗节省，是首个能在低成本Spartan UltraScale+ FPGA上部署的LLM加速器

2. **突破内存限制**：通过嵌入表卸载和GQA支持，在4GB内存设备上部署8B参数模型并支持4K上下文，是先前工作的4倍

3. **接近理论极限的带宽利用率**：列对齐内存访问策略实现93-94%带宽利用率，接近理论极限（95%，仅受刷新周期影响）

4. **超越嵌入式GPU的能效**：在带宽效率和功耗效率上均超越Jetson Orin系列GPU

### 局限

1. **模型支持范围**：当前仅支持LLaMA3-8B，对其他架构（如Mamba、RWKV等）的支持需要额外工作

2. **上下文长度上限**：虽然支持4K上下文，但仍低于LLaMA3原生支持的8K，受限于嵌入式设备的内存容量

3. **量化精度**：采用4-bit权重量化和8-bit KV Cache量化，可能对某些精度敏感任务产生影响

4. **硬件平台依赖**：部分优化（如列对齐访问）针对Zynq UltraScale+平台设计，迁移到其他FPGA平台需要适配

## 5. 总结

Hummingbird代表了嵌入式FPGA上LLM推理加速的重要进展。通过DSP优化计算引擎、列对齐内存访问策略和嵌入表卸载三项核心创新，Hummingbird在资源效率、带宽利用率和模型支持能力上均实现了突破。

该工作的重要意义在于：
- 证明了在低成本嵌入式FPGA上部署8B参数LLM的可行性
- 为边缘AI应用提供了高性能、低成本的LLM推理解决方案
- 开辟了在Spartan UltraScale+等成本优化型FPGA上部署LLM的新路径

对于AI芯片设计研究，Hummingbird的优化思路——特别是针对内存带宽瓶颈的列对齐访问策略和DSP级优化技术——具有重要的参考价值。

## 参考文献

1. Jindong Li et al., "Hummingbird: A Smaller and Faster Large Language Model Accelerator on Embedded FPGA," arXiv:2507.03308, 2025.
2. Jindong Li et al., "Pushing up to the limit of memory bandwidth and capacity utilization for efficient llm decoding on embedded fpga," DATE, 2025.
3. Shulin Zeng et al., "FlightLLM: Efficient large language model inference with a complete mapping flow on fpgas," FPGA, 2024.
4. Aaron Grattafiori et al., "The llama 3 herd of models," arXiv:2407.21783, 2024.
