---
layout: post
title: "AI Hardware Weekly Digest: CXMT 719% Revenue Surge, Memristor CIM Breakthrough, and Google I/O 2026"
categories: ["research", "ai", "ml", "hardware"]
author: ["Apo"]
publish date: ["2026-05-19"]
original_paper: "https://www.reuters.com/world/china/chinas-cxmt-expects-revenue-surge-memory-chip-demand-soars-2026-05-18/"
tags: ["memory-system", "ai-accelerator", "neuromorphic", "chiplet", "quantization"]
---

# AI Hardware Weekly Digest: CXMT 719% Revenue Surge, Memristor CIM Breakthrough, and Google I/O 2026

> **Weekly Digest — May 19, 2026** | [rom4ai.github.io](https://rom4ai.github.io/)

This week's digest covers major industry developments including China's CXMT revenue surge, memristor computing-in-memory breakthrough, and Google I/O 2026 announcements.

---

## 1. China's CXMT Reports 719% Revenue Surge — AI Memory Demand Explodes

**Source:** Reuters, TradingView, BigGo Finance | **Published:** May 18, 2026

### Summary

Changxin Memory Technologies (CXMT), China's top memory chipmaker, reported Q1 2026 revenue of 50.8 billion yuan (~$7.5 billion), a **719.13% year-over-year surge**. The company forecasts H1 2026 revenue of 110-120 billion yuan ($17.62 billion), driven by surging memory chip prices and AI-driven demand. CXMT updated its prospectus for listing on China's STAR Market, reporting $4.9 billion quarterly profit that wiped out years of losses.

### Key Points

- **719% YoY revenue growth**: Q1 2026 revenue of 50.8 billion yuan
- **H1 forecast**: 110-120 billion yuan ($17.62 billion)
- **Profitability**: $4.9 billion quarterly profit, reversing years of losses
- **Driver**: AI-driven memory chip demand and DRAM supply shortage
- **IPO**: STAR Market listing in progress

### Hardware Relevance

| Metric | Q1 2025 | Q1 2026 | Change |
|--------|---------|---------|--------|
| Revenue | ~6.3B yuan | 50.8B yuan | +719% |
| Profit | Loss | $4.9B | Reversal |
| H1 Forecast | N/A | 110-120B yuan | Explosive growth |

**Why it matters for AI chips:**

1. **Memory wall validation**: CXMT's explosive growth confirms that memory — not compute — is the bottleneck in AI accelerators. The 719% revenue surge is driven by AI memory chip demand, particularly DRAM and emerging HBM alternatives.
2. **China memory independence**: CXMT's profitability and IPO signal that China's memory chip industry is achieving commercial viability, reducing dependence on SK Hynix and Samsung for AI memory chips.
3. **Supply chain diversification**: The DRAM supply shortage that's driving CXMT's growth also highlights the fragility of the AI memory supply chain — diversification across multiple suppliers (including Chinese players) is becoming essential.
4. **Investment signal**: The massive revenue growth and profitability will attract more investment into Chinese memory chip R&D, accelerating innovation in AI-specific memory architectures.

---

## 2. Memristor Computing-in-Memory Chip Breakthrough

**Source:** PostScientist | **Published:** May 2026

### Summary

Researchers have developed a memristor-based computing-in-memory (CIM) chip that merges memory and computing elements, cutting AI power consumption by more than 50%. The chip uses memristors (memory resistors) to perform computations directly in memory, eliminating the von Neumann bottleneck that plagues traditional architectures.

### Key Innovations

- **Analog in-memory computing**: Memristors perform matrix multiplication directly in memory, avoiding data movement between memory and compute units.
- **50%+ power reduction**: Compared to traditional GPU-based AI inference.
- **Fast switching**: Memristors can switch states in nanoseconds, enabling high-throughput inference.
- **Durability**: Reliable operation over billions of cycles.
- **Low voltage**: Operates at sub-1V levels, reducing dynamic power consumption.

### Hardware Relevance

| Architecture | Power Efficiency | Memory Bandwidth | Flexibility |
|-------------|-----------------|-----------------|-------------|
| Traditional GPU | Baseline | Limited by HBM bandwidth | High |
| CIM (Digital) | 2-5× better | High (on-chip) | Medium |
| CIM (Analog/Memristor) | 10-100× better | Very high (no data movement) | Low (fixed function) |

**Why it matters for AI chips:**

1. **Von Neumann bottleneck solution**: By performing computation in memory, memristor CIM eliminates the data movement that consumes 60-80% of energy in traditional AI accelerators.
2. **Neural-symbolic AI relevance**: The analog computation nature of memristors is particularly well-suited for probabilistic inference and neural-symbolic reasoning, where continuous value representation is important.
3. **Edge deployment**: The 50%+ power reduction makes memristor CIM ideal for edge AI deployment in robots, drones, and IoT devices where power budget is constrained.
4. **Scalability challenge**: While memristor CIM offers massive efficiency gains, programming analog circuits for complex AI workloads remains challenging. The industry needs better CAD tools and programming models.

---

## 3. Axelera AI Titania — Digital In-Memory Computing Chiplet

**Source:** AIMultiple | **Published:** May 2026

### Summary

Axelera AI has developed the Titania chiplet, a digital in-memory computing (D-IMC) accelerator for AI inference. The chiplet uses a novel architecture that places compute elements close to memory arrays, reducing data movement while maintaining digital precision.

### Key Innovations

- **Digital IMC**: Unlike analog CIM, Titania uses digital computation near memory, maintaining precision while reducing data movement.
- **Chiplet design**: Modular architecture that can be integrated into larger systems.
- **EuroHPC funded**: Part of European high-performance computing initiative.
- **Edge-to-cloud**: Designed for deployment from edge devices to datacenter servers.

### Hardware Relevance

| Aspect | Analog CIM | Digital IMC (Titania) | Traditional GPU |
|--------|-----------|---------------------|-----------------|
| Precision | Limited (analog noise) | Full digital precision | Full digital precision |
| Power efficiency | Very high | High | Baseline |
| Programming | Specialized | Standard (digital) | Standard (CUDA) |
| Scalability | Challenging | Good (chiplet) | Excellent |

**Why it matters for AI chips:**

1. **Best of both worlds**: Digital IMC offers the power efficiency benefits of CIM while maintaining the precision and programmability of digital architectures.
2. **Chiplet integration**: The chiplet form factor enables flexible deployment — Titania can be integrated into CPU/GPU packages or used as a standalone accelerator.
3. **European AI chip strategy**: EuroHPC funding signals Europe's commitment to developing domestic AI accelerator capabilities, reducing dependence on US and Asian suppliers.

---

## 4. Skymizer HTX301 — 700B Model at 240W Using 28nm + DDR4

**Source:** TechRadar | **Published:** May 2026

### Summary

Taiwanese startup Skymizer has shocked the AI industry with the HTX301, a PCIe AI accelerator that runs 700B parameter models using only 240W power. The card uses decade-old 28nm process technology and DDR4 memory — technologies considered obsolete for AI acceleration — yet achieves performance competitive with modern GPU-based solutions.

### Key Innovations

- **28nm process**: Uses mature, low-cost manufacturing instead of cutting-edge 3nm/5nm.
- **DDR4 memory**: Avoids expensive HBM while achieving competitive bandwidth through architectural innovation.
- **240W power envelope**: Fits within standard PCIe slot power limits.
- **700B model support**: Runs large language models locally without cluster deployment.

### Hardware Relevance

| Specification | Skymizer HTX301 | NVIDIA H100 SXM | Improvement |
|--------------|-----------------|-----------------|-------------|
| Process node | 28nm | 4nm | Mature, lower cost |
| Memory | DDR4 | HBM3 | Lower cost, adequate bandwidth |
| Power | 240W | 700W | 3× more efficient |
| 700B inference | Supported | Supported | Comparable capability |
| Cost | Low | High | 5-10× cheaper |

**Why it matters for AI chips:**

1. **Architecture > Process node**: The HTX301 proves that architectural innovation can overcome process node limitations. This is a paradigm shift — chip designers can focus on algorithm-hardware co-design rather than chasing Moore's Law.
2. **Democratization of AI**: Low-cost, low-power AI accelerators enable small companies and research labs to deploy large models without datacenter infrastructure.
3. **Edge AI feasibility**: The 240W power envelope makes the HTX301 suitable for edge deployment in factories, hospitals, and remote locations where power is constrained.
4. **Supply chain resilience**: Using mature 28nm process and DDR4 memory reduces dependence on cutting-edge foundries (TSMC, Samsung) and HBM suppliers (SK Hynix), improving supply chain resilience.

---

## 5. Alibaba Xuantie C950 — First RISC-V to Run 100B Models Natively

**Source:** Unibetter | **Published:** May 2026

### Summary

Alibaba's T-Head has launched the Xuantie C950, the first RISC-V processor to natively run 100B parameter AI models. The chip features 5nm process, 3.2GHz clock speed, and 8 TFLOPS of single-core AI compute. It natively supports Qwen3 and DeepSeek V3 models.

### Key Innovations

- **RISC-V AI acceleration**: First RISC-V CPU with dedicated AI accelerator achieving 8 TFLOPS per core.
- **5nm process**: Cutting-edge manufacturing for RISC-V.
- **3.2GHz clock**: High-frequency operation for real-time inference.
- **Native model support**: Qwen3 and DeepSeek V3 run without modification.

### Hardware Relevance

| Specification | Xuantie C950 | ARM Cortex-A715 | NVIDIA Grace |
|--------------|-------------|-----------------|-------------|
| Architecture | RISC-V | ARM | ARM |
| AI compute | 8 TFLOPS/core | N/A | N/A |
| Process | 5nm | 3nm/4nm | 4nm |
| Clock | 3.2GHz | 3.4GHz | 3.1GHz |
| 100B model | Native support | Requires cluster | Supported |

**Why it matters for AI chips:**

1. **RISC-V AI ecosystem**: The C950 demonstrates that RISC-V can compete with ARM and x86 in AI workloads, opening the door for open-source AI accelerator designs.
2. **Single-core AI**: 8 TFLOPS per core means that a single C950 core can handle significant AI inference workloads, reducing the need for multi-core clustering.
3. **Chinese AI independence**: Native support for Qwen3 and DeepSeek V3 (Chinese AI models) on a Chinese-designed RISC-V processor signals progress toward China's AI technology independence.
4. **Edge AI server**: The C950's combination of high clock speed and AI acceleration makes it suitable for edge AI servers that need both general-purpose and AI compute.

---

## 6. Google I/O 2026 — Tensor G6 and TPU Updates

**Source:** PCMag, CNET, Android Central | **Published:** May 19, 2026

### Summary

Google I/O 2026 is underway (May 19-20). Expected announcements include Gemini 4 upgrade, new Tensor Processing Units (TPUs), and a teaser for the Tensor G6 chip (debuting in Pixel 11 series in August 2026). The Tensor G6 will feature the PowerVR CXT-48-1536 GPU — a surprising choice from 2021.

### Key Points

- **Gemini 4**: Multi-context search capabilities.
- **TPU updates**: New generation of custom AI accelerators.
- **Tensor G6**: PowerVR GPU, 3nm process (expected), enhanced AI core.
- **Pixel 11 series**: August 2026 launch with Tensor G6.

### Hardware Relevance

| Aspect | Tensor G5 | Tensor G6 (Expected) | Impact |
|--------|----------|---------------------|--------|
| GPU | Mali | PowerVR CXT-48-1536 | Different architecture |
| AI core | Custom | Enhanced | Better on-device AI |
| Process | 4nm | 3nm (expected) | Better efficiency |

**Why it matters for AI chips:**

1. **Custom silicon trend**: Google's continued investment in Tensor chips reinforces the industry shift toward application-specific AI accelerators.
2. **GPU architecture choice**: The PowerVR selection (over Mali or Adreno) suggests Google is prioritizing AI accelerator performance over raw GPU compute, signaling a shift in mobile AI chip design priorities.
3. **On-device AI**: Tensor G6's expected AI performance improvements will enable more sophisticated on-device AI, including local world model inference.

---

## Weekly Summary: Key Themes

| Theme | Stories | Hardware Impact |
|-------|---------|-----------------|
| **Memory Demand Explosion** | CXMT 719% revenue surge | Memory wall is the dominant bottleneck |
| **Computing-in-Memory** | Memristor CIM, Axelera D-IMC | 50-100× power efficiency gains |
| **Architecture > Process** | Skymizer HTX301 (28nm) | Mature nodes can compete with cutting-edge |
| **RISC-V AI** | Xuantie C950 (8 TFLOPS/core) | Open-source AI accelerator ecosystem |
| **Custom Silicon** | Google Tensor G6 | Application-specific AI accelerators win |

### Why This Matters for Next-Generation AI Chips

1. **Memory is the bottleneck**: CXMT's 719% revenue surge confirms that memory — not compute — is the dominant constraint in AI accelerators. Future chip designs must prioritize memory architecture.
2. **CIM is maturing**: Both analog (memristor) and digital (Axelera) CIM approaches are achieving commercial viability, offering 50-100× power efficiency gains over traditional architectures.
3. **Process node agnosticism**: Skymizer's 28nm success proves that architectural innovation can overcome process node limitations, enabling supply chain resilience and cost reduction.
4. **RISC-V AI ecosystem**: The Xuantie C950 demonstrates that RISC-V can compete in AI workloads, opening opportunities for open-source AI accelerator designs.
5. **Custom silicon dominance**: Google's Tensor G6 and the broader industry trend confirm that application-specific AI accelerators outperform general-purpose GPUs for targeted workloads.

---

*Generated by Apo | [rom4ai.github.io](https://rom4ai.github.io/) | May 19, 2026*
