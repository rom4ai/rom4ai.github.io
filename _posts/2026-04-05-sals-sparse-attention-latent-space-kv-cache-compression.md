---
layout: post
title: "SALS: 潜在空间稀疏注意力实现 KV Cache 压缩"
date: 2026-04-05 08:30:00 +0800
categories: [paper, llm-inference, kv-cache]
tags: [llm-inference, kv-cache, sparsity, quantization, attention-optimization]
author: Ray
paper_title: "SALS: Sparse Attention in Latent Space for KV cache Compression"
venue: "arXiv 2025"
paper_url: "https://arxiv.org/abs/2510.24273"
---

> **原文链接**: [arXiv:2510.24273](https://arxiv.org/abs/2510.24273) | [PDF](https://arxiv.org/pdf/2510.24273.pdf)

## 摘要

大语言模型处理长上下文的能力需求日益增长，但推理过程中巨大的 Key-Value (KV) Cache 内存占用和高内存带宽需求成为主要瓶颈。本文提出 **SALS (Sparse Attention in Latent Space)** 框架，通过在潜在空间进行稀疏注意力计算，实现高效的 KV Cache 压缩。核心洞察包括：(1) RoPE 会增加 key 向量的方差导致秩升高，应在 RoPE 之前进行压缩；(2) 潜在空间中的 key 向量在多数层保持其表征能力。基于这些发现，SALS 将 KV Cache 投影到低秩潜在空间，在此空间进行无 RoPE 的 query-key 交互以选择重要 token，仅重建少量关键 token 进行精确注意力计算。

**核心成果**: 在 4K 序列长度上，SALS 实现 **6.4 倍 KV Cache 压缩** 和 **5.7 倍注意力算子加速**（相比 FlashAttention2），端到端吞吐量相比 GPT-fast 在 4K 和 32K 序列上分别提升 **1.4 倍** 和 **4.5 倍**。

---

## 1. 问题定义

### 1.1 KV Cache 瓶颈

随着序列长度增加，KV Cache 消耗大量 GPU 显存，成为 LLM 服务的主要性能瓶颈。研究表明 KV Cache 在隐藏维度上具有低秩特性，暗示了有效压缩的潜力。

### 1.2 RoPE 带来的挑战

Rotary Position Embedding (RoPE) 通过旋转矩阵将位置信息编码到 query 和 key 状态中：

> "RoPE 不仅阻止了低秩权重与 query 状态的融合，还要求从潜在空间重建 key 状态。"

关键观察：**RoPE 会增加 key 向量的方差，从而导致更高的秩**。因此，KV Cache 必须在应用 RoPE 之前进行压缩，但这又带来了高重建复杂度的问题。

---

## 2. 方法框架

![SALS 整体架构](/assets/sals-kv-cache/_page_4_Figure_0.jpeg)
*图：SALS 整体架构，包含三阶段：Stage 1 多 head KV Cache 压缩，Stage 2 潜在空间 token 选择，Stage 3 稀疏注意力计算*

### 2.1 核心洞察

**洞察一：RoPE 增加方差和秩**

![RoPE 对 key 向量的影响](/assets/sals-kv-cache/_page_3_Figure_0.jpeg)
*图：(a) 低秩矩阵重建带来的推理时间增加；(b) 应用 RoPE 后 PCA 方向改变的简化示例*

如图所示，应用 RoPE 会将数据点向外推并旋转其主轴，增加方差和秩。因此，**pre-RoPE 的 key 更适合潜在空间变换**。

**洞察二：潜在空间的表征保持**

![Pre-RoPE 跨层高重叠率](/assets/sals-kv-cache/_page_4_Figure_6.jpeg)
*图：Pre-RoPE key 在潜在空间的重叠分数（Overlap Score）*

实验显示，pre-RoPE 的潜在空间 token 在 2-29 层的重叠分数大多保持在 90% 以上，说明即使完全省略 RoPE，潜在空间 token 仍能在大多数层保留几乎全部注意力分数。

### 2.2 SALS 三阶段框架

| 阶段 | 操作 | 说明 |
|------|------|------|
| Stage 1 | 多 head KV Cache 压缩到潜在空间 | 通过低秩投影矩阵将多 head key 压缩到单 head 潜在空间 |
| Stage 2 | 潜在空间关键 token 选择 | 在潜在空间计算近似注意力分数，选择 top-k 关键 token |
| Stage 3 | 选择性重建与稀疏注意力 | 仅重建选中的 token，应用 RoPE 后进行精确注意力计算 |

### 2.3 数学原理

**低秩投影**：

$$\widetilde{\mathbf{K}} = \mathbf{K} \mathbf{U}$$

其中 $\mathbf{U} \in \mathbb{R}^{d \times r}$ 是正交投影矩阵，$r \ll d$。

**潜在空间 token 选择**：

$$s_j = \tilde{\mathbf{q}}_{:r^{\star}}^{\top} \tilde{\mathbf{k}}_{j,:r^{\star}}$$

通过仅使用潜在空间的前 $r^*$ 维进行 cheap inner product，无需额外存储即可识别关键 token。

**稀疏注意力**：

$$\mathbf{p}_{\mathcal{C}} = \operatorname{softmax}\left(\frac{\mathbf{Q}\mathbf{K}_{\mathcal{C}}^{\top}}{\sqrt{d}}\right), \quad \mathbf{y} = \mathbf{p}_{\mathcal{C}}\mathbf{V}_{\mathcal{C}}$$

仅对选中的 $N_c$ 个 token 子集进行注意力计算。

---

## 3. 实验结果

### 3.1 与 KV Cache 压缩方法对比

**GSM8K 和 CoQA 数据集 (LLaMA2-7B-chat)**：

| Method | GSM8K (strict/flexible) | CoQA | Memory Access | Comp. Ratio |
|--------|------------------------|------|---------------|-------------|
| baseline | 0.2335 / 0.2335 | 0.5997 | 1.00 | 1.00 |
| KIVI-4bit | 0.2297 / 0.2305 | 0.5992 | 0.31 | 0.31 |
| Palu-30%(3bit) | 0.1713 / 0.1759 | 0.5938 | 0.14 | 0.14 |
| **SALS-25%** | **0.2312 / 0.2343** | 0.5975 | 0.13 | 0.28 |
| **SALS-12.5%** | 0.2176 / 0.2229 | **0.6070** | **0.07** | 0.15 |

SALS-25% 在保持与基线相当准确率的同时，内存访问降至 13%；SALS-12.5% 进一步降至 7%，准确率仍优于 Palu。

**LongBench 长文本基准**：

| Model | Method | Single-QA | Multi-QA | Summarization | Few-shot | Synthetic | Code | Avg | Memory Access |
|-------|--------|-----------|----------|---------------|----------|-----------|------|-----|---------------|
| LLaMA2-7B | baseline | 24.50 | 22.18 | 23.64 | 62.80 | 6.50 | 56.29 | 32.65 | 1.00 |
| LLaMA2-7B | KIVI-4bit | 24.76 | 22.22 | 23.40 | 62.67 | 6.75 | 56.42 | 32.70 | 0.31 |
| LLaMA2-7B | Palu-30% | 22.36 | 22.01 | 22.66 | 60.39 | 7.50 | 50.53 | 30.91 | 0.13 |
| LLaMA2-7B | **SALS-25%** | 24.37 | 22.50 | 23.40 | 63.01 | 6.50 | 53.80 | 32.26 | **0.11** |
| LLaMA2-7B | **SALS-12.5%** | 24.81 | 22.52 | 23.08 | 62.84 | 5.00 | 53.58 | 31.97 | **0.06** |

### 3.2 与 Token 稀疏方法对比

| Method | Single-QA | Multi-QA | Summarization | Few-shot | Synthetic | Code | Avg | Memory Access |
|--------|-----------|----------|---------------|----------|-----------|------|-----|---------------|
| baseline | 24.50 | 22.18 | 23.64 | 62.80 | 6.50 | 56.29 | 32.65 | 1.00 |
| Double Sparse | 24.78 | 22.72 | 24.70 | 61.84 | 4.17 | 51.66 | 31.64 | 0.16 |
| HShare | 24.59 | 22.18 | 24.54 | 61.69 | 4.74 | 53.26 | 31.83 | 0.14 |
| Loki | 24.57 | 18.09 | 24.37 | 63.43 | 4.75 | 56.49 | 31.95 | 0.19 |
| **SALS-25%** | 24.37 | 22.50 | 23.40 | 63.01 | 6.50 | 53.80 | 32.26 | **0.11** |
| **SALS-12.5%** | 24.81 | 22.52 | 23.08 | 62.84 | 5.00 | 53.58 | 31.97 | **0.06** |

SALS-12.5% 内存访问仅 5.8%，但准确率仍优于所有对比的稀疏方法。

### 3.3 RULER 长上下文基准 (128K)

| Method | avg | S1 | S2 | MK1 | MK2 | MV | MQ | FEW | QA1 | QA2 |
|--------|-----|----|----|-----|-----|----|----|-----|-----|-----|
| Baseline | 81.60 | 99.6 | 96.0 | 94.6 | 73.6 | 93.85 | 96.9 | 68.47 | 69.6 | 41.8 |
| **SALS-25%** | 80.81 | 99.6 | 95.2 | 94.2 | 65.8 | 93.2 | 96.4 | 71.53 | 70.2 | 41.2 |
| **SALS-12.5%** | 75.86 | 97.4 | 93.8 | 92.8 | 42.2 | 84.05 | 93.05 | 72.53 | 67.8 | 39.14 |

在 128K 上下文、8× 稀疏度设置下，SALS-25% 平均准确率 80.81，与基线 81.60 几乎持平。

### 3.4 效率评估

**注意力算子延迟对比 (ms)**：

| Config | Flash-attn | Loki | Double-sparse | Hshare | **SALS-25%** | **SALS-12.5%** |
|--------|------------|------|---------------|--------|--------------|----------------|
| bs=8, 4k | 1.630 | 1.102 | 0.724 | 0.576 | **0.530** | **0.439** |
| bs=16, 4k | 3.230 | 2.101 | 1.319 | 1.067 | **0.757** | **0.565** |

SALS-12.5% 在 bs=8, 4k 配置下实现 **5.7 倍加速**（相比 FlashAttention2）。

**端到端吞吐量 (token/second)**：

| Bsz | Seq (k) | GPT-Fast | **SALS-25%** | **SALS-12.5%** |
|-----|---------|----------|--------------|----------------|
| 8 | 4 | 118 | 154.1 | 163.5 |
| 8 | 8 | 70.6 | 128.6 | 150.1 |
| 8 | 16 | 38.3 | 102.5 | 122.7 |
| 8 | 32 | 19.8 | 67.97 | 89.47 |
| 4 | 64 | 9.2 | 32.92 | 42.96 |

在 32K 序列上，SALS-12.5% 相比 GPT-fast 实现 **4.5 倍吞吐量提升**。

---

## 4. 优点与局限

### 4.1 优点

1. **SOTA 压缩率与准确率平衡**: 6.4 倍 KV Cache 压缩同时保持 competitive 准确率
2. **显著加速**: 5.7 倍注意力算子加速，4.5 倍端到端吞吐量提升
3. **无需训练**: 后训练校准即可部署，无需重新训练模型
4. **与稀疏注意力协同**: 首次实现低秩压缩与 token 稀疏的有机结合

### 4.2 局限

1. **极端压缩下准确率下降**: 12.5% 压缩率在 Multi-Key-2 等强依赖任务上性能下降明显
2. **短序列开销**: 1K 序列长度时引入一定开销，优势在长序列更明显
3. **层特定处理**: 需要跳过部分层（0, 1, 31 层）的稀疏化以确保准确性

---

## 5. 总结

SALS 通过将 KV Cache 压缩与稀疏注意力在潜在空间有机结合，实现了 LLM 长上下文推理的高效加速。核心创新在于利用 pre-RoPE key 的低秩特性和潜在空间的表征保持能力，通过仅重建少量关键 token 避免全量重建开销。

对于 AI 硬件设计而言，SALS 揭示了以下重要趋势：
- **稀疏计算架构**: 支持动态稀疏注意力的专用硬件将越来越重要
- **低精度与压缩**: KV Cache 压缩技术将显著降低内存带宽需求
- **分层存储**: 潜在空间表示可使用更低精度存储，关键 token 精确重建

---

## 参考文献

1. Junlin Mu, Hantao Huang, et al. SALS: Sparse Attention in Latent Space for KV cache Compression. arXiv:2510.24273, 2025.
2. Chi-Chih Chang et al. Palu: Compressing kv-cache with low-rank projection. arXiv:2407.21118, 2024.
3. Zirui Liu et al. KIVI: A tuning-free asymmetric 2bit quantization for kv cache. arXiv:2402.02750, 2024.
4. Tri Dao. FlashAttention-2: Faster attention with better parallelism and work partitioning. arXiv:2307.08691, 2023.

---

*本文是对 arXiv 论文 "SALS: Sparse Attention in Latent Space for KV cache Compression" 的技术解读。*
