---
layout: post
title: GSoC 2020&#58; ZXCalculus.jl, quantum compiling and circuit simplification
description: Metaprogramming, quantum compiling, and circuit optimization in quantum compiling.
author: Chen Zhao
tags:
- GSoC
- Quantum Compiling
- ZX-calculus
- Yao
- YaoLang
---

In the past three months, I participated my first GSoC and working on the Julia package `ZXCalculus.jl`. I want to appreciate my mentors, Roger Luo, and Jinguo Liu. Without their help, I couldn't accomplish this project. They taught me a lot, not only in Julia programming but also in how to get communication with the open-source community and contribute to it. Now, let me briefly introduce my work during GSoC 2020.

## The landscape of quantum compiling

As the development of the quantum hardware, we have entered a new era, the NISQ (Noisy Intermediate-Scale Quantum) era. Now, it is possible to operate more than 50 qubits without error-correcting. It means that we can do something non-trivial on real quantum computers which is impossible on classical computers. Last year, Google's quantum supremacy experiment shows some quantum advantages.

However, 50 noisy qubits, even if logical qubits with error-correcting, are still too little for general purposed quantum computing. To get advantages from quantum hardware, people often use the hybrid quantum-classical computing scheme. That is, we move most computation to classical computers, and we only run the part that really needs quantum hardware on quantum computers. The famous VQE (Variational Quantum Eigensolver) used this scheme.

Also, classical control-flow can make it much more easier to construct large quantum circuits. Hybrid quantum-classical programs compiling will be useful if general purposed quantum computing has been achieved. Hence, the compiling of hybrid quantum-classical programs becomes a practical problem to be solved. `YaoLang.jl` is aimed to solve this problem.

The goal of `YaoLang.jl` is to construct a user-friendly quantum compiler for hybrid quantum-classical programs in Julia. That is by only using a few macros and add them to native Julia functions, one can define quantum programs. In `YaoLang.jl`, a function decorated with the macro @device will be regarded as a function with quantum operations. In these functions, macros `@ctrl`, `@measure`, `@expect` and "syntax sugar" `locs => gate` are available for defining quantum operations. For example, this represents a quantum program for quantum Fourier transformation.
```julia
@device function qft(n::Int)
    1 => H
    for k in 2:n
        @ctrl k 1 => shift(2π / 2^k)
    end

    if n > 1
        2:n => qft(n - 1)
    end
end
```

It accepts an integer `n` and returns a [quantum circuit](https://en.wikipedia.org/wiki/Quantum_circuit) (the quantum analog of the logical circuit which describes quantum algorithms). The first line `1 => H` is a line of quantum codes, which means apply the H (Hadamard gate) on the first qubit. And `@ctrl k 1 => shift(2π / 2^k)` means take the k-th qubit as a control qubit to determine whether the shift gate is applied on the first qubit.

`YaoLang.jl` will compile these hybrid codes to an intermediate representation, the `YaoIR`. `YaoIR` will record which part of the hybrid program is quantum. And we can optimize the codes in `YaoIR`, then converting them to instructions that can be run on real quantum devices (e.g. IBM Q, etc.) or quantum simulators (e.g. `YaoBlocks.jl` etc.).
![](\assets\blog_res\ZX\Quantum_Compiling.png)

As demonstrated by the above picture, `ZXCalculus.jl` is aimed to simplify quantum circuits in the compiling routine. 

## ZXCalculus.jl

[ZX-calculus](https://en.wikipedia.org/wiki/ZX-calculus) is a graphical language for representing quantum states and operations. In ZX-calculus, we will deal with ZX-diagrams, multigraphs with some extra information. Each vertex of a ZX-diagram is called a spider. There are two types of spiders, the Z-spider and the Z-spider. Each spider is associated with a number called phase. By Dirac notation, the Z-spider and X-spider represent the following rank-2 matrices.
![](\assets\blog_res\ZX\spider.png)

To represent ZX-diagrams in Julia, I implement a high-performance multigraph backend in Julia. 
```julia
mutable struct Multigraph{T<:Integer}
    adjlist::Dict{T, Vector{T}}
    _idmax::T
    ...
end
```
The multigraph is stored as the adjacency list. Each vertex has its unique id, and its neighbors are stored as a sorted vector of ids. The `_idmax` records the maximum vertex id, which is needed when adding new vertices into a multigraph.

The struct `ZXDiagram` is for representing general ZX-diagrams.
```julia
struct ZXDiagram{T<:Integer, P} <: AbstractZXDiagram{T, P}
    mg::Multigraph{T}

    st::Dict{T, SpiderType.SType}
    ps::Dict{T, P}

    layout::ZXLayout{T}
    phase_ids::Dict{T, Tuple{T, Int}}
    _inputs::Vector{T}
    _outputs::Vector{T}
    ...
end
```
The `mg` is the multigraph backend of the ZX-diagram. The `st` and `ps` record the spider type and the phase for each vertex. As we will mainly focus on ZX-diagrams that represent quantum circuits, the `layout` is for recording the corresponding qubit of each spider. And `_inputs` and `_outputs` record the location of inputs and outputs of the quantum circuit. The `phase_ids` stores the information that is needed in the phase teleportation algorithm.

ZX-calculus rules defined how ZX-diagrams are allowed to be transformed. Here are some basic rules. 
![](\assets\blog_res\ZX\rules.png)
To apply these rules on ZX-diagrams, one need to match available spiders and rewrite them.
```julia
match(::Rule{r}, zxd::ZXDiagram{T, P}) where {r, T, P}
rewrite!(::Rule{r}, zxd::ZXDiagram{T, P}, vs::Vector{T}) where {r, T, P}
```
Here, I used the Julia holy trait trick of multiple dispatch for different rules. And `r` can be one of `:f`, `:h`, `:i1`, `:i2`, `:c`, `:b`. The `match` function will return all available spiders of a rule `Rule{r}()`. The `rewrite!` function will rewrite the ZX-diagram `zxd` on the spiders `vs` with rule `Rule{r}()`. 



## Circuit simplification with ZX-calculus

To simplify quantum circuits with ZX-calculus, we will convert quantum circuits to ZX-diagrams first. A quantum circuit is composed of a set of basic gates. Each basic gate can be converted to a ZX-diagram with the following rule.
![](\assets\blog_res\ZX\QC_to_ZX.png)
Then we can simplify a ZX-diagram with the ZX-calculus rules. Finally, we need to extract a simplified circuit from simplified ZX-diagrams.

In `ZXCalculus.jl`, we implemented two simplification algorithms, the [circuit extraction](https://arxiv.org/abs/1902.03178) algorithm for simplifying Clifford circuits and [phase teleportation](https://arxiv.org/abs/1903.10477) algorithm for reducing T-count. In these algorithms, we will deal with a special type of ZX-diagram, graph-like ZX-diagram. A graph-like ZX-diagram has only Z-spiders and they are connected with H-boxes. We defined `ZXGraph` for the graph-like ZX-diagram. 
```julia
struct ZXGraph{T<:Integer, P} <: AbstractZXDiagram{T, P}
    mg::Multigraph{T}
    ps::Dict{T, P}
    st::Dict{T, SpiderType.SType}
    et::Dict{Tuple{T, T}, EdgeType.EType}
    layout::ZXLayout{T}
    phase_ids::Dict{T,Tuple{T, Int}}
    master::ZXDiagram{T, P}
end
```

## Integration of ZXCalculus.jl with YaoLang.jl

For more details about the integration, please check the [last blog post](https://chenzhao44.github.io/2020/07/28/Quantum-Compiler/). Julia will parse Julia codes to ASTs (abstract syntax trees). In `YaoLang.jl`, the macro `@device` will convert the quantum part of the AST to function calls marked as quantum. Then convert the AST to SSA (single static assignment) form. The codes in `YaoIR` are in SSA form, and we extract the quantum parts as quantum circuits. These quantum circuits can be optimized with `ZXCalculus.jl`. We implemented the conversion between the `ZXDiagram` and the quantum circuit in SSA form in `YaoLang.jl`

## Loading OpenQASM codes

[OpenQASM](https://en.wikipedia.org/wiki/OpenQASM) is a quantum instruction. OpenQASM codes can be run on IBM Q devices. And quantum circuits can be stored as OpenQASM codes. Hence, a conversion between `YaoIR` and OpenQASM codes. We use the Julia package [`RBNF.jl`](https://github.com/thautwarm/RBNF.jl) to parse OpenQASM codes to ASTs, and then convert it to YaoIR.

With this conversion, we can try `ZXCalculus.jl` on larger circuits.

## Benchmark

There is a Python implementation of ZX-calculus, [`PyZX`](https://github.com/Quantomatic/pyzx). PyZX is a full-stack library for manipulating large-scale quantum circuits and ZX-diagrams. It provides many amazing features of visualization and supports different forms of quantum circuits including QASM, Quipper, and Quantomatic. 

Because we need a high-performance backend for ZX-calculus, we implemented `ZXCalculus.jl`. We benchmarked the phase teleportation algorithm on 40 circuits of various numbers of gates (from 57 to 91642). `ZXCalculus.jl` has 8x to 63x speed-up in these examples. In most examples, the T-count of optimized circuits produced by `ZXCalculus.jl` is the same as `PyZX`. However in 6 examples, `ZXCalculus.jl` has more T-count than `PyZX`. This may be caused by the different simplification strategies between `ZXCalculus.jl` and `PyZX`. 

## Summary and future works

During GSoC 2020, I mainly accomplished the following works.
* Representing and manipulating ZX-diagrams with high-performance
* Implementing two simplification algorithms based on ZX-calculus
* Adding visualization of ZX-diagrams to `YaoPlots.jl`
* Integrating `ZXCalculus.jl` with `YaoLang.jl`
* Adding support of OpenQASM to `YaoLang.jl`

There is still something to be polished. 
* Finding a better simplification strategy to get lower T-counts.
* Fully support of visualization of the `ZXGraph` (the plotting script may fail on some `ZXgraph` with phase gadgets)

Also, I will keep working on `YaoLang.jl` with Roger Luo to support more circuit simplification methods (template matching methods, Quon based methods, etc.). 