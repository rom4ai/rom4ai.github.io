---
layout: post
title: "GOMA: Geometrically Optimal Mapping via Analytical Modeling for Spatial Accelerators"
categories: [research, ai, accelerator, mapping]
author: ROM4AI
date: 2026-03-16
original_paper: "https://arxiv.org/abs/2603.07962"
tags: ["spatial-accelerators", "GEMM", "mapping", "optimization", "analytical-modeling"]
---

# GOMA: Geometrically Optimal Mapping via Analytical Modeling for Spatial Accelerators

> **原文链接**: [arXiv:2603.07962](https://arxiv.org/abs/2603.07962) | [PDF](https://arxiv.org/pdf/2603.07962.pdf)

## 摘要

GOMA 是一个基于几何抽象和解析建模的全局最优 GEMM 映射框架，用于空间加速器。它通过首创的计算网格几何抽象，实现了精确的解析能量目标函数（O(1) 评估），并将映射选择公式化为硬件约束下的整数优化问题。实验表明，在代表性加速器和 LLM 预填充工作负载上，GOMA 相比 SOTA 映射器实现了 2.24-4.24 倍的 EDP 提升，同时求解速度提升 3.83-73.6 倍。

## 1. 问题定义

> "General matrix multiplication (GEMM) on spatial accelerators is highly sensitive to mapping choices in both execution efficiency and energy consumption. However, the mapping space exhibits combinatorial explosion, which makes it extremely challenging to obtain optimal mappings within an acceptable time budget."

空间加速器上的 GEMM 操作对映射选择极其敏感。相同的算法和硬件，不同的映射可能导致能效和性能相差数个数量级。然而，映射空间呈组合爆炸增长（典型 GEMM 的映射空间远超 10^10），使得穷举搜索最优映射在计算上不可行。

现有方法面临的核心挑战：

- **搜索方法**（随机搜索、启发式搜索）：无法保证全局最优，解的质量不稳定
- **可微分近似**：引入近似误差，松弛 - 舍入过程破坏最优性
- **数学规划**：现有工作难以精确刻画真实硬件成本，求解效率有限

因此，**在可接受时间内获得可证明的全局最优映射**仍是一个亟待解决的开放问题。

## 2. 方法框架

GOMA 的核心思想是将 GEMM 映射问题转化为**分层几何遍历问题**，通过投影更新计数来统一组织能量计算。

![GOMA 方法框架](/assets/goma/goma-framework.png)
*图：GOMA 整体工作流程（来源：原文 Figure 5）*

### 2.1 3D 计算网格几何抽象

> "We introduce a new compute-grid geometric abstraction for GEMM mapping, derived from first principles, which yields an exact analytical closed-form energy objective with O(1) evaluation and 99.9% consistency with timeloop-model."

GOMA 从第一性原理出发，将 GEMM 计算抽象为 3D 计算网格：

```
G = {(x, y, z) | x ∈ [1, Lx], y ∈ [1, Ly], z ∈ [1, Lz]}
```

其中每个 MAC（乘累加）操作对应一个计算点 (x, y, z)。三个矩阵自然对齐到三个正交投影平面：

- **A 矩阵** ↔ x-z 平面投影
- **B 矩阵** ↔ y-z 平面投影
- **输出 P** ↔ x-y 平面投影

这种几何表示的关键价值在于：**"循环如何嵌套/并行性如何映射"可以统一转化为"如何分层覆盖和遍历计算网格 G"**。

### 2.2 层级瓦片与数据投影

硬件采用五级存储层次：DRAM → SRAM → PE 阵列 → 寄存器文件 → MACC。执行过程可概括为：

1. 全局计算点集（DRAM）首先划分为大的 SRAM 瓦片
2. 再细分为 PE 阵列瓦片
3. 再细分为寄存器瓦片
4. 最后在每个寄存器瓦片内逐点执行 MAC 操作

对于任何 3D 计算瓦片，其在三个正交平面上的投影面积分别给出了 A、B、P 的数据需求规模。

### 2.3 遍历轴与数据复用

> "When a 3D compute tile advances by one step along an axis, exactly one of the three 2D projections stays unchanged, while the other two change."

遍历轴（walking axis）决定了哪种数据可以获得时间复用：

- 沿 **y 轴** 前进 → x-z 投影不变 → **A 矩阵可复用**
- 沿 **x 轴** 前进 → y-z 投影不变 → **B 矩阵可复用**
- 沿 **z 轴** 前进 → x-y 投影不变 → **部分和 P 可复用**

因此，循环顺序影响能量的本质可归结为：**在给定层级，哪个投影能保持更长时间不变，决定了哪种数据类型能在该层级获得更强的时间复用**。

### 2.4 层级旁路（Level Bypass）

GOMA 引入了逐轴的旁路策略：如果某层级选择旁路某种数据类型，则该层级不再对该数据进行读写或驻留，数据直接从上层供应到下层。

> "Bypass makes the energy attribution of a transfer no longer confined to adjacent levels. For a given data type, its nearest upper resident level may be several levels away."

旁路机制改变了跨层访问链的能量归属，需要以"接收者为中心"重新组织能量计算。

### 2.5 闭式能量目标函数

基于上述几何抽象，GOMA 推导出闭式解析能量公式：

```
E_total = E_src-1 + E_src-3 + E_src-4 + E_compute + E_leak
```

其中每项都是投影更新计数 × 单位能量权重的闭合形式表达式。关键优势：

- **O(1) 评估复杂度**：能量评估不随问题规模增长
- **99.9% 一致性**：与 Timeloop 模型相比，平均相对误差仅 0.099%

### 2.6 全局优化公式化

GOMA 将映射搜索公式化为约束优化问题：

```
min E_total
s.t. 
  - 容量约束（SRAM/寄存器文件大小限制）
  - PE 数量约束
  - 整除性约束（相邻层级瓦片尺寸必须整除）
  
决策变量:
  - 各层级瓦片形状 L(p)_d
  - 各阶段遍历轴 α
  - 各轴旁路决策 B
```

使用 Gurobi 求解器通过分支定界法求解，输出**可验证的最优性证书**（上界/下界/间隙=0）。

## 3. 实验设置

### 3.1 工作负载

选择代表性大模型，评估 LLM 预填充阶段的 GEMM 操作：

| 类别 | 模型 | 输入序列长度 |
|------|------|-------------|
| 边缘 LLM | Qwen3-0.6B, LLaMA-3.2-1B | 1k, 8k, 32k |
| 中心 LLM | Qwen3-32B, LLaMA-3.3-70B | 2k, 32k, 128k |

共 12 个工作负载，每个工作负载包含 8 种 GEMM 类型（attn_q_proj, attn_kv_proj, attn_score, attn_context, attn_output, mlp_gate_up, mlp_down, lm_head）。

### 3.2 目标加速器

选择 4 个代表性空间加速器模板：

| 加速器 | GLB (KiB) | PE 数量 | RF (字/PE) | 工艺 (nm) | DRAM |
|--------|-----------|---------|-----------|-----------|------|
| Eyeriss-like | 162 | 256 | 424 | 65 | LPDDR4 |
| Gemmini-like | 576 | 256 | 1 | 22 | LPDDR4 |
| A100-like | 36864 | 65536 | 128 | 7 | HBM2 |
| TPU v1-like | 30720 | 65536 | 2 | 28 | DDR3 |

共 24 个评估案例（6 个边缘工作负载 × 2 个边缘加速器 + 6 个中心工作负载 × 2 个中心加速器）。

### 3.3 基线方法

对比 5 个代表性映射算法/框架：

- **Timeloop-mapper (Hybrid)**：混合搜索方法
- **LOMA**：基于循环顺序的内存分配
- **SALSA**：模拟退火调度器
- **CoSA**：约束优化调度
- **FactorFlow**：因子流方法

## 4. 实验结果

### 4.1 EDP 对比

下表总结了 24 个评估案例的归一化 EDP（相对于 GOMA，越小越好）：

| 方法 | 几何平均 | 中位数 |
|------|----------|--------|
| **GOMA** | **1.00×** | **1.00×** |
| CoSA | 2.24× | 1.83× |
| FactorFlow | 3.91× | 2.51× |
| LOMA | 4.17× | 4.31× |
| SALSA | 4.24× | 4.37× |
| Timeloop Hybrid | 98.5× | 2.95× |

**关键发现**：

1. **全面领先**：GOMA 在所有工作负载和所有加速器模板上都实现了最低 EDP，在模型规模（0.6B→70B）、序列长度（1k→128k）和硬件资源（256→65k PEs）上均表现出鲁棒优势。

2. **启发式方法不稳定**：LOMA、SALSA、FactorFlow 等方法在某些案例中接近最优，但在其他案例中偏差较大，表现出工作负载依赖的波动性。这是因为目标函数受多级瓦片、循环置换和离散约束共同影响，形成高度非凸、不连续的组合景观。

3. **旁路是关键自由度**：Timeloop Hybrid 在 Eyeriss-like 和 Gemmini-like 模板上表现最佳（除 GOMA 外），主要得益于其能够探索多层级的旁路组合。

### 4.2 求解时间对比

| 方法 | 几何平均归一化时间 |
|------|-------------------|
| **GOMA** | **1.00×** (5.22 秒/案例) |
| CoSA | 3.83× |
| LOMA | 11.0× |
| FactorFlow | 23.3× |
| Timeloop Hybrid | 43.5× |
| SALSA | 73.6× |

GOMA 不仅找到最优解，而且**求解速度最快**：

- 案例级运行时间几何平均：5.22 秒
- 平均每个 GEMM：仅 0.65 秒
- 最大单层运行时间：3.6 秒

满足实时映射需求。

### 4.3 逐层 EDP 分解分析

对于矩阵 - 向量形状的 GEMM（如 lm_head），多种方法都能接近最优；但对于**矩阵 - 矩阵 GEMM**，GOMA 的优势随规模放大：

- 在 Gemmini-like + LLaMA-3.2-1B (1k) 案例中，GOMA 在 attn_q_proj、attn_kv_proj、mlp_gate_up、mlp_down 等矩阵 - 矩阵工作负载上已显示出稳定领先
- 在 A100-like + LLaMA-3.3-70B (128k) 等更大规模设置中，这些领先优势进一步放大

这表明：**随着规模增加，映射空间的组合爆炸使得采样/启发式方法更难可靠地找到高质量解，而解析建模 + 全局求解提供了更强的确定性和保证**。

## 5. 优点与局限

### 优点

1. **全局最优保证**：通过整数优化公式化和分支定界求解，输出可验证的最优性证书
2. **高效求解**：O(1) 能量评估 + 低维整数决策变量，实现稳定且快速的求解
3. **高保真模型**：与 Timeloop 模型 99.9% 一致性，精确刻画真实硬件成本
4. **统一框架**：同时优化瓦片形状、循环置换和旁路决策
5. **实用性强**：针对 GEMM（LLM 和 DiT 中的主导计算），具有实际应用价值

### 局限

1. **适用范围**：当前仅针对 GEMM 操作，扩展到卷积等操作需要 generalize 到更高维计算网格
2. **硬件模板**：针对特定加速器模板（五级层次结构），其他硬件架构需要重新建模
3. **单算子优化**：当前聚焦单 GEMM 实例，多层映射探索和软硬件协同优化是未来方向
4. **量化假设**：默认使用 8-bit 量化权重和激活，其他精度需要调整能量参数

## 6. 总结

GOMA 提出了一个统一的 GEMM 映射优化框架，通过几何抽象将分层执行转化为投影更新计数的闭式计算，并通过逐轴旁路重写跨层访问链。这使得任何给定映射的能量评估都能在 O(1) 时间内完成。

在此基础上，GOMA 将瓦片、循环置换和旁路联合公式化为整数优化问题，通过全局求解输出可验证的最优性证书，在建模目标和约束下严格保证全局最优性。

实验结果表明，GOMA 的解析模型与 Timeloop 模型高度一致。在多个代表性硬件模板和 LLM 预填充工作负载上，GOMA 始终实现最低 EDP，相比现有 SOTA 映射器实现 **2.24-4.24 倍 EDP 提升**和 **3.83-73.6 倍求解速度提升**。

> **代码开源**: https://github.com/ywlywl6/GOMA

## 参考文献

1. Yang W, Zou H, Zhou R, et al. GOMA: Geometrically Optimal Mapping via Analytical Modeling for Spatial Accelerators. arXiv preprint arXiv:2603.07962, 2026.
2. Parashar A, et al. Timeloop: A systematic approach to DNN accelerator evaluation. ISPASS, 2019.
3. Huang Q, et al. CoSA: Scheduling by constrained optimization for spatial accelerators. ISCA, 2021.
4. Symons A, et al. LOMA: Fast auto-scheduling on DNN accelerators through loop-order-based memory allocation. AICAS, 2021.
5. Jung V J B, et al. SALSA: Simulated annealing based loop-ordering scheduler for DNN accelerators. AICAS, 2023.
