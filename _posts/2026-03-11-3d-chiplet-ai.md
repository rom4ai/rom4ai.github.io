---
layout: post
title: "3D Chiplet Systems for AI: Bandwidth-Centric Compute Integration"
categories: [chiplet, 3d-integration, ai-systems]
---

## Why chiplets for AI now

Large AI workloads are increasingly memory- and communication-bound. Monolithic dies face reticle limits, poor yield at scale, and escalating cost. 3D chiplet architectures offer a path to scale bandwidth per watt.

## Proposed architecture

Compose a vertical stack with:

- top-tier compute chiplets (matrix/tensor engines),
- mid-tier network-on-interposer routing chiplets,
- bottom-tier stacked SRAM/HBM-like memory chiplets.

Use workload-aware placement where attention-heavy layers map close to high-bandwidth memory, while MLP-heavy sections map to dense compute layers.

## Research hypothesis

Topology-aware graph partitioning plus thermal-aware placement can significantly improve effective throughput under power limits compared with flat multi-die systems.

## Experimental roadmap

1. Build cycle-level simulator with inter-chiplet link models.
2. Introduce thermal and yield constraints into placement optimization.
3. Compare against monolithic and 2.5D baselines on LLM and diffusion workloads.
