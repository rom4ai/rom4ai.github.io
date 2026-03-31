---
layout: post
title: 'ROMA: 基于ROM的QLoRA边缘设备LLM加速器'
categories:
- llm
- accelerator
- hardware
- qlora
- edge-computing
author: ROM4AI
date: 2026-03-11
tags:
- edge-ai
- transformer
- low-power
- llm-inference
- memory-system
---
# ROMA: 基于ROM的QLoRA边缘设备LLM加速器

## 摘要

ROMA是一种专为QLoRA设计的边缘设备LLM加速器，采用混合存储架构：ROM存储量化基模型，SRAM存储LoRA权重和KV缓存。通过创新的B-ROM设计减少约1/4的CMOS晶体管，并采用Fused-cell融合布局优化芯片资源利用。在TSMC 7nm工艺下可实现超过20,000 tokens/s的生成速度。

## 论文要点

| 项目 | 内容 |
|------|------|
| **问题定义** | 边缘设备部署LLM面临内存和计算挑战：量化后的QLoRA模型仍需大量内存，生成每个token需要访问整个模型权重；混合精度计算（低比特量化基模型+高精度LoRA）的硬件支持困难 |
| **方法框架** | ROMA：混合存储架构QLoRA加速器 - ROM存储量化基模型 + SRAM存储LoRA权重和KV缓存。核心创新：B-ROM（块级ROM）减少CMOS晶体管约1/4；Fused-cell融合B-ROM与计算单元 |
| **核心模块** | 2D计算单元阵列(17x16) + 向量单元(1x16) + 矩阵单元(8x16x2) + H-Unit(SRAM,高精度) + L-Unit(B-ROM,低精度) |
| **实验设置** | TSMC 7nm工艺；测试模型：Llama3-8B(INT2+FP8 LoRA)和Llama3.2-3B(INT4+FP8 LoRA)；QLoRA rank=16；频率500MHz |
| **实验结果** | TTFT延迟：5.6ms(256输入)/140.2ms(4K输入)；解码吞吐量：31.8K tokens/s(无KV)/24.6K tokens/s(1K KV)；对比CPU提升2785x，对比GPU提升70.5x |
| **优点** | 1. ROM高存储密度，可全芯片存储整个LLM，无需外部内存；2. B-ROM减少40%面积；3. Fused-cell进一步优化片上资源利用；4. 支持4-bit 3B或2-bit 8B LLaMA模型；5. 功耗仅33.1W |
| **局限** | 1. ROM不可修改，基模型更新周期长（以年计）；2. 高QLoRA rank会增加参数大小，影响性能；3. SRAM容量影响最大token缓存数 |

## 总结

本文提出了一种新的方法，在特定任务上取得了优异的表现。
