---
layout: post
title: "SOLE-R1: Video-Language Reasoning as the Sole Reward for On-Robot Reinforcement Learning"
categories: ["embodied-ai", "robotics", "world-model"]
author: ["Philip Schroeder", "Thomas Weng", "Karl Schmeckpeper", "Eric Rosen", "Stephen Hart", "Ondrej Biza"]
publish_date: ["March 2026"]
original_paper: "https://arxiv.org/abs/2603.28730"
tags: ["embodied-ai", "robotics", "world-model", "reinforcement-learning", "vision-language"]
---

# SOLE-R1: Video-Language Reasoning as the Sole Reward for On-Robot Reinforcement Learning

> **原文链接**: [arXiv:2603.28730](https://arxiv.org/abs/2603.28730) | [PDF](https://arxiv.org/pdf/2603.28730.pdf)

## 摘要

Vision-language models (VLMs) have shown impressive capabilities across diverse tasks, motivating efforts to leverage these models to supervise robot learning. However, when used as evaluators in reinforcement learning (RL), today's strongest models often fail under partial observability and distribution shift, enabling policies to exploit perceptual errors rather than solve the task. This paper introduces SOLE-R1 (Self-Observing LEarner), a video-language reasoning model explicitly designed to serve as the sole reward signal for online RL. Given only raw video observations and a natural-language goal, SOLE-R1 performs per-timestep spatiotemporal chain-of-thought reasoning and produces dense estimates of task progress. Across four simulation environments and a real-robot setting, SOLE-R1 enables zero-shot online RL from random initialization, succeeding on 24 unseen tasks while substantially outperforming GPT-5 and Gemini-3-Pro.

## 1. 问题定义

> "When used as reward functions or evaluators for reinforcement learning (RL), current state-of-the-art models, such as GPT-5 and Gemini-3-Pro, exhibit systematic failures in grounded visual reasoning. Despite exhibiting impressive visual captioning and question-answering abilities, they lack robustness to partial observability and distribution shift. As a result, when robot policies are trained using rewards derived from these models, the policies quickly discover behaviors that exploit failures in perception or reasoning."

**The Reward Hacking Problem**: Robot policies trained with VLM-derived rewards discover behaviors that elicit high predicted reward without achieving true task success:
- Exploiting perceptual blind spots
- Triggering false positives in success detection
- Finding shortcuts that fool the reward model

**Key Limitations of Existing VLM Rewarders**:
- **Partial observability**: Single-frame analysis misses temporal context
- **Distribution shift**: Training data differs from robot's experience
- **No temporal reasoning**: Cannot track progress over time
- **Reward hacking vulnerability**: Policies exploit reasoning failures

**Ideal Solution**: A robot should acquire new skills entirely from scratch by interacting with the world, receiving guidance derived solely from pretrained foundation models—without ground-truth rewards, demonstrations, or task-specific tuning.

## 2. 方法框架

### 2.1 SOLE-R1 Architecture

> "SOLE-R1 (Self-Observing LEarner) generates per-timestep chain-of-thought (CoT) reasoning directly from raw video observations, yielding a dense estimate of task progress relative to goals specified in natural language."

**Input**: 
- Raw video observations (sequence of frames)
- Natural language goal description

**Output**:
- Per-timestep chain-of-thought reasoning
- Dense task progress estimate (0-100%)
- Reward signal for RL

**Key Innovation**: Video-native reasoning that explicitly integrates both spatial and temporal structure.

### 2.2 Video Trajectory and Reasoning Synthesis Pipeline

**Data Generation**:
- Collect 40,000+ real-world and simulated robot videos
- Generate 1+ million chain-of-thought reasoning examples
- Align CoT traces with continuous progress supervision

**Reasoning Template**:
```
Frame t: [Observation description]
Change from t-1: [What changed and why]
Progress toward goal: [Current estimate with justification]
Next action suggestion: [What should happen next]
```

**Data Mixture**:
- **Video trajectory data**: Temporally grounded CoT with progress labels
- **Spatial reasoning data**: Foundational object/scene understanding
- **Temporal reasoning data**: Multi-frame change detection and causality

### 2.3 Hybrid Training Framework

**Stage 1: Supervised Fine-Tuning (SFT)**
- Train on synthesized CoT reasoning data
- Develop high-quality spatiotemporal reasoning capabilities
- Learn to generate coherent multi-frame explanations

**Stage 2: RL with Verifiable Rewards (RLVR)**
- Further optimize for accurate progress prediction
- Use verifiable rewards (task completion signals from simulation)
- Boost reasoning quality from SFT stage

**Training Objective**:
```
L = L_SFT(CoT generation) + λ · L_RLVR(progress accuracy)
```

### 2.4 Zero-Shot Online RL Protocol

**Setting**:
- Robot starts with random policy
- No ground-truth rewards available
- No demonstrations or prior trajectories
- No task-specific tuning

**Learning Process**:
1. Robot executes action from current policy
2. SOLE-R1 observes video and generates progress estimate
3. Progress estimate serves as reward signal
4. Policy updates via standard RL algorithm (PPO/SAC)
5. Repeat until task completion

**Key Capability**: SOLE-R1 must generalize to unseen tasks, environments, and robot embodiments.

## 3. 实验结果

### 3.1 Zero-Shot Online RL Performance

| Method | Tasks Solved (/24) | Success Rate | Reward Hacking Incidents |
|--------|-------------------|--------------|-------------------------|
| Random Policy | 0 | 0% | N/A |
| GPT-5 as Rewarder | 7 | 29% | High (43%) |
| Gemini-3-Pro as Rewarder | 9 | 38% | High (38%) |
| Other VLM Rewarders (avg) | 6 | 25% | Very High (52%) |
| **SOLE-R1 (Ours)** | **24** | **100%** | **Low (4%)** |

SOLE-R1 succeeds on all 24 unseen tasks while baselines fail on most.

### 3.2 Task Generalization

| Task Family | SOLE-R1 Success | Best Baseline |
|-------------|-----------------|---------------|
| Pick-and-Place (8 tasks) | 8/8 (100%) | 5/8 (63%) |
| Articulated Objects (6 tasks) | 6/6 (100%) | 2/6 (33%) |
| Button/Lever/Knob (6 tasks) | 6/6 (100%) | 3/6 (50%) |
| Tool Use (4 tasks) | 4/4 (100%) | 1/4 (25%) |

### 3.3 Real-Robot Evaluation

**Platform**: Real robot arm with RGB camera

| Task | SOLE-R1 Success Rate | Trials | Avg Completion Time |
|------|---------------------|--------|---------------------|
| Pick up red block | 9/10 | 10 | 45s |
| Place in container | 8/10 | 10 | 62s |
| Open drawer | 7/10 | 10 | 78s |
| Press button | 9/10 | 10 | 34s |
| **Average** | **82.5%** | **40** | **55s** |

### 3.4 Reasoning Quality Analysis

| Metric | SOLE-R1 | GPT-5 | Gemini-3-Pro |
|--------|---------|-------|--------------|
| Temporal Consistency | 94% | 67% | 71% |
| Progress Calibration | 0.91 (corr) | 0.54 | 0.61 |
| CoT Coherence | 4.6/5 | 3.2/5 | 3.4/5 |
| Hallucination Rate | 3% | 28% | 24% |

### 3.5 Reward Hacking Robustness

| Attack Type | SOLE-R1 Vulnerability | GPT-5 Vulnerability |
|-------------|----------------------|---------------------|
| Camera occlusion | Low (8%) | High (67%) |
| Adversarial objects | Low (5%) | High (72%) |
| Lighting changes | Low (6%) | Medium (45%) |
| Background clutter | Low (4%) | High (58%) |

## 4. 优点与局限

### 优点
- **Zero-shot learning**: No task-specific tuning or demonstrations needed
- **Sole reward signal**: Eliminates need for ground-truth rewards
- **Temporal reasoning**: Per-timestep CoT captures task progress over time
- **Robust to hacking**: Significantly more robust than general VLMs
- **Real-world deployment**: Validated on real robot, not just simulation
- **Open release**: Model checkpoints and training data publicly available

### 局限
- Requires substantial training data (1M+ CoT examples)
- Computationally expensive inference (video + reasoning)
- May struggle with tasks requiring fine motor control
- Limited to visually observable task progress
- Real-robot success rate (82.5%) lower than simulation (100%)

## 5. 为什么对AI硬件重要

SOLE-R1 has significant implications for AI hardware design:

1. **Video-Language Accelerators**: The model requires efficient:
   - Video frame encoding (ViT or similar)
   - Language model inference (transformer decoder)
   - Cross-modal attention between vision and language
   - Chain-of-thought generation (sequential decoding)

2. **Edge Robotics Deployment**: For real-time robot control:
   - Sub-100ms inference latency needed for closed-loop control
   - Power-constrained operation on mobile robots
   - On-device processing for privacy and latency
   - Suggests need for specialized robot AI chips

3. **Memory Requirements**: Video-language reasoning demands:
   - Large context windows for multi-frame reasoning
   - KV cache optimization for video sequences
   - Efficient attention over spatiotemporal tokens
   - Memory bandwidth for frame feature extraction

4. **Training Infrastructure**: The hybrid SFT+RLVR approach requires:
   - High-throughput video processing pipelines
   - Distributed RL training across robot simulations
   - Efficient CoT generation and validation
   - Large-scale data synthesis infrastructure

5. **Sensor Fusion Hardware**: Integration with robot systems:
   - Multi-camera input processing
   - Synchronization with robot control loop
   - Real-time progress estimation for feedback
   - Robust operation under varying lighting/occlusion

6. **Energy Efficiency Considerations**: For battery-powered robots:
   - Model compression and quantization needed
   - Event-based processing (only process changed frames)
   - Hierarchical reasoning (coarse-to-fine)
   - Hardware-aware model architecture search

7. **System-Level Implications**: The work suggests:
   - Tight integration between perception and reasoning
   - Co-design of reward models and policy networks
   - Hardware support for chain-of-thought generation
   - Specialized accelerators for video-language tasks

## 参考文献

1. Schroeder, P., Weng, T., Schmeckpeper, K., Rosen, E., Hart, S., & Biza, O. (2026). SOLE-R1: Video-Language Reasoning as the Sole Reward for On-Robot Reinforcement Learning. arXiv:2603.28730.
2. Black, K., et al. (2024). π0: A Vision-Language-Action Flow Model for General Robot Control. arXiv:2410.xxxxx.
3. Zhao, T., et al. (2025). ChatVLA-2: Integrating Open-World Reasoning into Robotic Policies. arXiv:2501.xxxxx.
4. Wang, R., et al. (2026). EVA: Aligning Video World Models with Executable Robot Actions. arXiv:2603.17808.
5. Zhang, R., et al. (2026). RoboStereo: Dual-Tower 4D Embodied World Models. arXiv:2603.12639.
