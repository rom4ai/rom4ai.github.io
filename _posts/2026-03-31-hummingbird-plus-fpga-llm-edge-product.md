---
layout: post
title: "Hummingbird+: Advancing FPGA-based LLM Deployment from Research Prototype to Edge Product"
categories: [research, ai, ml]
author: ROM4AI
date: 2026-03-31
original_paper: "https://dl.acm.org/doi/10.1145/3748173.3779189"
tags: ["ai-accelerator", "llm-inference", "edge-ai", "quantization", "memory-system", "moe"]
---

# Hummingbird+: Advancing FPGA-based LLM Deployment from Research Prototype to Edge Product

> **原文链接**: [ACM Digital Library](https://dl.acm.org/doi/10.1145/3748173.3779189) | FPGA 2026

## 摘要

Field-Programmable Gate Arrays (FPGAs) 已被证明可用于大语言模型 (LLM) 部署，但与嵌入式 GPU 和 NPU 相比，它们在最终边缘产品中的竞争力仍然较弱。这主要是因为现有的基于 FPGA 的 LLM 加速器原型依赖大型、昂贵的 FPGA 设备来提供足够的硬件资源以获得满意的性能，而边缘产品对成本高度敏感。

本文提出 **Hummingbird+**，包含：(1) 一个紧凑的嵌入式 FPGA 基 LLM 加速器，旨在提供与嵌入式 GPU 和 NPU 相当的推理性能；(2) 一个围绕 Zynq UltraScale XCZU2CG/3EG SoC 构建的定制印刷电路板 (PCB)，配备 24GB 内存，量产预期物料清单 (BOM) 低于 150 美元。

通过广泛的 FPGA -centric 优化，我们显著降低了加速器的资源消耗，使其能够在入门级 FPGA 上部署，具有卓越的成本效益。在该平台上，我们成功部署了 GPTQ 4-bit 量化的 **Qwen3-30B-A3B** LLM，实现了超过 **18 token/s** 的解码速度和超过 **50 token/s** 的预填充速度，无需进一步的模型压缩。据我们所知，这是首次展示基于 FPGA 的边缘产品作为 LLM 部署的实用且经济高效的最终实现介质。

## 1. 问题定义

> "FPGAs—viewed purely as computational devices—struggle to match the TFLOPs/TOPs of these alternatives, becoming increasingly less competitive in such role."

在深学习时代，FPGA 扮演着几个关键角色：(1) 可重配置性使研究人员能够探索新颖架构，而无需承担芯片流片的高成本；(2) 长期作为 ASIC 不可或缺的验证平台；(3) 作为最终部署平台（如 BrainWave 项目和 Vitis AI）。

然而，随着深度学习模型复杂度的增长、GPU 的快速发展以及 ASIC 的崛起，FPGA 作为纯计算设备在峰值计算密度方面的劣势使其竞争力逐渐下降。

**LLM 带来的新机遇：**

LLM 展现出内存受限的特性，降低了原始计算吞吐量对端到端推理性能的决定性影响。内存带宽——在嵌入式设备中通常相当——成为主要性能瓶颈。在这种背景下，FPGA 在峰值计算密度方面的劣势变得不那么明显。

然而，维持 LLM 推理仍然需要在每个生成步骤中将数十亿参数移入内存，这一负担压垮了嵌入式设备有限的带宽。**混合专家 (MoE) LLM** 的出现解决了这一挑战——每个 token 只激活一小部分专家，显著降低带宽需求，使得使用更慢但更高容量的内存成为可能。

**MoE 与 FPGA 的协同：**

嵌入式 FPGA 揭示了一个独特优势：虽然通常限于 DDR4，但其灵活的 I/O 允许与多通道内存接口，从而补偿单通道速度限制，同时支持更大的总容量。MoE 的特性与 FPGA 可扩展内存连接之间的这种协同，重新开启了 FPGA 不仅作为原型平台或验证平台，而且作为 MoE LLM 最终边缘部署产品的可能性。

**现有工作的局限：**

- FlightLLM、AccLLM、EdgeLLM 等依赖昂贵的 HBM 云级 FPGA
- 嵌入式 FPGA 工作（Li et al.、Hummingbird）仅关注解码阶段加速
- TeLLMe 引入预填充加速但针对更小的 BitNet LLM，依赖极端三元量化
- 硬件成本、LLM 质量、预填充和解码速度似乎形成**不可能三角**

## 2. 方法框架

![Hummingbird+解决方案](/assets/hummingbird-plus-fpga-llm/figure_1_1.png)
*图：提出的 Hummingbird+ MoE 基 LLM 部署解决方案（来源：原文 Figure 1）*

Hummingbird+ 旨在同时实现以下目标：
1. 支持高质量、中等规模的 LLM，无需激进的压缩方法
2. 针对低成本 FPGA 芯片
3. 接近理论解码速度极限
4. 获得尽可能多的预填充加速

### 2.1 平台级：定制 PCB

我们的定制 PCB 平台采用入门级 Zynq Ultrascale SoC：**XCZU2CG 或 XCZU3EG**。

**内存配置：**
- PS 侧：集成 8GB DDR4 板载内存
- PL 侧：SODIMM 插槽支持 8/16/32GB 内存
- 双通道内存接口提供 **34GB/s** 峰值带宽
- 总容量 **24GB**，足以容纳 30B MoE 基 LLM

**存储：**
- M.2 NVMe 插槽预留用于 128GB SSD
- 利用 PS 内置的 PCIe-2.0 硬核实现快速模型权重加载

**成本：**
- 量产物料清单 (BOM) 约 **150 美元**
- 其中 FPGA 芯片本身仅占约 30%

### 2.2 加速器架构

![架构概览](/assets/hummingbird-plus-fpga-llm/figure_3_1.png)
*图：从平台级、SoC 级到加速器级的自上而下概览（来源：原文 Figure 3）*

**Token Processor 设计：**

现有 LLM 加速器通常遵循三支柱设计——矩阵引擎、非线性特殊功能单元和内存管理器。我们识别出几个低效之处：

1. LLM 推理由扁平形状的 GEMM 操作（解码期间降为 GEMV）主导
2. 解码对数据依赖和初始化延迟高度敏感
3. 矩阵单元和特殊功能单元之间的松散耦合迫使后者过度配置

我们提出一种新颖的加速器架构，以高度资源高效且紧凑的 **token processor** 为中心。每个 token processor 集成所有必要组件：
- GEMV 实例用于 MatMul
- 标量引擎用于特殊功能
- 激活缓冲区用于片上解码数据流

**多 Token 并行：**

利用上述资源节省，我们设法在 XCZU2CG 和 XCZU3EG 上分别实例化 2 个和 4 个处理器，进一步启用预填充加速。

### 2.3 GEMV 引擎优化

![GEMV引擎优化](/assets/hummingbird-plus-fpga-llm/figure_5_1.png)
*图：GEMV 引擎的实现和优化细节（来源：原文 Figure 5）*

我们的 GEMV 引擎支持双精度——**W4 用于线性投影，KV8 用于注意力**——并在两种模式下运行：DOT 模式 (y = W·A) 和 AXPY 模式 (Y_i = a·X + Y_{i-1})。

**关键优化技术：**

| 优化技术 | 描述 | DSP 资源 |
|---------|------|---------|
| 双精度操作数打包 | (A+D)×B 打包，W4/KV8 模式切换 | 内置预加器 |
| INMODE 门控 | 通过 INMODE[1] 信号零门控 A 端口 | 无 LUT 开销 |
| 链-树混合实现 | 16 个 DSP 链，分层归约树 | 140 DSPs |
| 双倍数据速率 (DDR) | 输入固定数据流，B 级联路径预取 | 每链 1 个 LUT |
| AXPY 结果卸载 | P 级联路径重用，三级序列化 | 32 个 CLB |

**性能指标：**
- 单引擎实现 **272 GOPs**
- 使用 **140 DSPs** @ 532MHz
- 仅 **<1K LUTs** 开销
- 并行度：M=2, K=128, N=2

### 2.4 标量引擎优化

![标量引擎优化](/assets/hummingbird-plus-fpga-llm/figure_6_1.png)
*图：标量引擎概览和资源共享优化（来源：原文 Figure 6）*

标量引擎处理浮点非线性操作，如 softmax 和 RMSNorm。我们采用数据流方法而非覆盖层方法。

**资源共享策略：**
- 通过时间占用分析识别非重叠计算 I/O 操作
- 在操作符之间应用资源共享电路
- 使用 one-hot 向量的有效信号选择活动端口

**FP16 乘法器优化：**
- 操作数打包和 DDR 技术应用于 16 位浮点乘法器
- 将 DSP 使用减半（从 14 个到 7 个）
- 指数加法吸收到 DSP 后加器中

**资源消耗：**
- **<6K LUTs**
- **仅 7 DSPs**
- 支持所有 LLM 特殊功能
- 完全隐藏在 MatMul 周期内

## 3. 实验结果

### 3.1 资源消耗对比

| 实现 | 精度 | MACs | AXPY | LUT | FF | DSP |
|------|------|------|------|-----|-----|-----|
| [31] | W16A16 | 128 | No | 31,871 | 44,809 | 256 |
| [29] | W4A24 | 128 | Yes | 1,962 | 4,355 | 148 |
| **Ours** | **W4KV8A12** | **512/256** | **Yes** | **950(+912)** | **2,313(+2,231)** | **140** |

*表：不同 GEMV 引擎设计对比（来源：原文 Table 3）*

### 3.2 标量引擎对比

| 实现 | LUT | FF | BRAM | URAM | DSP |
|------|-----|-----|------|------|-----|
| [31] | 29K | 40K | 6.5 | 3 | 24 |
| [29] | 5.8K | 6.8K | 11 | 0 | 29 |
| **Ours** | **5.9K** | **6.4K** | **23** | **0** | **7** |

*表：不同标量引擎设计对比（来源：原文 Table 4）*

### 3.3 与商业平台性能对比

![性能对比](/assets/hummingbird-plus-fpga-llm/figure_10_1.png)
*图：与商业 CPU 和嵌入式 GPU 的解码和预填充速度对比（来源：原文 Figure 10）*

**解码速度对比：**

| 平台 | 内存 | 带宽 | 成本 | 解码速度 | 能效 |
|------|------|------|------|---------|------|
| Jetson AGX Orin | LPDDR5 64GB | 204GB/s | $1,999 | ~40 token/s | 基准 |
| i9-13900KF DDR4 | 32GB | 34GB/s | $1,000 | ~15 token/s | - |
| **XCZU3EG** | **DDR4 24GB** | **34GB/s** | **$150** | **18 token/s** | **7× token/$** |

**关键发现：**
- XCZU3EG 实现近 2× 于同带宽 DDR4 CPU 的解码吞吐量
- 相比 Jetson AGX Orin，仅使用 17% 带宽却维持超过一半的解码速度
- **7× 更高的 token-per-dollar 效率** 和 **1.7× 更高的功耗效率**

**预填充速度：**
- XCZU3EG 在所有预填充长度上均优于 CPU
- 峰值预填充吞吐量约 **50 token/s**

### 3.4 与 SOTA FPGA 加速器对比

| 研究 | 平台 | 模型 | 加速阶段 | 压缩 | LUTs | DSPs | 带宽 | 功率 | D.token/s | P.token/s |
|------|------|------|---------|------|------|------|------|------|-----------|-----------|
| FlightLLM | U280 | Llama2-7B | P&D | SparseW8A8 | 574K | 6345 | 460 | 45W | 55 | 2-4× |
| EdgeLLM | VCU128 | ChatGLM-6B | P&D | W4A16 | 967K | 4563 | 460 | 56.8W | 86 | 2× |
| AccLLM | U280 | Llama2-7B | P&D | W2KV4A8 | 420K | 4497 | 460 | 33W | 164 | 2-4× |
| Hummingbird | KV260 | Llama3-8B | D | W4A24 | 26K | 179 | 19.2 | 3.81W | 4.8 | - |
| TeLLMe | KV260 | BitNet | P&D | W1.58 | 108K | 356 | 19.2 | 7W | 9 | 116 |
| **Ours (ZU3EG)** | **ZU3EG** | **Qwen3-30B-A3B** | **P&D** | **W4KV8A12** | **50K** | **311** | **34** | **~13W** | **18** | **50** |

*表：基于 FPGA 的 LLM 加速器对比（来源：原文 Table 5）*

**关键成就：**
- 在嵌入式 FPGA 加速器中提供最佳解码性能
- 在最小设备上运行最大的 LLM（30B MoE）
- 唯一同时支持预填充加速的嵌入式 FPGA 解决方案

## 4. 优点与局限

### 优点

1. **极致成本效益**
   - 量产 BOM 仅 **$150**
   - 相比 Jetson AGX Orin 实现 **7× token-per-dollar** 效率
   - FPGA 芯片本身仅占 BOM 的 30%

2. **突破性的模型规模支持**
   - 首次在嵌入式 FPGA 上部署 **30B 参数 MoE LLM**
   - 仅激活 1.47GB 参数/token，实现高效推理
   - 支持 16K 上下文长度

3. **全阶段加速**
   - 同时支持解码 (**18 token/s**) 和预填充 (**50 token/s**)
   - 多 token processor 架构实现可扩展预填充
   - 精细化的数据流隐藏延迟

4. **激进的资源优化**
   - GEMV 引擎仅使用 **140 DSPs** 实现 272 GOPs
   - 标量引擎仅 **7 DSPs** 支持所有非线性操作
   - 在 **50K LUTs** 内实现完整加速

### 局限

1. **MoE 工作负载不规则性**
   - 专家选择的动态性导致内存访问模式不规则
   - 激活卸载/重载影响实际预填充吞吐量

2. **手工 RTL 设计依赖**
   - 需要精细的手动优化才能达到此效率
   - 覆盖层 DPU、HLS 和编译器驱动方法无法达到此细粒度效率

3. **平台专用性**
   - 针对 Xilinx Ultrascale+ DSP48E2 优化
   - 迁移到其他 FPGA 家族需要重新设计

4. **上下文长度限制**
   - 当前支持 16K 上下文（Qwen3 原生支持 256K）
   - 受限于嵌入式设备的内存容量

## 5. 总结

Hummingbird+ 代表了 FPGA 基 LLM 部署从研究原型到边缘就绪产品的重要进展。

**核心贡献：**

1. **首个低成本 FPGA 边缘产品** — 量产 BOM $150，使 30B MoE LLM 边缘部署成为现实

2. **系统级优化方法论** — 从 PCB 设计、SoC 架构到加速器微架构的全栈优化

3. **极致资源效率** — 通过激进的 DSP 和 LUT 优化，在入门级 FPGA 上实现高性能

4. **预填充加速突破** — 首次在嵌入式 FPGA 上实现有效的预填充加速

**对 AI 芯片设计的启示：**

- MoE 架构与 FPGA 可扩展内存连接的协同为边缘 AI 开辟新路径
- 当计算不再是瓶颈时，内存带宽和容量成为关键
- 手工优化的 RTL 设计在资源受限场景仍具不可替代的价值

Hummingbird+ 证明了 FPGA 不仅可以作为原型平台和验证工具，更可以作为 LLM 边缘部署的最终实现介质——这在 CNN、ViT、BERT 和密集 LLM 时代是无法实现的。

## 参考文献

1. Jindong Li et al., "Hummingbird+: