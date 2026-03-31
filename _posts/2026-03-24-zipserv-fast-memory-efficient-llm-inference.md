---
layout: post
title: 'ZipServ: Fast and Memory-Efficient LLM Inference with Hardware-Aware Lossless
  Compression'
categories:
- llm
- compression
- gpu
- inference
- systems
author: ROM4AI
date: 2026-03-24
paper_url: https://arxiv.org/abs/2603.17435
pdf_url: https://arxiv.org/pdf/2603.17435.pdf
tags:
- memory-system
- llm-inference
- transformer
- ai-accelerator
---
**原文链接:** [arXiv](https://arxiv.org/abs/2603.17435) | [PDF](https://arxiv.org/pdf/2603.17435.pdf)

# ZipServ: Fast and Memory-Efficient LLM Inference with Hardware-Aware Lossless Compression

## 摘要

Lossless model compression holds tremendous promise for alleviating the memory and bandwidth bottlenecks in bit-exact Large Language Model (LLM) serving. However, existing approaches often result in substantial inference slowdowns due to fundamental design mismatches with GPU architectures. We present ZipServ, a lossless compression framework co-designed for efficient LLM inference. ZipServ introduces Tensor-Core-Aware Triple Bitmap Encoding (TCA-TBE), a novel fixed-length format that enables constant-time, parallel decoding, together with a fused decompression-GEMM (ZipGEMM) kernel that decompresses weights on-the-fly directly into Tensor Core registers. Experiments show that ZipServ reduces the model size by up to 30%, achieves up to 2.21× kernel-level speedup over NVIDIA's cuBLAS, and expedites end-to-end inference by an average of 1.22× over vLLM.

## 研究问题

LLM 部署面临 GPU 内存和带宽瓶颈。现有的无损压缩方法由于与 GPU 架构不匹配导致推理速度显著下降：在内核级别，传统熵编码器产生的可变长度比特流破坏了 SIMT 并行性；在系统级别，解耦的流水线导致冗余的内存流量。有损压缩方法（如量化）会导致精度损失，例如激进的 4-bit 量化在 LiveCodeBench 上准确率从 56.0% 降至 36.2%。

## 方法框架

ZipServ 采用"加载压缩、计算解压"（load-compressed, compute-decompressed）设计。核心创新包括：1）Tensor-Core-Aware Triple Bitmap Encoding (TCA-TBE)：一种新颖的固定长度编码格式，支持常数时间并行解码；2）ZipGEMM 内核：融合解压和 GEMM 计算，直接将权重解压到 Tensor Core 寄存器中，消除中间缓冲区，最大化计算强度。

## 核心模块

TCA-TBE 编码：利用三个位图（非零位图、符号位图、指数位图）对权重进行固定长度编码，保持 GPU SIMT 并行性。ZipGEMM 内核：融合解压和矩阵乘法，支持 FP16/BF16 输出精度，直接在 Tensor Core 中完成计算。

## 实验设置

| 配置项 | 值 |
|--------|-----|
| GPU | NVIDIA L40S, A100, H100 |

## 实验结果

| 指标 | 数值 | 条件/说明 |
|------|------|----------|
| - | 模型大小减少：30% | - |
| - | 内核级加速：2.21× (vs cuBLAS) | - |
| - | 端到端推理加速：1.22× (vs vLLM) | - |
| - | 内存带宽节省：显著减少内存访问 | - |
| - | 精度损失：0% (无损压缩) | - |

## 优点

1. 无损压缩：保证 bit-exact 精度，无数值误差。2. 硬件感知设计：针对 GPU Tensor Core 优化，支持并行解码。3. 融合内核：消除中间缓冲区，减少内存流量。4. 通用性：适用于各种 LLM 架构，无需重新训练。5. 首个同时提供存储节省和显著加速的无损压缩系统。

## 局限

1. 需要特定的 GPU 架构支持（Tensor Core）。2. 压缩率相比有损压缩方法较低（30% vs 量化可达 75%）。3. 实现复杂度较高，需要自定义 CUDA 内核。4. 对于已经使用低精度训练的场景收益有限。

## 总结

ZipServ 通过硬件感知的无损压缩设计，首次实现了在 GPU 上同时获得存储节省和推理加速。TCA-TBE 编码和 ZipGEMM 融合内核的创新设计，为 LLM 部署提供了新的优化方向，特别适用于对精度要求严格的生产环境。
