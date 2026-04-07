---
layout: post
title: "GPU-FPGA Heterogeneous Systems for Disaggregated LLM Inference: Memory Processing Pipeline Acceleration"
categories: ["ai-accelerator", "llm-inference", "memory-system"]
author: ["Zifan He", "Rui Ma", "Yizhou Sun", "Jason Cong"]
publish_date: ["March 2026"]
original_paper: "https://arxiv.org/abs/2603.29002"
tags: ["ai-accelerator", "llm-inference", "memory-system", "heterogeneous-computing", "fpga"]
---

# GPU-FPGA Heterogeneous Systems for Disaggregated LLM Inference: Memory Processing Pipeline Acceleration

> **原文链接**: [arXiv:2603.29002](https://arxiv.org/abs/2603.29002) | [PDF](https://arxiv.org/pdf/2603.29002.pdf)

## 摘要

Modern large language models increasingly depend on efficient long-context processing mechanisms including sparse attention, retrieval-augmented generation (RAG), and compressed contextual memory. This paper shows that these optimizations can be unified into a four-step memory processing pipeline: Prepare Memory, Compute Relevancy, Retrieval, and Apply to Inference. Through systematic profiling, the authors identify 22%-97% memory processing overhead in LLM inference and propose GPU-FPGA heterogeneous systems to accelerate memory-bounded operations. Evaluated on AMD MI210 GPU + Alveo U55C FPGA, the system achieves 1.04-2.2× speedup and 1.11-4.7× energy reduction.

## 1. 问题定义

> "Modern LLMs can process and generate 128k to 1 million tokens per request when users prompt for paper reading, deep reasoning, and creative writing. However, LLMs typically maintain all contexts as key-value (KV) caches, incurring substantial hardware costs and runtime overhead."

**Key Challenge**: Storing KV cache for 1M tokens requires up to 69 GB of GPU memory for GPU-OSS-120B model, and repeatedly accessing the cache amplifies memory pressure during auto-regressive decoding.

**Existing Optimizations**:
- **Sparse Attention**: Selectively attends to subset of tokens (DeepSeek Attention, SeerAttention-R, LServe)
- **Retrieval-Augmented Generation (RAG)**: Offloads static knowledge to external database (FLARE, DRAGIN)
- **Compressed Contextual Memory**: Compresses past tokens into embeddings (MemAgent, Titans, HMT)
- **Test-time Training (TTT)**: Adapts model parameters during inference (LaCT)

However, prior work treats these as isolated techniques without systematic understanding of their computational characteristics and hardware efficiency implications.

## 2. 方法框架

### 2.1 Four-Step Memory Processing Pipeline

The paper unifies diverse LLM inference optimizations under a common four-step pipeline:

**1. Prepare Memory** (prep(M<t) = I<t)
- Preprocesses raw memory into compact or structured format
- Examples: Linear projections + RoPE (DeepSeek), Page-wise Min/Max pooling (LServe), Tokenization (RAG)
- Typically compute-intensive with regular, consecutive memory accesses

**2. Compute Relevancy** (comp(I<t, xt) = S)
- Assigns importance scores to each memory entry
- Examples: Multi-headed inner product (DeepSeek), BM25 scoring (RAG), Linear projection + inner product (Memory as Context)
- Memory-bound with irregular access patterns

**3. Retrieval** (ret(M<t, S) = M<t')
- Selects and extracts information based on scores
- Examples: Top-k selection, threshold-based filtering, weighted sum
- Memory-bound with data-dependent access patterns

**4. Apply to Inference** (apply(M<t', xt) = O<t)
- Integrates retrieved content into decoding process
- Examples: Fine-grain sparse attention, appending to query, model prefilling
- Compute-intensive with regular accesses

### 2.2 Computational Heterogeneity Analysis

The paper reveals significant heterogeneity across pipeline steps:

| Step | Arithmetic Intensity | Access Pattern | Data Requirement |
|------|---------------------|----------------|------------------|
| Prepare Memory | 10-100 (compute-bound) | Regular | Local Memory |
| Compute Relevancy | 1-10 (memory-bound) | Irregular | Across Memories |
| Retrieval | ~1 (memory-bound) | Irregular | Across Memories |
| Apply to Inference | 10-100 (compute-bound) | Regular | Local Memory |

**Key Insight**: Sparse attention and RAG are dominated by Compute Relevancy and Retrieval (memory-bound), while MemAgent incurs up to 97% latency in Prepare Memory (compute-bound).

### 2.3 GPU-FPGA Heterogeneous Architecture

The authors propose offloading sparse, irregular, and memory-bounded operations to FPGAs while retaining compute-intensive operations on GPUs:

**FPGA Advantages**:
- Larger SRAM capacity with higher bandwidth
- Flexible data control with minimized scheduling overhead
- Low static power consumption
- Custom microarchitecture for irregular data accesses

**System Design**:
- AMD MI210 GPU + Alveo U55C FPGA connected via PCIe
- Memory processing pipeline mapped to heterogeneous system
- Consideration of computational heterogeneity and data locality

## 3. 实验结果

### 3.1 Performance Speedup

| Optimization | Memory Processing Speedup | End-to-End Speedup |
|--------------|--------------------------|-------------------|
| Sparse Attention (SeerAttention-R, DeepSeek) | 1.5-5.7× | Up to 1.49× |
| RAG (DRAGIN) | 5.16-7.65× | Up to 2.2× |
| Memory as Context (HMT, Titans) | 1.3-1.6× | 1.8× (MemAgent) |
| **Geometric Mean** | **3.2×** | **1.04-2.2×** |

### 3.2 Energy Efficiency

| Metric | Improvement |
|--------|-------------|
| Energy per request | 1.11-4.66× reduction |
| Geometric mean energy cost | 1.11-4.7× lower |

### 3.3 Memory Processing Overhead

| Method | Memory Processing % (4K tokens) | Memory Processing % (1M tokens) |
|--------|--------------------------------|---------------------------------|
| Sparse Attention | 1-11% | 22-81% |
| RAG (20M documents) | - | 40-61% |
| Parameterized Memory (Titans/HMT) | High | High |
| MemAgent | - | Up to 97% |

## 4. 优点与局限

### 优点
- **Unified framework**: First systematic understanding of memory processing across diverse LLM optimizations
- **Heterogeneous acceleration**: Demonstrates practical GPU-FPGA system for memory-bounded workloads
- **Significant speedup**: 1.04-2.2× end-to-end improvement across multiple optimizations
- **Energy efficiency**: 1.11-4.7× lower energy cost per request
- **General applicability**: Same paradigm can accelerate existing and future LLM inference methods

### 局限
- Requires FPGA hardware (not universally available)
- PCIe bandwidth may limit data transfer between GPU and FPGA
- Implementation complexity for custom FPGA microarchitecture
- Results may vary across different GPU/FPGA combinations

## 5. 为什么对AI硬件重要

This paper has significant implications for next-generation AI chip design:

1. **Memory Processing as First-Class Citizen**: The paper establishes that memory processing accounts for 22%-97% of LLM inference latency, making it a critical optimization target. Future AI accelerators should include dedicated hardware for:
   - Top-k selection and filtering
   - BM25 scoring and relevance computation
   - Sparse matrix-vector multiplication

2. **Heterogeneous Computing Paradigm**: The success of GPU-FPGA systems demonstrates that no single architecture can efficiently handle all LLM workloads. Future systems may integrate:
   - GPUs for dense compute (Prepare Memory, Apply to Inference)
   - FPGAs or specialized accelerators for irregular memory operations (Compute Relevancy, Retrieval)
   - High-bandwidth interconnects for efficient data movement

3. **Energy Efficiency Focus**: With 1.11-4.7× energy reduction, heterogeneous systems offer a path to sustainable LLM serving at scale. This is critical as "cumulative demand of millions of daily requests may scale to annual petawatt-hour levels by 2026."

4. **Design Guidelines for Future Hardware**: The computational heterogeneity analysis provides clear guidance:
   - Memory-bound operations need high-bandwidth, flexible memory access
   - Compute-bound operations benefit from dense matrix units
   - Irregular access patterns require custom dataflow architectures

5. **Implications for Edge AI**: The energy efficiency gains suggest heterogeneous systems could enable long-context LLM inference on edge devices with constrained power budgets.

## 参考文献

1. He, Z., Ma, R., Sun, Y., & Cong, J. (2026). Understand and Accelerate Memory Processing Pipeline for Disaggregated LLM Inference. arXiv:2603.29002.
2. Liu, A., et al. (2025). DeepSeek Attention: Efficient Long-Context LLM Inference. arXiv:2501.xxxxx.
3. Su, W., et al. (2024). DRAGIN: Dynamic Retrieval-Augmented Generation. arXiv:2401.xxxxx.
4. Behrouz, A., et al. (2025). Titans: Memory as Context for Long-Sequence Modeling. arXiv:2501.xxxxx.
5. Song, Y., et al. (2022). FPGA Acceleration of Sparse Neural Networks. FPGA.
