---
layout: post
title: GSoC 2020&#58; ZXCalculus.jl, ZX-calculus in Julia
description: A full-stack Julia package for ZX-calculus, and a circuit simplification engine for the Julia quantum compiler, YaoLang.jl.
author: Chen Zhao
tags:
- GSoC
- Quantum Compiling
- ZX-calculus
- Yao
- YaoLang
---

In the past three months, I participated my first GSoC (Google Summer of Code) and working on the Julia package [`ZXCalculus.jl`](https://github.com/QuantumBFS/ZXCalculus.jl). In this blog post, I will briefly introduce my work during GSoC 2020.

## ZXCalculus.jl

[ZX-calculus](https://en.wikipedia.org/wiki/ZX-calculus) is a graphical language for representing quantum states and operations. In ZX-calculus, we will deal with ZX-diagrams, multigraphs with some extra information. Each vertex of a ZX-diagram is called a spider. There are two types of spiders, the Z-spider and the Z-spider. Each spider is associated with a number called phase. By Dirac notation, the Z-spider and X-spider represent the following rank-2 matrices.
![](\assets\blog_res\ZX\spider.png)

ZX-calculus rules define how ZX-diagrams are allowed to be transformed. Here are some basic rules. 
![](\assets\blog_res\ZX\rules.png)
ZX-diagrams can be regarded as a special type of tensor network. And these rules also define the equivalent relation of ZX-diagrams as tensor networks. On the other hand, quantum circuits can also be regarded as tensor networks. Moreover, quantum circuits can be converted to ZX-diagrams according to the following rules. Hence, ZX-calculus becomes a powerful tool to help us finding equivalent but simpler quantum circuits. 

Here are some basic purposes of `ZXCalculus.jl`.
- Defining data structures to represent ZX-diagrams.
- Providing APIs for creating ZX-diagrams and manipulating them with ZX-calculus rules
- Providing a visualization tool for ZX-diagrams
- Implementing quantum circuit simplification algorithms base on ZX-calculus (including circuit extraction[^1] and phase teleportation[^2])

The data structure for representing ZX-diagrams is the multigraph. I implemented a high-performance multigraph backend according to APIs of [`LightGraphs.jl`](https://github.com/JuliaGraphs/LightGraphs.jl). For more details about the implementation, please read [the first GSoC blog post](https://chenzhao44.github.io/2020/06/21/Quantum-circuits-simplification-and-ZX-calculus/). Here, I will show an example to demonstrate how to use `ZXCalculus.jl` to simplify a quantum circuit.

### Using ZXCalculus.jl for circuit simplification

In `ZXCalculus.jl`, the objects we will mainly deal with are the `ZXDiagram` and `ZXGraph`, which represent the general ZX-diagram and the graph-like ZX-diagram (defined in [^1]). If one wants to simplify a quantum circuit, he has to convert it to a `ZXDiagram` or construct a `ZXDiagram` directly. We can construct a ZX-diagram which represents an empty quantum circuit with `n` qubits by [`ZXDiagram(n)`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZX-diagrams). In this example, I will simplify a 4-qubits circuit.
```julia
using ZXCalculus
zxd = ZXDiagram(4)
```

Then we can add some gates to the ZX-diagram we have just constructed. We can simply use [`push_gate!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.push_gate!) and [`push_ctrl_gate!`]((https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.push_ctrl_gate!)) to do that.
```julia
push_gate!(zxd, Val{:Z}(), 1, 7//4)
push_gate!(zxd, Val{:H}(), 1)
push_gate!(zxd, Val{:X}(), 1, 1//4)
push_gate!(zxd, Val{:H}(), 4)
push_ctrl_gate!(zxd, Val{:CZ}(), 4, 1)
push_ctrl_gate!(zxd, Val{:CNOT}(), 1, 4)
push_gate!(zxd, Val{:H}(), 1)
push_gate!(zxd, Val{:H}(), 4)
push_gate!(zxd, Val{:Z}(), 1, 1//4)
push_gate!(zxd, Val{:Z}(), 4, 3//2)
push_gate!(zxd, Val{:X}(), 4, 1//1)
push_gate!(zxd, Val{:H}(), 1)
push_gate!(zxd, Val{:Z}(), 4, 1//2)
push_gate!(zxd, Val{:X}(), 4, 1//1)
push_gate!(zxd, Val{:Z}(), 2, 1//2)
push_ctrl_gate!(zxd, Val{:CNOT}(), 3, 2)
push_gate!(zxd, Val{:H}(), 2)
push_ctrl_gate!(zxd, Val{:CNOT}(), 3, 2)
push_gate!(zxd, Val{:Z}(), 2, 1//4)
push_gate!(zxd, Val{:Z}(), 3, 1//2)
push_gate!(zxd, Val{:H}(), 2)
push_gate!(zxd, Val{:H}(), 3)
push_gate!(zxd, Val{:Z}(), 3, 1//2)
push_ctrl_gate!(zxd, Val{:CNOT}(), 3, 2)
```

Now, let's draw the circuit we have built up. The visualization tool of `ZXCalculus.jl` is currently provided in [`YaoPlots.jl`](https://github.com/QuantumBFS/YaoPlots.jl). 
```julia
using YaoPlots
plot(zxd)
```
![original circuit](\assets\blog_res\ZX\zxd.svg)

We can use the algorithms [`clifford_simplification`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.clifford_simplification) [^1] and [`phase_teleportation`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.phase_teleportation) [^2] to simplify this circuit.
```julia
ex_zxd = clifford_simplification(zxd)
pt_zxd = phase_teleportation(zxd)
plot(ex_zxd)
plot(pt_zxd)
```
![circuit after clifford_simplification](\assets\blog_res\ZX\ex_zxd.svg)
![circuit after phase_telefortation](\assets\blog_res\ZX\pt_zxd.svg)

The phase teleportation algorithm can reduce the number of T-gates of a quantum circuit. We can use [`tcount`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.tcount-Tuple{AbstractZXDiagram}) to show the number of T-gates. In this example, the T-count decreased from 4 to 2.
```julia
tcount(zxd)
tcount(pt_zxd)
```

One may want to apply rules on a ZX-diagram manually. We provide different APIs for this. Also, the simplification algorithm `clifford_simplification` and `phase_teleportation` are written with these APIs.

The function [`match`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#Base.match) will match all available vertices on a ZX-diagram with a given rule. And we can use the function [`rewrite!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.rewrite!) to rewrite a ZX-diagram on some matched vertices. The [`replace!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#Base.replace!) function just match and rewrite on all matched vertices once. The [`simplify!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#Base.replace!) function will match and rewrite a ZX-diagram with a rule until no vertices can be matched. 

In the `clifford_simplification`, we will first convert the given ZX-diagram to a graph-like ZX-diagram.
```julia
zxg = ZXGraph(zxd)
plot(zxg)
```
![graph-like ZX-diagram](\assets\blog_res\ZX\zxg.svg)
Then we simplify the graph-like ZX-diagram with rule `:lc`, `:p1`, and `:pab`.
```julia
simplify!(Rule{:lc}(), zxg)
simplify!(Rule{:p1}(), zxg)
replace!(Rule{:pab}(), zxg)
plot(zxg)
```
![simplified graph-like ZX-diagram](\assets\blog_res\ZX\simp_zxg.svg)
Finally, we extract a new circuit from the simplified graph-like ZX-diagram. 
```julia
ex_circ = circuit_extraction(zxg)
```

However, for large quantum circuits, constructing ZX-diagrams via the above APIs will be extremely cumbersome. We support a more efficient way to do that via [`YaoLang.jl`](https://github.com/QuantumBFS/YaoLang.jl).

## YaoLang.jl

`YaoLang.jl` is a compiler for hybrid quantum-classical programs that are very practical in the current NISQ (noisy intermediate-scale quantum) era. For more details about `YaoLang.jl` and quantum compiling, please read [my second GSoC blog post](https://chenzhao44.github.io/2020/07/28/Quantum-Compiler/). There is an intermediate representation, `YaoIR`, for representing hybrid programs in `YaoLang.jl`. If an `YaoIR` represents a quantum circuit, one converts it to a `ZXDiagram` directly. 

[OpenQASM](https://en.wikipedia.org/wiki/OpenQASM) is a quantum instruction. OpenQASM codes can be run on IBM Q devices. And quantum circuits can be stored as OpenQASM codes. We use the Julia package [`RBNF.jl`](https://github.com/thautwarm/RBNF.jl) (a Julia parser that parses code to restricted [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form)) to parse OpenQASM codes to ASTs, and then convert it to YaoIR. In conclusion, we can load circuits from QASM codes to `ZXDiagram`s via `YaoLang.jl`.
```julia
using YaoLang: YaoIR, is_pure_quantum
using ZXCalculus

src = """OPENQASM 2.0;
qreg q[3];
ccx q[0], q[1], q[2];
ccx q[0], q[1], q[2];
ccx q[1], q[0], q[2];
x q[0];
ccx q[1], q[0], q[2];
ccx q[2], q[1], q[0];
ccx q[2], q[1], q[0];
ccx q[1], q[0], q[2];
"""

ir = YaoIR(@__MODULE__, src, :qasm_circ)
ir.pure_quantum = is_pure_quantum(ir)

circ = ZXDiagram(ir)
tcount(circ)
pt_circ = phase_teleportation(circ)
tcount(pt_circ)
```
In this example, the T-count decreased from 49 to 7.

## Why ZXCalculus.jl?

There is a Python implementation of ZX-calculus, [`PyZX`](https://github.com/Quantomatic/pyzx). PyZX is a full-stack library for manipulating large-scale quantum circuits and ZX-diagrams. It provides many amazing features of visualization and supports different forms of quantum circuits including QASM, Quipper, and Quantomatic.

So why we developed `ZXCalculus.jl`? Let me explain the necessity. `ZXCalculus.jl` is not only a full-stack library for ZX-calculus but also one of circuit simplification engines for `YaoLang.jl`. Hence, the performance becomes significantly important. If we use `PyZX` as the ZX-calculus backend, the `YaoLang.jl` compiler may become much slower. And it will be complicated to maintain a package with two languages.

We benchmarked the phase teleportation algorithm on 40 circuits of various numbers of gates (from 57 to 91642). `ZXCalculus.jl` has 8x to 63x speed-up in these examples. In most examples, the T-count of optimized circuits produced by `ZXCalculus.jl` is the same as `PyZX`. However in 6 examples, `ZXCalculus.jl` has more T-count than `PyZX`. This may be caused by the different simplification strategies between `ZXCalculus.jl` and `PyZX`. 

Also, `YaoLang.jl` support hybrid quantum-classical programs. It is possible to optimize hybrid quantum-classical programs with `ZXCalculus.jl`.

## Summary and future works

During GSoC 2020, I mainly accomplished the following works.
- Representing and manipulating ZX-diagrams with high-performance
- Implementing two simplification algorithms based on ZX-calculus
- Adding visualization of ZX-diagrams to `YaoPlots.jl`
- Integrating `ZXCalculus.jl` with `YaoLang.jl`
- Adding support of OpenQASM to `YaoLang.jl`

There is still something to be polished. 
* Finding a better simplification strategy to get lower T-counts.
* Fully support of visualization of the `ZXGraph` (the plotting script may fail on some `ZXgraph` with phase gadgets)

Also, I will keep working on `YaoLang.jl` with Roger Luo to support more circuit simplification methods (template matching methods, Quon based methods, etc.). 

## Acknowledgement

I want to appreciate my mentors, Roger Luo, and Jinguo Liu. Without their help, I couldn't accomplish this project. `ZXCalculus.jl` is highly inspired by `PyZX`. Thank Aleks Kissinger and John van de Wetering, the authors of `PyZX`. They gave me useful advice on the phase teleportation algorithm and reviewed the benchmarks between `PyZX` and `ZXCalculus.jl`. Thank Google for holding the **Google Summer of Code**, which promotes the development of the open-source community.

[^1]: [Graph-theoretic Simplification of Quantum Circuits with the ZX-calculus](https://arxiv.org/abs/1902.03178)
[^2]: [Reducing T-count with the ZX-calculus](https://arxiv.org/abs/1903.10477)