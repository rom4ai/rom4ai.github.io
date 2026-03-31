---
layout: post
title: 'Hardwired LLM Accelerators: From Programmable Kernels to Fixed-Flow Inference'
categories:
- llm
- accelerator
- inference
tags:
- edge-ai
- transformer
- quantization
- low-power
- llm-inference
---
## Motivation

Current LLM inference stacks rely on general-purpose GPU kernels and runtime orchestration, causing excess overhead for token-by-token decoding. For edge and low-latency deployment, a hardwired path for dominant compute patterns could be far more efficient.

## Research concept

Build a **fixed-flow decoder accelerator** that hardwires:

- attention score computation and normalization,
- KV-cache fetch/update,
- MLP expansion/projection,
- quantized activation pipelines.

Rather than supporting all model variants, target a constrained family of decoder architectures and co-design models to match hardware templates.

## Key opportunities

1. **Control-plane minimization**: replace software launch overhead with finite-state scheduling.
2. **Memory determinism**: static KV-cache tiling to reduce random access penalties.
3. **Aggressive quantization**: native support for mixed precision (e.g., W4A8/W8A8).

## Open questions

- How much flexibility can be preserved while keeping the datapath mostly fixed?
- What is the best compile-time mapping from transformer graphs to hardwired blocks?
- How should speculative decoding be integrated in a fixed-flow pipeline?
