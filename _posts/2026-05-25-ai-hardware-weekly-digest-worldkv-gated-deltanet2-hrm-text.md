---
layout: post
title: "AI Hardware Weekly Digest: WorldKV for Video World Models, Gated DeltaNet-2 Linear Attention, and HRM-Text Efficient Pretraining"
categories: ["research", "ai", "ml", "hardware"]
author: ["Apo"]
publish date: ["2026-05-25"]
original_paper: "https://arxiv.org/abs/2605.22718, https://arxiv.org/abs/2605.22791, https://arxiv.org/abs/2605.20613"
tags: ["kv-cache", "transformer", "ai-accelerator", "world-model", "low-power"]
---

# AI Hardware Weekly Digest: WorldKV for Video World Models, Gated DeltaNet-2 Linear Attention, and HRM-Text Efficient Pretraining

> **Weekly Digest — May 25, 2026** | [rom4ai.github.io](https://rom4ai.github.io/)

This week's digest covers three significant papers with direct hardware implications: WorldKV's KV cache optimization for video world models, NVIDIA's Gated DeltaNet-2 for linear attention, and HRM-Text's hierarchical recurrent model for compute-efficient pretraining.

---

## 1. WorldKV: Efficient World Memory with World Retrieval and Compression

**arXiv:** [2605.22718](https://arxiv.org/abs/2605.22718) | **Authors:** Jung Yi, Minjae Kim, Paul Hyunbin Cho, Wooseok Jang, Sangdoo Yun, Seungryong Kim | **Published:** May 21, 2026

### Abstract

Autoregressive video diffusion models have enabled real-time, action-conditioned world generation. However, sustaining a persistent world where revisiting a previously seen viewpoint yields consistent content remains an open problem. Full KV-cache attention preserves consistency but breaks real-time constraints: memory footprint and attention cost grow linearly with rollout length. Sliding window inference restores throughput but discards long-term consistency. **WorldKV** is a training-free framework with two components: **World Retrieval** and **World Compression**. World Retrieval stores evicted KV-cache chunks in GPU/CPU memory and selectively retrieves scene-relevant chunks via camera/action correspondence, inserting them back into the native attention window without re-encoding. World Compression prunes redundant tokens within each chunk via key-key similarity to an anchor frame, halving per-chunk storage to fit 2× more history under a fixed budget. On Matrix-Game-2.0 and LingBot-World-Fast, WorldKV matches or exceeds full-KV memory fidelity at roughly 2× the throughput, competitive with memory-trained baselines without any fine-tuning.

### Key Innovations

- **World Retrieval**: Stores evicted KV-cache chunks in GPU/CPU memory, selectively retrieves scene-relevant chunks via camera/action correspondence.
- **World Compression**: Prunes redundant tokens within each chunk via key-key similarity to an anchor frame, halving per-chunk storage.
- **Training-free**: No fine-tuning required — works with existing autoregressive video world models.
- **2× throughput**: Matches or exceeds full-KV memory fidelity at roughly 2× the throughput of full KV-cache attention.
- **Persistent world memory**: Enables consistent revisits to previously seen viewpoints without architectural changes.

### Hardware Relevance

> "Pre-trained autoregressive world models, even when trained on short sequences, possess emergent long-term visual memory within their KV caches, which can be efficiently accessed."

| Metric | Full KV-Cache | Sliding Window | WorldKV |
|--------|--------------|----------------|---------|
| Throughput | 2.36 FPS | High | 4.78 FPS (2× full KV) |
| Memory fidelity | Baseline | Low | Matches/exceeds full KV |
| Long-term consistency | Yes | No | Yes |
| Training required | No | No | No |
| Storage efficiency | 1× | N/A | 2× (via compression) |

**Why it matters for AI chips:**

1. **World model KV cache optimization**: WorldKV demonstrates that KV cache for world models has different access patterns than LLM KV cache — retrieval is highly localized to viewpoint-relevant past chunks. AI accelerators for world models should include hardware support for sparse, content-addressable KV cache retrieval.
2. **GPU/CPU tiered memory**: World Retrieval stores evicted KV-cache chunks in GPU/CPU memory, similar to the multi-tier KV cache approach in KVDrive. AI chip designers should include hardware support for tiered KV cache with content-addressable retrieval.
3. **Key-key similarity pruning**: World Compression prunes redundant tokens via key-key similarity — this is a compute pattern that could be accelerated in hardware. AI accelerators for world models should include dedicated similarity computation units.
4. **Real-time world generation**: 4.78 FPS on H200 for LingBot-World-Fast demonstrates that real-time world generation is achievable with KV cache optimization. AI chips for embodied AI should prioritize real-time world model inference capabilities.
5. **Training-free deployment**: WorldKV works without fine-tuning — this is critical for rapid deployment of new world models. AI chip runtime systems should support training-free KV cache optimization.

---

## 2. Gated DeltaNet-2: Decoupling Erase and Write in Linear Attention

**arXiv:** [2605.22791](https://arxiv.org/abs/2605.22791) | **Authors:** Ali Hatamizadeh, Yejin Choi, Jan Kautz (NVIDIA) | **Published:** May 21, 2026

### Abstract

Linear attention replaces the unbounded cache of softmax attention with a fixed-size recurrent state, reducing sequence mixing to linear time and decoding to constant memory. The hard part is not just what to forget, but how to edit this compressed memory without scrambling existing associations. Delta-rule models subtract the current read before writing a new value, and Kimi Delta Attention (KDA) sharpens forgetting with channel-wise decay. But the active edit still uses a single scalar gate to control two different things: how much old content to erase on the key side and how much new content to commit on the value side. **Gated DeltaNet-2** generalizes both Gated DeltaNet and KDA by inheriting adaptive forgetting and channel-wise decay while addressing their shared limitation — the scalar tie between erasing and writing. It separates these roles with a channel-wise erase gate and a channel-wise write gate, reducing to KDA when both gates collapse to the same scalar and to Gated DeltaNet when the decay also collapses. The authors derive a fast-weight update view, a chunkwise WY algorithm with channel-wise decay absorbed into asymmetric erase factors, and a gate-aware backward pass that preserves efficient parallel training. At 1.3B parameters trained on 100B FineWeb-Edu tokens, Gated DeltaNet-2 achieves the strongest overall results among Mamba-2, Gated DeltaNet, KDA, and Mamba-3 variants across language modeling, commonsense reasoning, and retrieval. Its advantage is most pronounced on long-context RULER needle-in-a-haystack benchmarks.

### Key Innovations

- **Decoupled erase/write gates**: Channel-wise erase gate and channel-wise write gate replace the single scalar gate, enabling fine-grained memory editing.
- **Generalization of prior models**: Reduces to KDA or Gated DeltaNet as special cases.
- **Chunkwise parallel training**: WY algorithm with channel-wise decay absorbed into asymmetric erase factors.
- **Gate-aware backward pass**: Preserves efficient parallel training.
- **SOTA performance**: Strongest overall results across language modeling, commonsense reasoning, and retrieval among linear attention variants.
- **Near-flat scaling**: 38.0 Kt/s at 2K to 36.1 Kt/s at 16K sequence length on H100 GPU.

### Hardware Relevance

> "Gated DeltaNet-2 achieved the strongest overall average performance across language modeling perplexity, zero-shot common-sense reasoning, and retrieval tasks compared to other recurrent and Transformer models."

| Metric | Mamba-2 | Gated DeltaNet | KDA | Mamba-3 | **Gated DeltaNet-2** |
|--------|---------|----------------|-----|---------|---------------------|
| Language modeling | Strong | Strong | Strong | Strong | **Strongest** |
| Commonsense reasoning | Good | Good | Good | Good | **Best** |
| Retrieval (RULER) | Good | Good | Good | Good | **Best** |
| Throughput scaling | Flat | Flat | Flat | Flat | **Near-flat (38→36.1 Kt/s)** |

**Why it matters for AI chips:**

1. **Linear attention hardware**: Gated DeltaNet-2 demonstrates that linear attention models can achieve SOTA performance with near-flat throughput scaling. AI chip designers should include native support for linear attention (delta-rule updates) in hardware — this could dramatically reduce memory bandwidth requirements for long-context inference.
2. **Decoupled erase/write operations**: The separation of erase and write gates suggests that hardware for recurrent attention should include separate erase and write pathways — similar to how SRAM includes separate read and write ports. This could improve memory editing efficiency.
3. **Chunkwise parallel training**: The chunkwise WY algorithm enables efficient parallel training. AI accelerator training systems should include hardware support for chunkwise parallel computation of linear attention.
4. **Long-context efficiency**: Near-flat throughput scaling (38.0→36.1 Kt/s from 2K to 16K sequence length) demonstrates that linear attention can handle long contexts without throughput degradation. AI chips for long-context inference should prioritize linear attention support.
5. **NVIDIA's linear attention investment**: NVIDIA researchers publishing on linear attention signals that NVIDIA is investing in this architecture. AI chip designers should monitor NVIDIA's linear attention hardware roadmap.

---

## 3. HRM-Text: Efficient Pretraining Beyond Scaling

**arXiv:** [2605.20613](https://arxiv.org/abs/2605.20613) | **Authors:** Guan Wang, Changling Liu, Chenyu Wang, Cai Zhou, Yuhao Sun, Yifei Wu, Shuai Zhen, Luca Scimeca, Yasin Abbasi Yadkori | **Published:** May 20, 2026

### Abstract

The current pretraining paradigm for large language models relies on massive compute and internet-scale raw text, creating a significant barrier to foundational research. In contrast, biological systems demonstrate highly sample-efficient learning through multi-timescale processing, such as the functional organization of the frontoparietal loop. **HRM-Text** replaces standard Transformers with a **Hierarchical Recurrent Model (HRM)** that decouples computation into slow-evolving strategic and fast-evolving execution layers. To stabilize this deep recurrence for language modeling, the authors introduce MagicNorm and warmup deep credit assignment. Instead of standard raw-text pretraining, they train exclusively on instruction-response pairs using a task-completion objective and PrefixLM masking. A 1B-parameter HRM-Text model trained from scratch on only **40 billion unique tokens and $1,500 budget** achieves 60.7% on MMLU, 81.9% on ARC-C, 82.2% on DROP, 84.5% on GSM8K, and 56.2% on MATH. Despite utilizing roughly **100-900× fewer training tokens and 96-432× less estimated compute** than standard baselines, HRM-Text performs competitively with 2-7B parameter open models.

### Key Innovations

- **Hierarchical Recurrent Model**: Decouples computation into slow-evolving strategic and fast-evolving execution layers, inspired by biological frontoparietal loop.
- **MagicNorm**: Stabilizes deep recurrence for language modeling.
- **Warmup deep credit assignment**: Enables stable training of deep recurrent architectures.
- **Instruction-response pretraining**: Trains exclusively on instruction-response pairs instead of raw text.
- **Extreme compute efficiency**: 100-900× fewer training tokens, 96-432× less estimated compute than standard baselines.
- **$1,500 budget**: 1B-parameter model trained from scratch for $1,500 — dramatically lower than standard pretraining costs.

### Hardware Relevance

> "These results demonstrate that co-designing architectures and objectives can radically reduce the compute-to-performance ratio, making pretraining from scratch accessible to the broader research community."

| Metric | Standard Transformer (2-7B) | HRM-Text (1B) | Improvement |
|--------|---------------------------|---------------|-------------|
| MMLU | ~55-60% | **60.7%** | Competitive |
| Training tokens | 4-36 trillion | **40 billion** | 100-900× fewer |
| Compute cost | $150K-$650K | **$1,500** | 96-432× less |
| Architecture | Transformer | Hierarchical Recurrent | Biological inspiration |

**Why it matters for AI chips:**

1. **Biological inspiration for AI hardware**: HRM-Text's hierarchical recurrent model is inspired by the biological frontoparietal loop — slow-evolving strategic layers and fast-evolving execution layers. AI chip designers should consider biological inspiration for hardware architecture, including separate strategic and execution compute units.
2. **Compute-efficient pretraining**: 96-432× less compute than standard baselines demonstrates that architectural co-design can dramatically reduce pretraining costs. AI chip designers should prioritize architectures that enable compute-efficient pretraining, not just inference efficiency.
3. **Recurrent hardware support**: HRM-Text's hierarchical recurrent model requires hardware support for deep recurrence with stable gradient flow. AI accelerators should include hardware support for recurrent computation with stable gradient propagation.
4. **Edge AI pretraining**: $1,500 budget for 1B-parameter pretraining makes pretraining accessible to smaller organizations. AI chips for edge AI should include hardware support for on-device pretraining/fine-tuning.
5. **Instruction-response training**: Training exclusively on instruction-response pairs instead of raw text suggests that AI hardware should optimize for instruction-tuning workloads, not just pretraining workloads.

---

## 4. Week in Review: Key Themes

### Theme 1: KV Cache Optimization Extends to World Models

WorldKV demonstrates that KV cache optimization is not just for LLMs — video world models also benefit from tiered KV cache management, content-addressable retrieval, and key-key similarity pruning. AI accelerators for world models should include specialized KV cache hardware.

### Theme 2: Linear Attention Reaches SOTA Performance

Gated DeltaNet-2 from NVIDIA demonstrates that linear attention models can achieve SOTA performance with near-flat throughput scaling. This signals a potential shift from Transformer to linear attention architectures for long-context inference — AI chip designers should prepare for this transition.

### Theme 3: Biological Inspiration for Compute-Efficient AI

HRM-Text's hierarchical recurrent model, inspired by the biological frontoparietal loop, achieves competitive performance with 96-432× less compute. This demonstrates that biological inspiration can lead to dramatically more compute-efficient AI architectures — AI chip designers should explore biological inspiration for hardware architecture.

### Theme 4: Training Efficiency Matters as Much as Inference Efficiency

HRM-Text's $1,500 pretraining budget demonstrates that architectural co-design can dramatically reduce pretraining costs. AI chip designers should prioritize architectures that enable compute-efficient pretraining, not just inference efficiency.

---

## References

1. Yi, J., Kim, M., Cho, P.H., Jang, W., Yun, S., Kim, S. "WorldKV: Efficient World Memory with World Retrieval and Compression." arXiv:2605.22718, May 2026.
2. Hatamizadeh, A., Choi, Y., Kautz, J. "Gated DeltaNet-2: Decoupling Erase and Write in Linear Attention." arXiv:2605.22791, May 2026.
3. Wang, G., Liu, C., Wang, C., et al. "HRM-Text: Efficient Pretraining Beyond Scaling." arXiv:2605.20613, May 2026.

---

*Tags: kv-cache, transformer, ai-accelerator, world-model, low-power*
