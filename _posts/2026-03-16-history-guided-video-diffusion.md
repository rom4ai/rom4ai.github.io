---
layout: post
title: 'History-Guided Video Diffusion: 用历史引导实现超长视频生成'
categories:
- research
- ai
- ml
- cv
author: ROM4AI
date: 2026-03-16
original_paper: https://arxiv.org/abs/2502.06764
tags:
- multi-modal
- diffusion-model
- llm-inference
- transformer
---
# History-Guided Video Diffusion: 用历史引导实现超长视频生成

> **原文链接**: [arXiv:2502.06764](https://arxiv.org/abs/2502.06764) | [PDF](https://arxiv.org/pdf/2502.06764.pdf) | [项目主页](https://boyuan.space/history-guidance)

## 摘要

本文提出了**Diffusion Forcing Transformer (DFoT)** 和**History Guidance (HG)** 方法，解决了视频扩散模型中灵活历史条件化的关键挑战。通过允许模型在采样时灵活条件化任意数量的历史帧，该方法显著提升了视频生成质量和时间一致性，能够稳定生成超过 800 帧的超长视频，在 Kinetics-600 基准上超越了现有方法。

## 1. 问题定义

视频扩散模型的核心挑战在于如何有效地利用历史帧（之前生成的帧）来指导后续帧的生成。传统的 Classifier-Free Guidance (CFG) 技术在视频领域面临两个关键问题：

> " architectures that only support fixed-size conditioning, and the empirical observation that CFG-style history dropout performs poorly."

**问题 1：固定长度的条件化架构**
- 现有的 DiT 或 U-Net 架构通常使用 AdaLN 层或通道拼接来注入条件信息
- 这限制了条件输入必须是固定大小的向量
- 无法灵活处理可变长度的历史帧序列

**问题 2：帧级二元 Dropout 效果差**
- 传统的 CFG 通过随机丢弃条件变量来训练条件/无条件模型
- 当扩展到历史引导时，随机丢弃历史帧子集的方法表现不佳
- 原因是 token 利用率低：模型处理所有帧，但只有随机子集对损失有贡献

## 2. 方法框架

### 2.1 Diffusion Forcing Transformer (DFoT)

DFoT 的核心思想是**"噪声即掩码"（Noise as Masking）**：

> "Each frame xt ∈ xT is assigned an independent noise level kt ∈ [0, 1], resulting in random sequences of noise levels."

**关键创新点：**

1. **统一历史与生成帧**：不区分历史帧和生成帧，将所有帧视为同一输入序列
2. **逐帧独立噪声级别**：每个帧分配独立的噪声级别 kt ∈ [0, 1]
3. **全序列训练**：训练模型去噪整个序列，其中每个帧有不同的噪声级别

**训练目标：**
```
E_{kT,xT,ϵT}[||ϵT - ϵθ(x^{kT}_T, kT)||²]
```

这种方法允许模型在采样时灵活地条件化任意子集的历史帧，因为历史帧只是噪声级别为 0 的帧。

### 2.2 History Guidance (HG) 方法族

DFoT 使得一系列历史引导方法成为可能：

**1. Vanilla History Guidance (HG-v)**
- 使用任意长度的历史作为 CFG 的条件变量
- 最简单的形式，但已显著提升视频质量
- 公式：∇log pk(x^k_G) + ω[∇log pk(x^k_G|xH) - ∇log pk(x^k_G)]

**2. Temporal History Guidance (HG-t)**
- 组合不同历史窗口的分数
- 将 OOD 历史分割为更短的、分布内的子序列
- 实现鲁棒的分布外泛化能力

**3. Fractional History Guidance (HG-f)**
- 条件化被不同噪声级别破坏的历史窗口
- 充当"低通滤波器"，关注低频细节
- 增强运动动态性，同时保持一致性

**4. History Guidance across Time and Frequency (HG-tf)**
- 组合 HG-t 和 HG-f 的综合方法
- 实现最佳的视频质量和稳定性

## 3. 实验设置

### 3.1 数据集

| 数据集 | 分辨率 | 用途 |
|--------|--------|------|
| Kinetics-600 | 128×128 | 标准视频预测基准 |
| RealEstate10K (RE10K) | 256×256 | 真实世界室内场景 |
| Minecraft | 256×256 | 长上下文导航视频 |
| Fruit Swapping | - | 机器人模仿学习任务 |

### 3.2 基线方法

1. **Standard Diffusion (SD)**: 针对特定历史长度优化的单任务模型
2. **Binary-Dropout Diffusion (BD)**: 使用帧级二元 dropout 的消融基线
3. **Full-Sequence Diffusion (FS)**: 使用最大序列长度训练的无条件模型

### 3.3 评估指标

- **FVD (Fréchet Video Distance)**: 综合评估视频质量和多样性
- **V Bench**: 分别评估帧质量、一致性、动态性
- **LPIPS**: 针对确定性任务的帧级感知相似度

## 4. 实验结果

### 4.1 DFoT 作为通用视频模型的性能

在 Kinetics-600 上的对比结果：

| 方法 | FVD ↓ | 灵活历史条件化 |
|------|-------|----------------|
| MAGVIT-v2 | 4.3±0.1 | ✗ |
| W.A.L.T | 3.3±0.1 | ✗ |
| Rolling Diffusion | 5.2 | ✗ |
| Standard Diffusion (SD) | 247.5 | ✗ |
| Binary-Dropout (BD) | 表现差 | ▲ |
| **DFoT (从头训练)** | **181.6** | ✔ |
| **DFoT (微调)** | **~180** | ✔ |
| **DFoT + HG-v** | **181.6 (ω=1.5)** | ✔ |
| **DFoT + HG-tf** | **170.4** | ✔ |

关键发现：
- DFoT 超越了所有基线，包括针对特定历史长度优化的 SD
- 二元 Dropout (BD) 表现显著下降，产生伪影和不一致生成
- DFoT 可以通过微调现有模型获得，仅需 12.5% 的训练成本

### 4.2 History Guidance 的效果

**Vanilla HG 的质量 - 多样性权衡：**
- 最佳 FVD 在ω=1.5 时获得 (181.6)
- 更高的引导尺度会提升质量但降低多样性
- ω≥3 时生成过于静态的视频

**Fractional HG 的动态性提升：**
- 通过引导低频信息，显著增加运动动态性
- FVD 从 181.6 降至 170.4
- 超越了 FS (1040)、SD (247.5) 和无引导的 DFoT (208.0)

### 4.3 新能力展示

**任务 1：分布外 (OOD) 历史鲁棒性**
- 在 RealEstate10K 上测试极端相机旋转的插值
- 基线方法失败，产生不连贯生成
- DFoT + HG-t 通过分割 OOD 历史为分布内子序列，保持高质量生成

**任务 2：长上下文生成 (Minecraft)**
- 需要长上下文才能获得好的 FVD
- HG-t 平衡长期记忆和 OOD 鲁棒性
- FVD 从 97.63 提升至 79.19

**任务 3：长视野但反应式的模仿学习**
- 机器人操作任务，需要长期记忆和短期反应性
- 基线无法整合两种行为
- DFoT + HG-t 组合全历史分数（记忆）和单帧分数（反应性）
- 成功率 83%，基线完全失败

### 4.4 超长视频生成

**关键展示：从单张图像生成 862 帧导航视频**

> "We extend a single image to an 862-frame video in RE10K. Even the most high-performing prior methods can only roll out for dozens of frames under the same setup."

这是通过以下技术实现的：
- DFoT 的灵活条件化能力
- HG-tf 增强的质量、一致性和滚动稳定性
- 远超训练集中的最大视频长度

## 5. 优点与局限

### 优点

1. **灵活的历史条件化**：支持任意长度、任意子集的历史帧
2. **显著提升视频质量**：FVD 超越现有方法，达到行业模型水平
3. **超长视频生成能力**：稳定生成 800+ 帧视频
4. **分布外泛化能力**：对 OOD 历史保持鲁棒性
5. **高效微调**：可用 12.5% 训练成本从现有模型微调
6. **理论保证**：提供变分下界 (ELBO) 的理论证明

### 局限

1. **计算成本**：虽然优于行业模型，但仍需要大量计算资源
2. **引导尺度权衡**：高质量和高多样性之间存在权衡
3. **复杂采样策略**：HG-tf 的最佳参数设置需要进一步研究
4. **潜在滥用风险**：生成高质量长视频可能被用于不当内容

## 6. 总结

本文提出的 Diffusion Forcing Transformer 和 History Guidance 方法代表了视频生成领域的重要进展：

**核心贡献：**
1. DFoT 架构：支持灵活历史条件化的竞争性视频扩散框架
2. History Guidance 方法族：显著提升视频质量、一致性和运动动态性
3. 新能力展示：超长视频生成、OOD 鲁棒性、长视野反应式控制

**实际意义：**
- 为机器人学、虚拟现实、内容创作等领域提供强大工具
- 展示了通过灵活条件化释放扩散模型潜力的新方向
- 为未来整合现有基础模型提供了可行路径

**未来方向：**
- 探索更复杂的采样策略
- 整合文本等多模态条件
- 扩展到更高分辨率和更长视频

---

## 参考文献

1. Song K, Chen B, Simchowitz M, Du Y, Tedrake R, Sitzmann V. History-Guided Video Diffusion. ICML 2025.
2. Chen B, et al. Diffusion Forcing: Next-token Prediction Meets Full-sequence Diffusion. NeurIPS 2024.
3. Ho J, Salimans T. Classifier-Free Diffusion Guidance. arXiv:2207.12598, 2022.
4. Peebles W, Xie S. Scalable Diffusion Models with Transformers (DiT). ICCV 2023.
5. Blattmann A, et al. Stable Video Diffusion. arXiv:2311.15127, 2023.

---

*本文总结基于 arXiv:2502.06764，更多技术细节和可视化结果请访问 [项目主页](https://boyuan.space/history-guidance)*
