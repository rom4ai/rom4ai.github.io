---
layout: post
title: "SPINIC: Programmable Superconducting Neuron with In-Memory Computation for Ultra-Efficient Neuromorphic Computing"
categories: ["neuromorphic", "ai-accelerator", "low-power"]
author: ["Muen Wang", "Shucheng Yang", "Yuxiang Lin", "Yuntian Gao", "Xue Zhang", "Xiaoping Gao", "Minghui Niu", "Huanli Liu", "Yikang Wan", "Wei Peng", "Jie Ren"]
publish_date: ["March 2026"]
original_paper: "https://arxiv.org/abs/2603.04966"
tags: ["neuromorphic", "ai-accelerator", "low-power", "superconducting", "spiking-neural-networks"]
---

# SPINIC: Programmable Superconducting Neuron with In-Memory Computation for Ultra-Efficient Neuromorphic Computing

> **原文链接**: [arXiv:2603.04966](https://arxiv.org/abs/2603.04966) | [PDF](https://arxiv.org/pdf/2603.04966.pdf)

## 摘要

The escalating energy demands of artificial intelligence pose a critical challenge to conventional computing. This paper introduces SPINIC (Superconducting Programmable spIking Neuromorphic Integrated Circuit), a programmable Josephson-junction-based leaky integrate-and-fire (LIF) neuron that features intrinsic static memory and precise programmability by encoding somatic and synaptic parameters directly in the bias current. The neuron achieves dual-timescale plasticity: picosecond-scale short-term modulation and long-term weight retention exceeding 10⁴ seconds, while operating up to 45 GHz with femtojoule-level energy dissipation per spike.

## 1. 问题定义

> "The rapid growth of artificial intelligence infrastructure continues to challenge the capabilities of conventional computing architecture built on metal-oxide-semiconductor (CMOS) platforms in reducing energy consumption and latency of computation."

Modern CMOS neuromorphic processors have demonstrated impressive parallelism and event-driven efficiency, yet they remain fundamentally limited by:
- Transistor leakage and capacitive switching energy
- Memory-computation separation inherent to Von Neumann architectures
- Energy consumption of 10⁻¹² to 10⁻¹⁰ J per synaptic operation—nearly ten orders of magnitude higher than the theoretical minimum (Landauer bound)
- Operating frequencies confined below a few GHz due to thermal bottlenecks

The paper addresses the need for a new class of hardware that unifies: ultralow energy consumption, ultrafast dynamics, and learning capability.

## 2. 方法框架

### 2.1 Core Innovation: Superconducting Programmable Neuron

The SPINIC architecture is built upon a programmable leaky integrate-and-fire (LIF) neuron using Josephson junctions (JJs). The key insight is using **bias currents as a new degree of freedom for parameter encoding**:

**Soma Circuit Design:**
- Superconducting inductor (L) stores quantum flux and generates loop current as membrane potential
- Resistor (R) induces leakage to govern the decay time constant (τ ~ L/R)
- Picohenry-level inductance and sub-ohm resistance enable τ of tens of picoseconds
- Spike computation speed exceeding 40 GHz

**Synapse Circuit Design:**
- Built on a non-destructive read-out (NDRO) circuit with embedded LIF feedback
- Implements synaptic weights through pulse-count modulation (not amplitude)
- A single incoming spike triggers a programmable number of pulse replications

### 2.2 In-Memory Computing via Bias-Current Programming

> "The DC bias currents that govern device dynamics also serve as persistent, analog memory variables."

This is the breakthrough innovation: neuronal thresholds and synaptic weights are stored natively as persistent bias currents, without on-chip memory or refresh circuitry. By introducing scaling factors XI1 and XI2 for bias currents:
- Ten discrete soma thresholds (1 to 10) are achieved
- Synaptic weights ranging from 1 to 20 states
- Reconfiguration time of microseconds for the entire network

### 2.3 Dual-Timescale Plasticity

**Long-Term Plasticity (LTP):**
- Weight adjustment via varying bias current of JJs in the LIF feedback loop
- Stable over 10,000+ cycles with negligible drift (|DR| < 2%)

**Short-Term Plasticity (STP):**
- Picosecond-scale (10⁻¹² s) modulation via input pulse frequency
- Average weight reduction of ~0.22 per GHz frequency change
- Enables rapid temporal adaptation

## 3. 实验结果

### 3.1 Hardware Implementation

A 4×4 SPINIC prototype core was fabricated using the SIMIT-Nb03P superconducting integration process:
- 1,050 Josephson junctions for the network circuitry
- Operating temperature: 4.2 K (liquid helium)
- Tested with MNIST, Fashion-MNIST, and custom datasets

### 3.2 Performance Comparison

| Implementation | Year | Synaptic Width | GSOPS | Energy/SOP | GSOPS/W (Wo.C.) | GSOPS/W (W.C.) |
|----------------|------|----------------|-------|------------|-----------------|----------------|
| TrueNorth | 2015 | 1 bit | 58 | 26 pJ | 400 | 292 |
| Loihi | 2018 | 1-9 bit | - | 23.6 pJ | 42 | 31 |
| Tianjic | 2020 | 8 bit | 608 | 1.54 pJ | 649 | 474 |
| Darwin3 | 2024 | 1/2/4/8/16 bit | - | 5.47 pJ | 183 | 134 |
| SUSHI | 2023 | 1 bit | 1,355 | - | 32,336 | 108 |
| **SPINIC** | **2026** | **4-5 bit** | **2,306** | **3.21 fJ** | **93,184** | **311** |
| **SPINIC (ERSFQ)** | **2026** | **4-5 bit** | **2,306** | **3.21 fJ** | **2,693,949** | **8,962** |

*Wo.C. = Without cooling cost, W.C. = With cooling cost (300× for superconducting)*

### 3.3 Key Metrics

- **Energy per synaptic operation**: 3.21 femtojoules (fJ)
- **Operating frequency**: Up to 45 GHz
- **Peak throughput (32×32 core)**: 2,306 GSOPS
- **Energy efficiency**: 93,184 GSOPS/W (without cooling)
- **Quantization robustness**: Only 0.21% accuracy loss on MNIST with limited precision

## 4. 优点与局限

### 优点
- **Three orders of magnitude** better energy efficiency than CMOS neuromorphic platforms
- **In-memory computing** eliminates data movement overheads
- **Dual-timescale plasticity** enables both rapid adaptation and long-term memory
- **Programmability** via bias currents without complex digital control
- **10× better** energy efficiency than prior superconducting SUSHI chip

### 局限
- Requires cryogenic cooling (4.2 K operation)
- Limited to 4-5 bit synaptic weight resolution
- Fabrication complexity of superconducting circuits
- Cooling power penalty must be factored into total cost

## 5. 为什么对AI硬件重要

SPINIC represents a fundamental shift in neuromorphic computing hardware:

1. **Near-Landauer-Bound Computing**: At 3.21 fJ per operation, SPINIC approaches the theoretical minimum energy for information processing (~2.9 × 10⁻²¹ J at 300K), demonstrating that superconducting electronics can achieve energy efficiencies impossible with semiconductor technologies.

2. **Unified Memory-Computation**: By encoding parameters directly in bias currents, SPINIC eliminates the Von Neumann bottleneck that plagues conventional architectures.

3. **Path to Exascale AI**: With projected efficiency of 2.7 million GSOPS/W (using ERSFQ technology), SPINIC offers a viable path to energy-efficient exascale neuromorphic computing.

4. **Implications for Edge AI**: While requiring cryogenic cooling, the technology demonstrates principles that could inspire room-temperature approaches to in-memory computing and event-driven processing.

## 参考文献

1. Wang, M., et al. (2026). Programmable superconducting neuron with intrinsic in-memory computation and dual-timescale plasticity for ultra-efficient neuromorphic computing. arXiv:2603.04966.
2. Merolla, P. A., et al. (2014). A million spiking-neuron integrated circuit with a scalable communication network and interface. Science, 345, 668-673.
3. Davies, M., et al. (2018). Loihi: A Neuromorphic Manycore Processor with On-Chip Learning. IEEE Micro, 38, 82-99.
4. Pei, J., et al. (2019). Towards artificial general intelligence with hybrid Tianjic chip architecture. Nature, 572, 106-111.
5. Liu, Z., et al. (2023). SUSHI: Ultra-High