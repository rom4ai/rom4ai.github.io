---
layout: post
title: 'Helios: Hardware-Software Co-design for 3D-DRAM-based LLM Serving Accelerator'
categories:
- research
- ai-accelerator
- memory-system
- llm-inference
author: ROM4AI
date: 2026-04-01
original_paper: "https://arxiv.org/abs/2603.04797"
tags:
- memory-system
- llm-inference
- ai-accelerator
- kv-cache
- edge-ai
---

# Helios: Hardware-Software Co-design for 3D-DRAM-based LLM Serving Accelerator

> **原文链接**: [arXiv:2603.04797](https://arxiv.org/abs/2603.04797) | Authors: Cong Li, Yihan Yin, Chenhao Xue, Zhao Wang, Fujun Bai, Yixin Guo, Xiping Jiang, Qiang Wu, Yuan Xie, Guangyu Sun (Peking University, Xi'an UniIC, Houmo AI, HKUST)

## 摘要

Helios 是一个基于混合键合（Hybrid Bonding）3D-DRAM 的 LLM 服务加速器，通过近存计算（Near-Memory Processing, NMP）范式解决 LLM 服务中的动态工作负载挑战。该设计提出了分布式分块注意力执行机制、空间感知 KV 缓存分配策略，以及针对 NMP 架构的通信原语优化。相比现有 GPU/NMP 设计，Helios 实现了 **3.25 倍** 的端到端加速和 **3.36 倍** 的能效提升，同时将 P50/P99 time-between-tokens（TBT）降低 **72%/76%**。

---

## 1. 问题定义：LLM 服务的动态挑战

### 1.1 LLM 服务的独特需求

大语言模型（LLM）在线服务面临高度动态的工作负载：

> "In LLM serving, multiple LLM instances jointly handle highly dynamic request workloads, characterized by widely varying sequence lengths (as high as 10K tokens) and rapidly fluctuating arrival rates (as high as an order of magnitude)."

**动态性特征**:

| 特征 | 描述 | 挑战 |
|-----|------|------|
| **序列长度变化** | 从数百到数万 token | 内存需求高度可变 |
| **到达率波动** | 数量级变化（如 1x → 10x） | 负载均衡困难 |
| **批次大小变化** | 小批次（4-8）到大批次（32-64） | 计算模式切换 |
| **上下文非均匀** | 不同请求有不同上下文长度 | 内存碎片化 |

### 1.2 LLM 推理的两阶段特性

LLM 推理包含两个截然不同的阶段：

**Prefill 阶段（计算密集）**:
- 一次性处理输入 token 序列（prompt）
- 生成第一个输出 token
- 需要全序列的自注意力计算
- 计算密集，适合 GPU/TPU

**Decoding 阶段（内存密集）**:
- 逐个生成后续 token
- 每次仅处理最后一个 token
- 需要访问所有历史 KV cache
- 内存密集，带宽瓶颈

```
Prefill vs Decoding:
┌─────────────────────────────────────────────────────────────┐
│  Prefill (Compute-bound)        Decoding (Memory-bound)     │
│  ───────────────────────        ───────────────────────     │
│                                                             │
│  Input: [t1, t2, t3, ..., tn]   Input: [t_last]             │
│         ↓                              ↓                    │
│  Full self-attention              KV cache lookup           │
│  (Q × K^T × V)                    (memory bandwidth limit)  │
│         ↓                              ↓                    │
│  Output: [o1]                     Output: [o_next]          │
│  (first token)                    (next token)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 现有方案的局限

**GPU/TPU 方案**:
- 计算能力强，但内存带宽受限（比计算能力低两个数量级）
- Decoding 阶段性能受限于带宽

**现有 NMP 方案的问题**:

| 问题 | 描述 | 影响 |
|-----|------|------|
| **粗粒度 KV 管理** | 注意力头静态分配到固定 NMP 模块 | 计算负载不均衡 |
| **内存碎片化** | 预留全上下文窗口 KV cache | 有效容量降低 |
| **非灵活执行流** | 要求完整 KV cache 在同一模块 | 无法细粒度分区 |
| **NMP 非均匀抽象** | 分布式内存与动态需求不匹配 | 数据传输开销 |

**根本矛盾**:
> "The fundamental gap between the dynamic nature of KV cache management in LLM serving and the distributed, non-uniform memory abstraction among NMP processing engines."

---

## 2. Helios 架构设计

### 2.1 总体架构

Helios 基于混合键合（Hybrid Bonding）3D-DRAM 技术构建：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Helios Architecture                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                 Hybrid-Bonding Device (HB-Device)            │   │
│   │  ┌─────────────────────────────────────────────────────┐    │   │
│   │  │              Logic Die (12nm, 1GHz)                  │    │   │
│   │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                 │    │   │
│   │  │  │ PE0 │ │ PE1 │ │ PE2 │ │ PE3 │  ... 4×4 Mesh    │    │   │
│   │  │  │     │ │     │ │     │ │     │                 │    │   │
│   │  │  │Matrix│ │Matrix│ │Matrix│ │Matrix│              │    │   │
│   │  │  │Unit │ │Unit │ │Unit │ │Unit │                 │    │   │
│   │  │  │Vector│ │Vector│ │Vector│ │Vector│              │    │   │
│   │  │  │Unit │ │Unit │ │Unit │ │Unit │                 │    │   │
│   │  │  │Online│ │Online│ │Online│ │Online│              │    │   │
│   │  │  │Softmax│ │Softmax│ │Softmax│ │Softmax│           │    │   │
│   │  │  │Unit │ │Unit │ │Unit │ │Unit │                 │    │   │
│   │  │  └─────┘ └─────┘ └─────┘ └─────┘                 │    │   │
│   │  │              Router NoC (Mesh Topology)            │    │   │
│   │  └─────────────────────────────────────────────────────┘    │   │
│   │                          │                                     │   │
│   │                   Hybrid Bonding                              │   │
│   │                          │                                     │   │
│   │  ┌─────────────────────────────────────────────────────┐    │   │
│   │  │              3D-DRAM Stack (4 dies)                  │    │   │
│   │  │  Die 0: 256 banks × 80MB = 20GB                      │    │   │
│   │  │  Die 1: 256 banks × 80MB = 20GB                      │    │   │
│   │  │  Die 2: 256 banks × 80MB = 20GB                      │    │   │
│   │  │  Die 3: 256 banks × 80MB = 20GB                      │    │   │
│   │  │  Total: 80GB per HB-Device                           │    │   │
│   │  │  Bandwidth: 256 I/O pins × 0.5Gbps per bank          │    │   │
│   │  └─────────────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   Multi-Device Scaling: TP=8, PP/EP support                          │
│   Interconnect: NVLink (600GB/s), NIC (8×200Gbps)                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 PE 架构设计

每个处理引擎（PE）包含：

| 组件 | 功能 | 面积 |
|-----|------|------|
| **Matrix Unit** | 密集矩阵运算（GEMM） | 17.6 mm² |
| **Vector Unit** | 向量运算（Softmax、LayerNorm） | 2.5 mm² |
| **Online Softmax Unit** | 分块 Softmax 计算 | 2.5 mm² |
| **Reduction Unit** | 跨 PE 结果归约 | 1.58 mm² |
| **Compute/Transfer Buffer** | 数据缓冲（各 2.5MB） | 10.66 mm² |
| **Router NoC** | 片上网络通信 | 1.65 mm² |
| **HB Controller** | 混合键合控制 | ~5 mm² |
| **Total per PE** | - | **48 mm²** |

**计算能力**:
- 512 个 16-MAC FPUs @ 1GHz
- 峰值算力：8 TFLOPS（FP16）

### 2.3 分布式分块注意力（Distributed Tiled Attention）

**核心创新**：突破现有 NMP 方案的非分块限制

```
传统 NMP（非分块）:
┌─────────────────────────────────────┐
│  KV Head 0  │  KV Head 1  │  ...   │
│  ┌─────────┐│  ┌─────────┐│        │
│  │Full Cache│  │Full Cache││        │
│  │  PE 0   ││  │  PE 1   ││        │
│  └─────────┘│  └─────────┘│        │
│  必须在同一 PE 上计算              │
│  → 无法跨 PE 分配                  │
└─────────────────────────────────────┘

Helios（分块）:
┌─────────────────────────────────────┐
│  Block 0 │ Block 1 │ Block 2 │ ...  │
│  ┌──────┐│ ┌──────┐│ ┌──────┐│      │
│  │PE 0  ││ │PE 1  ││ │PE 2  ││      │
│  └──────┘│ └──────┘│ └──────┘│      │
│  可跨所有 PE 灵活分配              │
│  → 细粒度动态管理                  │
└─────────────────────────────────────┘
```

**分块注意力算法（迭代版本）**:

```
Algorithm: Iterative Tiled Attention
─────────────────────────────────────
Input: Query Q, KV Blocks {K_i, V_i}
Output: Attention Output O

Initialize: m = -∞, l = 0, O = 0

For each KV block i:
    ❶ S_i = Q × K_i^T          // GEMM: Query × Key
    ❷ m_new = max(m, max(S_i)) // Online max
       l = l × exp(m - m_new) + Σ exp(S_i - m_new)
       m = m_new
    ❸ O = O × exp(m_old - m) + softmax(S_i) × V_i

Return O
```

**关键优势**:
- 支持 KV cache 的细粒度块级管理
- 允许跨 PE 分布式计算
- 通过在线 Softmax 保持数值稳定性

### 2.4 空间感知 KV 缓存分配

**核心问题**：如何在分布式 PE 上分配 KV 块，平衡负载并最小化通信？

**算法 2：空间感知 KV 块分配**

```
Input: Request with length L, Block size b
Output: Block allocation across PEs

1. Compute required blocks: n = ⌈L/b⌉

2. For each block j in [0, n-1]:
   a. Evaluate each PE's state:
      - CMPFull: 比较完整负载（已分配块数）
      - CMPLast: 比较最后块负载
   
   b. Select optimal PE:
      - Prefer PE with lower load
      - Consider spatial locality（连续块就近分配）
   
   c. Update PE state

3. Return block-to-PE mapping
```

**负载均衡策略**:

| 策略 | 适用场景 | 特点 |
|-----|---------|------|
| **CMPFull** | 长序列 | 基于完整负载比较，全局均衡 |
| **CMPLast** | 短序列 | 基于最后块负载，局部优化 |

**复杂度分析**:
- 使用优先队列维护 PE 状态
- 选择复杂度：O(log P)，P 为 PE 数量
- 实际开销可忽略（P=16）

---

## 3. 系统级设计

### 3.1 块管理器实现

Helios 的块管理器与 vLLM/SGLang 兼容：

**数据结构**:
```
Block Table (per model instance):
├── Available Block List: [free blocks per PE]
└── Request Block List: {req_id: [block_ids per PE]}

Block Address Calculation:
addr = base + (block_id × block_size + offset) × hidden_size
```

**分配流程**:
1. 新请求到达 → 计算所需块数
2. 调用空间感知分配器 → 选择最优 PE
3. 从可用列表移动块 ID 到请求列表
4. 解码完成后 → 释放块回可用列表

### 3.2 多设备扩展

Helios 支持大规模模型并行：

**Tensor Parallelism (TP)**:
- 算子按 TP 大小切分到不同设备
- 设备间通过 Router NoC 执行集合通信
- 输入根据划分策略散射到各设备

**Pipeline Parallelism (PP)**:
- 层间流水线并行
- 跨设备激活值传递

**Expert Parallelism (EP)**:
- 每个设备持有部分专家
- 支持任意专家映射和输入路由策略

### 3.3 服务集群架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Helios Serving Cluster                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐      ┌─────────────┐                     │
│   │ Prefill Pool │      │ Decoding Pool │                     │
│   │  (A100 GPUs) │      │ (HB-Devices) │                     │
│   │              │      │              │                     │
│   │ TP=8         │      │ TP=8         │                     │
│   │ Compute-bound│      │ Memory-bound │                     │
│   └─────────────┘      └─────────────┘                     │
│          │                      │                           │
│          └──────────┬───────────┘                           │
│                     │                                       │
│              Load Balancer                                  │
│                     │                                       │
│   Request → [Scheduling] → Prefill → KV Transfer → Decoding │
│                                                              │
│   Interconnect: NVLink (600GB/s), NIC (8×200Gbps)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 实验结果

### 4.1 评估设置

**测试模型**（覆盖 Dense 和 MoE）：

| 模型 | 规模 | 类型 | 注意力变体 |
|-----|------|------|-----------|
| OPT 66B | 66B | Dense | MHA |
| LLaMA3 70B | 70B | Dense | GQA |
| Mixtral 8×22B | 176B | MoE | GQA |
| Qwen3 30B-A3B | 30B | MoE | MLA |
| DeepSeek 236B | 236B | MoE | MHA/MLA |

**基线对比**:
1. **GPU**: A100-80GB + SGLang + FlashInfer
2. **In-die-NMP**: AttAcc bank-PIM 设计
3. **Duplex**: 4× NMP 带宽 + 32× 512-MAC-FPU
4. **HB-non-Tiled**: 混合键合但非分块注意力

### 4.2 端到端性能

**Decoding 加速与能效**:

| 对比 | vs GPU | vs In-die-NMP | vs Duplex | vs HB-non-Tiled |
|-----|--------|---------------|-----------|-----------------|
| **Speedup** | 3.25× | - | - | 1.67× |
| **Energy Efficiency** | 3.36× | - | - | 1.06× |

**端到端延迟（E2E Latency）**:

| 模型 | GPU | HB-non-Tiled | **Helios** | 降低 |
|-----|-----|--------------|-----------|------|
| OPT | 基准 | +6.7% | **39.5%** | 60.5% |
| LLaMA3 | 基准 | +13.7% | **56.9%** | 43.1% |
| Mixtral | 基准 | +6.7% | **48.2%** | 51.8% |
| Qwen3 | 基准 | +13.7% | **52.1%** | 47.9% |
| DeepSeek | 基准 | +6.7% | **45.3%** | 54.7% |

### 4.3 服务性能（Time-Between-Tokens）

**P50 TBT**:

| 模型 | GPU | HB-non-Tiled | **Helios** | 降低 |
|-----|-----|--------------|-----------|------|
| OPT | 基准 | 1.17× | **5.6%** | 94.4% |
| LLaMA3 | 基准 | 1.86× | **28.0%** | 72.0% |
| Mixtral | 基准 | 1.17× | **12.3%** | 87.7% |
| Qwen3 | 基准 | 4.86× | **15.6%** | 84.4% |
| DeepSeek | 基准 | 1.86× | **18.9%** | 81.1% |

**P99 TBT**:

| 模型 | GPU | HB-non-Tiled | **Helios** | 降低 |
|-----|-----|--------------|-----------|------|
| OPT | 基准 | 1.17× | **6.9%** | 93.1% |
| LLaMA3 | 基准 | 2.39× | **23.9%** | 76.1% |
| Mixtral | 基准 | 1.17× | **11.2%** | 88.8% |
| Qwen3 | 基准 | 4.86× | **14.8%** | 85.2% |
| DeepSeek | 基准 | 2.39× | **17.3%** | 82.7% |

**关键洞察**:
- Helios 实现 **72%/76%** P50/P99 TBT 降低
- 相比 HB-non-Tiled，分块注意力设计至关重要
- 对 MoE 模型（Mixtral、Qwen3、DeepSeek）同样有效

### 4.4 面积、功耗与热分析

**面积分解**（每 HB-Device）：

| 组件 | 面积 | 占比 |
|-----|------|------|
| Matrix Unit | 17.60 mm² | 36.7% |
| SRAM Buffer | 10.66 mm² | 22.2% |
| PE Controller | 5.06 mm² | 10.5% |
| 3D DRAM Controller | 4.80 mm² | 10.0% |
| Vector/Softmax/Reduction | 6.58 mm² | 13.7% |
| NoC | 3.30 mm² | 6.9% |
| **Total per PE** | **48 mm²** | - |
| **Total (16 PEs)** | **~768 mm²** | - |

**功耗分解**（每 PE，最大利用率）：

| 组件 | 功耗 | 占比 |
|-----|------|------|
| 3D DRAM | 5.41W | 55.8% |
| Matrix Unit | 3.44W | 35.5% |
| SRAM | 1.25W | 12.9% |
| Vector Unit | 1.73W | 17.9% |
| PE Controller | 1.07W | 11.0% |
| NoC | 0.043W | 0.4% |
| **Total per PE** | **~9.7W** | - |

**热分析**:
- 使用 HotSpot 7.0 进行热仿真
- 混合键合界面热阻：1.625 W/(m·K)
- 工作温度：≤ 85°C（满足 DRAM 可靠性要求）

---

## 5. 为什么对 AI 硬件重要

### 5.1 3D-DRAM + NMP 的新范式

Helios 代表了 AI 加速器架构的重要演进：

**从 2D 到 3D**：
- 传统：DRAM 和计算分离（HBM、GDDR）
- Helios：3D 堆叠，混合键合连接
- 优势：极高带宽、低延迟、高能效

**从统一内存到分布式内存**：
- 传统：GPU 的统一内存抽象
- Helios：分布式 PE 的本地内存
- 优势：匹配分布式注意力计算

**从静态分配到动态分配**：
- 传统：注意力头静态绑定
- Helios：KV 块动态分配
- 优势：适应动态工作负载

### 5.2 对 LLM 服务基础设施的启示

**1. 分离式架构（Disaggregated Architecture）**:
- Prefill：GPU（计算密集）
- Decoding：NMP（内存密集）
- 各自优化，协同工作

**2. 细粒度资源管理**:
- 块级 KV cache 管理
- 空间感知分配策略
- 负载均衡与通信优化的平衡

**3. 服务质量保障**:
- P99 TBT 降低 76%
- 可预测的服务延迟
- 满足生产环境要求

### 5.3 对神经符号 AI 的关联

虽然 Helios 针对 LLM，但其设计思想对神经符号 AI 有重要启示：

**动态图结构支持**:
- 神经符号 AI 涉及动态变化的计算图
- Helios 的分块执行和动态调度机制可借鉴
- 支持图遍历和推理链的高效执行

**混合计算模式**:
- 神经符号 AI 需要密集计算（神经网络）和稀疏访问（符号检索）
- Helios 的 Matrix + Vector Unit 设计可扩展
- 支持计算模式的动态切换

**内存层次优化**:
- 符号知识库需要高效存储和检索
- Helios 的 3D-DRAM 架构提供高带宽基础
- 块管理策略可适配符号数据的组织

### 5.4 产业化前景

**技术成熟度**：
- 混合键合技术已商业化（AMD、Intel）
- 3D-DRAM 产品已出现（HBM3E）
- 12nm 逻辑工艺成熟可靠

**应用场景**：
- 云端 LLM 服务（AWS、Azure、Google Cloud）
- 企业私有化部署
- 大规模 AI 推理集群

**竞争优势**：
- 3.25× 加速，3.36× 能效提升
- 72%/76% P50/P99 TBT 降低
- 相比 GPU 显著降低 TCO

---

## 6. 局限与未来方向

### 6.1 当前局限

- **精度支持**：当前仅 FP16，更低精度（INT8/INT4）有待探索
- **模型范围**：主要针对 Decoder-only 模型，Encoder-Decoder 支持待验证
- **规模限制**：单设备 80GB，超大规模模型需要多设备
- **训练支持**：当前仅推理，训练场景有待扩展

### 6.2 未来研究方向

**技术演进**：
- 支持更低精度（FP8/INT8）和混合精度
- 扩展到多模态模型（视觉-语言）
- 集成稀疏注意力优化（如 Sparse FlashAttention）
- 支持 speculative decoding 等推理加速技术

**架构创新**：
- 探索光互连替代电互连
- 集成存算一体（CIM）单元
- 支持更细粒度的动态电压频率调节（DVFS）

**系统优化**：
- 与调度器协同优化（如考虑请求的优先级）
- 在线学习最优块大小
- 自适应负载均衡策略

---

## 7. 总结

Helios 代表了 LLM 服务加速器的重要突破：

1. **架构创新**：混合键合 3D-DRAM + 分布式分块注意力
2. **系统优化**：空间感知 KV 缓存分配，平衡负载与通信
3. **性能突破**：3.25× 加速，3.36× 能效，72%/76% TBT 降低
4. **实用价值**：兼容现有软件栈（vLLM/SGLang），可直接部署

对于 AI 硬件设计，Helios 提供了以下关键启示：
- **3D 集成**：打破内存墙的有效路径
- **分布式计算**：匹配注意力机制的并行特性
- **动态管理**：适应 LLM 服务的动态工作负载
- **软硬协同**：算法（分块注意力）与架构（分布式 PE）的深度融合

随着 LLM 服务的快速普及和 3D 集成技术的成熟，类似 Helios 的架构将在云端 AI 基础设施中发挥越来越重要的作用，为高效、低成本、高质量的 LLM 服务提供硬件基础。

---

## 参考文献

1. Li, C., Yin, Y., Xue, C., Wang, Z., Bai, F., Guo, Y., Jiang, X., Wu, Q., Xie, Y., & Sun, G. (2026). Hardware-Software Co-design for 3D-DRAM-based LLM Serving Accelerator. arXiv:2603.04797.
2. Kwon, W., et al. (2023). Efficient memory management for large language model serving with paged attention. SOSP.
3. Zheng, L., et al. (2024). SGLang: Efficient execution of structured language model programs. NeurIPS.
4. Dao, T. (2024). FlashAttention-2: Faster attention with better parallelism and work partitioning. ICLR.
5. AMD. (2024). Instinct MI300X Accelerator.
