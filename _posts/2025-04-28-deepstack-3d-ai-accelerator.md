---
layout: post
title: "DeepStack: 分布式3D堆叠AI加速器的设计空间探索框架"
categories: ["research", "ai-accelerator", "chiplet", "llm-inference"]
author: ["Zhiwen Mo", "Guoyu Li", "Hao (Mark) Chen", "Yu Cheng", "Zhengju Tang", "Qianzhou Wang", "Lei Wang", "Shuang Liang", "Lingxiao Ma", "Xianqi Zhou", "Yuxiao Guo", "Wayne Luk", "Jilong Xue", "Hongxiang Fan"]
publish_date: ["2025"]
original_paper: "https://arxiv.org/abs/2604.04750"
tags: ["ai-accelerator", "chiplet", "llm-inference", "memory-system", "training"]
---

# DeepStack: 分布式3D堆叠AI加速器的设计空间探索框架

> **原文链接**: [arXiv:2604.04750](https://arxiv.org/abs/2604.04750) | [PDF](https://arxiv.org/pdf/2604.04750.pdf)

## 摘要

随着大语言模型（LLM）规模达到数千亿甚至万亿参数，分布式推理已成为AI服务的核心需求。混合键合和先进封装技术的突破推动了3D DRAM堆叠加速器的发展，这类架构通过垂直集成DRAM与计算芯片，提供了远超传统2.5D设计的内存带宽和容量。然而，系统与硬件层面的复合复杂性（高达 $2.5 \times 10^{14}$ 种配置）阻碍了针对分布式3D堆叠AI系统的准确高效设计空间探索（DSE）框架的开发。

本文介绍的 **DeepStack** 是一个面向分布式3D堆叠加速器的全栈建模与DSE框架，通过细粒度3D内存语义建模、双阶段网络抽象和瓦片级计算-通信重叠技术，实现了比最先进的模拟器快 **100,000倍** 的运行速度，同时保持可比的精度（与vLLM在8×B200 GPU上的误差仅为12.18%）。

## 1. 问题定义

### 1.1 分布式LLM推理的挑战

LLM推理包含两个阶段：
- **Prefill（预填充）**：处理提示并构建KV缓存
- **Decode（解码）**：使用KV缓存顺序生成token

三个关键指标衡量服务性能：
- **TTFT**（首token时间）：响应延迟
- **UTPS**（用户每秒token数）：用户感知吞吐量
- **STPS**（系统每秒token数）：原始服务能力

随着模型规模增长，单芯片容量已无法满足需求，**分布式多芯片推理**成为必需。核心挑战在于优化并行策略和集合通信模式，这直接影响硬件利用率。

### 1.2 3D堆叠DRAM架构的机遇与复杂性

![2.5D与3D堆叠架构对比](/assets/deepstack-3d-ai-accelerator/_page_1_Figure_16.jpeg)
*图：2.5D硬件与3D堆叠架构对比（来源：原文 Figure 1）*

传统2.5D设计中，计算芯片通过中介层连接堆叠DRAM，但带宽受限于堆栈外I/O，且PHY宏占据数十平方毫米面积。3D堆叠加速器通过TSV和混合键合将DRAM芯片直接置于逻辑芯片之上，提供高带宽、高容量的近处理器内存。

然而，这种架构引入了独特的复杂性：

> "Chip-level accurate modeling with unique characteristics of 3D-stacked hardware. 3D-stacked DRAM provides significantly higher bandwidth, but fully utilizing it demands proportionally larger on-chip buffering (Little's Law) and careful handling of bank-level access semantics..."

**关键挑战包括**：
1. **芯片级精确建模**：3D堆叠DRAM的独特特性，如事务感知带宽、bank激活约束、缓冲限制
2. **系统级复杂并行性**：分布式LLM推理整合多种并行策略（TP、PP、DP、EP、SP、CP、FSDP），每种策略对计算、内存和通信有不同需求
3. **巨大的系统-硬件协同设计空间**：3D硬件特性、热约束与分布式执行策略的交互创造了庞大的协同设计空间

## 2. 方法框架

![DeepStack框架概览](/assets/deepstack-3d-ai-accelerator/_page_3_Figure_1.jpeg)
*图：DeepStack DSE框架概览（来源：原文 Figure 4）*

### 2.1 硬件模型层次

DeepStack采用层次化硬件模型，从细粒度处理引擎到完整多芯片系统：

![3D堆叠DRAM架构横截面与俯视图](/assets/deepstack-3d-ai-accelerator/_page_3_Figure_3.jpeg)
*图：3D堆叠DRAM架构示例（来源：原文 Figure 5）*

**层次结构包括**：
- **(a) 处理引擎（PE）**：包含SFU、向量单元、矩阵单元，以及可配置的L0寄存器文件和L1共享内存
- **(b) 3D堆叠DRAM集群**：包含多个PE、L2缓存、本地互连和垂直堆叠的DRAM层
- **(c) 芯片级**：多个集群通过可配置的L1网络连接
- **(d) 芯片间级**：通过UCIe链路集成多个芯片
- **(e) 系统级**：多个芯片通过以太网连接

### 2.2 核心创新：双阶段网络抽象

现有工具（如ASTRA-sim-v2）面临精度与速度的两难：分析后端误差高达58%，而NS-3后端每GiB规模集合通信需要超过1小时。

DeepStack提出**双阶段网络抽象**：

**阶段1：流量矩阵构建**
- 使用逻辑num_nodes × num_nodes流量矩阵（TM）表示集合通信步骤
- 捕获独立于物理拓扑的逻辑模式
- 优先将高容量逻辑通信对映射到物理相邻节点

**阶段2：物理映射与路由**
- 将逻辑流映射到物理路由
- 累积每条物理链路的流量体积 $V_l$
- 网络时间建模为：

$$T_{net} = \underbrace{\max_{p \in \mathcal{P}} (\mathsf{Hops}_p \times \delta_{hop})}_{L_{net}} + \underbrace{\max_{l \in \mathcal{L}} \left( \frac{V_l}{BW_l} \right)}_{T_{cong}}$$

![双阶段网络抽象示例](/assets/deepstack-3d-ai-accelerator/_page_5_Figure_8.jpeg)
*图：将64节点逻辑EP all-to-all流量映射到三层torus-mesh-mesh拓扑的示例（来源：原文 Figure 6）*

### 2.3 瓦片级计算-通信重叠

![瓦片级计算-通信重叠建模](/assets/deepstack-3d-ai-accelerator/_page_6_Figure_1.jpeg)
*图：GEMM的瓦片级计算-通信重叠建模（来源：原文 Figure 7）*

DeepStack在瓦片粒度建模计算-通信重叠。一旦某波次瓦片的计算完成，即启动对应数据传输，使第i波次的通信与第(i+1)波次的计算并行执行。

端到端延迟建模为：

$$T_{e2e} = \underbrace{\tau_{comp}}_{\text{Prologue}} + \underbrace{(\tau_{comm} + L_{net})}_{\text{Epilogue}} + \max\left((W-1)\tau_{comp}, (W-1)\tau_{comm} + L_{net}\right)$$

这一建模揭示了关键架构权衡：
- **大瓦片尺寸**：提高数据复用率，但减少波次数量，降低重叠机会
- **小瓦片尺寸**：增加波次数量，最大化重叠，但可能降低算术强度

## 3. 实验结果

### 3.1 建模精度验证

![DeepStack与8×H100 GPU的建模精度对比](/assets/deepstack-3d-ai-accelerator/_page_7_Figure_1.jpeg)
*图：DeepStack建模精度与8×H100 GPU对比（来源：原文 Figure 8）*

![DeepStack与vLLM在8×B200上的建模精度](/assets/deepstack-3d-ai-accelerator/_page_7_Figure_3.jpeg)
*图：DeepStack在vLLM TP8和EP8 MoE上的建模精度（来源：原文 Figure 9）*

验证结果：
- 与Cadence Palladium周期精确仿真对比：误差 < 5%
- 与8×H100 Triton-Distributed内核对比：平均误差3.97%
- 与8×B200 vLLM端到端对比：**MAPE 12.18%**
- 与ASTRA-sim NS-3后端对比：加权误差仅2.12%（Switch）和1.62%（Torus）

![与ASTRA-sim的对比](/assets/deepstack-3d-ai-accelerator/_page_7_Figure_11.jpeg)
*图：DeepStack与ASTRA-sim（NS-3和分析后端）的建模精度对比（来源：原文 Figure 10）*

**关键突破**：DeepStack实现高达 **100,000倍加速**（0.1秒 vs 3小时处理GiB规模集合通信），同时保持离散事件级精度。

### 3.2 系统-硬件协同设计探索

![DSE帕累托前沿](/assets/deepstack-3d-ai-accelerator/_page_8_Figure_1.jpeg)
*图：DeepStack DSE跨设计点的帕累托前沿（来源：原文 Figure 11）*

DeepStack探索了约 **$2.5 \times 10^{14}$** 个配置点，涵盖：
- 硬件：芯片架构、3D DRAM堆叠深度、片上SRAM、网络拓扑
- 软件：并行策略、单芯片调度、集合通信算法

![解码性能对比](/assets/deepstack-3d-ai-accelerator/_page_8_Figure_3.jpeg)
*图：UTPS/STPS解码性能对比（来源：原文 Figure 12）*

**关键发现**：
- 在内存受限的解码阶段，3D堆叠设计显著优于2.5D基线
- BS=1024时速度提升 **1.30-1.48倍**
- BS=1时速度提升高达 **2.79倍**

### 3.3 3D DRAM层设计空间案例研究

![理论有效DRAM带宽与SM数量](/assets/deepstack-3d-ai-accelerator/_page_9_Figure_1.jpeg)
*图：堆叠3D DRAM层的理论有效带宽与SM数量（来源：原文 Figure 13）*

**反直觉发现**：
> "DRAM layer stacking exhibits an inverted-U curve: beyond ~9 layers, effective bandwidth *decreases* despite increasing theoretical bandwidth, mainly due to buffering limitation."

有效带宽在约9层时达到峰值，超过此点后，由于Little定律和L1带宽约束，有效带宽反而下降。

![端到端TPS与面积分解](/assets/deepstack-3d-ai-accelerator/_page_9_Figure_3.jpeg)
*图：DeepSeek-V3端到端TPS与不同DRAM堆叠层的面积分解（来源：原文 Figure 14）*

**最优堆叠深度因工作负载而异**：
- 小批量解码（BS=4）：偏好深层堆叠（~9层）以最大化带宽
- 大批量解码（BS=1024）：最优降至6-7层，因为工作负载变为部分计算受限
- 大批量预填充：仅2层最优，因为工作负载完全计算受限

**核心洞察**：
> "Batch size defines a more fundamental architectural divide than the pre-fill/decode distinction."

批次大小比预填充/解码区分更根本地定义了架构分化。

### 3.4 热可行性分析

![3D DRAM设计空间的温度分布](/assets/deepstack-3d-ai-accelerator/_page_10_Figure_3.jpeg)
*图：3D DRAM设计空间的温度分布（来源：原文 Figure 16）*

大批量解码是最具热挑战性的场景，许多配置超过85°C。但热包络内的高吞吐量设计确实存在：更大的片上缓冲和更粗的瓦片尺寸可降低DRAM访问频率，在不牺牲吞吐量的情况下降低功耗。

所有热可行设计的功耗密度低于 **~0.8 W/mm²**，远低于NVIDIA Vera Rubin GPU已量产的 **≥1.34 W/mm²**。

### 3.5 消融研究

| 消融研究 | STPS<sub>bs=4</sub> | STPS<sub>bs=1024</sub> |
|---------|---------------------|------------------------|
| Baseline (ASTRA-sim: DP/TP/PP/FSDP) | 177.1 | 5,729 |
| + Full Parallel (EP/SP/CP/FSDP) | 256.4 (+45%) | 21,252 (+271%) |
| + Flex. Parallel Across Modules | 256.4 (—) | 24,488 (+15%) |
| + Search On-chip Arch. | 314.2 (+23%) | 31,350 (+28%) |
| + Comm-Comp. Overlap | 340.5 (+8%) | 38,061 (+21%) |
| + Stacking DRAM Layer DSE | 493.3 (+45%) | 51,095 (+34%) |
| + NoC DSE | 494.1 (+0.2%) | 54,280 (+6.2%) |
| **Total Speedup** | **2.8×** | **9.5×** |

*表：DeepStack技术的消融研究（来源：原文 Table 4）*

![扩展并行性搜索空间的效果](/assets/deepstack-3d-ai-accelerator/_page_10_Figure_11.jpeg)
*图：DeepStack扩展并行性的效果（来源：原文 Figure 19）*

**关键发现**：
- 完整并行性搜索（包括EP、SP、CP）带来 **5.03倍**（DeepSeek-V3）和 **2.31倍**（Qwen3-235B）提升
- 不完整的并行性搜索不仅降低吞吐量，还会**误导架构搜索**，导致无法通过软件调优恢复的硅片不匹配

## 4. 优点与局限

### 优点

1. **全栈建模能力**：首次实现芯片级3D内存语义与系统级并行策略的联合建模
2. **极致效率**：比SOTA模拟器快100,000倍，使十亿点DSE成为可能
3. **高精度验证**：与商业级仿真和实际GPU部署交叉验证，误差控制在12%以内
4. **关键设计洞察**：揭示了批次大小比预填充/解码更根本、能量效率与吞吐量优化需要不同架构等重要发现

### 局限

1. **热模型简化**：采用线性热阻模型，可能无法捕获所有热瞬态效应
2. **实现细节差距**：与vLLM的残余差距（12.18% MAPE）源于FlashMLA动态KV分割等实现细节超出分析范围
3. **工作负载限制**：当前主要评估标准LLM架构，对更特殊的模型（如多模态）支持有限

## 5. 总结

DeepStack为分布式3D堆叠AI加速器提供了一个全栈建模与DSE框架，通过细粒度3D内存语义建模、双阶段网络抽象和瓦片级计算-通信重叠，实现了前所未有的探索效率。

**核心贡献**：
- 揭示了最优DRAM堆叠深度受非平凡的带宽-面积权衡支配
- 发现批次大小比预填充/解码区分更根本地定义架构分化
- 证明并行策略与硬件架构紧密耦合：单独优化任一方都会导致次优设计

对于AI芯片架构师和系统设计师，DeepStack提供了在早期设计阶段系统性地导航庞大硬件-系统协同设计空间的工具，为下一代可扩展AI基础设施的架构决策提供指导。

## 参考文献

1. Zhiwen Mo et al. DeepStack: Scalable and Accurate Design Space Exploration for Distributed 3D-Stacked AI Accelerators. arXiv:2604.04750, 2025.
2. William Won et al. ASTRA-sim2.0: Modeling Hierarchical Networks and Disaggregated Systems for Large-model Training at Scale. ISPASS, 2023.
3. Hengrui