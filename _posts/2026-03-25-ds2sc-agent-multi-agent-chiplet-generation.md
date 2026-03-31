---
layout: post
title: 'DS2SC-Agent: 从数据手册到 SystemC 模型的多智能体自动化生成流水线'
categories:
- research
- ai
- hardware
- chiplet
author: ROM4AI
date: 2026-03-25
original_paper: https://arxiv.org/abs/2603.21190
tags:
- chiplet
- llm-inference
- transformer
- ai-accelerator
---
# DS2SC-Agent: 从数据手册到 SystemC 模型的多智能体自动化生成流水线

> **原文链接**: [arXiv:2603.21190](https://arxiv.org/abs/2603.21190) | [PDF](https://arxiv.org/pdf/2603.21190.pdf)

## 摘要

在后摩尔时代，通过 Chiplet 技术进行异构集成已成为先进半导体设计的主要驱动力。为了在系统集成早期进行高效的架构探索和硬件软件协同验证，构建精确高效的 SystemC 行为级参考模型是不可或缺的步骤。然而，传统的 Chiplet 模型构建工作流严重依赖领域专家，工程师需要阅读数十页的工业级数据手册，提取关键的接口规格、时序约束和内部算法逻辑，然后将其转化为 SystemC 代码。这一过程耗时、依赖专业知识且容易出错。

最近，大语言模型在自动化硬件代码生成方面展现出巨大潜力，但现有的 LLM 辅助设计框架主要基于高度结构化或简化的设计规格进行评估。在实际工业工程中，原始数据手册包含冗长、复杂且高度非结构化的信息，直接输入 LLM 会导致严重的"上下文消失"和"逻辑幻觉"问题。

本文提出了 **DS2SC-Agent（Datasheet-to-SystemC-Agent）**：第一个端到端的全自动化生成流水线，能够直接将原始数据手册翻译成 SystemC Chiplet 模型。该系统建立了一个高效的多智能体协作框架，通过解耦复杂的建模任务，协调包含非结构化长文档解析、SystemC 核心代码构建、Testbench 激励生成和自适应闭环调试的全自动化工作流。

## 1. 问题定义

> "Traditional manual modeling is notoriously time-consuming and error-prone... Directly feeding these raw, multimodal datasheets into an LLM inevitably leads to catastrophic failures."

传统的手工建模方法存在两个核心问题：

**问题 1：手工建模效率低下**
- 工程师需要阅读数十页的工业级数据手册
- 提取关键接口规格、时序约束和内部算法逻辑
- 手动翻译为 SystemC 代码
- 过程耗时、依赖专业知识、容易出错

**问题 2：LLM 直接生成不可靠**
- 原始数据手册包含冗长、复杂、高度非结构化的信息
- 包含自然语言描述、参数表格、时序图和架构示意图
- 单次生成（one-shot）方法面临严重的"上下文消失"问题
- LLM 在生成内部逻辑时忘记初始接口约束
- 产生"逻辑幻觉"，几乎无法直接从工业数据手册生成功能正确的 SystemC 代码

## 2. 方法框架

DS2SC-Agent 建立了一个**四智能体协作架构**，将复杂的建模任务解耦为四个专门化的阶段：

![DS2SC-Agent 系统概览](/assets/fig1-overview.jpeg)
*图 1：DS2SC-Agent 系统概览（来源：原文 Fig.1）*

### 2.1 核心模块：四智能体架构

**Agent 1：规格解析智能体（Specification Parsing Agent）**
- **输入**：原始 PDF 数据手册 + 预定义的 Spec IR 模板
- **任务**：从数据手册中提取关键硬件信息（引脚列表、主要特性、寄存器映射），填充预定义模板
- **输出**：完全填充的 Spec IR（规格中间表示），作为下游智能体的单一事实来源

**Agent 2：代码生成智能体（Code Generation Agent）**
- **输入**：完全填充的 Spec IR
- **任务**：构建 SystemC 硬件模型，生成头文件（.h）
- **输出**：自包含的 header-only SystemC 核心代码，明确定义 sc_module 架构、端口和内部信号

**Agent 3：Testbench 生成智能体（Testbench Generation Agent）**
- **输入**：Spec IR + 生成的核心头文件
- **任务**：合成 SystemC testbench，输出 main.cpp 文件
- **输出**：可独立执行的 testbench 汇编，包含激励生成器、监控/检查器和顶层连接入口

**Agent 4：自动调试智能体（Automated Debugging Agent）**
- **输入**：编译/仿真错误日志 + 生成的代码 + Spec IR
- **任务**：提供自适应的闭环迭代代码优化
- **输出**：经过功能验证的最终 SystemC 代码

### 2.2 Spec IR 模板设计

> "The Spec IR template serves as the cornerstone of the entire automated pipeline... encapsulates the domain expertise through a 'mixed-fill' strategy."

Spec IR（规格中间表示）模板采用**"混合填充"策略**，包含四个核心模块：

1. **全局配置和边界规格（预填充区）**：预填充确定性系统级参数，剪枝设计空间
2. **领域特定接口和参数抽象（提取区）**：针对数字/模拟/RF Chiplet 的定制化提取策略
3. **行为逻辑伪代码提取（提取区）**：提取核心动态行为规则，建立结构化 C/C++ 分支逻辑
4. **仿真测试用例（预填充区）**：预设置核心仿真测试场景，确保模型生成与验证目标对齐

### 2.3 闭环调试机制

自动调试智能体采用**链式思维（Chain-of-Thought）推理**，包含两个并行反馈回路：

**语法调试回路（编译阶段）**
- 捕获编译器错误日志（具体行号和类型不匹配错误）
- 修复语法错误：缺失分号、未声明变量、模块连接端口不匹配

**功能调试回路（运行阶段）**
- 当代码编译成功但仿真结果失败时触发
- 交叉参考仿真数据日志与 Spec IR 中的预期行为
- 定位功能缺陷：状态机转换死锁、非线性公式计算错误、位宽截断

## 3. 实验结果

### 3.1 实验设置

**Benchmark**：三个代表性单功能工业 Chiplet，跨越三个不同物理领域：

| Chiplet | 领域 | 数据手册特点 | 主要挑战 |
|---------|------|-------------|----------|
| **FFT** | 数字 | 96 页综合指南 | 从密集文本中提取 4 个核心寄存器映射 |
| **LA（Limiting Amplifier）** | 模拟 | 6 页密集表格 | 从表格中提取精确静态工作点 |
| **PA（Power Amplifier）** | RF | 18 页曲线图 | 从图形趋势中提取 RF 性能曲线 |

**实现细节**：
- 核心推理引擎：Gemini 3 Flash（通过 API）
- 温度配置：Agent1=0.2（高确定性），Agent2/3=0.4（平衡约束与灵活性），Agent4=0.3（严谨推理）
- 编译环境：GCC + SystemC 2.3.3 + SystemC-AMS 2.3.4

### 3.2 实验结果

**案例 1：数字领域 - FFT Chiplet**

执行完整的"时域→频域→时域"闭环测试，输入 8 点单调递增序列（1 到 8）：

| Index | 输入 (Re, Im) | IFFT 输出 (Re, Im) | 差分误差 (ΔRe, ΔIm) |
|-------|---------------|-------------------|---------------------|
| 0 | (1, 0) | (1, 0) | (0, 0) |
| 1 | (2, 0) | (2, -2.7e-16) | (0, 2.7e-16) |
| 2 | (3, 0) | (3, 4.4e-16) | (0, 4.4e-16) |
| 3 | (4, 0) | (4, 3.8e-16) | (0, 3.8e-16) |
| 4 | (5, 0) | (5, 0) | (0, 0) |
| 5 | (6, 0) | (6, -5e-17) | (0, 5e-17) |
| 6 | (7, 0) | (7, 4.4e-16) | (0, 4.4e-16) |
| 7 | (8, 0) | (8, -6.4e-17) | (0, 6.4e-17) |

**验证结果：PASS** - 差分误差在 10⁻¹⁶量级，符合双精度浮点算术的机器 epsilon 限制。

**案例 2：模拟领域 - LA Chiplet**

生成了三个不同操作阶段的瞬态仿真波形：

1. **线性放大阶段**：输入正弦波在小信号范围内，模型展现理想线性特性
2. **非线性钳位阶段**：输入信号超过预定义阈值时，输出波形被钳位到最大输出电压摆幅
3. **禁用/使能逻辑**：响应数字控制信号，TDF 处理线程逻辑旁路，输出返回静态电平

**案例 3：RF 领域 - PA Chiplet**

![PA 的 Pin-Pout 特性对比](/assets/fig9-pa-characteristics.png)
*图 9：RF PA Chiplet 的数据手册参考与仿真结果的 Pin-Pout 特性对比（来源：原文 Fig.9）*

- 在整个动态范围（线性、压缩、深度饱和区域）内，仿真 Pout 与真实数据手册曲线高度拟合
- 最大偏差在 P1dB 压缩点附近严格保持在 **1dB 以内**

### 3.3 实验分析

DS2SC-Agent 的成功归因于以下关键设计：

1. **多智能体解耦架构**：有效缓解了 LLM 处理长文档时的上下文消失和逻辑幻觉问题
2. **Spec IR 模板**：通过"混合填充"策略将领域专业知识编码到模板中，约束生成空间
3. **闭环调试机制**：通过链式思维推理实现自我修复，无需人工干预
4. **领域适应性**：针对数字/模拟/RF 不同领域的定制化提取策略

## 4. 优点与局限

### 优点

- **首创性**：第一个端到端的从原始数据手册到 SystemC 模型的全自动化生成流水线
- **高效协作**：四智能体架构有效解耦复杂任务，每个智能体专注于特定子任务
- **跨领域通用**：在数字、模拟、RF 三个不同物理领域均展现出高保真度
- **最小化人工干预**：整个流程完全自动化，包括自适应闭环调试
- **工业级适用**：能够处理真实世界的复杂数据手册（96 页 FFT 指南、密集表格、曲线图）

### 局限

- **单功能 Chiplet**：当前评估仅限于单功能 Chiplet，尚未扩展到多功能复杂系统
- **图形解析限制**：LLM 直接解析复杂图形曲线存在固有限制，需要人工提供基础物理参数
- **模型依赖**：当前使用 Gemini 3 Flash，对其他基础模型的适应性需要进一步验证
- **系统级验证**：尚未实现多 Chiplet 异构系统的自动化生成和系统级验证

## 5. 总结

DS2SC-Agent 通过创新的多智能体协作架构，成功 bridging 了非结构化工业级数据手册与可执行 SystemC Chiplet 模型之间的关键鸿沟。实验结果证明，该系统能够直接从原始多模态规格中准确重建复杂算法逻辑、多阶段物理行为和非线性 RF 特性。

未来研究方向包括：
- 从单功能 Chiplet 建模扩展到复杂多 Chiplet 异构系统的自动化生成和系统级验证
- 探索集成更小的领域特定微调本地模型，进一步降低推理延迟并增强数据隐私

## 参考文献

1. Wu, Y., Wu, Y., Xiong, Y., Zhao, D., Shen, J., Jiang, J., He, G., Tu, S., & Sun, Y. (2026). DS2SC-Agent: A Multi-Agent Automated Pipeline for Rapid Chiplet Model Generation. *arXiv preprint arXiv:2603.21190*.
2. AMD Xilinx. (2018). Fast Fourier Transform v9.1 LogiCORE IP Product Guide. PG109.
3. Qorvo. (2023). QPM2239: 13–15.5 GHz 80W GaN Power Amplifier Module Datasheet.
4. Micrel. (2022). SY88923V: 5V/3.3V 2.5Gbps High-Speed Limiting Post Amplifier Datasheet.
5. Wei, J., Wang, X., Schuurmans, D., et al. (2022). Chain-of-thought prompting elicits reasoning in large language models. *NeurIPS*.

---

*本文基于 arXiv 论文 2603.21190 自动转换生成，旨在促进技术传播和知识分享。*
