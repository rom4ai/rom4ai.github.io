---
layout: post
title: "CPPL: 面向 LLM 的电路提示编程语言"
categories: ["research", "llm-inference", "ai-accelerator"]
author: ["Shuo Yin", "Yihe Wang", "Lancheng Zou", "Xufeng Yao", "Tinghuan Chen", "Chen Bai", "Zhengrong Wang", "Tsung-Yi Ho", "Bei Yu"]
publish_date: ["2026"]
original_paper: "https://arxiv.org/abs/2605.17892"
tags: ["llm-inference", "ai-accelerator", "benchmark", "neural-symbolic", "training"]
---

# CPPL: A Circuit Prompt Programming Language

> **原文链接**: [arXiv:2605.17892](https://arxiv.org/abs/2605.17892) | [PDF](https://arxiv.org/pdf/2605.17892.pdf)

## 摘要

大语言模型（LLMs）在寄存器传输级（RTL）设计自动化方面显示出潜力，但直接 RTL 生成难以验证、优化，且难以与基于编译器的硬件设计流程集成。CIRCT 等硬件编译器基础设施提供了类型化的中间表示、合法性检查和优化通道，但当前 LLM 难以直接生成原始编译器 IR，因为 MLIR 语法、SSA 规范、方言特定操作和严格的位宽约束。

本文介绍 **CPPL**（Circuit Prompt Programming Language），一种编译器介导的设计框架，将 LLM 辅助硬件生成转变为静态可检查的前端问题，而非无约束的 RTL 文本生成任务。CPPL 结合 Python 前端 DSL 用于声明模块接口和层次结构，以及 CPPL IR——一种 JSON 格式的电路 IR，旨在暴露编译器可见的结构同时保持对 LLM 的可访问性。

在 RTLLM 基准上的评估表明，CPPL 在功能正确性方面优于直接 Verilog 和直接 CIRCT IR 生成，同时 CIRCT 优化可减少综合后的 AIG 节点数。

![CPPL 框架概览](/assets/cppl/_page_0_Figure_8.jpeg)
*图1: CPPL 结合 LLM 生成与编译器介导的电路构建和优化（来源：原文 Figure 1）*

## 1. 问题定义

> "Generated RTL can be syntactically invalid or incompatible with downstream tools. Syntactically valid RTL often fails functional tests because the model must simultaneously reason about behavior, structure, widths, and corner cases."

现有 LLM4RTL 流程遵循端到端生成范式：模型直接生成最终 RTL 文本，然后由仿真器或综合工具检查。这种方法存在三个核心问题：

1. **语法和工具兼容性错误**：生成的 RTL 可能包含语法错误或下游工具不兼容的问题
2. **功能正确性差距**：语法正确的 RTL 经常无法通过功能测试，因为模型必须同时推理行为、结构、位宽和边界情况
3. **缺乏编译器优化**：端到端 RTL 生成几乎不向硬件编译器基础设施暴露中间结构，而这些基础设施提供了类型化表示、合法性检查、规范化和优化

CIRCT 等硬件编译器基础设施通过将结构、合法性和类型在最终后端代码生成之前显式化，可以解决这些问题。然而，直接让 LLM 生成 CIRCT IR 存在挑战：
- 缺乏 CIRCT IR 示例的公开数据集
- CIRCT 是活跃开发项目，IR 语法和方言定义持续演进
- SSA 形式对 LLM 理解和生成存在困难

实验表明，即使强大的商业模型生成 CIRCT IR 的正确性也远低于 Verilog，尽管提供了格式特定的提示。

## 2. 方法框架

![性能差距](/assets/cppl/_page_2_Figure_0.jpeg)
*图2: Verilog 与 CIRCT IR 在语法正确性上的 pass@1 分数差距（来源：原文 Figure 2）*

### 2.1 CPPL 核心设计

CPPL 采用编译器介导的生成范式，结合 LLM 的自然语言和代码生成能力与 CIRCT 提供的类型化编译流程。

**Python 前端 DSL**：CPPL 提供基于 Python 的前端 DSL，用于显式捕获模块接口和结构层次，同时将实现意图保留为 LLM 友好的形式。

```python
from cppl import module, In, Out

@module
class ALU:
    """A 2-bit opcode ALU with an 8-bit adder instance."""
    op_code: In[2]
    op_a: In[8]
    op_b: In[8]
    res: Out[8]
    zero: Out[1]
    
    def __init__(self):
        self.adder8 = Adder8()
```

**CPPL IR**：JSON 格式的中间表示，编码电路操作于正则模式中。CPPL IR 保留编译器可见的电路结构，同时避免原始 MLIR 语法。

![CPPL IR 示例](/assets/cppl/_page_2_Picture_12.jpeg)
*图3: CPPL 框架概览（来源：原文 Figure 4）*

### 2.2 编译流程

CPPL 的工作流程包含四个阶段：

1. **前端 DSL 解析**：解析模块签名、结构化文档字符串和格式化模块调用所暗示的层次结构
2. **LLM 生成 CPPL IR**：模型基于文档字符串中描述的实现意图生成 JSON 格式的电路 IR
3. **编译器验证与优化**：执行语法验证、位宽推断、结构检查和死代码消除
4. **确定性降级到 CIRCT**：生成 CIRCT IR，应用优化通道，最终生成 Verilog

### 2.3 位宽推断系统

CPPL IR 使用位宽作为其类型系统，与 CIRCT IR 的类型系统对齐。对于模块 m，其签名环境 Σ(m) = (I, O) 记录声明的输入和输出端口类型。

从输入端口环境 Γ⁰ = I 开始，编译器通过操作传播位宽来推断每个内部 SSA 值：
- 算术和逻辑操作保留位宽
- 比较和归约操作产生单比特值
- 多路选择器要求等宽分支
- 实例从被调用者签名获取结果位宽

这种设计在 JSON 到 CIRCT 编译期间静态检查位宽错误，如不等二进制操作数、非单比特多路选择器选择信号等。

## 3. 实验结果

### 3.1 直接生成 vs CPPL

| 模型 | 直接 Verilog (pass@1) | 直接 CIRCT IR (pass@1) | CPPL (pass@1) |
|------|----------------------|----------------------|---------------|
| Claude-opus-4.6 | 0.725 | 0.500 | **0.800** |
| GPT-5.3-codex | 0.675 | 0.318 | **0.782** |
| Qwen-3.6-plus | 0.679 | 0.082 | **0.768** |

**关键发现**：
- **直接 Verilog 生成**：语法正确性高（>0.9），但功能正确性存在显著差距（最高 0.725）
- **直接 CIRCT IR 生成**：明显更困难，大多数模型语法 pass@1 大幅下降，Qwen-3.6-plus 仅 0.093
- **CPPL**：所有评估模型通过 CPPL 编译流程产生语法有效的 CIRCT IR 和 Verilog，功能正确性全面超越两种基线

### 3.2 错误类型分析

![错误类型分布](/assets/cppl/_page_2_Figure_2.jpeg)
*图3: 所有评估模型在 RTLLM 基准上生成 CIRCT IR 的几何平均错误类型分解（来源：原文 Figure 3）*

CIRCT IR 生成错误分为三类：
- **CIRCT 操作错误**（最大类别）：LLM 经常无法满足方言特定的操作约束
- **MLIR 语法错误**：违反 MLIR 格式语义
- **类型错误**：类型系统不匹配

CPPL 通过将模型生成与编译器验证分离，有效避免了这些错误来源。

### 3.3 综合节点减少

| 设计 | 参考 Verilog | CPPL 无优化 | CPPL 有优化 | 优化收益 |
|------|-------------|------------|------------|---------|
| ram | 700 | 4147 | **413** | 90.0% |
| div_16bit | 16397 | 6603 | **3945** | 40.3% |
| calendar | 352 | 295.78 | **229** | 22.6% |
| Geo. Avg | 513.89 | 439.88 | **368.16** | 16.3% |

**关键发现**：
- CPPL 生成的 Verilog 通常产生比直接 LLM 生成 Verilog 和 RTLLM 参考设计更低的综合后 AIG 节点数
- 启用 CIRCT 优化通道可将几何平均节点数从 439.88 减少到 368.16，**减少 16.3%**
- 某些设计（如 ram）通过优化获得显著收益（90% 节点减少）

## 4. 与现有工作的对比

| 方法 | 生成目标 | 编译器验证 | 后端优化 | LLM 友好性 |
|------|---------|-----------|---------|-----------|
| RTLLM | Verilog | ✗ | ✗ | ✓ |
| VerilogEval | Verilog | ✗ | ✗ | ✓ |
| RTLCoder | Verilog | ✗ | ✗ | ✓ |
| 直接 CIRCT IR | CIRCT IR | ✓ | ✓ | ✗ |
| **CPPL** | **CPPL IR** | **✓** | **✓** | **✓** |

CPPL 的独特价值在于：
- 比直接 Verilog 生成更可靠（编译器验证）
- 比直接 CIRCT IR 生成更易于 LLM 使用（JSON 格式）
- 保留编译器优化的全部能力

## 5. 局限与未来方向

### 当前局限

1. **前端 DSL 表达能力**：当前 Python DSL 主要关注模块接口和层次结构，复杂控制流表达有待扩展
2. **优化通道覆盖**：评估使用的 CIRCT 优化通道相对基础，更激进的优化有待探索
3. **基准范围**：RTLLM 主要覆盖组合逻辑、时序逻辑和存储器设计，更大规模设计有待验证

### 未来研究方向

1. **扩展 DSL 表达能力**：支持更复杂的硬件设计模式，如流水线、状态机等
2. **集成形式化验证**：将形式化验证工具集成到编译流程中
3. **多模型协作**：探索多个 LLM 协作生成复杂硬件设计
4. **领域特定优化**：针对 AI 加速器、处理器等特定领域的优化通道

## 6. 总结

CPPL 是一种编译器介导的 LLM 辅助硬件生成框架，通过引入 Python 前端 DSL、静态可检查的 JSON 格式电路 IR 和确定性降级到 CIRCT，使 LLM 能够通过结构化表示而非原始 RTL 或原始编译器 IR 生成硬件。

**核心贡献**：
- 识别了 LLM 生成能力与原始 CIRCT IR 生成之间的不匹配
- 提出结合 Python 前端 DSL、JSON 电路 IR、静态检查和 CIRCT 降级的编译器介导硬件生成框架
- 在 RTLLM 上验证，功能正确性和综合级紧凑性均优于直接生成基线

CPPL 代表了可靠的 LLM 硬件设计方向，能够从后端优化中受益，为 LLM 辅助的硬件设计自动化开辟了新路径。

---

**项目链接**: https://github.com/SawyDust1228/CPPL
