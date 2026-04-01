---
layout: post
title: 'VMXDOTP: RISC-V Vector ISA Extension for Efficient Microscaling (MX) Format Acceleration'
categories:
- research
- ai-accelerator
- risc-v
- quantization
author: ROM4AI
date: 2026-04-01
original_paper: "https://arxiv.org/abs/2603.04979"
tags:
- risc-v
- quantization
- ai-accelerator
- low-power
- edge-ai
---

# VMXDOTP: RISC-V Vector ISA Extension for Efficient Microscaling (MX) Format Acceleration

> **原文链接**: [arXiv:2603.04979](https://arxiv.org/abs/2603.04979) | Authors: Max Wipfli, Gamze İslamoğlu, Navaneeth Kunhi Purayil, Angelo Garofalo, Luca Benini (ETH Zurich, University of Bologna)

## 摘要

VMXDOTP 是一个面向 RISC-V Vector (RVV) 1.0 的 ISA 扩展，用于高效加速 Microscaling (MX) 数据格式的点积运算。该扩展支持 MXFP8/MXFP4 输入、FP32/BF16 累加，以及软件定义的块大小。在 12nm FinFET 工艺下，VMXDOTP 增强的 VPE 集群实现了 **125 MXFP8-GFLOPS** 和 **250 MXFP4-GFLOPS** 的峰值性能，能效分别达 **843** 和 **1632 GFLOPS/W**。相比软件模拟的 MXFP8-MatMul，VMXDOTP 实现了 **7.0× 加速** 和 **4.9× 能效提升**，同时保持了 **97%** 的 FPU 利用率。

---

## 1. 问题定义：MX 格式的计算挑战

### 1.1 Microscaling (MX) 格式的崛起

随着 AI 模型规模的增长，低精度数据格式成为关键优化手段：

> "Microscaling (MX) data formats, based on block floating-point (BFP) representations, have emerged as a promising solution to reduce data volumes while preserving accuracy."

**MX 格式的核心思想**:
- 块级共享指数（E8M0）+ 窄位宽元素（FP8/FP6/FP4）
- 在保持动态范围的同时减少存储和带宽
- OCP 标准化，NVIDIA Blackwell、AMD CDNA 4 已支持

**标准 MX 格式**:

| 格式 | 元素精度 | 块大小 | 应用场景 |
|-----|---------|--------|---------|
| **MXFP8** | E5M2 / E4M3 | 32 | 通用训练/推理 |
| **MXFP6** | E3M2 / E2M3 | 32 | 边缘设备 |
| **MXFP4** | E2M1 | 32 | 极致压缩 |
| **MXINT8** | INT8 | 32 | 整数运算 |

### 1.2 MX 计算的核心操作

MX 数据的基本操作是块级点积（MX-Dot-Product）：

```
MX-DP 公式:
C = Dot(A, B) = Scale(A) × Scale(B) × Σ(Element(A_i) × Element(B_i))

其中:
- Scale(A), Scale(B): E8M0 块级缩放因子
- Element(A_i), Element(B_i): 窄位宽 FP 元素
- C: FP32 累加结果
```

**计算流程**:
1. 解包 MX 块，提取缩放因子和元素
2. 元素级乘法（窄位宽）
3. 累加求和
4. 应用块级缩放

### 1.3 现有方案的局限

**软件模拟方案**:
- 将窄位宽元素展开到宽格式（FP8→FP16）再计算
- 需要额外的转换指令
- 计算效率低下，FPU 利用率低

**专用硬件方案**:
- NVIDIA Blackwell、AMD CDNA 4 已支持 MX
- 但缺乏开源、可编程的解决方案
- 固定块大小（k=32），缺乏灵活性

**RISC-V 现状**:
- Zvfofp8min 扩展提供 FP8→BF16 转换指令
- 但缺乏原生 MX 点积支持
- 无法充分利用 MX 的计算优势

### 1.4 设计目标与挑战

**设计目标**:
1. 高效微架构：高吞吐、高 FPU 利用率
2. 灵活块大小：软件定义，不限于 k=32
3. 标准兼容：符合 RVV 1.0 规范

**关键挑战**:

| 挑战 | 描述 | 影响 |
|-----|------|------|
| **操作数位宽差异大** | 元素（8/4-bit）vs 缩放（8-bit）vs 累加（32/16-bit） | 最大 256-bit EEW |
| **输入超宽** | 32×FP8 = 256-bit 操作数 | 超出现有 RVV 指令 |
| **5 个源操作数** | 标准 RVV 仅支持 3 个 | 编码和寄存器端口挑战 |
| **块大小固定** | 硬件固定 k=32 缺乏灵活性 | 无法适应不同场景 |

---

## 2. VMXDOTP ISA 扩展设计

### 2.1 核心洞察：分解 MX 点积

VMXDOTP 的关键创新：将大 MX-DP 分解为多个小点积之和：

```
32-wide MX-DP = Sum of four 8-wide dot products

Example:
Dot_32(A, B) = Dot_8(A[0:7], B[0:7]) 
             + Dot_8(A[8:15], B[8:15])
             + Dot_8(A[16:23], B[16:23])
             + Dot_8(A[24:31], B[24:31])
             
All share the same block scales!
```

**优势**:
- 降低硬件块大小到可管理值（k=8 for FP8, k=16 for FP4）
- 元素向量宽度匹配 FLEN（32/64-bit）
- 软件可实现任意倍数于硬件块大小的块

### 2.2 指令集规范

**VMXDOTP 指令变体**（取决于 FLEN）：

| 指令 | 累加器 | 元素格式 | 硬件块大小 k | EMUL_elem | EMUL_scale |
|-----|--------|---------|-------------|-----------|------------|
| `vmxdotp.vv` | FP32 | FP8 | 8 (FLEN=32) / 16 (FLEN=64) | LMUL/4 | LMUL/4 |
| `vmxdotp.vf` | FP32 | FP8 | 8 / 16 | LMUL/4 | scalar |
| `vmxdotp.ww` | BF16 | FP8 | 8 / 16 | LMUL/2 | LMUL/4 |
| `vmxdotp.wf` | BF16 | FP8 | 8 / 16 | LMUL/2 | scalar |
| `vmxdotp.qq` | FP32 | FP4 | 16 / 32 | 2×LMUL | LMUL/4 |
| `vmxdotp.qf` | FP32 | FP4 | 16 / 32 | 2×LMUL | scalar |

**指令编码**:

```
Vector-Vector 格式 (vv/ww/qq):
vd[i] += vs3[i] × vs4[i] × Σ(vs1[ki+j] × vs2[ki+j])

Vector-Scalar 格式 (vf/wf/qf):
vd[i] += rs3 × vs4[i] × Σ(rs1[j] × vs2[ki+j])

其中:
- vd: 累加器向量 (FP32/BF16)
- vs1/vs2: 元素向量 (FP8/FP4)
- vs3/vs4 或 rs3/rs1: 缩放因子 (E8M0)
- k: 硬件块大小
```

**格式选择**:
- 元素格式（FP8/FP4）通过 CSR 配置
- 支持 FP8E5M2、FP8E4M3、FP4E2M1

### 2.3 解决关键挑战

**挑战 1 & 2：位宽差异和超宽输入**
- **方案**: 分解为多个小点积，元素 EEW = FLEN
- **结果**: 无需引入新的 EEW，兼容现有 RVV

**挑战 3：5 个源操作数**
- **方案**: 预取和缓冲缩放因子，避免额外寄存器端口
- **实现**: 缩放因子预取到专用缓冲区

**挑战 4：块大小灵活性**
- **方案**: 硬件固定小 k，软件组合成大块
- **示例**: 硬件 k=8，软件循环 4 次实现 k=32

### 2.4 与标准 RVV 的兼容性

**数据布局**:

```
Vector Register Layout (k=8, FP8):
┌─────────────────────────────────────────────────────────────┐
│  VLMAX independent MX-DPA operations                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Element Vectors (vs1, vs2):                                │
│  ┌─────────┐ ┌─────────┐        ┌─────────┐               │
│  │Elem 0-7 │ │Elem 8-15│  ...   │Elem n   │               │
│  │(64-bit) │ │(64-bit) │        │(64-bit) │               │
│  └─────────┘ └─────────┘        └─────────┘               │
│                                                             │
│  Scale Vectors (vs3, vs4):                                 │
│  ┌────┐ ┌────┐        ┌────┐                             │
│  │S0  │ │S1  │  ...   │Sn  │  (E8M0, 8-bit each)         │
│  └────┘ └────┘        └────┘                             │
│                                                             │
│  Accumulator Vector (vd):                                  │
│  ┌────────┐ ┌────────┐      ┌────────┐                   │
│  │Acc 0   │ │Acc 1   │ ...  │Acc n   │  (FP32/BF16)       │
│  └────────┘ └────────┘      └────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 微架构实现

### 3.1 Spatz VPE 增强

VMXDOTP 集成到 Spatz 开源 VPE：

**基础 Spatz 架构**:
- 标量核心 + 向量单元
- 32×32-bit 向量寄存器文件（VRF）
- 向量加载/存储单元（VLSU）
- 向量算术单元（VAU）：IPU + 4×FPU
- 128 KiB 共享 L1 Scratchpad

**VMXDOTP 增强**:

```
┌─────────────────────────────────────────────────────────────┐
│              VMXDOTP-Enhanced Spatz Core                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Vector Register File (VRF)              │   │
│  │  32 × 32-bit registers, 3R1W                         │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                        │
│  ┌──────────────────┼──────────────────────────────────┐   │
│  │                  ▼                                   │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │           MX Dot-Product Unit                  │  │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐       │  │   │
│  │  │  │ Dot-8   │  │ Dot-8   │  │ Dot-8   │  ...  │  │   │
│  │  │  │ Engine  │  │ Engine  │  │ Engine  │       │  │   │
│  │  │  │(8×FP8)  │  │(8×FP8)  │  │(8×FP8)  │       │  │   │
│  │  │  └────┬────┘  └────┬────┘  └────┬────┘       │  │   │
│  │  │       └─────────────┴─────────────┘           │  │   │
│  │  │                    │                          │  │   │
│  │  │              ┌─────┴─────┐                    │  │   │
│  │  │              │  Accumulate │                   │  │   │
│  │  │              │  + Scale   │                   │  │   │
│  │  │              └─────┬─────┘                    │  │   │
│  │  └────────────────────┼──────────────────────────┘  │   │
│  │                       │                              │   │
│  │  ┌────────────────────┼──────────────────────────┐  │   │
│  │  │  Scale Prefetch Buffer (E8M0)                │  │   │
│  │  │  - Preload block scales                      │  │   │
│  │  │  - Avoid extra VRF read ports                │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  └────────────────