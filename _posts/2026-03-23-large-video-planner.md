---
layout: post
title: "Large Video Planner: 基于视频生成的通用机器人控制新范式"
categories: [research, ai, robotics, video]
author: ROM4AI
date: 2026-03-23
original_paper: "https://arxiv.org/abs/2512.15840"
tags: ["robotics", "video generation", "foundation model", "motion planning", "VLA"]
---

# Large Video Planner: 基于视频生成的通用机器人控制新范式

> **原文链接**: [arXiv:2512.15840](https://arxiv.org/abs/2512.15840) | [PDF](https://arxiv.org/pdf/2512.15840.pdf)

> **项目主页**: [https://www.boyuan.space/large-video-planner/](https://www.boyuan.space/large-video-planner/)

## 摘要

本文提出了一种新的机器人基础模型范式——使用大规模视频预训练作为主要模态，而非传统的视觉 - 语言 - 动作（VLA）方法。作者训练了一个互联网规模的视频生成模型，能够为零样本的新场景和任务生成视频规划，并通过后处理提取可执行的机器人动作。该方法在真实机器人实验中展示了强大的指令跟随能力、泛化能力和物理可行性。

## 1. 问题定义

通用机器人需要能够在多样化任务和环境中进行决策的规划算法。当前的机器人基础模型主要采用**视觉 - 语言 - 动作（VLA）**范式，即在多模态大语言模型（MLLM）基础上扩展动作输出。

> "然而，与支撑 MLLM 的 web 规模文本和图像数据相比，机器人动作数据要稀缺得多。"

这导致现有 VLA 模型存在以下问题：

- **数据稀缺**：机器人动作数据远少于文本和图像数据
- **泛化能力差**：在未见过的任务场景中表现不佳
- **不对称迁移**：依赖 MLLM 预训练知识，仅在少量机器人数据上微调

## 2. 方法框架

![方法框架图](/assets/large-video-planner/method-framework.png)
*图 1：Large Video Planner 的整体流程。从单张图像和任务指令出发，模型生成展示任务完成方式的视频，然后将预测的人体动作重定向到机器人手进行真实世界执行。*

本文提出**以视频为主要模态**的替代范式：

> "与静态图像 - 文本对不同，视频自然地编码了状态 - 动作规划，视觉化地展示了智能体与世界交互时的演变过程。"

### 2.1 核心思想

1. **视频即规划**：视频生成模型根据文本指令和初始观察帧，预测合理的未来帧， effectively 生成视觉动作规划
2. **时空连续性**：视频捕捉物理世界中状态和动作的时空序列，与机器人行为自然对齐
3. **数据丰富**：在线视频数据丰富，涵盖人类活动和任务演示

### 2.2 模型架构

- **基础模型**：基于 Wan I2V 14B 权重进行继续预训练
- **输入**：单张图像 + 文本指令
- **输出**：3 秒动作视频（16 FPS，共 48 帧）
- **历史条件**：支持最多 24 帧作为上下文，支持自回归多阶段规划

### 2.3 训练策略

模型采用两阶段训练：

| 阶段 | 数据 | 步数 | Batch Size | 总 Token 数 | 目的 |
|------|------|------|------------|-------------|------|
| 继续预训练 | 全量数据集 | 60k | 128 | 200B | 捕捉丰富动态和指令跟随行为 |
| 低相机运动微调 | 低光流子集 | 10k | - | - | 抑制相机漂移，提升时间平滑性 |

总训练时间：约 14 天（128 块 H100 SXM5 GPU）

## 3. LVP-1M 数据集

为了训练具身规划的视频基础模型，作者构建了**LVP-1M**数据集——包含 140 万个展示人类或机器人与物体交互的短视频片段。

### 3.1 视频来源

| 来源类型 | 数据集 | 特点 |
|----------|--------|------|
| 机器人数据 | Bridge, Droid, Language Table, AgiBot-World | 提供机器人形态知识，但视觉质量较差 |
| 第一人称人类活动 | Ego4D, Epic-Kitchens, Something-something | 包含大量人手 - 物体交互，但有相机运动 |
| 网络爬取 | Panda-70M | 规模大、多样性高，但手部交互细节少 |

### 3.2 关键处理步骤

**时间对齐**：将所有视频对齐到人类速度（3 秒完成原子动作），避免不同形态间的时间不一致。

**质量过滤**：
- 过滤快速相机运动（使用光流统计）
- 确保首帧中 embodiment（手或机器人夹爪）清晰可见
- 移除失败轨迹（仅保留成功完成任务的动作）
- 对 Panda-70M 进行三阶段过滤（关键词、人体检测、Gemini 验证）

## 4. 实验结果

### 4.1 评估设置

- **任务级泛化**：通过第三方选择的野外任务和真实机器人实验评估
- **零样本规划**：在新场景和任务上无需微调
- **物理执行**：将生成的视频计划重定向到真实机器人执行

### 4.2 主要结果

| 评估维度 | 结果 |
|----------|------|
| 指令跟随 | 强大的自然语言指令理解能力 |
| 泛化能力 | 在未见过的任务场景中成功执行 |
| 物理可行性 | 真实机器人实验验证成功执行 |
| 多阶段规划 | 支持自回归扩展，生成多阶段视频计划 |

### 4.3 定性结果

![定性结果](/assets/large-video-planner/qualitative-results.png)
*图：Large Video Planner 在不同场景和任务上生成的视频计划示例。*

## 5. 优点与局限

### 优点

- **新范式**：首次在互联网规模上训练用于机器人规划的视频基础模型
- **数据丰富**：利用海量在线视频数据，突破机器人数据稀缺瓶颈
- **零样本泛化**：在新任务上无需微调即可生成可执行计划
- **开源贡献**：公开模型和 LVP-1M 数据集，促进可复现研究

### 局限

- **相机运动控制**：尽管进行了微调，生成视频仍可能存在一定相机漂移
- **重定向误差**：从人体动作到机器人动作的重定向可能引入误差
- **计算成本**：训练需要 128 块 H100 GPU，约 14 天
- **视频长度限制**：当前支持 3 秒视频，长时任务需自回归扩展

## 6. 总结

本文提出了一种基于视频生成的机器人规划新范式，通过大规模视频预训练实现了强大的零样本泛化能力。与 VLA 方法相比，该方法利用丰富的在线视频数据，避免了机器人动作数据稀缺的问题。实验结果证明了该方法在指令跟随、泛化能力和物理可行性方面的优势。

> "我们发布模型和数据集，以支持开放、可复现的基于视频的机器人学习。"

## 参考文献

1. Chen, B., Zhang, T., Geng, H., et al. Large Video Planner Enables Generalizable Robot Control. arXiv preprint arXiv:2512.15840, 2025.
2. Du, Y., Yang, M., Florence, P., et al. Video Language Planning. arXiv preprint arXiv:2310.10625, 2023.
3. Du, Y., Yang, S., Dai, B., et al. Learning Universal Policies via Text-Guided Video Generation. NeurIPS, 2023.
4. Brohan, A., Brown, N., Carbajal, J., et al. RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control. arXiv preprint arXiv:2307.15818, 2023.
5. Black, K., Brown, N., Carroll, D., et al. Open X-Embodiment: Robotic Learning Datasets and RT-X Models. arXiv preprint arXiv:2310.08864, 2023.
