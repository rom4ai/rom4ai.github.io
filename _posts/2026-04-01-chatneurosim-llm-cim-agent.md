---
layout: post
title: 'ChatNeuroSim: LLM Agent Framework for Automated CIM Accelerator Deployment'
categories:
- research
- ai-accelerator
- memory-system
- llm-agent
author: ROM4AI
date: 2026-04-01
original_paper: "https://arxiv.org/abs/2603.08745"
tags:
- memory-system
- ai-accelerator
- llm-inference
- edge-ai
- benchmark
---

# ChatNeuroSim: LLM Agent Framework for Automated CIM Accelerator Deployment and Optimization

> **原文链接**: [arXiv:2603.08745](https://arxiv.org/abs/2603.08745) | Authors: Ming-Yen Lee, Shimeng Yu (Georgia Institute of Technology)

## 摘要

ChatNeuroSim 是一个基于大语言模型（LLM）的 Agent 框架，用于自动化存算一体（Compute-in-Memory, CIM）加速器的设计空间探索（DSE）和优化。该框架通过任务调度、请求解析、参数依赖检查、脚本生成和仿真执行，实现了端到端的 CIM 工作流程自动化。ChatNeuroSim 集成了基于设计空间剪枝的 CIM 优化器，能够快速识别不同 DNN 工作负载的最优配置。在 40 个测试用例上，使用 GPT-5.1 实现了 **100%** 的脚本生成正确率。在 Swin Transformer Tiny 的优化案例中，设计空间剪枝技术实现了 **0.42×-0.79×** 的平均运行时间减少。

---

## 1. 问题定义：CIM 设计的复杂性挑战

### 1.1 存算一体（CIM）的潜力与困境

存算一体（CIM）是一种新兴的 AI 加速器架构范式：

> "Compute-in-Memory (CIM) architectures have been widely studied for deep neural network (DNN) acceleration by reducing data transfer overhead between the memory and computing units."

**CIM 的核心优势**:
- **减少数据搬运**：在存储阵列内直接执行 MAC 运算
- **高能效**：消除冯·诺依曼瓶颈
- **高吞吐**：大规模并行计算

**但设计复杂性极高**:

传统 CIM 设计流程涉及三个耗时步骤：

```
Step 1: 理解仿真器行为
    ↓ 需要投入大量精力阅读手册和文档
Step 2: 手动请求到参数转换 + 仿真执行
    ↓ 复杂的参数依赖关系
Step 3: 仿真输出后处理
    ↓ 迭代优化
```

**主要痛点**:

| 痛点 | 描述 | 影响 |
|-----|------|------|
| **文档复杂性** | 需要理解仿真器功能、参数依赖、异构 I/O 格式 | 高学习成本 |
| **参数转换** | 将高层设计意图转换为有效仿真器参数 | 易出错 |
| **迭代耗时** | 需要大量设计-仿真迭代寻找最优配置 | 延长设计周期 |
| **领域知识** | 需要深厚的硬件设计专业知识 | 门槛高 |

### 1.2 现有解决方案的局限

**CIM 仿真器**: NeuroSim、MNSIM 等提供了系统级仿真能力，但：
- 需要手动配置数百个参数
- 参数之间存在复杂的依赖关系
- 不同工作负载需要不同的配置策略

**ML 优化算法**: 遗传算法、贝叶斯优化等被用于 DSE：
- 减少了设计-仿真迭代次数
- 但对于 Vision Transformer 等复杂工作负载，运行时间仍然过长（数小时到数天）
- 缺乏系统性的设计空间剪枝策略

**LLM Agent 框架**: ChatEDA、ChatArch 等用于 EDA 自动化：
- 自动化 RTL 到 GDS 的设计流程
- 处理器架构优化
- **但尚未应用于 CIM 仿真和部署**

---

## 2. ChatNeuroSim 框架设计

### 2.1 总体架构

ChatNeuroSim 是一个多 Agent 协作框架，自动化整个 CIM 工作流程：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ChatNeuroSim Framework                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   User Request                                                        │
│      │                                                                │
│      ▼                                                                │
│   ┌─────────────────┐                                                 │
│   │ Task Parsing    │  → 分类请求类型 (Single/Multiple/Auto/Optimize) │
│   │ Agent           │                                                 │
│   └────────┬────────┘                                                 │
│            │                                                          │
│            ▼                                                          │
│   ┌─────────────────┐                                                 │
│   │ Parameter       │  → 提取结构化参数，检查依赖关系                   │
│   │ Parsing Agent   │                                                 │
│   └────────┬────────┘                                                 │
│            │                                                          │
│            ▼                                                          │
│   ┌─────────────────┐     ┌─────────────────┐                        │
│   │ Parameter       │◄───►│ User Adjustment │                        │
│   │ Adjustment Agent│     │ (if needed)     │                        │
│   └────────┬────────┘     └─────────────────┘                        │
│            │                                                          │
│            ▼                                                          │
│   ┌─────────────────┐     ┌─────────────────┐                        │
│   │ Script          │────►│ CIM Simulator   │                        │
│   │ Generation      │     │ (NeuroSim)      │                        │
│   └─────────────────┘     └────────┬────────┘                        │
│                                     │                                 │
│                                     ▼                                 │
│   User ◄────────────────────  PPA Results                             │
│   (Accuracy, Performance, Power, Area)                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 四种请求类型

ChatNeuroSim 支持四种用户请求类型：

| 类型 | 描述 | 示例 |
|-----|------|------|
| **Single Call** | 单次仿真，固定参数集 | "在 22nm RRAM 上仿真 VGG8，8bit 量化" |
| **Multiple Call** | 多次仿真，不同参数值 | "对比 22nm/14nm/7nm 三种工艺节点" |
| **Testbench Auto-design** | 自动设计测试用例 | "检查不同量化精度对 ResNet-18 精度的影响" |
| **PPA Optimization** | 约束下的 PPA 优化 | "在 3600mm² 面积约束下最小化功耗" |

### 2.3 Agent 设计

**1. 任务解析 Agent (Task Parsing Agent)**

**功能**: 将用户请求分类为预定义的四种类型

**提示设计**:
- **Types**: 明确定义四种请求类型的语义特征
- **Decision Rules**: 编码区分特征
- **Exception Handling**: 无法匹配时请求用户澄清

**输出**: 分类结果 + 决策原因

**2. 参数解析 Agent (Parameter Parsing Agent)**

**功能**: 从用户查询中提取结构化参数

**类型感知提示设计**:
- Single/Multiple Call: 提取 NeuroSim 输入参数
- PPA Optimization: 提取优化器参数（设计空间、算法配置）

**参数分组**:
```
{
  "specialized_params": {
    "testbench_0": { /* 各测试用例特有参数 */ },
    "testbench_1": { /* 各测试用例特有参数 */ }
  },
  "common_params": {
    /* 所有测试用例共享参数 */
  }
}
```

**规则约束**:
- 分离 specialized 和 common 参数
- 严格禁止幻觉（no-hallucination）
- 格式规范化

**3. 参数调整 Agent (Parameter Adjustment Agent)**

**功能**: 处理用户修改、添加或删除参数的请求

**关键能力**:
- 缺失参数赋值（用户输入或默认值）
- 参数范围切换（specialized ↔ common）
- 测试用例增删后的索引重排序

### 2.4 对话示例

```
User: 我想仿真 ResNet-50 在三种不同 ADC 精度（5b, 6b, 7b）下的精度和 PPA

Step 1 - Task Parsing:
Agent: 识别为 Multiple Call 请求

Step 2 - Parameter Parsing:
Agent: 提取参数
  - DNN model: ResNet-50
  - ADC precision: [5, 6, 7] bits
  - 缺失: 工艺节点、存储器件类型、子阵列大小...

Step 3 - User Adjustment:
User: 补充缺失参数
  - Tech node: 22nm
  - Device: SRAM
  - Subarray: 128x128

Step 4 - Script Generation:
Agent: 生成三个测试用例的执行脚本

Step 5 - Execution:
Agent: 调用 NeuroSim，返回 PPA 结果
```

---

## 3. CIM 优化器与设计空间剪枝

### 3.1 优化问题定义

CIM 优化目标：在硬件约束下找到最优 PPA 配置

**设计空间**:
- 存储器件类型: SRAM, RRAM, FeFET, etc.
- 技术节点: 22nm, 14nm, 7nm, etc.
- 子阵列大小: 32×32 到 512×512
- ADC 类型: Flash, SAR
- ADC 精度: 3b 到 7b
- ...（数十个参数）

**约束**:
- 面积 < 25 cm²
- 功耗 < 200 mW

**优化目标**:
- 最大化吞吐
- 最大化能效
- 最大化 FoM（能效 × 计算效率）

### 3.2 设计空间剪枝策略

**核心洞察**: 不同 DNN 模型在设计空间中的性能分布存在相关性

**剪枝流程**:

```
┌─────────────────────────────────────────────────────────────┐
│              Design Space Pruning Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Target Model: Swin-T                                        │
│  Base Model:   ViT-B (预仿真数据)                            │
│                                                              │
│  Step 1: Cross-Space Constraint Projection                  │
│    ├── 在设计空间交集中代表性采样                            │
│    ├── 在目标模型和基础模型上仿真/获取性能                    │
│    └── 幂律回归建立跨模型映射                                │
│                                                              │
│  Step 2: Top-K Design Space Pruning                         │
│    ├── 约束投影和有效性过滤                                  │
│    ├── 高性能样本（Top-K）频率聚合                           │
│    └── 基于分箱映射缩减目标空间                              │
│                                                              │
│  Step 3: Optimization on Pruned Space                       │
│    └── 在剪枝后的空间上使用启发式算法优化                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**关键参数**:
- **Full recovery iteration**: 20（完全恢复迭代）
- **De-pruning iteration**: 10（反剪枝迭代）
- **De-pruning interval**: 2（反剪枝间隔）

### 3.3 优化算法

支持三种启发式优化算法：

| 算法 | 特点 | 适用场景 |
|-----|------|---------|
| **Genetic Algorithm (GA)** | 全局搜索能力强 | 复杂设计空间 |
| **Simulated Annealing (SA)** | 收敛速度快 | 快速探索 |
| **Tree-Structured Parzen Estimator (TPE)** | 贝叶斯优化 | 样本高效 |

---

## 4. 实验结果

### 4.1 Agent 准确性评估

在 40 个 CIM 查询的测试集上评估（每种类型 10 个）：

| LLM Backend | Single Call | Multiple Call | Testbench Auto-design | PPA Optimization | **总准确率** |
|------------|-------------|---------------|----------------------|------------------|-------------|
| **GPT-5.1** | **100%** | **100%** | **100%** | **100%** | **100%** |
| GPT-5-mini | 100% | 90% | 80% | 90% | 90% |
| DeepSeekV3.2-Reasoner | 90% | 100% | 100% | 90% | 95% |
| DeepSeekV3.2-Chat | 80% | 90% | 60% | 80% | 77.5% |

**关键发现**:
- GPT-5.1 在所有任务类型上实现完美准确率
- 复杂请求类型（multi-call、auto-design、optimization）对 LLM 要求更高
- 提示工程和多 Agent 验证可进一步提升非 GPT-5.1 模型的性能

### 4.2 优化性能对比（无剪枝）

在 ResNet-50 和 Swin Transformer Tiny (Swin-T) 上的 FoM 优化：

**ResNet-50**:
- 所有启发式算法（GA、SA、TPE）均比随机搜索收敛快
- SA 收敛最快，平均运行时间约 1 小时

**Swin-T**:
- 运行时间显著长于 ResNet-50
  - 原因 1: NeuroSim 仿真延迟更高
  - 原因 2: 设计空间更大
- 即使使用最快的 SA，平均仍需数小时
- 最坏 5% 情况下需要 6-7 小时

**关键洞察**: 现有启发式算法对 CNN 有效，但对 Vision Transformer 运行时间过长，需要算法级增强。

### 4.3 设计空间剪枝效果

在 Swin-T 上的优化，对比有无设计空间剪枝：

**FoM 优化**:

| 算法 | 基础模型 | 平均运行时间 | P95 运行时间 |
|-----|---------|-------------|-------------|
| GA | 无剪枝 | 基准 | 基准 |
| GA | ResNet-50 | 0.79× | 0.69× |
| GA | ViT-B | **0.42×** | **0.35×** |
| SA | 无剪枝 | 基准 | 基准 |
| SA | ResNet-50 | 0.79× | 0.69× |
| SA | ViT-B | **0.42×** | **0.29×** |
| TPE | 无剪枝 | 基准 | 基准 |
| TPE | ResNet-50 | 0.79× | 0.69× |
| TPE | ViT-B | **0.42×** | **0.35×** |

**能效优化**:

| 算法 | 基础模型 | 平均运行时间 | P95 运行时间 |
|-----|---------|-------------|-------------|
| SA | 无剪枝 | 基准 | 基准 |
| SA | ViT-B | **0.50×** | **0.29×** |

**结论**:
- 设计空间剪枝显著加速优化过程
- ViT-B 作为基础模型比 ResNet-50 更有效（Swin-T 与 ViT 结构更相似）
- SA 算法在剪枝后始终保持最快收敛速度

---

## 5. 为什么对 AI 硬件重要

### 5.1 LLM Agent 赋能硬件设计自动化

ChatNeuroSim 代表了 LLM Agent 在硬件设计领域的成功应用：

**传统流程**:
```
用户 → 阅读手册 → 理解参数 → 手动配置 → 运行仿真 → 分析结果 → 迭代优化
    ↑___________________________________________________________|
    （循环多次，耗时数天到数周）
```

**ChatNeuroSim 流程**:
```
用户 → 自然语言描述需求 → Agent 自动处理 → 返回结果
    （几分钟到几小时）
```

**核心价值**:
- **降低门槛**: 无需深入理解仿真器细节
- **提高效率**: 自动化重复性工作
- **减少错误**: Agent 进行参数依赖检查
- **加速迭代**: 快速探索设计空间

### 5.2 对 CIM 生态的推动

**1. 降低 CIM 设计门槛**
- 使更多研究人员和工程师能够使用 CIM 仿真器
- 加速 CIM 架构的创新和探索
- 促进 CIM 技术的普及和应用

**2. 优化算法创新**
- 设计空间剪枝策略可推广到其他硬件优化问题
- 跨模型知识迁移的思想具有普适性
- 为 DSE 自动化提供新范式

**3. 开源贡献**
- 代码开源：https://github.com/neurosim/ChatNeuroSim
- 促进社区协作和工具改进
- 建立 CIM Agent 的基准测试

### 5.3 对神经符号 AI 的启示

ChatNeuroSim 本身就是神经符号 AI 的成功应用：

**神经部分（LLM）**:
- 理解自然语言请求
- 提取结构化参数
- 生成执行脚本

**符号部分（规则引擎）**:
- 参数依赖检查
- 约束验证
- 优化算法执行

**协同工作**:
- LLM 处理不确定性和模糊性
- 符号系统保证正确性和可解释性
- 两者结合实现端到端自动化

**对神经符号 AI 芯片的启示**:
- 需要同时支持神经网络推理和符号规则执行
- 动态图结构和静态计算的混合
- 自然语言理解和结构化输出的协同

### 5.4 未来硬件设计范式的 preview

ChatNeuroSim 预示了未来硬件设计的可能方向：

**趋势 1：自然语言驱动的设计**
- 设计师用自然语言描述意图
- AI Agent 自动转化为具体实现
- 人机协作的新模式

**趋势 2：自主优化系统**
- 从手动调参到自动优化
- 从单次设计到持续迭代
- 从专家经验到数据驱动

**趋势 3：跨领域知识融合**
- 结合架构设计知识
- 结合制造工艺知识
- 结合应用场景知识

---

## 6. 局限与未来方向

### 6.1 当前局限

- **LLM 依赖**: 需要强大的 LLM API（GPT-5.1 效果最佳）
- **成本考虑**: 大量 API 调用带来成本开销
- **泛化能力**: 主要针对 NeuroSim，其他仿真器适配需要额外工作
- **复杂设计**: 对于极端复杂的定制设计，自动化程度有限

### 6.2 未来研究方向

**技术演进**:
- 支持更多 CIM 仿真器（MNSIM、XCIM 等）
- 扩展到其他硬件架构（存算一体、近存计算、光计算）
- 集成多物理域仿真（热、电、可靠性）
- 开发更高效的本地 LLM 部署方案

**应用扩展**:
- 全栈自动化（从算法到 GDS）
- 在线学习和持续优化
- 多目标优化和帕累托前沿探索
- 与制造数据结合的良率优化

---

## 7. 总结

ChatNeuroSim 代表了 AI 辅助硬件设计的重要进展：

1. **框架创新**: 首个面向 CIM 的 LLM Agent 自动化框架
2. **Agent 设计**: 任务解析、参数解析、参数调整三 Agent 协作
3. **优化算法**: 设计空间剪枝显著加速 DSE（0.42×-0.79× 运行时间减少）
4. **实用价值**: 100% 准确率（GPT-5.1），大幅降低 CIM 设计门槛

对于 AI 硬件设计，ChatNeuroSim 提供了以下关键启示：
- **LLM Agent 的潜力**: 自然语言界面 + 自动化执行
- **设计空间剪枝**: 跨模型知识迁移的普适价值
- **神经符号应用**: 神经网络 + 符号规则的协同范例
- **开源生态**: 社区协作加速工具演进

随着 LLM 能力的持续提升和硬件设计复杂度的不断增加，类似 ChatNeuroSim 的 AI 辅助设计工具将在芯片设计领域发挥越来越重要的作用，最终实现"自然语言描述 → 自动优化 → 物理实现"的全流程自动化。

---

## 参考文献

1. Lee, M.-Y., & Yu, S. (2026). ChatNeuroSim: An LLM Agent Framework for Automated Compute-in-Memory Accelerator Deployment and Optimization. arXiv:2603.08745.
2. Chen, P.-Y., et al. (2018). NeuroSim: A circuit-level macro model for benchmarking neuro-inspired architectures in online learning. IEEE TED.
3. Xia, Q., et al. (2023). MNSIM 2.0: A behavior-level modeling tool for memristor-based neuromorphic computing systems. IEEE TCAD.
4. Chang, L., et al. (2024). XCIM: Xbar-based compute-in-memory with FeFET for binary neural networks. IEEE TVLSI.
5. Chang, C., et al. (2024). ChatEDA: A large language model powered autonomous agent for EDA. IEEE TCAD.