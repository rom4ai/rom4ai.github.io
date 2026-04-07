---
layout: post
title: "MicroScopiQ: 通过异常值感知微缩放量化加速基础模型"
categories: ["research", "ai", "ml"]
author: ["Akshat Ramachandran", "Souvik Kundu", "Tushar Krishna"]
publish_date: ["2025"]
original_paper: "https://arxiv.org/abs/2411.05282"
tags: ["quantization", "ai-accelerator", "llm-inference", "edge-ai", "low-power"]
---

# MicroScopiQ: 通过异常值感知微缩放量化加速基础模型

> **原文链接**: [arXiv:2411.05282](https://arxiv.org/abs/2411.05282) | [PDF](https://arxiv.org/pdf/2411.05282.pdf)

## 摘要

基础模型（FMs）的量化比传统深度神经网络更具挑战性，原因在于模型中出现了大量被称为"异常值"（outliers）的大幅度值。现有的异常值感知算法-架构协同设计技术面临两难选择：要么使用混合精度（保留异常值的高精度表示）但牺牲硬件效率，要么将异常值和内层值（inliers）量化为相同精度，虽然提高硬件效率但会损失精度。

**MicroScopiQ** 提出了一种新颖的协同设计技术，利用剪枝来补充异常值感知量化。该方法将异常值保留在更高精度，同时剪枝一部分最不重要的权重来分配额外的异常值比特位，从而在保持高精度的同时确保内存对齐和硬件效率。论文还设计了一种高吞吐量、低开销的加速器架构，包含多精度整数处理单元和一个名为 **ReCoN** 的片上网络（NoC），有效抽象了支持高精度异常值的复杂性。

## 1. 问题定义

> "量化基础模型（FMs）比传统DNNs更具挑战性，原因在于出现了被称为异常值的大幅度值。"

基础模型（包括大语言模型LLMs和视觉语言模型VLMs）利用数十亿规模的参数进行学习，但对内存、能量和计算资源提出了巨大需求。模型量化是降低内存和计算开销的关键技术，但FMs中的异常值问题使得传统量化方法难以奏效。

### 现有技术的局限性

现有异常值感知量化技术可分为两类：

**A类（如GOBO、OLAccel）**：将异常值保留在高精度，与低精度内层值分开存储。优点是精度高，但缺点是有效比特宽度（EBW）高、内存访问不对齐、硬件效率低。

**B类（如AWQ、OliVe）**：将异常值和内层值量化为相同精度，使用不同数据格式或缩放因子。优点是压缩率高、内存对齐，但精度损失大，特别是在超低比特宽度下。

![现有技术对比](/assets/microscopiq/_page_0_Picture_13.jpeg)
*图：MicroScopiQ与现有异常值感知量化技术的对比（来源：原文Table 1）*

| 特性 | A类方法 | B类方法 | MicroScopiQ |
|------|---------|---------|-------------|
| 精度 | 高 | 低 | **高** |
| 有效比特宽度 | 高(18.17b) | 低(2b) | **低(2.36b)** |
| 灵活性 | 否 | 否 | **是** |
| 对齐内存 | 不对齐 | 对齐 | **对齐** |
| PE设计 | 复杂 | 复杂 | **简单** |
| 硬件开销 | 高 | 中等 | **低** |

## 2. 方法框架

### 2.1 核心洞察：相邻异常值的重要性

![异常值分布](/assets/microscopiq/_page_2_Figure_2.jpeg)
*图：(a) 各层异常值和相邻异常值占总权重的百分比分布；(b) OliVe-W4A16与MicroScopiQ-W2A16在不同基准测试上的量化精度对比（来源：原文Figure 2）*

论文发现，现代FMs平均每个层拥有超过0.5%的相邻异常值（两个连续的异常值），某些层甚至超过2%。这与OliVe评估的BERT、OPT等模型（<0.04%）形成鲜明对比。OliVe假设异常值不会相邻，导致在现代FMs上剪枝时会意外删除关键异常值，造成显著的精度损失。

### 2.2 MicroScopiQ量化方法

![MicroScopiQ框架](/assets/microscopiq/_page_3_Figure_2.jpeg)
*图：MicroScopiQ量化框架概述，展示内层值和异常值的量化方法以及异常值比特的重新分布（来源：原文Figure 3）*

MicroScopiQ的核心思想是：

1. **异常值保留高精度**：使用MX-FP格式将异常量化为比内层值（MX-INT）更高的精度（2倍）
2. **剪枝补充**：基于Hessian信息识别最不重要的权重进行剪枝
3. **比特重新分布**：将异常值的低位比特分布到剪枝后的位置，确保固定的比特预算和内存对齐

### 2.3 数据格式

**MX-INT（内层值）**：采用分组量化，每128个元素共享一个8位缩放因子。

**MX-FP（异常值）**：使用微缩放浮点格式，具有两级缩放：
- Level-1：共享的幂次缩放因子
- Level-2：微指数（μX），从异常值的共同指数中提取

这种设计使得异常值可以用FP格式表示，同时允许使用简单的INT处理单元进行计算。

## 3. 加速器架构

### 3.1 架构概述

![加速器架构](/assets/microscopiq/_page_4_Figure_9.jpeg)
*图：MicroScopiQ集成到权重静止脉动阵列（来源：原文Figure 4）*

MicroScopiQ加速器包含以下关键组件：

1. **多精度PE阵列**：支持2位和4位操作，通过MODE信号动态切换
2. **ReCoN（重分布与协调NoC）**：高效处理异常值的重新排序和部分和计算
3. **后处理单元**：负责输出激活的缩放和量化

### 3.2 ReCoN：异常值处理的核心

![ReCoN微架构](/assets/microscopiq/_page_6_Figure_9.jpeg)
*图：(a) 多精度PE微架构；(b) 同步缓冲区；(c) ReCoN开关（来源：原文Figure 7）*

ReCoN是一个多级蝶形NoC，采用时分复用方式被所有PE行共享。它执行三种关键操作：

- **Pass**：直接传递输入
- **Swap**：交换输入到不同输出端口
- **Merge**：合并异常值的上下两半，计算完整的FP部分和

ReCoN的设计使得异常值处理的开销最小化，相比在每个PE中处理异常值（如OliVe、GOBO）显著降低了面积成本。

### 3.3 端到端示例

![端到端示例](/assets/microscopiq/_page_6_Figure_2.jpeg)
*图：MicroScopiQ在4×4 PE阵列上的端到端工作示例（来源：原文Figure 8）*

该图展示了MicroScopiQ的完整工作流程：
1. 异常值被分布到不同列的PE中
2. PE计算部分积，异常值结果发送到ReCoN
3. ReCoN通过Swap和Merge操作重组异常值
4. 最终结果传递回PE阵列继续计算

## 4. 实验结果

### 4.1 LLM量化结果

![LLM量化结果](/assets/microscopiq/_page_9_Figure_12.jpeg)
*图：VLM的仅权重量化结果（来源：原文Figure 10）*

| 方法 | W/A | OPT-6.7B | LLaMA2-7B | LLaMA3-8B | Phi-3-3.8B |
|------|-----|----------|-----------|-----------|------------|
| Baseline | 16/16 | 10.86 | 5.47 | 6.13 | 6.33 |
| OliVe | 4/16 | 12.20 | 11.52 | 10.29 | 8.57 |
| GOBO | 4/16 | 10.97 | 5.79 | 7.11 | 6.64 |
| **MicroScopiQ** | **4/16** | **10.91** | **5.65** | **6.89** | **6.61** |
| OmniQuant | 2/16 | 11.61 | 9.62 | 9.13 | 7.09 |
| **MicroScopiQ** | **2/16** | **11.51** | **8.43** | **8.97** | **7.16** |

*表：WikiText2困惑度（越低越好）（来源：原文Table 2）*

MicroScopiQ在W4A16配置下实现近乎无损的量化性能，在W2A16配置下相比基线方法显著降低困惑度（PPL降低可达2.04）。

### 4.2 加速器性能

![加速器对比](/assets/microscopiq/_page_10_Figure_12.jpeg)
*图：不同加速器的等精度对比（来源：原文Figure 12）*

| 架构 | 计算面积(mm²) | 计算开销 | 计算密度(TOPS/mm²) |
|------|---------------|----------|---------------------|
| GOBO | 0.216 | 3.28% | 28.28 |
| OliVe | 0.011 | 9.90% | 184.30 |
| **MicroScopiQ** | **0.012** | **8.63%** | **367.51** |

*表：64×64阵列的计算面积和密度对比（来源：原文Table 5）*

MicroScopiQ实现了：
- **3×** 更高的单位面积性能（TOPS/mm²）相比现有方案
- **2×** 更低的能耗消耗
- **1.5-2.5×** 的端到端推理加速

### 4.3 与GPU对比

![GPU对比](/assets/microscopiq/_page_11_Figure_4.jpeg)
*图：MicroScopiQ加速器与A100 GPU的对比：(a) 归一化延迟；(b) 归一化能耗（来源：原文Figure 13）*

在等带宽和等计算条件下，MicroScopiQ相比A100 GPU实现：
- W4A4配置：**1.2×** 加速
- WxA4配置（大部分层bb=2）：**1.7×** 加速

### 4.4 消融研究

![消融研究](/assets/microscopiq/_page_11_Figure_4.jpeg)
*图：不同量化技术逐步引入对LLaMA3-8B困惑度的影响（来源：原文Table 7）*

| 量化方法 | WikiText2 PPL↓ |
|----------|----------------|
| Baseline W16A16 | 6.13 |
| + INT-4全量化 | 10.27 (↑4.14) |
| + MX-INT-4₁₂₈ | 9.53 (↓0.74) |
| + MX-INT-2₁₂₈ | 39.48 (↑29.95) |
| + MX-FP-4₁₂₈,₁₂₈异常值 | 10.96 (↓28.52) |
| + MX-FP-4₈,₈异常值 | **8.93** (↓2.03) |
| + 异常值幅度缩减 | 8.89 (↓0.04) |
| + 剪枝最不重要的内层值 | 9.02 (↑0.13) |
| + 量化误差补偿 | **8.97** (↓0.05) |

该表展示了各组件的贡献：MX-FP异常值量化是恢复精度的关键，而剪枝和误差补偿进一步优化了结果。

## 5. 优点与局限

### 优点

1. **高精度与高效率兼得**：通过剪枝+异常值高精度量化，同时实现高模型精度和低硬件开销
2. **通用性强**：不依赖异常值的空间局部性假设，适用于广泛的FMs
3. **内存对齐**：固定比特预算确保内存访问对齐，简化硬件设计
4. **硬件友好**：简单的INT处理单元+ReCoN，避免复杂的混合精度PE

### 局限

1. **GPU支持需修改**：现有GPU张量核心无法原生支持INT+FP混合计算，需要硬件修改
2. **微块大小选择**：μB大小（论文采用8）需要针对模型特性调优
3. **异常值比例限制**：当某微块中异常值超过μB/2时可能需要更大的微块

## 6. 总结

MicroScopiQ提出了一种创新的异常值感知量化框架，通过**剪枝补充**的策略解决了传统方法在高精度和硬件效率之间的权衡问题。其核心贡献包括：

1. **算法层面**：MX-INT内层值 + MX-FP异常值的混合量化策略，结合Hessian引导的剪枝
2. **架构层面**：ReCoN NoC高效抽象异常值处理复杂性，支持简单的多精度INT PE阵列
3. **性能层面**：首个在PTQ设置下同时支持LLMs和VLMs达到~2.36比特EBW的技术，实现3×推理加速和2×能耗降低

这项工作为边缘AI部署和高效LLM推理提供了重要的算法-硬件协同设计思路。

## 参考文献

1. Akshat Ramachandran, Souvik Kundu, and Tushar Krishna. MicroScopiQ: Accelerating Foundational Models through Outlier-Aware Microscaling Quantization. ISCA 2025.
2. Bita Darvish Rouhani et al. Microscaling data formats for deep learning. arXiv:2310.10537, 2023.
3. Cong Guo et al. OliVe: Accelerating large language models via hardware-friendly outlier-victim pair quantization. ISCA 2023.
4. Ali Hadi Zadeh et al. GOBO: Quantizing attention-based NLP models for low latency and energy efficient inference. MICRO 2020.
5. Elias Frantar et al. GPTQ: Accurate post-training quantization for generative pre-trained transformers. arXiv:2210.17323, 2022.
