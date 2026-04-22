---
layout: post
title: "EPAC: The Last Dance - 欧洲RISC-V HPC加速器芯片的全栈实践"
categories: ["ai-accelerator", "chiplet", "llm-inference"]
author: ["Filippo Mantovani", "Fabio Banchelli", "Pablo Vizcaino", "Roger Ferrer", "Oscar Palomar", "Francesco Minervini", "Jesus Labarta", "Mauro Olivieri", "Sebastiano Pomata", "Pedro Marcuello", "Jordi Cortina", "Alberto Moreno", "Josep Sans", "Roger Espasa", "Eric Guthmuller", "Andrea Bocco", "Jérôme Fereyre", "César Fuguet", "Mate Kovač", "Mario Kovač", "Luka Mrković", "Josip Ramljak", "Bhavishya Goel", "Madhavan Manivannan", "Tiago Rocha", "Nuno Neves", "Vassilis Papaefstathiou", "Nikolaos Dimou", "Georgios Ieronymakis", "Antonis Psathakis", "Michalis Giaourtas", "Iasonas Mastorakis", "Manolis Marazakis", "Luca Bertaccini", "Tim Fischer", "Frank K. Gurkaynak", "Paul Scheffler", "Luca Benini", "Jens Krüger"]
publish_date: ["2026-04-14"]
original_paper: "https://arxiv.org/abs/2604.12715"
tags: ["ai-accelerator", "chiplet", "risc-v", "hpc", "european-processor-initiative"]
---

# EPAC: The Last Dance - 欧洲RISC-V HPC加速器芯片的全栈实践

> **原文链接**: [arXiv:2604.12715](https://arxiv.org/abs/2604.12715) | [PDF](https://arxiv.org/pdf/2604.12715.pdf)

## 摘要

本文介绍了EPAC（European Processor Accelerator Chip），一款基于RISC-V指令集的高性能计算加速器芯片。该芯片由欧洲处理器计划（EPI）开发，采用GlobalFoundries 22FDX工艺制造，面积27mm²，集成约3亿晶体管。EPAC包含三种不同的计算单元：VEC（向量处理单元）、STX（模板/张量加速单元）和VRP（可变精度单元），分别针对双精度HPC工作负载、机器学习/模板计算和扩展精度数值求解器。芯片通过CHI协议互联，配备分布式L2缓存和SerDes片间互联，已成功流片并完成bring-up验证。

![EPAC芯片框图](/assets/epac-the-last-dance/page-1.png)
*图1：EPAC测试芯片整体架构框图（来源：原文Figure 1）*

---

## 1. 问题定义与背景

### 1.1 欧洲处理器自主化的战略需求

> "Europe has played an important role in the development of instruction set architectures (ISAs) for embedded systems, especially with Arm. However, it has not reached the same position in high-performance computing (HPC), datacenter, or automotive processors."

欧洲在嵌入式处理器架构（尤其是Arm）方面具有重要地位，但在高性能计算、数据中心和汽车处理器领域尚未达到同等水平。近年来，地缘政治变化和COVID-19疫情期间的供应链问题凸显了依赖非欧洲技术的风险，推动了欧洲自主处理器生态系统的建设。

### 1.2 欧洲处理器计划（EPI）

欧洲处理器计划（EPI）是这一方向的主要项目，分为两个阶段：
- **SGA1阶段**：2018年12月至2021年12月，预算8000万欧元
- **SGA2阶段**：2022年1月至2026年3月，预算7000万欧元

整个计划由EuroHPC联合企业资助50%，参与国家（克罗地亚、法国、德国、希腊、意大利、荷兰、葡萄牙、西班牙、瑞典、瑞士）资助50%。RISC-V开发占总预算的20%（约3000万欧元）。

### 1.3 双轨架构策略

现代HPC系统通常采用通用CPU加加速器的架构。EPI遵循这一结构但进行了扩展：
- **通用CPU**：基于Arm架构，由SiPearl开发
- **加速器**：基于RISC-V ISA，探索多种设计方案

EPI支持两种运行模式：
1. **传统host-device模式**：CPU控制，加速器执行卸载任务
2. **独立运行模式**：加速器可独立启动Linux并执行工作负载

这种设计比传统GPU方案更加灵活。

---

## 2. 方法框架

### 2.1 EPAC整体架构

EPAC芯片采用GF22FDX工艺实现，面积27mm²，约3亿晶体管，于2022年10月提交流片，2023年10月完成bring-up。

芯片集成三种RISC-V计算单元：

| 计算单元 | 目标工作负载 | 核心特性 |
|---------|------------|---------|
| **VEC** | 传统HPC，双精度计算 | 向量处理单元，支持256个双精度元素 |
| **STX** | 模板计算、机器学习 | 众核架构，硬件地址生成，Scratchpad内存 |
| **VRP** | 迭代数值求解器 | 可变精度浮点，最高512位尾数 |

### 2.2 系统级互联

所有计算单元通过基于CHI（Coherent Hub Interface）协议的片上网络（NoC）互联，配备：
- **分布式L2缓存**：每片256KB，由FORTH开发
- **Home Node（HN）**：由Chalmers开发，管理缓存一致性
- **片间互联（C2C）**：25GB/s全双工SerDes链路，由EXTOLL开发

![EPAC Floorplan与芯片照片](/assets/epac-the-last-dance/page-5.png)
*图2：EPAC芯片Floorplan（左）与实物照片（右）（来源：原文Figure 4）*

---

## 3. 核心模块详解

### 3.1 VEC Tile：向量处理单元

VEC单元针对传统HPC工作负载，特别是双精度计算。其核心设计思想是在保持通用处理器可编程性的同时，提供比标准HPC CPU更激进的设计点。

**架构组成**：
- **标量核心**：Avispado（Semidynamics开发的顺序RISC-V核心）
- **向量处理单元（VPU）**：BSC开发，通过Open Vector Interface（OVI）连接
- **浮点单元（FPU）**：萨格勒布大学开发的FAUST单元

**关键特性**：
- 支持RISC-V Vector Extension 0.7.1，最大向量长度2048字节（256个双精度元素）
- 40个物理向量寄存器（相比标准32个）
- 8个并行功能单元，每个包含流水线化FPU
- 16KB指令缓存，32KB数据缓存
- Gazillion单元支持大量未完成的缓存行请求

> "The VPU can be seen as a pipelined SIMD unit operating on vector registers up to 2048 bytes, corresponding to 256 double-precision elements."

向量算术指令在完整向量上需要32个周期（8个功能单元每周期处理8个元素），加上约3个周期的解码开销。

**编程模型**：
- 基于LLVM的工具链支持C/C++/Fortran自动向量化
- 支持OpenMP SIMD语法的引导向量化
- 提供内联函数（intrinsics）进行底层优化
- 完整的Linux启动能力

### 3.2 STX Tile：模板/张量加速器

STX是针对模板计算和机器学习工作负载的众核加速器。这类工作负载的特点是：规则的多维数据访问模式、高内存带宽需求、有限的数据重用、每个网格点大量简单浮点操作。

**设计动机**：
传统通用处理器在这类工作负载上存在开销：地址生成、缓存管理、控制逻辑，即使访问模式已知。

**架构组成**：
- **Snitch核心**：ETH Zürich开发的轻量级32位RISC-V核心
- **Stream Semantic Registers（SSR）**：将内存流直接映射到浮点寄存器
- **Floating-Point Repetition（FREP）**：硬件重复浮点指令序列
- **可选SPU单元**：Fraunhofer开发的模板处理单元

**关键特性**：
- 基于Scratchpad的显式内存管理（通过DMA）
- 64-256KB本地Scratchpad内存
- 典型配置：4个集群 × 8个计算核心 = 32个核心
- 1GHz频率下可达64 GFLOPS（双精度）

> "By relying on a simpler architecture without large cache hierarchies or complex out-of-order logic, STX is a strong candidate for achieving higher energy efficiency compared to general-purpose or vector-based designs."

**编程模型**：
- 支持基于OpenMP的offloading
- 可从Arm主机或EPAC内部RISC-V核心卸载
- 支持GCC和LLVM工具链

![STX框图](/assets/epac-the-last-dance/page-3.png)
*图3：STX Tile架构框图（来源：原文Figure 3）*

### 3.3 VRP Tile：可变精度单元

VRP单元针对需要比标准双精度更高精度的浮点计算，主要目标是迭代线性求解器（如Krylov方法：CG、BiCG、PCG）。

**核心问题**：
在病态系统中，增加精度可以减少舍入误差、改善收敛性或使原本不收敛的系统收敛。

**架构组成**：
- **CVA6核心**：64位RISC-V单发射顺序核心
- **可变精度浮点单元（VPFPU）**：支持自定义Xvpfloat ISA扩展
- **HPDcache**：32KB高性能数据缓存

**关键特性**：
- 支持尾数最高512位、指数最高18位的浮点格式
- 采用分块（chunk-based）架构避免全宽512位数据路径成本
- 64项物理寄存器堆，支持寄存器重命名
- 多流水线并行执行（加、减、乘、移动/比较/转换、加载/存储）
- 可配置的IEEE 754扩展格式（128/256/512位）

> "The VPFPU supports floating-point formats with a significand up to 512 bits and an exponent up to 18 bits."

**运行时精度配置**：
通过环境寄存器在运行时配置精度，无需重新编译代码，支持自适应策略平衡性能、功耗和数值稳定性。

---

## 4. Uncore架构

### 4.1 分布式L2缓存与一致性管理

- **L2缓存片**：每片256KB，8路组相联，写回式
- **支持特性**：128个未完成事务、64个miss、64个eviction、原子ALU
- **Home Node（HN）**：全映射目录缓存一致性控制器，MESI-like协议

### 4.2 片上网络（NoC）

- **拓扑**：2D Mesh，维度顺序路由
- **协议**：AMBA 5 CHI
- **带宽**：1GHz频率下每端口每方向64GB/s（数据通道）
- **特性**：基于信用的流控、请求/响应/数据/探听独立通道、组播支持

### 4.3 片间互联（C2C）

- **SerDes**：8个lane，每lane最高25Gb/s
- **峰值带宽**：单向200Gb/s（25GB/s），双向400Gb/s（50GB/s）
- **特性**：CRC校验、链路级重传

---

## 5. 实现与流片

### 5.1 物理实现

- **工艺**：GlobalFoundries 22FDX FDSOI，10层金属
- **标准单元库**：Invecas GF22FDX 8-track（优于12-track的功耗-性能权衡）
- **规模**：超过1400万逻辑单元，991个存储器宏
- **面积**：26.97mm²（含划片线27.29mm²）

**三个实现分区**：
| 分区 | 逻辑单元数 |
|-----|----------|
| STX Tile | 186万 |
| VEC Tile | 226万 |
| VRP Tile | 53.2万 |

**时序目标**：
- 综合约束：1.25GHz（考虑片上变化）
- 运行目标：1GHz
- 实际达成：最坏情况768MHz（SS角，0.72V，125°C），典型情况1234MHz（TT，0.80V，85°C）

### 5.2 Bring-up与验证

- **流片提交**：2022年10月10日
- **硅片到货**：2023年2月17日
- **封装**：FCBGA（22×22球，1mm间距）
- **测试平台**：E4和SECO设计的子板，连接Xilinx VCU128 FPGA板

**验证序列**：
- JTAG/SPI寄存器访问
- SRAM读写模式
- Tile间CHI和AXI互联
- 缓存一致性和探听传递
- VPU向量化基准测试（DGEMM和Stream）
- CLINT中断传递

**关键成果**：
- C2C链路安全演示，聚合带宽20GB/s
- 成功启动Ubuntu 22.04 LTS（Linux内核v5.7）
- 稳定运行标准GUI和长时HPC基准测试（LINPACK等）

---

## 6. 优点与局限

### 6.1 主要优点

1. **架构多样性探索**：单一芯片内集成三种不同加速策略，为比较不同架构方法提供统一平台
2. **全栈开源生态**：基于RISC-V ISA，避免供应商锁定，支持开放灵活的设计方法
3. **欧洲协作模式**：展示了学术界与工业界分布式协作进行完整芯片设计的可行性
4. **软件基础设施**：配套的编译器、库、仿真工具形成可延续的资产

### 6.2 局限与挑战

1. **多组织协调开销**：RTL集成需要解决接口标准化、命名冲突、工具链对齐等问题
2. **层次化物理实现复杂度**：1400万逻辑单元跨三个独立分区的时序收敛和DFT插入需要紧密协调
3. **RVV版本**：VEC单元采用RVV 0.7.1（开发时的ratified版本），新版芯片已升级至RVV 1.0
4. **片外内存**：无片上内存控制器，依赖C2C链路访问外部DRAM

---

## 7. 总结

EPAC项目证明了从架构设计到流片bring-up的完整芯片开发可以由分布式欧洲联盟（学术界+工业界）成功完成。芯片集成了三种不同的RISC-V计算单元（VEC、STX、VRP），分别针对不同类型的HPC工作负载。

从架构角度看，三种单元证实了HPC加速没有单一最佳方案：
- **VEC**提供最通用的解决方案，可运行完整软件栈，支持编译器驱动向量化，但设计复杂度较高
- **STX**以通用性换取效率，简单的数据路径、基于Scratchpad的内存层次和硬件级数据流使其在规则工作负载上具有能效优势
- **VRP**针对科学计算中更专业的细分领域（病态数值问题的扩展精度算术），展示了在RISC-V框架中支持可变精度的可行性和实用性

EPAC为未来的欧洲处理器发展提供了经过验证的硅平台、硅验证的IP组合以及可直接借鉴的工程经验。主要开放挑战仍然是多伙伴设计模式的可扩展性：随着芯片复杂度增长，组织间的协调开销成为一级设计约束，需要显式规划而不仅是技术解决方案。

---

## 参考文献

1. Mantovani et al.. EPAC: The Last Dance: Invited Paper. CF Companion '26, May 19-21, 2026, Catania, Italy.
2. Minervini et al.. Vitruvius+: An area-efficient RISC-V decoupled vector coprocessor. ACM TACO, 20(2), 2023.
3. Kovač et al.. FAUST: Design and implementation of a pipelined RISC-V vector floating-point unit. Microprocessors and