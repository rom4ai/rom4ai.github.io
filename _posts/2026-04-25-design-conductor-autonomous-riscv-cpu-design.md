---
layout: post
title: "Design Conductor: AI Agent 12小时自主设计1.5GHz RISC-V CPU"
categories: ["ai-accelerator", "chiplet", "llm-inference"]
author: ["Ravi Krishna", "Suresh Krishna", "David Chin"]
publish_date: "2026-03-11"
original_paper: "https://arxiv.org/abs/2603.08716"
tags: ["ai-accelerator", "chiplet", "llm-inference", "edge-ai", "neural-symbolic"]
---

# Design Conductor: AI Agent 12小时自主设计1.5GHz RISC-V CPU

> **原文链接**: [arXiv:2603.08716](https://arxiv.org/abs/2603.08716) | [PDF](https://arxiv.org/pdf/2603.08716.pdf)

## 摘要

**Design Conductor (DC)** 是一个自主AI Agent，能够利用前沿大语言模型的能力，端到端地完成半导体芯片设计——从概念到经过验证、可流片的GDSII版图文件。在仅12小时内，DC完全自主地构建了多个**VerCore** RISC-V CPU的微架构变体，实现了**1.48 GHz**的时钟频率，CoreMark跑分达到**3261**——性能相当于2011年的Intel Celeron SU2300（1.2 GHz）。这是首次有自主Agent完成从规格到GDSII的完整CPU设计。

![VerCore GDSII版图](/assets/design-conductor-riscv-cpu/_page_0_Figure_9.jpeg)
*图1: VerCore设计A的GDSII版图（高性能版本，70μm × 70μm）（来源：原文 Figure 1）*

---

## 1. 问题定义

芯片设计是一个极其耗时且昂贵的过程。将一个领先设计推向市场通常需要**超过4亿美元**和**18-36个月**的时间，即使拥有数百人的工程团队。这个过程包含多个复杂步骤：

- 架构定义
- RTL实现
- 测试平台实现与功能验证
- 前端综合
- 布局布线
- 功耗估计
- 封装

> "验证成本通常估计占总支出的50%以上"

传统芯片设计面临几个关键挑战：

1. **极高的功能测试覆盖率要求**：单次流片成本可达数千万美元，生产中"修复"bug不是可行选项
2. **严格的性能约束**：时钟频率、功耗、硅片面积等多重目标需要反复迭代
3. **EDA工具复杂性**：高度可配置，需要专业知识才能操作
4. **仿真成本**：验证所需的各类仿真在 wall-clock 时间和服务器小时数上都很昂贵

DC的出现为改变这一范式提供了可能——一个能够端到端完成设计的长期自主AI Agent。

---

## 2. Design Conductor架构

### 2.1 核心能力

DC被构建为实现以下关键能力：

**稳定的长时程执行**：芯片设计是一个包含多个子组件的复杂任务。DC需要能够在消耗数百亿token的过程中持续朝着目标（功能正确、高性能的设计）推进。

**上下文管理**：DC必须为其使用的底层LLM提供做出良好决策所需的信息，同时仔细管理有限的上下文窗口。

**技术精通**：芯片设计需要某些特定领域的极深知识。DC必须达到能够与领域专家顺畅合作的水平。

**正确性与验证**："氛围芯片设计"在量产数百万单位时不是可选项。DC必须交付可验证的正确设计。

**探索与速度的平衡**：芯片设计空间巨大。DC需要能够探索这个空间，同时避免陷入"兔子洞"而无法及时完成整体目标。

**端到端操作**：人类芯片设计中最昂贵和痛苦的部分是流片前最后一刻的RTL更改。DC必须执行相同的操作，同时保持对先前工作的必要上下文和记忆。

### 2.2 系统架构

![DC架构概览](/assets/design-conductor-riscv-cpu/_page_2_Figure_10.jpeg)
*图2: Design Conductor高层架构概览（来源：原文 Figure 2）*

DC是一个可扩展的云端应用，运行在分布式文件系统上：

- **Worker服务器**：管理LLM会话，同步到中央数据库
- **工具服务器**：存在于一个或多个执行环境（VM或容器）中
- **上下文管理模块**：监控和控制各种会话的上下文窗口使用
- **DC Core模块**：管理子代理和高级算法（如进化算法）
- **知识库**：专用知识库位于主内存系统中，记忆永久存在并完全自主管理

---

## 3. 方法论

### 3.1 输入规格

DC的唯一用户输入是一个219字的需求文档：

> "构建VerCore，一个支持RV32I和ZMMUL的RISC-V CPU核心...实现简单的5级流水线设计，按序执行，单发射...目标是CoreMark跑分最大化，目标时钟频率1.6 GHz...使用OpenROAD流程脚本生成最终GDSII输出，使用ASAP7平台/PDK..."

DC还被提供了Spike（RISC-V ISA模拟器）、RISC-V ISA和ASM手册，以及RISC-V GNU工具链。

### 3.2 设计流程

![DC设计流程](/assets/design-conductor-riscv-cpu/_page_4_Figure_0.jpeg)
*图3: Design Conductor典型设计流程（来源：原文 Figure 3）*

DC的设计流程包括以下关键步骤：

**设计提案生成**：根据输入、记忆和知识，生成初始设计提案。这是一个"活文档"，DC会根据功能或时序问题的反馈更新它。

**设计评审**：DC会"手动"和" painstakingly "审查设计的每个方面，确保设计在开始实现前是正确的。

**模块实现与测试**：DC始终为每个模块构建测试平台，并在继续前修复模块功能以确保测试平台通过。

**集成测试**：DC使用Spike构建整体vercore_tb.v测试平台，运行测试程序并确认设计的架构状态和内存事务与Spike报告的一致。

**调试与修复**：当发现与Spike的差异时，DC观察条件并检查VCD文件以调试问题。它通常将VCD转换为CSV文件并使用Python进行处理：

```python
import pandas as pd
df = pd.read_csv('vercore_tb.csv')
# 读取预期寄存器跟踪
with open('reg_trace.hex', 'r') as f:
    reg_trace = [line.strip() for line in f.readlines()]
# 比较实际写入与预期写入...
```

**PPA收敛**：DC审查时序报告并使用这些信息对设计进行RTL更改。在此过程中，它发现了如何在ID阶段实现早期转发，并实现了一个4级平衡的高效Booth-Wallace乘法器。

---

## 4. 实验结果

### 4.1 定量指标

| 指标 | 数值 |
|------|------|
| CoreMark分数 | 3261 |
| 面积（不含缓存） | 2809 μm² |
| 时钟频率 | 1.48 GHz |
| 工艺 | ASAP7 7nm |

*表1: VerCore关键指标（来源：原文 Table 1）*

### 4.2 VerCore流水线

![VerCore流水线](/assets/design-conductor-riscv-cpu/_page_9_Figure_6.jpeg)
*图4: VerCore流水线图（来源：原文 Figure 4）*

图中展示的是最终VerCore中性能最高的版本。它具备：

- 早期分支解析（尽可能早）
- 早期转发
- 高效Booth-Wallace乘法器（单独可跑2.57 GHz）

这些特性是DC自主发现的，并未包含在任何输入指令中。

> "DC没有依赖'猜测'。相反，DC对每个变体都进行了完整的Verilog实现（一些有2周期分支惩罚，一些有1周期）。DC完全实现每个变体直到GDSII。"

DC最终确定可以使用1周期分支惩罚设计满足时钟频率目标，即使该变体具有更长的关键时序路径。DC实际上重新发现了原始MIPS 5级RISC CPU设计的关键路径，该设计也采用1周期分支惩罚！

---

## 5. 对前沿模型的启示

### 5.1 架构推理

基础模型在像架构师一样推理方面需要额外帮助。作者观察到模型做出了次优设计选择，需要大量token才能最终优化。例如，转发实现最初常常导致过长的关键路径。只有在模型观察到时序结果后，它才理解问题并修复它。

### 5.2 RTL和时序理解

模型有时将Verilog（一种事件驱动语言）当作顺序代码来推理。虽然这不影响DC实现功能正确性的能力，但它使调试时序问题更具挑战性。在一个难忘的实例中，DC错误地推理认为减少依赖代码行数会导致芯片中更短的关键路径。

### 5.3 规格要求

提供给DC的输入规格必须以极其深思熟虑、紧凑且可验证/可测量的方式编写。例如，如果没有CPI要求，DC有时会生成分支和转发性能明显更差的处理器。有了这一行规格，DC会使用测试平台中的周期计数器计算其每个PC的周期数来估计CPI，从而确保达到目标。

---

## 6. 未来展望

### 6.1 扩展性

作者发现扩展到非常大的代码库（例如数百万行Verilog）对DC来说并不构成特殊问题。DC能够以处理VerCore时相同的方式解决功能和时序问题。这归功于它在记忆中构建代码库信息的方式。

### 6.2 新的设计流程

![未来团队结构](/assets/design-conductor-riscv-cpu/_page_11_Figure_0.jpeg)
*图5: 团队如何重组以最有效利用DC的示意图（来源：原文 Figure 5）*

有了DC这样的系统，目前100多人从事单一设计的团队将能够同时探索许多不同的设计、架构和产品创意，每个都从概念到GDSII。这些团队将能够在3-6个月内流片最复杂的设计，而不是目前的18-36个月。

专家的角色将变为在架构和目标层面指导DC，以实现他们认为将在市场上成功的设计结果——具备无需猜测即可实验的能力，并推动更激进的成本和性能目标。

> "高级工程师和主设计师将承担更少的'工具操作员'职责，而是更多地依赖他们的判断和经验，DC能够处理几乎所有其他工程工作。"

---

## 7. 总结

Design Conductor代表了AI在硬件设计领域的重大突破：

**优点：**
- 首次实现从规格到GDSII的完整自主CPU设计
- 12小时内完成传统需要数月的任务
- 通过验证驱动的方法确保功能正确性
- 自主发现并实现了高性能微架构优化
- 展示了AI在复杂工程任务中的端到端能力

**局限与未来方向：**
- 当前模型在架构推理和RTL理解方面仍需改进
- 需要更精确的规格编写以确保最优结果
- 人类架构师指导仍然是实现最佳结果的关键
- 工具厂商可以专注于算法质量而非界面设计

这项工作预示着芯片设计行业的范式转变——从劳动密集型向AI辅助设计的转变，可能大幅降低芯片设计的门槛和成本，让更多创新成为可能。

---

## 参考文献

1. GDS II Graphic Design System User's Operating Manual. *CALMA, Nov*, 1978.
2. EEMBC. CoreMark EEMBC Benchmark. https://www.eembc.org/coremark/
3. RISC-V International. Spike, a RISC-V ISA Simulator. https://github.com/riscv-software-src/riscv-isa-sim
4. Andrew Waterman et al. The RISC-V Instruction Set Manual, Volume I: Base User-Level ISA. *UC Berkeley Tech Report*, 2011.
