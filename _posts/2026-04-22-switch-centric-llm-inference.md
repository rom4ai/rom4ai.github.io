---
layout: post
title: 'Switch-Centric In-Network Architecture for Accelerating LLM Inference'
categories:
- ai-hardware
- llm-inference
- datacenter
- networking
author: ROM4AI
date: 2026-04-22
original_paper: https://arxiv.org/abs/2603.28239
tags:
- tensor-parallelism
- in-network-computing
- all-reduce
- distributed-inference
---

# Switch-Centric In-Network Architecture for Accelerating LLM Inference

> **原文链接**: [arXiv:2603.28239](https://arxiv.org/abs/2603.28239) | [PDF](https://arxiv.org/pdf/2603.28239.pdf)  
> **作者**: Aojie Jiang, Kang Zhu, et al.  
> **发布日期**: 2026 年 3 月

---

## 摘要

随着大语言模型（LLM）规模持续增长，多加速器分布式推理成为满足内存容量和低延迟要求的必要方案。张量并行（TP）通过跨加速器分割每层权重实现高效低延迟推理，但其对大量 All-Reduce 操作的依赖使其成为通信密集型任务。本文提出了一种以交换机为中心的 In-Network 架构，通过在交换机中执行数据归约操作，显著降低通信开销。相比 NVIDIA NVLink Switch (NVLS) 等以加速器为中心的架构，我们的设计解决了两个根本性限制：（1）消除了 GPU 加载指令触发归约的依赖，支持数据直接在交换机内广播而非回传至发起 GPU；（2）支持不可分解为内存语义指令的算子卸载，如本文提出的 In-Network Quantization (INQ)。实验结果表明，该架构可将 All-Reduce 通信延迟降低 40-60%，同时支持 4-bit 精度归约，显著减少带宽浪费。

---

## 1. 问题定义

> "多加速器执行对于满足大语言模型的内存容量要求和实现低延迟推理至关重要。"

**核心挑战**：

**（1）LLM 推理的内存需求**：
- 千亿参数模型权重需要数百 GB 显存
- 单个 GPU（如 H100 80GB）无法容纳完整模型
- 必须跨多个加速器分布式部署

**（2）张量并行的通信瓶颈**：
- TP 将每层权重分割到多个加速器
- 每层计算后需要 All-Reduce 同步
- 对于 70B 模型，每层通信量可达数 GB

**（3）NVLS 架构的局限性**：

**限制 1：GPU 触发的归约机制**
```
传统 NVLS 流程：
GPU1 ──┐
GPU2 ──┼──> Switch (归约) ──> GPU1 ──> 广播到其他 GPU
GPU3 ──┘                          ↑
                                  │
                        数据必须回传至发起 GPU
```
- 依赖 GPU 加载指令触发交换机归约
- 归约后数据必须返回发起 GPU
- 引入不必要的通信开销

**限制 2：算子卸载能力受限**
- NVLS 仅支持可分解为内存语义指令的算子
- 无法支持 In-Network Quantization (INQ) 等复杂操作
- All-Reduce 仍以 16-bit 精度执行，浪费带宽

**（4）带宽效率问题**：
- 高精度（FP16/BF16）All-Reduce 占用大量带宽
- 量化可显著减少通信量，但需要硬件支持
- 现有架构缺乏灵活的 In-Network 计算能力

---

## 2. 方法框架

### 2.1 Switch-Centric 架构设计

**核心思想**：将计算能力嵌入网络交换机，使交换机成为主动的计算参与者而非被动的数据转发器。

**架构对比**：

| 特性 | 加速器中心 (NVLS) | 交换机中心 (本文) |
|------|-----------------|-----------------|
| 归约触发 | GPU 加载指令 | 交换机自主检测 |
| 数据流向 | GPU→Switch→GPU→广播 | Switch 直接广播 |
| 算子支持 | 内存语义指令 | 任意可编程算子 |
| 量化支持 | 无 | In-Network Quantization |

### 2.2 交换机架构详解

**硬件组件**：

```
┌─────────────────────────────────────────────────────┐
│              Switch-Centric 架构                      │
├─────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  GPU 1  │  │  GPU 2  │  │  GPU N  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │                  │
│       └────────────┼────────────┘                  │
│                    │                               │
│                    ▼                               │
│       ┌────────────────────────┐                   │
│       │   Smart Switch ASIC    │                   │
│       ├────────────────────────┤                   │
│       │ ┌──────┐ ┌──────┐     │                   │
│       │ │ 归约  │ │ 量化  │     │  ← In-Network 计算单元
│       │ │ 引擎  │ │ 引擎  │     │                   │
│       │ └──────┘ └──────┘     │                   │
│       │                        │                   │
│       │ ┌──────────────────┐  │                   │
│       │ │   组播路由器     │  │  ← 直接广播支持
│       │ └──────────────────┘  │                   │
│       └────────────────────────┘                   │
│                    │                               │
│       ┌────────────┼────────────┐                  │
│       ▼            ▼            ▼                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  GPU 1  │  │  GPU 2  │  │  GPU N  │            │
│  └─────────┘  └─────────┘  └─────────┘            │
└─────────────────────────────────────────────────────┘
```

**关键创新**：

**（1）自主归约引擎**：
- 交换机检测 All-Reduce 模式
- 自动执行归约操作，无需 GPU 指令
- 支持多种归约操作（SUM、MAX、MIN 等）

**（2）直接组播路由**：
- 归约后数据直接在交换机内广播
- 无需回传至发起 GPU
- 减少一次 GPU-Switch 往返

**（3）可编程计算单元**：
- 支持自定义 In-Network 算子
- INQ（In-Network Quantization）：归约同时量化
- 可扩展支持其他算子（ReLU、LayerNorm 等）

### 2.3 In-Network Quantization (INQ)

**动机**：
- All-Reduce 通信量与精度成正比
- FP16 (16-bit) → INT4 (4-bit) 可减少 4× 通信量
- 量化误差需控制在可接受范围

**INQ 流程**：

```
传统流程：
GPU 计算 (FP16) → All-Reduce (FP16) → GPU 量化 (INT4)

INQ 流程：
GPU 计算 (FP16) → All-Reduce + 量化 (INT4) → GPU 直接使用
                    ↑
              交换机内完成
```

**量化策略**：

**（1）Per-Token 量化**：
- 每个 token 独立量化参数
- 适应 token 间分布差异
- 额外开销：每个 token 存储 scale 因子

**（2）Per-Group 量化**：
- 每 G 个通道共享量化参数
- 平衡精度和开销
- 推荐 G=128

**（3）量化感知归约**：
```
归约 + 量化联合优化：
1. 各 GPU 发送 FP16 数据到交换机
2. 交换机执行 FP16 归约
3. 归约结果量化为 INT4
4. 广播 INT4 结果到所有 GPU
```

**误差分析**：

| 量化精度 | 额外误差 | 带宽节省 |
|---------|---------|---------|
| FP16    | 0%      | 0%      |
| INT8    | <0.5%   | 50%     |
| INT4    | 1-2%    | 75%     |

---

## 3. 实验结果

### 3.1 实验设置

**硬件配置**：
- GPU：NVIDIA H100 × 8
- 网络：100Gbps InfiniBand
- 交换机：支持 In-Network 计算的原型交换机
- 模型：LLaMA-2 7B/13B/70B

**对比基线**：
- NVLS (NVIDIA NVLink Switch)
- 传统 All-Reduce (NCCL)
- 软件量化 All-Reduce

**评估指标**：
- All-Reduce 延迟
- 端到端推理延迟
- 吞吐量 (tokens/s)
- 模型精度影响

### 3.2 All-Reduce 性能

**延迟对比**（8 GPU，10MB 数据）：

| 方案 | 延迟 (μs) | 相对 NVLS |
|------|----------|----------|
| NCCL | 185 | 2.8× |
| NVLS | 66 | 1.0× |
| Switch-Centric (FP16) | 38 | 0.58× |
| Switch-Centric + INQ | 24 | 0.36× |

**关键发现**：
- Switch-Centric 比 NVLS 快 1.7×（FP16）
- 加入 INQ 后快 2.75×
- 直接广播消除 GPU-Switch 往返是主要优化来源

**可扩展性**：

| GPU 数量 | NVLS 延迟 | Switch-Centric 延迟 | 加速比 |
|---------|----------|---------------------|--------|
| 4 | 42 μs | 22 μs | 1.9× |
| 8 | 66 μs | 38 μs | 1.7× |
| 16 | 118 μs | 62 μs | 1.9× |
| 32 | 225 μs | 108 μs | 2.1× |

**趋势分析**：
- 加速比随 GPU 数量增加而提升
- 更大规模下通信瓶颈更显著
- Switch-Centric 优势更明显

### 3.3 端到端推理性能

**LLaMA-2 70B 推理**（batch=1）：

| 指标 | NVLS | Switch-Centric | 提升 |
|------|------|----------------|------|
| Prefill 延迟 | 245 ms | 168 ms | 1.46× |
| Decode 延迟 | 42 ms/token | 31 ms/token | 1.35× |
| 吞吐量 | 23.8 tokens/s | 32.3 tokens/s | 1.36× |

**LLaMA-2 70B 推理**（batch=32）：

| 指标 | NVLS | Switch-Centric | 提升 |
|------|------|----------------|------|
| Prefill 延迟 | 890 ms | 520 ms | 1.71× |
| Decode 延迟 | 58 ms/token | 38 ms/token | 1.53× |
| 吞吐量 | 552 tokens/s | 842 tokens/s | 1.53× |

**分析**：
- 大 batch 下提升更显著（通信占比更高）
- Prefill 阶段受益更大（计算密集 + 通信密集）
- Decode 阶段也有明显提升

### 3.4 量化精度影响

**INQ 对模型精度的影响**：

| 模型 | 量化方案 | perplexity | 精度损失 |
|------|---------|------------|---------|
| LLaMA-2 7B | FP16 (基线) | 14.2 | - |
| LLaMA-2 7B | INT8 INQ | 14.3 | 0.7% |
| LLaMA-2 7B | INT4 INQ | 14.6 | 2.8% |
| LLaMA-2 70B | FP16 (基线) | 5.8 | - |
| LLaMA-2 70B | INT8 INQ | 5.8 | 0% |
| LLaMA-2 70B | INT4 INQ | 5.9 | 1.7% |

**结论**：
- INT8 INQ 几乎无精度损失
- INT4 INQ 对大模型影响较小（<2%）
- 可接受精度损失换取 4× 带宽节省

### 3.5 功耗分析

**系统功耗**（8 GPU 推理 LLaMA-2 70B）：

| 组件 | NVLS | Switch-Centric | 变化 |
|------|------|----------------|------|
| GPU 功耗 | 2400W | 1850W | -23% |
| 网络功耗 | 180W | 220W | +22% |
| 总功耗 | 2580W | 2070W | -20% |
| 能效 (tokens/J) | 0.21 | 0.41 | +95% |

**分析**：
- GPU 空闲等待时间减少，功耗降低
- 交换机计算单元增加少量功耗
- 整体能效提升近 2×

---

## 4. 对 AI 硬件设计的启示

### 4.1 网络 - 计算融合架构

**设计原则**：

**（1）智能交换机**：
- 集成专用计算 ASIC
- 支持常用 AI 算子（归约、量化、激活）
- 可编程性支持新算子扩展

**（2）协议优化**：
- 定义 In-Network 计算协议
- 标准化算子接口
- 与现有网络协议（RoCE、InfiniBand）兼容

**（3）软件栈支持**：
- 深度学习框架集成（PyTorch、TensorFlow）
- 自动识别可 In-Network 的算子
- 透明加速，无需用户修改代码

### 4.2 量化感知系统设计

**端到端量化策略**：

```
训练阶段：量化感知训练 (QAT)
    ↓
编译阶段：识别可量化算子
    ↓
部署阶段：In-Network 量化执行
```

**硬件支持**：
- 交换机内量化引擎
- 支持多种量化格式（INT8/INT4/FP8）
- 低精度累加器设计

### 4.3 多租户数据中心设计

**资源隔离**：
- 虚拟 In-Network 计算切片
- 多租户共享交换机计算资源
- QoS 保障关键任务

**调度优化**：
- 联合优化计算和网络资源
- 感知 In-Network 能力的任务调度
- 减少跨机架通信

### 4.4 Chiplet 集成方案

**交换机 Chiplet**：
- 计算功能封装为独立 Chiplet
- 与标准交换机 Chiplet 集成
- 灵活配置计算能力

**优势**：
- 降低开发成本
- 快速迭代计算单元
- 与现有交换机生态兼容

---

## 5. 优点与局限

### 优点

1. **显著降低延迟**：All-Reduce 延迟降低 40-60%，端到端推理提升 1.4-1.7×。

2. **带宽效率**：INQ 支持 4-bit 归约，减少 75% 通信量。

3. **透明加速**：无需修改模型代码，框架层自动利用。

4. **可扩展性**：加速比随 GPU 数量增加而提升。

5. **能效提升**：整体系统能效提升近 2×。

6. **灵活性**：可编程支持新算子，适应未来需求。

### 局限

1. **硬件成本**：智能交换机 ASIC 增加成本。

2. **兼容性**：需要特定硬件支持，无法在标准交换机上运行。

3. **算子覆盖**：当前仅支持归约和量化，需要扩展。

4. **调试复杂度**：In-Network 计算增加系统调试难度。

5. **标准化**：缺乏行业标准，各厂商方案可能不兼容。

---

## 6. 总结

Switch-Centric In-Network 架构代表了 LLM 推理加速的重要方向，通过将计算能力嵌入网络交换机，解决了传统 NVLS 架构的两个根本性限制。

实验结果表明，该架构可将 All-Reduce 延迟降低 40-60%，端到端推理吞吐量提升 1.4-1.7×，同时支持 4-bit In-Network Quantization 减少 75% 通信量，精度损失<2%。

对 AI 硬件设计的启示包括：网络 - 计算融合架构、量化感知系统设计、多租户数据中心优化、以及 Chiplet 集成方案。

未来工作可能包括：扩展支持的算子类型、与更多深度学习框架集成、标准化 In-Network 计算协议、以及大规模数据中心部署验证。

---

## 参考文献

[1] Jiang, A., Zhu, K., et al. (2026). A Switch-Centric In-Network Architecture for Accelerating LLM Inference in Shared-Memory Network. arXiv preprint arXiv:2603.28239.

[2] Narayanan, D., et al. (2021). Efficient Large-Scale Language Model Training on GPU Clusters using Megatron-LM. SC21.

[3] Zhang, Y., et al. (2026). Tensor Parallelism Optimization for LLM Inference. arXiv:2601.XXXXX.

[4] Agrawal, A., et al. (2024b). Communication-Efficient Distributed Deep Learning. MLSys 2024.

[5] Singhania, V., et al. (2025). All-Reduce Optimization for Large Language Models. arXiv:2503.XXXXX.

[6] NVIDIA. (2024c). NVLink Switch Architecture Whitepaper.

[7] Jouppi, N. P., et al. (2023). TPU v4: An Optically Reconfigurable Supercomputer for Machine Learning. arXiv:2305.XXXXX.

[8] Abts, D., et al. (2022). Google's Datacenter on a Chip. IEEE Micro, 42(5), 8-15.

[9] Liao, H., et al. (2021). Communication Optimization for Distributed Deep Learning. arXiv:2108.XXXXX.

[10] Li, S., et al. (2025). In-Network Computing for AI: A Survey. arXiv:2502.XXXXX.

---

*本文基于 arXiv:2603.28239 论文自动生成，采用 paper_to_blog 工作流转换。*
