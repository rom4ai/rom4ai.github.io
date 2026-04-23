---
layout: post
title: "A Scalable Approach to Probabilistic Neuro-Symbolic Robustness Verification"
categories: ["research", "neural-symbolic", "verification", "autonomous-driving"]
author: ["Vasileios Manginas", "Nikolaos Manginas", "Sherwin Varghese", "Edward Stevinson", "Georgios Paliouras", "Nikos Katzouris", "Alessio Lomuscio"]
publish_date: 2025-02-05
original_paper: https://arxiv.org/abs/2502.03274
tags: ["neural-symbolic", "autonomous-driving", "robotics", "benchmark", "llm-inference"]
---

# A Scalable Approach to Probabilistic Neuro-Symbolic Robustness Verification

> **原文链接**: [arXiv:2502.03274](https://arxiv.org/abs/2502.03274) | [PDF](https://arxiv.org/pdf/2502.03274.pdf)

## 摘要

Neuro-Symbolic Artificial Intelligence (NeSy AI) has emerged as a promising direction for integrating neural learning with symbolic reasoning. This work addresses the challenge of formally verifying the robustness of probabilistic NeSy reasoning systems, paving the way for their safe deployment in critical domains. The authors analyze the complexity of exact verification and prove that the decision version of the core computation is **NP^PP-complete**. In response to this hardness result, they propose the first approach for approximate, relaxation-based verification of probabilistic NeSy systems. Experimental validation on standard NeSy benchmarks demonstrates that the proposed method scales exponentially better than solver-based solutions, with successful application to real-world autonomous driving scenarios involving high-dimensional input.

## 1. 问题定义

Neuro-Symbolic AI aims to combine the strengths of neural-based learning with symbolic reasoning. In probabilistic NeSy systems, the architecture follows a two-step process:

1. **Neural Perception**: A neural network extracts latent concepts (symbols) from sub-symbolic input data
2. **Symbolic Reasoning**: These concepts are processed by a symbolic component using domain knowledge to perform probabilistic inference

> "Given input x ∈ ℝⁿ, the system utilizes a NN, as well as symbolic knowledge K, to infer an output y ∈ {0,1}ᵐ. The system computes p_θ(y | x; K), where θ refers to the trainable parameters of the NN."

The core verification challenge is to ensure that input perturbations do not affect the reasoning output. Formally, the goal is to compute:

> "[min_x' p(y_i|x'), max_x' p(y_i|x')] ∀ x' s.t. ||x' - x|| ≤ ε"

This requires finding the minimum and maximum value of each probabilistic output under bounded input perturbations of size ε.

![Motivating Example](/assets/nesy-robustness-verification/_page_2_Figure_1.jpeg)
*图1: 自动驾驶场景中的NeSy验证示例。系统包含目标检测网络（识别红灯/前车）和动作选择网络（加速/刹车），通过符号约束验证安全性（来源：原文 Figure 1）*

## 2. 方法框架

### 2.1 复杂度分析

The authors establish a fundamental complexity result for exact verification:

**Proposition (E-WMC Complexity)**: E-WMC is **NP^PP-complete**.

> "The circuits comprising the symbolic component represent multi-linear polynomials of the input variables. As all input variables are defined in a closed interval, the extrema lie on the vertices of the domain, yielding a combinatorial search space of 2ⁿ possible assignments."

This hardness result motivates the need for approximate, relaxation-based approaches that can scale to practical problem sizes.

### 2.2 Relaxation-Based Verification Approach

The proposed solution extends neural network verification techniques to the NeSy setting through three key innovations:

1. **End-to-End Compilation**: The entire NeSy system (neural + symbolic components) is compiled into a single computational graph
2. **Knowledge Compilation**: Symbolic constraints are compiled into tractable arithmetic circuits using Sentential Decision Diagrams (SDD)
3. **Interval Bound Propagation (IBP)**: Bounds are propagated through the unified graph using off-the-shelf NN verifiers

![SDD and Arithmetic Circuit](/assets/nesy-robustness-verification/_page_14_Figure_5.jpeg)
*图2: (a) Sentential Decision Diagram (SDD) 作为知识编译得到的计算图示例；(b) 对应的算术电路，通过将AND/OR节点替换为乘法/加法运算得到（来源：原文 Figure 3）*

### 2.3 Core Modules

**Knowledge Compilation Module**: The symbolic component uses Weighted Model Counting (WMC) for probabilistic reasoning:

> "WMC(ϕ, p) = Σ_{ω ⊨ ϕ} Π_{i∈ω} p_i Π_{i∉ω} (1-p_i)"

The formula ϕ is compiled into a tractable representation where literals are at the leaves, and internal nodes are AND/OR operations. During inference, this becomes an arithmetic circuit with multiplication (AND), addition (OR), and subtraction (negation).

**ONNX Export Module**: The unified NeSy system is exported as an ONNX graph:

![ONNX Representation](/assets/nesy-robustness-verification/_page_17_Figure_2.jpeg)
*图3: 运行示例中NeSy系统的统一ONNX表示。输入图像经过两个神经网络（左分支为动作选择，右分支为目标检测）处理后进入算术电路（来源：原文 Figure 4）*

This enables direct use of state-of-the-art NN verifiers including auto LiRPA, VeriNet, and Marabou.

## 3. 实验结果

### 3.1 Multi-Digit MNIST Addition Benchmark

The authors evaluate scalability using a controllable synthetic task where the complexity of the symbolic component can be varied while keeping the neural part constant.

**Experimental Setup**:
- CNN: 2 convolutional layers + 2 linear layers + softmax (98% test accuracy on MNIST)
- Symbolic component: Multi-digit addition rules
- Variables: Number of digits {2, 3, 4, 5, 6}, perturbation size ε {10⁻², 10⁻³, 10⁻⁴}

**Scalability Comparison**:

![Scalability Results](/assets/nesy-robustness-verification/_page_7_Figure_5.jpeg)
*图4: 验证运行时间随求和数字数量增加的对比。报告在MNIST测试数据集上验证单个样本所需的平均时间（来源：原文 Figure 2）*

| Method | Type | Scalability |
|--------|------|-------------|
| **E2E-R** (Ours) | Relaxation-based | Exponential improvement |
| R+SLV | Hybrid (Relaxation + Solver) | Timeout at 5-6 digits |
| Marabou | SMT-based | 314s per sample (CNN only) |

**Bound Quality and Robustness** (ε = 0.001):

| Method | Metric | 2 digits | 3 digits | 4 digits | 5 digits |
|--------|--------|----------|----------|----------|----------|
| R+SLV | Lower/Upper Bound | 0.871-0.981 | 0.815-0.972 | 0.764-0.962 | 0.731-0.928 |
| R+SLV | Robustness (%) | 90.60 | 86.17 | 81.33 | 78.31 |
| **E2E-R** | Lower/Upper Bound | 0.871-0.982 | 0.815-0.974 | 0.763-0.965 | 0.716-0.958 |
| **E2E-R** | Robustness (%) | 90.60 | 86.11 | 81.21 | 76.67 |

The results show that E2E-R achieves nearly identical robustness scores to the hybrid approach while scaling exponentially better.

### 3.2 Autonomous Driving (ROAD-R Dataset)

The method is applied to a real-world autonomous driving dataset with high-dimensional input:

**Dataset**: ROad event Awareness Dataset with logical Requirements (ROAD-R)
- 22 videos of dashcam footage
- 3,143 examples (3×240×320 images)
- Four binary labels: red light, car in front, stop, move forward

**Neural Architecture**: Two 6-layer CNNs
- Object detection network (sigmoid output): 97.2% accuracy
- Action selection network (softmax output): 96.3% accuracy

**Verification Results**:

| Metric | ε=1e-5 | ε=5e-5 | ε=1e-4 | ε=5e-4 | ε=1e-3 |
|--------|--------|--------|--------|--------|--------|
| **Robustness (%)** | 96.82% | 92.68% | 82.64% | 6.21% | 0.00% |
| Runtime per Sample (s) | 0.091 | 0.092 | 0.091 | 0.092 | 0.092 |

The runtime remains nearly constant (~0.09s) regardless of perturbation size, demonstrating the method's efficiency for real-world applications.

## 4. 优点与局限

### 优点

1. **Scalability**: Exponential improvement over solver-based methods, enabling verification of complex NeSy systems
2. **End-to-End Integration**: Unified treatment of neural and symbolic components through ONNX compilation
3. **Generality**: Compatible with any NeSy system representable as an algebraic computational graph
4. **Practical Applicability**: Successfully verified safety properties on real-world autonomous driving data with high-dimensional input

### 局限

1. **Approximation Trade-off**: As an incomplete verification method, E2E-R may fail to verify some robust instances that exact methods could prove safe
2. **Bound Quality Degradation**: Error accumulation over larger end-to-end graphs leads to looser bounds as reasoning circuit size increases
3. **Limited Symbolic Expressiveness**: Current implementation focuses on propositional logic; extension to more expressive logics remains future work
4. **No Certified Training**: The method provides verification but does not yet integrate with certified training techniques to improve robustness

## 5. 总结

This work presents the first scalable approach for verifying the robustness of probabilistic neuro-symbolic reasoning systems. Key contributions include:

1. **Complexity Analysis**: Proof that exact verification is NP^PP-complete, establishing fundamental limits
2. **Relaxation-Based Framework**: Novel end-to-end compilation approach combining knowledge compilation with interval bound propagation
3. **Experimental Validation**: Demonstration of exponential scalability improvement over solver-based methods on MNIST addition benchmark
4. **Real-World Application**: Successful verification of safety properties on autonomous driving data with high-dimensional input

The method opens the door for deploying NeSy AI systems in safety-critical applications where formal robustness guarantees are essential. Future directions include extending to more sophisticated verification techniques like Reverse Symbolic Interval Propagation and integration with certified training methods.

## 参考文献

1. Manginas, V., Manginas, N., Varghese, S., Stevinson, E., Paliouras, G., Katzouris, N., & Lomuscio, A. (2025). A Scalable Approach to Probabilistic Neuro-Symbolic Robustness Verification. *arXiv preprint arXiv:2502.03274*.

2. Manhaeve, R., Dumancic, S., Kimmig, A., Demeester, T., & De Raedt, L. (2018). DeepProbLog: Neural probabilistic logic programming. *Advances in Neural Information Processing Systems*, 31.

3. Giunchiglia, E., Stoian, M. C., Khan, S., Cuzzolin, F., & Lukasiewicz, T. (2023). ROAD-R: The autonomous driving dataset with logical requirements. *Machine Learning*, 112(9), 3261-3291.

4. Xu, K., Shi, Z., Zhang, H., Huang, M., Chang, K. W., Kailkhura, B., ... & Hsieh, C. J. (2020). Automatic perturbation analysis on general computational graphs. *arXiv preprint arXiv:2002.12920*.

5. Darwiche, A., & Marquis, P. (2002). A knowledge compilation map. *Journal of Artificial Intelligence Research*, 17, 229-264.