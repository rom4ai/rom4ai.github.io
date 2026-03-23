---
layout: post
title: "History-Guided Video Diffusion: 用历史引导实现超长视频生成"
categories: [research, ai, video-generation, diffusion-models]
author: ROM4AI
date: 2026-03-23
original_paper: "https://arxiv.org/abs/2502.06764"
tags: ["Video Diffusion", "Classifier-Free Guidance", "DFoT", "Long Video Generation", "Temporal Consistency"]
---

# History-Guided Video Diffusion: 用历史引导实现超长视频生成

> **原文链接**: [arXiv:2502.06764](https://arxiv.org/abs/2502.06764) | [PDF](https://arxiv.org/pdf/2502.06764.pdf)

**会议**: ICML 2025 (Proceedings of the 42nd International Conference on Machine Learning)

**机构**: MIT, Carnegie Mellon University, Harvard

## 核心亮点

本文提出**Diffusion Forcing Transformer (DFoT)**和**History Guidance (HG)**，实现了灵活的历史帧条件视频生成。该方法能够稳定生成**862 帧**的超长导航视频——远超训练集最大视频长度，性能媲美需要**一个数量级更多计算资源**的行业模型。

## 摘要

Classifier-free guidance (CFG) 是扩散模型中提升条件生成质量的关键技术。在视频扩散中，自然地将可变数量的上下文帧（称为"历史"）作为条件变量。然而，使用可变长度历史进行引导面临两个关键挑战：**仅支持固定大小条件输入的架构**，以及**CFG 风格的历史丢弃经验上表现不佳**。

本文提出 Diffusion Forcing Transformer (DFoT)——一个视频扩散架构和理论基础的训练目标，共同实现了对灵活数量历史帧的条件化。进而引入 History Guidance，一系列由 DFoT 独特支持的引导方法。最简单形式（vanilla history guidance）已显著提升视频生成质量和时间一致性。更高级的方法（history guidance across time and frequency）进一步增强运动动态，实现对分布外历史的组合泛化，并能稳定 rollout 超长视频。

## 1. 问题定义

### 1.1 视频扩散中的条件化挑战

视频扩散模型是条件扩散模型 `p(x|c)`，其中 `x` 表示要生成的帧，`c` 表示条件（如文本提示或观察到的 prior 帧）。在视频生成中，历史帧作为条件变量至关重要，特别是对于自回归扩展新生成的视频。

> "然而，我们发现使用可变长度历史进行引导面临两个关键挑战：仅支持固定大小条件输入的架构，以及 CFG 风格的历史丢弃经验上表现不佳。"

### 1.2 现有方法的局限

**固定长度条件限制**：
- DiT 或 U-Net 基扩散模型通常使用 AdaLN 层或沿通道维度拼接来注入条件
- 这种设计将条件限制为固定大小向量
- 某些模型采用序列编码器处理可变长度条件（如文本输入），但这些编码器通常是预训练的，无法与扩散模型共享参数来编码历史帧
- 因此，引导被限制为固定长度且通常较短的历史

**Framewise Binary Dropout 表现不佳**：
- CFG 通常使用单个网络联合表示条件和无条件扩散模型，通过随机丢弃条件 `c` 实现
- 当扩展到历史引导时，这种二元丢弃训练经验上表现次优
- 导致样本质量显著下降

### 1.3 核心研究问题

> "能否使用不同部分的历史——可变长度、帧子集、甚至不同的图像域频率——作为视频生成的引导形式？"

## 2. 方法

### 2.1 Diffusion Forcing Transformer (DFoT)

DFoT 扩展了 Diffusion Forcing 中的"noising-as-masking"范式到非因果 transformer，通过**对每帧应用独立噪声级别**来训练视频扩散模型。

#### 核心设计

**传统视频扩散 vs DFoT**：

| 特性 | 传统方法 | DFoT |
|------|----------|------|
| 噪声级别 | 所有 token 统一 | 每帧独立变化 |
| 历史处理 | 单独编码器 + AdaLN 注入 | 不区分历史和生成帧 |
| 条件化 | 固定长度 | 任意子集 |
| 架构兼容性 | 需专门设计 | 兼容现有 DiT/U-ViT |

**训练目标**：

给定 T 帧视频剪辑 `x_T`，定义 `H ⊂ T` 为用于条件的历史帧索引，`G = T \ H` 为要生成的帧索引。目标是建模条件分布 `p(x_G | x_H)`。

DFoT 对序列所有帧去噪，其中帧具有独立变化的噪声级别。在采样时，可以通过噪声选择性掩码历史的部分，实现灵活的条件化和引导。

#### 理论 justification

通过变分下界提供训练目标的理论 justification。DFoT 可以高效地通过微调预训练视频扩散模型实现。

### 2.2 History Guidance (HG) 家族

在采样时，DFoT 支持一系列历史条件引导方法：

#### 2.2.1 Vanilla History Guidance (HG-v)

最简单的形式，使用**任意长度的历史**作为 CFG 的条件变量：

```
∇ log p_k(x_k^G) + ω [∇ log p_k(x_k^G | x_H) - ∇ log p_k(x_k^G)]
```

其中 `ω ≥ 1` 是引导尺度。

> "值得注意的是，即使这种简单方法也显著增强了视频质量。"

#### 2.2.2 Temporal History Guidance (HG-t)

组合不同历史窗口的分数：

```
s(x) = ω1 · s(x | H1) + ω2 · s(x | H2) - s(x | ∅)
```

其中 `H1` 和 `H2` 是不同的历史子序列（如 `{0,1,2}` 和 `{1,2,3}`）。

**关键优势**：
- 实现对分布外（OOD）历史的鲁棒性
- 通过组合分布内短历史窗口近似严格 OOD 历史

#### 2.2.3 Fractional History Guidance (HG-f)

对历史窗口应用**不同程度的噪声腐蚀**，有效充当历史帧的"低通滤波器"：

```
s(x) = ∇ log p_k(x_k^G | x_H^{k_H})
```

其中 `k_H` 是分数掩码程度（如 `k_H = 0.8`）。

**扩展**：通过轻微修改，可以针对特定频率带宽增强生成视频的动态程度。

#### 2.2.4 History Guidance Across Time and Frequency (HG-tf)

组合 HG-t 和 HG-f 创建全面的历史引导范式：

```
s(x) = ω_t · [s(x | H1) + s(x | H2)] + ω_f · s(x | H^{k_H})
```

### 2.3 实现细节

#### 架构配置

**Kinetics-600 模型**：
- Backbone: DiT
- 层数：28
- 隐藏大小：1152
- 注意力头：16
- 训练步数：640k
- 批量大小：192

**RealEstate10K 模型**：
- Backbone: U-ViT
- 层配置：`[ResNet×2, Transformer×2] × 4`
- 隐藏大小：`[128, 256, 576, 1152]`
- 训练步数：500k

**Minecraft 模型**：
- Backbone: DiT
- 层数：12
- 隐藏大小：768
- 输入：50 帧 256×256

#### 训练技巧

**帧跳跃（Frame Skip）**：
- Kinetics-600: stride=1
- Minecraft: stride=2
- RealEstate10K: 从 10 开始递增到最大可能

**Loss 重加权**：
- min-SNR: Kinetics 和 robot learning
- Sigmoid: RealEstate10K 和 Minecraft

**噪声调度偏移**：`0.125`，显著提升样本质量

**参数化**：v-parameterization（除 robot 模型使用 x0）

## 3. 实验结果

### 3.1 Kinetics-600 基准测试

**任务设置**：条件化前 5 帧历史，预测接下来 11 帧

**FVD 比较**（越低越好）：

| 方法 | FVD | 参数量 | 批量大小 |
|------|-----|--------|----------|
| Video Diffusion | ~200 | 1.1B | 256 |
| MAGVIT | ~190 | - | 256 |
| MAGVIT-v2 | ~185 | - | 256 |
| W.A.L.T | ~175 | - | 512 |
| Rolling Diffusion | ~190 | 1.2B | 512 |
| **DFoT (scratch)** | **181.6** | 673M | 192 |
| **DFoT + HG-v** | **170.4** | 673M | 192 |
| **DFoT + HG-f** | **170.4** | 673M | 192 |

> "尽管资源劣势，DFoT 证明与这些强基线高度竞争。仅略落后于 W.A.L.T，与 MAGVIT-v2 相当，并超越其他。"

### 3.2 History Guidance 效果

#### 引导尺度消融

**FVD vs 引导尺度 ω**：

| ω | DFoT + HG-v | BD + HG-v |
|---|-------------|-----------|
| 1.0 | 208.0 | - |
| 1.5 | **181.6** | 196.0 |
| 2.0 | 185.0 | 188.0 |
| 2.5 | 190.0 | **185.0** |
| 3.0 | 195.0 | 192.0 |
| 4.0 | 210.0 | 220.0 |

**最优配置**：`ω = 1.5` 时 DFoT 达到最低 FVD 181.6，而 Binary-Dropout (BD) 为 196.0

**定性比较**：DFoT 生成一致、高质量样本，而 BD 难以与历史帧保持一致并产生伪影。

### 3.3 分布外（OOD）历史泛化

**任务**：给定 4 帧历史（不同旋转角度），生成 4 帧插值

**旋转角度分布**：
- 训练集：通常 < 100°
- OOD 定义：> 140°（训练集中 < 100 个场景）

**LPIPS 比较**（越低越好）：

| 方法 | ID (0-100°) | Slight OOD (100-140°) | OOD (>140°) |
|------|-------------|----------------------|-------------|
| 标准 CFG | 0.15 | 0.28 | 0.45 |
| **HG-t** | **0.14** | **0.18** | **0.22** |

> "通过组合分布内短历史窗口，HG-t 能有效近似训练期间未见过的严格 OOD 历史。"

### 3.4 长上下文生成（Minecraft）

**任务设置**：
- 训练：50 帧 DFoT 模型，条件化历史最长 25 帧
- 测试：自回归扩散接下来 25 帧，rollout 5 次共 125 帧

**FVD 比较**：
- 标准条件扩散（全上下文）：97.625
- **DFoT + HG-t**: **79.19**

**定性观察**：DFoT 的预测在大多数帧上与 ground truth 语义对齐，而长上下文模型无时间引导会遭受高维上下文问题，更可能在历史中看到 OOD 帧。

### 3.5 机器人模仿学习

**任务**：水果交换任务——使用第三个槽交换两个水果的位置

**挑战**：
- 需要长期记忆（记住水果初始位置）
- 需要局部反应行为（应对人类扰动）

**基线**：
- Markov 模型：仅基于当前观察扩散接下来动作
- 2-frame 模型：看到前两帧作为短历史
- Full-history 模型：条件化到目前为止的整个历史

**成功率比较**：

| 方法 | 无扰动 | 人类扰动 | 强扰动 |
|------|--------|----------|--------|
| Markov | 0% | 0% | 0% |
| 2-frame | 0% | 15% | 0% |
| Full-history | 75% | 12% | 0% |
| **DFoT + HG** | **85%** | **83%** | **28%** |

> "DFoT 组合引导实际上是在拼接子轨迹做决策，或至少同时从全上下文模型借用记忆，同时使用短上下文模型保持局部反应性。"

**引导配置**：
- Full-history 模型：权重 0.2
- 1-frame 模型：权重 0.45
- 4-frame 模型：权重 0.45

### 3.6 超长视频生成（RealEstate10K）

**核心成果**：从单张图像生成**862 帧**导航视频

**生成流程**：

**Phase 1: Rollout**
- 滑动窗口方法：条件化最后 4 帧生成接下来 4 帧
- 第一次迭代例外：条件化单张图像生成接下来 7 帧
- 用户导航 UI：指定水平/垂直角度和移动距离
- 默认引导：HG-f (`ω=4, k_H=0.4`)
- 挑战场景切换：HG-v (`ω=4`)，当方向变化 >30° 或移动距离超过阈值

**Phase 2: Interpolation**
- 插值因子：7×
- 每对连续生成帧之间插值 6 帧
- 相机姿态：SLERP 插值旋转矩阵，线性插值平移向量
- 引导：HG-v (`ω=1.5`) 确保平滑一致

**稳定化技术**：
- 先前生成帧标记为轻微噪声 (`k=0.02`)
- 防止误差累积

**与基线比较**：
- SD (Standard Diffusion): ~30 帧失败
- 4DiM (文献最佳): 最大 32 帧
- **DFoT + HG**: **862 帧稳定 rollout**

## 4. 技术亮点

### 4.1 微调效率

从预训练 full-sequence (FS) 模型微调 DFoT：

| 配置 | 训练步数 | FVD | 训练 Loss |
|------|----------|-----|-----------|
| DFoT (scratch) | 640k | 4.3 | 0.108 |
| DFoT (fine-tuned) | 40k | 5.2 | 0.110 |
| DFoT (fine-tuned) | 80k | 4.7 | **0.106** |

> "微调模型仅 40k 步后达到与从头训练 405k 步相当的训练 loss——约**10×加速**。"

### 4.2 计算资源对比

**DFoT 资源**：
- 参数量：673M (DiT/XL)
- 批量大小：192
- GPU: 12×H100, ~5 天

**行业基线**：
- Video Diffusion: 1.1B, batch=256
- W.A.L.T: DiT/L, batch=512
- Rolling Diffusion: 1.2B, batch=512

> "MAGVIT 和 MAGVIT-v2 使用与 DFoT 相当的资源，而 Video Diffusion、W.A.L.T 和 Rolling Diffusion 需要显著更多资源。"

### 4.3 引导方案总结

| 方法 | 适用场景 | 引导尺度 | 特点 |
|------|----------|----------|------|
| HG-v | 通用提升 | ω=1.5-4.0 | 简单有效 |
| HG-t | OOD 泛化 | ω1=ω2=2.0 | 组合历史窗口 |
| HG-f | 长 rollout 稳定 | ω=4.0, k_H=0.4 | 分数掩码 |
| HG-tf | 综合场景 | 组合 | 时间 + 频率 |

## 5. 与相关工作的对比

### 5.1 vs Classifier-Free Guidance

| 特性 | 传统 CFG | History Guidance |
|------|----------|-----------------|
| 条件变量 | 文本/单帧 | 任意历史子集 |
| 训练方式 | 二元丢弃 | 独立噪声级别 |
| 引导形式 | 单条件 | 多条件组合 |
| OOD 鲁棒性 | 有限 | 强（HG-t） |

### 5.2 vs Diffusion Forcing

| 特性 | Diffusion Forcing | DFoT |
|------|-------------------|------|
| 架构 | 因果 state-space | 非因果 state-free |
| 应用 | 序列建模 | 视频生成 |
| 条件化 | 因果历史 | 任意子集 |
| 引导 | 无 | History Guidance 家族 |

## 6. 局限性与未来方向

### 6.1 当前局限

**EMA 影响**：
- 微调模型训练 loss 更低但 FVD 略高
- 归因于 EMA (decay=0.9999) 受最后数万步影响
- 无 EMA 时 FVD 显著升高（80k 步：7.3 vs 4.7）

**强 OOD 挑战**：
- 强扰动下成功率仅 28%
- 需要更多数据或更强泛化能力

### 6.2 未来方向

**大规模微调**：
- 微调大型基础视频扩散模型到 DFoT
- 计算成本小，潜力巨大

**EMA 优化**：
- 选择更小 EMA decay 保证样本质量
- Post hoc EMA tuning 策略

**频率引导扩展**：
- 针对特定频率带宽
- 增强动态程度控制

## 7. 总结

History-Guided Video Diffusion 代表了视频生成的重要进展：

**核心贡献**：
1. **DFoT 架构**：竞争性视频扩散框架，支持采样时使用任意部分历史进行条件化
2. **History Guidance 家族**：HG-v、HG-t、HG-f、HG-tf，显著提升一致性、运动动态和视觉质量
3. **SOTA 性能**：尤其在长视频生成中展现新能力

**关键成果**：
- Kinetics-600 FVD 170.4，媲美需要更多资源的行业模型
- OOD 历史泛化：LPIPS 从 0.45 降至 0.22
- 机器人模仿学习成功率 83%
- **862 帧超长视频稳定生成**

**技术亮点**：
- 独立噪声级别训练实现灵活条件化
- 多历史窗口组合实现 OOD 鲁棒性
- 分数掩码充当低通滤波器增强稳定性
- 微调预训练模型实现 10× 加速

**影响**：
- 为超长视频生成开辟新路径
- 提供理论基础的灵活条件化框架
- 兼容现有架构便于采用

这项工作展示了历史引导在视频扩散中的巨大潜力，为构建更强大、更灵活的视频生成模型奠定了基础。

## 参考文献

1. Kiwhan Song et al. History-Guided Video Diffusion. ICML, 2025.
2. Boyuan Chen et al. Diffusion Forcing: Next-token Prediction Meets Full-Sequence Diffusion. NeurIPS, 2024.
3. William Peebles & Saining Xie. Scalable Diffusion Models with Transformers. ICCV, 2023.
4. Jonathan Ho & Tim Salimans. Classifier-Free Diffusion Guidance. NeurIPS, 2022.
5. Team Wan. Wan: Open and Advanced Large-Scale Video Generative Models. arXiv:2503.20314, 2025.
