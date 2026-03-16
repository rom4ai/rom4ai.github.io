---
layout: post
title: "ROMA: 基于只读存储器的 QLoRA 边缘设备 LLM 加速器"
categories: [research, ai, hardware, edge-computing]
author: ROM4AI
date: 2026-03-13
original_paper: "https://arxiv.org/abs/2503.12988"
tags: ["LLM", "accelerator", "ROM", "SRAM", "QLoRA", "edge computing", "hardware"]
---

# ROMA: 基于只读存储器的 QLoRA 边缘设备 LLM 加速器

> **原文链接**: [arXiv:2503.12988](https://arxiv.org/abs/2503.12988) | [PDF](https://arxiv.org/pdf/2503.12988.pdf)  
> **作者**: Wenqiang Wang (上海交通大学), Yijia Zhang, Zikai Zhang (北京大学), Guanting Huo, Hao Liang, Shijie Cao (微软亚洲研究院), Ningyi Xu (上海交通大学)  
> **发布日期**: 2025 年 3 月 17 日提交，2026 年 3 月 2 日修订

---

## 摘要

随着大语言模型（LLM）展现出强大的能力，将其部署在边缘设备上变得日益重要，这能够提供隐私保护和实时交互优势。QLoRA 已成为边缘设备 LLM 的标准方法，利用量化模型降低内存和计算成本，同时使用 LoRA 实现任务特定适应性。本文提出了 ROMA，一种采用混合存储架构的 QLoRA 加速器，使用 ROM 存储量化基础模型，SRAM 存储 LoRA 权重和 KV 缓存。研究团队的核心洞察是量化基础模型稳定且已收敛，非常适合 ROM 存储；而 LoRA 模块提供适应新数据的灵活性，无需更新基础模型。为进一步降低 ROM 面积成本，研究者提出了一种新颖的 B-ROM 设计，并将其与计算单元集成为融合单元，以高效利用芯片资源。ROMA 能够有效地将整个 4-bit 3B 或 2-bit 8B LLaMA 模型完全存储在片上，实现超过 20,000 tokens/s 的显著生成速度，无需外部内存。

---

## 1. 问题定义

将大语言模型部署到边缘设备面临两个核心挑战：

> "尽管量化减少了内存占用，QLoRA 模型仍然需要大量内存资源。生成每个 token 需要访问整个模型权重，其中量化权重大小相比 LoRA 权重占主导地位。"

**第一个挑战**是内存容量限制。即使采用 4-bit 量化，一个 3B 参数模型仍需要约 1.5GB 内存，而 8B 模型需要约 4GB。边缘设备通常无法提供如此大的片上内存，导致需要频繁访问外部内存，带来显著的延迟和功耗开销。

**第二个挑战**是混合精度计算的硬件支持。QLoRA 依赖低比特存储和计算（量化基础模型）与高比特组件（LoRA 和注意力操作）的混合。在硬件上高效支持这种混合精度计算需要精心设计，以平衡低比特和高比特组件之间的资源分配。

QLoRA 已成为边缘设备部署 LLM 的主流方案。苹果和微软等公司正采用 QLoRA（2/4-bit 量化基础模型和 LoRA 适配器）为其智能手机和桌面设备提供 LLM 服务。然而，现有 CPU 和 GPU 方案在推理性能上存在显著局限，无法充分发挥 QLoRA 的潜力。

---

## 2. 方法框架

ROMA 的核心创新在于**混合 ROM-SRAM 存储架构**。研究团队的关键洞察是：

> "基础模型通常稳定且已收敛，因为其训练过程消耗了几乎所有可用数据，质量提升随时间变得增量式。我们预计基础模型的更新将以年为单位，而非频繁迭代。"

### 2.1 混合存储架构设计

ROMA 采用 ROM 存储量化基础模型，SRAM 存储 LoRA 权重和 KV 缓存。这种分工基于以下观察：

- **ROM 优势**：相比 SRAM，ROM 提供显著更高的存储密度。在 TSMC 7nm 工艺下，ROM 比特单元面积约为 SRAM 比特单元的三分之一，使得将整个 LLM 存储在片上成为可能。
- **ROM 不可变性的处理**：虽然 ROM 在制造后无法修改，但这对存储 QLoRA 量化基础模型不是问题，因为基础模型稳定，而 LoRA 模块提供学习新数据的灵活性。

![ROMA 整体架构](/assets/roma-accelerator/roma-page-1.png)  
*图：ROMA 整体架构，采用混合 ROM 和 SRAM 的 QLoRA 加速器（来源：原文 Figure 3）*

### 2.2 核心模块设计

**L-Unit（低精度单元）**：负责存储和计算低精度基础模型权重。每个 L-Unit 包含：
- B-ROM 存储量化权重（UInt2 格式，每 128 个权重一组）
- 量化参数存储（FP16 格式的 scale s，UInt2 格式的 zero-point z）
- 低精度计算单元执行矩阵 - 向量乘法

**H-Unit（高精度单元）**：基于 SRAM，负责存储高精度 LoRA 模块权重和 KV 缓存，并执行相关计算。

**Vector Unit**：位于加速器中央的 1×16 阵列，负责计算非矩阵操作，包括元素级操作、归约和置换，同时集成 SRAM 存储中间计算结果。

### 2.3 B-ROM：面积高效块 ROM

研究者提出了一种新颖的 ROM 实现结构 B-ROM，核心思想是：

> "通过将地址分组为 4 个一组，对每组预生成 16 个输出候选，然后直接选择，可将 CMOS 晶体管数量减少至约四分之一。"

传统 ROM 结构中，每个比特需要单个 CMOS 晶体管读取信息。B-ROM 通过分组预生成候选输出，将晶体管数量减少至约 1/4，从而显著降低 ROM 面积。相比标准 ROM，B-ROM 减少约 40% 面积。

### 2.4 Fused-Cell：物理级优化

在物理设计层面，研究团队将 B-ROM 单元与计算单元集成为**Fused-Cell**：

> "B-ROM 宏和计算宏在物理设计上互补：B-ROM 金属层利用率高、基层利用率低；计算宏则相反。通过融合两者，可提高基层和金属层的利用率，从而减少整体面积。"

这种集成设计进一步优化了芯片资源利用，降低了整体模块面积。

---

## 3. 实验结果

### 3.1 硬件实现规格

ROMA 在 TSMC 7nm 工艺下实现，关键规格如下：

| 参数 | 规格 |
|------|------|
| 工作频率 | 500MHz |
| 内存配置 | 1.86GB B-ROM + 304MB SRAM（LoRA + KV 缓存）+ 16MB SRAM（中间数据） |
| 功耗 | 33.1W |
| 面积 | 503.7mm² |
| 支持模型 | 4-bit 3B LLaMA 或 2-bit 8B LLaMA |
| KV 缓存 | 最高 4K 长度 |
| LoRA rank | 最高 64 |

### 3.2 推理性能对比

研究者将 ROMA 与现代边缘平台的 CPU 和 GPU 进行了对比测试：

| 硬件平台 | 配置 | 内存 | 功耗 |
|----------|------|------|------|
| CPU: i5-1135G7 | 2.4GHz | 64GB DDR + 8MB SRAM | 28W |
| GPU: RTX 4090 | 2.5GHz | 24GB DDR + 73MB SRAM | 450W |
| **ROMA** | **500MHz** | **1.86GB B-ROM + 304MB SRAM** | **33.1W** |

**推理吞吐量对比（输入序列长度 256 tokens）：**

| 平台 | 吞吐量 (tokens/s) | 相对提升 |
|------|-------------------|----------|
| CPU (i5-1135G7) | 6.8 | ×1.0 |
| GPU (RTX 4090) | 219 | ×32.2 |
| **ROMA** | **20,078** | **×2,953** |

> "通过平均不同输入序列长度下的性能，我们发现 ROMA 的推理性能是 i5-1135G7 CPU 的 2,785 倍，是 RTX 4090 GPU 的 70.5 倍。"

**不同输入序列长度下的性能：**

| 输入序列长度 | CPU (tokens/s) | GPU (tokens/s) | ROMA (tokens/s) |
|--------------|----------------|----------------|-----------------|
| 256 | 6.8 | 219 | 20,078 |
| 512 | 6.4 | 215.6 | 18,703 |
| 1K | 5.3 | 212.2 | 12,840 |
| 2K | 3.1 | 205.8 | 8,533 |

即使输入序列长度增加到 2K tokens，ROMA 仍保持 8,533 tokens/s 的令人印象深刻的性能。

### 3.3 首 token 延迟（TTFT）

使用 4-bit 3B LLaMA 模型和 rank-16 LoRA 模块：

| 输入序列长度 | TTFT 延迟 |
|--------------|-----------|
| 256 tokens | 5.6 ms |
| 4K tokens | 140.2 ms |

### 3.4 SRAM 容量与 Token 容量关系

| SRAM 容量 | QLoRA rank | 最大 Token 数（4-bit 3B） |
|-----------|------------|--------------------------|
| 64 MB | 16 | 736 |
| 128 MB | 16 | 1,600 |
| 256 MB | 16 | 3,808 |
| 64 MB | 64 | 0（空间不足） |

研究者观察到，当 SRAM 容量为 64 MB 且 QLoRA rank 为 64 时，硬件 token 容量降至零。这是因为 KV 缓存和 QLoRA 权重数据都存储在 SRAM 中，高 rank 增加了权重数据大小，减少了 KV 缓存可用空间。因此，ROMA 配置了 304MB SRAM，使其对不同 rank 设置具有鲁棒性。

### 3.5 面积与功耗分析

**总面积分解：**
- L-Unit：73.2%
- H-Unit：16.6%
- Vector Unit：1.4%
- 其他：4.8%

**L-Unit 不同设计的面积与功耗对比：**

| 设计 | 面积 (k μm²) | 功耗 (mW) |
|------|--------------|-----------|
| Standard SRAM + Compute | 59.7 | 36.7 |
| Standard ROM + Compute | 19.2 | 26.0 |
| B-ROM + Compute | 11.4 | 22.5 |
| **Fused L-Unit** | **6.9** | **6.8** |

采用标准 ROM 相比 SRAM 显著减少了面积和功耗。进一步引入 B-ROM 和 Fused Cell 后，整体面积和功耗得到进一步优化。Fused L-Unit 相比 Standard SRAM+Compute 设计，面积减少 88.4%，功耗减少 81.5%。

---

## 4. 优点与局限

### 优点

1. **片上存储完整模型**：利用 ROM 的高密度特性，ROMA 能够将整个 4-bit 3B 或 2-bit 8B LLaMA 模型存储在片上，消除了外部内存访问需求。

2. **超高推理吞吐量**：实现超过 20,000 tokens/s 的解码吞吐量，即使有 1K KV 缓存，吞吐量仍保持在 24.6K tokens/s。

3. **低首 token 延迟**：256 tokens 输入下 TTFT 仅 5.6ms，4K 输入下为 140.2ms，适合实时交互应用。

4. **面积高效**：B-ROM 设计相比标准 ROM 减少约 40% 面积，Fused-Cell 进一步优化物理布局。

5. **功耗优化**：33.1W 功耗下实现超越 RTX 4090（450W）70 倍的性能，能效比显著提升。

6. **QLoRA 原生支持**：混合精度架构原生支持 QLoRA 推理，平衡效率与灵活性。

### 局限

1. **基础模型更新困难**：ROM 在制造后无法修改，基础模型更新需要重新流片。虽然研究者预期基础模型更新以年为单位，但这仍限制了快速迭代的场景。

2. **固定模型支持**：每块芯片针对特定模型配置优化，支持不同模型需要不同芯片设计。

3. **SRAM 容量限制 KV 缓存**：尽管配置了 304MB SRAM，长序列生成（>4K tokens）仍受限于 SRAM 容量。

4. **制造成本**：定制 ASIC 设计需要高昂的 NRE（一次性工程）成本，适合大规模部署场景。

5. **LoRA rank 灵活性受限**：高 rank LoRA 模块占用更多 SRAM，减少 KV 缓存可用空间，需要在 rank 和序列长度之间权衡。

---

## 5. 总结

ROMA 代表了一种创新的边缘设备 LLM 加速器设计范式，通过混合 ROM-SRAM 存储架构有效解决了 QLoRA 部署的内存和计算效率挑战。研究团队的关键洞察——量化基础模型稳定适合 ROM 存储，LoRA 模块提供灵活性——为边缘 AI 硬件设计开辟了新方向。

实验结果表明，ROMA 能够在无需外部内存的情况下存储 QLoRA 模型，同时实现超过 20,000 tokens/s 的预填充和解码速度，相比现代 CPU 和 GPU 分别实现 2,785 倍和 70.5 倍的性能提升。B-ROM 和 Fused-Cell 优化进一步降低了芯片面积和功耗。

ROMA 展示了作为实时边缘设备 LLM 应用的强大高效解决方案的潜力，特别适合对延迟和隐私要求严格的场景，如自动驾驶、机器人和智能手机。未来工作可能包括支持动态模型更新的可重构 ROM 设计，以及扩展到更大规模模型的架构优化。

---

## 参考文献

[1] W. X. Zhao, K. Zhou, J. Li, T. Tang, X. Wang, Y. Hou, Y. Min, B. Zhang, J. Zhang, Z. Dong et al., "A survey of large language models," arXiv preprint arXiv:2303.18223, 2023.

[2] S. Zhang, S. Roller, N. Goyal, M. Artetxe, M. Chen, S. Chen, C. Dewan, M. Diab, X. Li, X. V. Lin et al., "Opt: Open pre-trained transformer language models," arXiv preprint arXiv:2205.01068, 2022.

[3] H. Touvron, T. Lavril, G. Izacard, X. Martinet, M.-A. Lachaux, T. Lacroix, B. Rozière, N. Goyal, E. Hambro, F. Azhar et al., "Llama: Open and efficient foundation language models," arXiv preprint arXiv:2302.13971, 2023.

[4] J. Li, J. Xu, S. Huang, Y. Chen, W. Li, J. Liu, Y. Lian, J. Pan, L. Ding, H. Zhou et al., "Large language model inference acceleration: A comprehensive hardware perspective," arXiv preprint arXiv:2410.04466, 2024.

[5] T. Dettmers, A. Pagnoni, A. Holtzman, and L. Zettlemoyer, "Qlora: Efficient finetuning of quantized llms," Advances in Neural Information Processing Systems, vol. 36, 2024.

[6] T. Gunter, Z. Wang, C. Wang, R. Pang, A. Narayanan, A. Zhang, B. Zhang, C. Chen, C.-C. Chiu, D. Qiu et al., "Apple intelligence foundation language models," arXiv preprint arXiv:2407.21075, 2024.

[7] M. Abdin, J. Aneja, H. Awadalla, A. Awadallah, A. A. Awan, N. Bach, A. Bahree, A. Bakhtiari, J. Bao, H. Behl et al., "Phi-3 technical report: A highly capable language model locally on your phone," arXiv preprint arXiv:2404.14219, 2024.

[8] E. Frantar, S. Ashkboos, T. Hoefler, and D. Alistarh, "Gptq: Accurate post-training quantization for generative pre-trained transformers," arXiv preprint arXiv:2210.17323, 2022.

[9] E. J. Hu, Y. Shen, P. Wallis, Z. Allen-Zhu, Y. Li, S. Wang, L. Wang, and W. Chen, "Lora: Low-rank adaptation of large language models," arXiv preprint arXiv:2106.09685, 2021.

[10] D. Taub, "A short review of read-only memories," in Proceedings of the Institution of Electrical Engineers, vol. 110, no. 1. IET, 1963, pp. 157–166.

[11] T. A. Brubaker and J. C. Becker, "Multiplication using logarithms implemented with read-only memory," IEEE Transactions on computers, vol. 100, no. 8, pp. 761–765, 1975.

[12] M. H. Lewin, "A survey of read-only memories," in Proceedings of the November 30–December 1, 1965, fall joint computer conference, part I, 1965, pp. 775–787.

[13] H. H. Radamson, H. Zhu, Z. Wu, X. He, H. Lin, J. Liu, J. Xiang, Z. Kong, W. Xiong, J. Li et al., "State of the art and future perspectives in advanced cmos technology," Nanomaterials, vol. 10, no. 8, p. 1555, 2020.

[14] A. Dubey, A. Jauhri, A. Pandey, A. Kadian, A. Al-Dahle, A. Letman, A. Mathur, A. Schelten, A. Yang, A. Fan et al., "The llama 3 herd of models," arXiv preprint arXiv:2407.21783, 2024.

[15] "Llama 3.2," https://ai.meta.com/blog/llama-3-2-connect-2024-visionedge-mobile-devices/.

[16] "i5-1135g7," https://www.intel.com/content/www/us/en/products/sku/208658/intelcore-i51135g7-processor-8m-cache-up-to-4-20-ghz/specifications.html.

[17] "RTX 4090," https://www.nvidia.cn/geforce/graphics-cards/40series/rtx-4090-d/.

[18] "Llamacpp," https://github.com/ggerganov/llama.cpp.

[19] "TensorRT-LLM," https://github.com/NVIDIA/TensorRT-LLM.

---

*本文基于 arXiv:2503.12988 论文自动生成，采用 paper_to_blog 工作流转换。*
