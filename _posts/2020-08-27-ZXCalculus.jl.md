---
layout: post
title: GSoC 2020&#58; ZXCalculus.jl, ZX-calculus in Julia
description: A full-featured Julia package for ZX-calculus, and a circuit simplification engine for the Julia quantum compiler, YaoLang.jl.
author: Chen Zhao
tags:
- GSoC
- Quantum Compilation
- ZX-calculus
- Yao
- YaoLang
---

In the past three months, I participated my first GSoC (Google Summer of Code) and working on the Julia package [`ZXCalculus.jl`](https://github.com/QuantumBFS/ZXCalculus.jl). In this blog post, I will briefly introduce my work during GSoC 2020 in three parts, the first part is the high level interface of using ZXCalculus as a quantum circuit simplification pass in [YaoLang](https://github.com/QuantumBFS/YaoLang.jl). The second part is the lower level interface, and the thrid part is a benchmark with Python package [`PyZX`](https://github.com/Quantomatic/pyzx).

## ZXCalculus.jl as a quantum circuit simplification pass

[ZX-calculus](https://en.wikipedia.org/wiki/ZX-calculus) is a graphical language for representing quantum states and operations. ZX-calculus is also used for simplifying quantum circuits. Let me show you how we can use `ZXCalculus.jl` to do circuit simplification.

![](\assets\blog_res\ZX\circuit.png)
Suppose that we have a quantum circuit with 24 gates as above. We can define this circuit with [`YaoLang.jl`](https://github.com/QuantumBFS/YaoLang.jl) by using the macro `@device` easily. `YaoLang.jl` is a compiler for hybrid quantum-classical programs that are very practical in the current NISQ (noisy intermediate-scale quantum) era. Moreover, `YaoLang.jl` is integrated with `ZXCalculus.jl`. For more details about `YaoLang.jl` and quantum compilation, please read [my second GSoC blog post](https://chenzhao44.github.io/2020/07/28/Quantum-Compiler/).
```julia
julia> using YaoLang;

julia> @device optimizer = [:zx_teleport] function demo_circ_simp()
           1 => shift($(7π/4))
           1 => H
           1 => Rx($(π/4))
           4 => H
           @ctrl 1 4 => Z
           @ctrl 4 1 => X
           1 => H
           4 => H
           1 => T
           4 => shift($(3π/2))
           4 => X
           1 => H
           4 => S
           4 => X
           2 => S
           @ctrl 2 3 => X
           2 => H
           @ctrl 2 3 => X
           2 => T
           3 => S
           2 => H
           3 => H
           3 => S
           @ctrl 2 3 => X
       end
demo_circ_simp (generic circuit with 1 methods)

```
One can add an argument `optimizer = [opts...]` in the macro `@device` to simplify this circuit during compilation. Currently, there are only two optimization passes, `:zx_clifford` for Clifford simplification [^1] and `:zx_teleport` for phase teleportation [^2]. For example, with `optimizer = [:zx_teleport]`, the compiler will call the phase teleportation algorithm [^2] in `ZXCalculus.jl` to simplify the circuit.

We can use the macro `@code_yao` to see the what circuit we have got. In this example, the gate number of the circuit has been decreased from 24 to 20.
```julia
julia> using YaoLang.Compiler

julia> gate_count(demo_circ_simp)
Dict{Any,Any} with 8 entries:
  "YaoLang.Rx(3.141592653589793)"     => 2
  "YaoLang.H"                         => 6
  "YaoLang.Rx(0.7853981633974483)"    => 1
  "YaoLang.shift(4.71238898038469)"   => 1
  "YaoLang.shift(1.5707963267948966)" => 4
  "YaoLang.shift(0.7853981633974483)" => 1
  "@ctrl YaoLang.Z"                   => 1
  "@ctrl YaoLang.X"                   => 4

```

We can use [`YaoArrayRegister.jl`](https://github.com/QuantumBFS/YaoArrayRegister.jl) to apply this simplified circuit on a quantum state.
```julia
julia> using YaoArrayRegister;

julia> circ_teleport = demo_circ_simp()
demo_circ_simp (quantum circuit)

julia> r = rand_state(4);

julia> r |> circ_teleport
ArrayReg{1, Complex{Float64}, Array...}
    active qubits: 4/4

```

One can also load circuits from [OpenQASM](https://en.wikipedia.org/wiki/OpenQASM) codes. OpenQASM is a quantum instruction. OpenQASM codes can be run on IBM Q devices. And quantum circuits can be stored as OpenQASM codes. I used the Julia package [`RBNF.jl`](https://github.com/thautwarm/RBNF.jl) (a Julia parser that parses code to restricted [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form)) to parse OpenQASM codes to ASTs, and then convert it to YaoIR, an intermediate representation for hybrid quantum-classical programs in `YaoLang.jl`. This makes it possible to read circuits from OpenQASM codes to `ZXCalculus.jl` via `YaoLang.jl`.

```julia
using YaoLang: YaoIR, is_pure_quantum
using ZXCalculus

lines = readlines("gf2^8_mult.qasm")
src = prod([lines[1]; lines[3:end]])
ir = YaoIR(@__MODULE__, src, :qasm_circ)
ir.pure_quantum = is_pure_quantum(ir)
    
circ = ZXDiagram(ir)
pt_circ = phase_teleportation(circ)
```
Here, we got a load a circuit as a `ZXDiagram` from a `.qasm` file which can be found [here](https://github.com/QuantumBFS/ZXCalculus.jl/tree/master/benchmark/circuits). And we used the phase teleportation algorithm to simplify it. We can see that the T-count of the circuit decreased from 448 to 264.
```julia
julia> tcount(circ)
448

julia> tcount(pt_circ)
264

```

The above examples showed how `ZXCalculus.jl` works as a circuit simplification engine in `YaoLang.jl`. Now, let's see what's behind the scene.

## Low level interfaces of ZXCalculus

In ZX-calculus, we will deal with ZX-diagrams, multigraphs with some extra information. Each vertex of a ZX-diagram is called a spider. There are two types of spiders, the Z-spider and the Z-spider. Each spider is associated with a number called phase. By Dirac notation, the Z-spider and X-spider represent the following rank-2 matrices.
![](\assets\blog_res\ZX\spider.png "Definition of the Z-spider and the X-spider (from [^1])")

ZX-diagrams can be regarded as a special type of tensor network. On the other hand, quantum circuits can also be regarded as tensor networks. And quantum circuits can be converted to ZX-diagrams according to the following rules.
![](\assets\blog_res\ZX\QC_to_ZX.png "Conversion from quantum circuits to ZX-diagrams")
The yellow box, H-box, is just a simple notation of the following spiders in ZX-calculus.
![](\assets\blog_res\ZX\H-box.png "H-box from [^1]")
To represent general ZX-diagrams, we defined a struct `ZXDiagram` in `ZXCalculus.jl`. We can construct a ZX-diagram which represents an empty quantum circuit with `n` qubits by [`ZXDiagram(n)`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZX-diagrams). For example, if we want to simplify the above circuit with `ZXCalculus.jl` manually. We first construct a ZX-diagram of a 4-qubits circuit.
```julia
using ZXCalculus
zxd = ZXDiagram(4)
```
Then we can add some gates to the ZX-diagram we have just constructed. We can simply use [`push_gate!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.push_gate!) and [`push_ctrl_gate!`]((https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.push_ctrl_gate!)) to do that.
```julia
push_gate!(zxd, Val(:Z), 1, 7//4)
push_gate!(zxd, Val(:H), 1)
push_gate!(zxd, Val(:X), 1, 1//4)
push_gate!(zxd, Val(:H), 4)
push_ctrl_gate!(zxd, Val(:CZ), 4, 1)
push_ctrl_gate!(zxd, Val(:CNOT), 1, 4)
push_gate!(zxd, Val(:H), 1)
push_gate!(zxd, Val(:H), 4)
push_gate!(zxd, Val(:Z), 1, 1//4)
push_gate!(zxd, Val(:Z), 4, 3//2)
push_gate!(zxd, Val(:X), 4, 1//1)
push_gate!(zxd, Val(:H), 1)
push_gate!(zxd, Val(:Z), 4, 1//2)
push_gate!(zxd, Val(:X), 4, 1//1)
push_gate!(zxd, Val(:Z), 2, 1//2)
push_ctrl_gate!(zxd, Val(:CNOT), 3, 2)
push_gate!(zxd, Val(:H), 2)
push_ctrl_gate!(zxd, Val(:CNOT), 3, 2)
push_gate!(zxd, Val(:Z), 2, 1//4)
push_gate!(zxd, Val(:Z), 3, 1//2)
push_gate!(zxd, Val(:H), 2)
push_gate!(zxd, Val(:H), 3)
push_gate!(zxd, Val(:Z), 3, 1//2)
push_ctrl_gate!(zxd, Val(:CNOT), 3, 2)
```
Now, let's draw the ZX-diagram we have built up. The visualization tool of `ZXCalculus.jl` is currently provided in [`YaoPlots.jl`](https://github.com/QuantumBFS/YaoPlots.jl).
```julia
using YaoPlots
plot(zxd)
```
![](\assets\blog_res\ZX\zxd.svg "Original circuit")

We can use the algorithms [`clifford_simplification`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.clifford_simplification) [^1] and [`phase_teleportation`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.phase_teleportation) [^2] to simplify this circuit.
```julia
ex_zxd = clifford_simplification(zxd);
pt_zxd = phase_teleportation(zxd);
plot(ex_zxd)
plot(pt_zxd)
```
![](\assets\blog_res\ZX\ex_zxd.svg "Circuit after clifford_simplification")
![](\assets\blog_res\ZX\pt_zxd.svg "Circuit after phase_telefortation")

The phase teleportation algorithm can reduce the number of T-gates of a quantum circuit. We can use [`tcount`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.tcount-Tuple{AbstractZXDiagram}) to show the number of T-gates. In this example, the T-count decreased from 4 to 2.
```julia
julia> tcount(zxd)
4

julia> tcount(pt_zxd)
2

```

These algorithms are using the ZX-calculus rules to simplify ZX-diagrams. These rules define how ZX-diagrams are allowed to be transformed. Here are some basic rules for `ZXDiagram`s.
![](\assets\blog_res\ZX\rules.png "ZX-calculus rules from [^1]")
In the paper [^1], they defined a special type of ZX-diagram, the graph-like ZX-diagram. We use `ZXGraph` to represent it in `ZXCalculus.jl`. And here are some rules for `ZXGraph`s.
![](\assets\blog_res\ZX\zxgraph-rules.png "Rules for graph-like ZX-diagrams from [^1] and [^2]")
One may want to apply rules on a ZX-diagram manually. We provide different APIs for this.

The function [`match`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#Base.match) will match all available vertices on a ZX-diagram with a given rule. And we can use the function [`rewrite!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#ZXCalculus.rewrite!) to rewrite a ZX-diagram on some matched vertices. The [`replace!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#Base.replace!) function just match and rewrite on all matched vertices once. The [`simplify!`](https://yaoquantum.org/ZXCalculus.jl/dev/api/#Base.replace!) function will match and rewrite a ZX-diagram with a rule until no vertices can be matched.

In the `clifford_simplification`, we will first convert the given ZX-diagram to a graph-like ZX-diagram.
```julia
zxg = ZXGraph(zxd)
plot(zxg)
```
![](\assets\blog_res\ZX\zxg.svg "Graph-like ZX-diagram")
Then we simplify the graph-like ZX-diagram with rule `:lc`, `:p1`, and `:pab`.
```julia
simplify!(Rule{:lc}(), zxg)
simplify!(Rule{:p1}(), zxg)
replace!(Rule{:pab}(), zxg)
plot(zxg)
```
![](\assets\blog_res\ZX\simp_zxg.svg "Simplified graph-like ZX-diagram")
Finally, we extract a new circuit from the simplified graph-like ZX-diagram.
```julia
ex_circ = circuit_extraction(zxg)
plot(ex_circ)
```
![](\assets\blog_res\ZX\ex_zxd.svg "Extracted circuit")

## Why ZXCalculus.jl?

The above algorithms are first implemented in a Python package [`PyZX`](https://github.com/Quantomatic/pyzx). `PyZX` is a full-featured library for manipulating large-scale quantum circuits and ZX-diagrams. It provides many amazing features of visualization and supports different forms of quantum circuits including QASM, Quipper, and Quantomatic.

So why we developed `ZXCalculus.jl`? This is because `ZXCalculus.jl` is not only a full-featured library for ZX-calculus but also one of circuit simplification engines for `YaoLang.jl`. A light-weight native implementation of ZX-calculus is necessary since depending on a Python package will make the compiler slower and more complicated.

### Benchmarks

We benchmarked the phase teleportation algorithm on 40 circuits of various numbers of gates (from 57 to 91642). `ZXCalculus.jl` has 8x to 63x speed-up in these examples (the run time of `ZXCalculus.jl` is scaled to 1 for each circuit in this picture). These benchmarks are run on a laptop with Intel i7-10710U CPU and 16 GB RAM. The code for benchmarks could be found [here](https://github.com/Roger-luo/quantum-benchmarks).
![](\assets\blog_res\ZX\benchmarks.png "The wall clock time for optimizing the same circuit in ZXCalculus and PyZX. The run time of `ZXCalculus.jl` is scaled to 1 for each circuit.")
In most examples, the T-count of optimized circuits produced by `ZXCalculus.jl` is the same as `PyZX`. However in 6 examples, `ZXCalculus.jl` has more T-count than `PyZX`. This may be caused by the different simplification strategies between `ZXCalculus.jl` and `PyZX`. We will keep investigating it in the future as mentioned in the next section.
![](\assets\blog_res\ZX\benchmarks t-count.png "T-count benchmarks between ZXCalculus and PyZX. `TRUE` means the result of ZXCalculus matches PyZX, `FALSE` means the feeded circuit in ZXCalculus is not fully simplified, we will keep investigate this issue.")

Also, `YaoLang.jl` support hybrid quantum-classical programs. It is possible to optimize hybrid quantum-classical programs with `ZXCalculus.jl`.

## Summary and future works

During GSoC 2020, I mainly accomplished the following works.
- Representing and manipulating ZX-diagrams with high-performance.
- Implementing two simplification algorithms based on ZX-calculus.
- Adding visualization of ZX-diagrams to `YaoPlots.jl`.
- Integrating `ZXCalculus.jl` with `YaoLang.jl`.
- Adding support of OpenQASM to `YaoLang.jl`.

There is still something to be polished.
- Finding a better simplification strategy to get lower T-counts.
- Fully support of visualization of the `ZXGraph` (the plotting script may fail on some `ZXGraph` with phase gadgets).
- Converting ZX-diagrams to tensor networks without `YaoLang.jl`.
- The conversion between the `YaoIR` and the `ZXDiagram` may cause the circuit different with a global phase. We should record this global phase in the later version.

Also, I will keep working on `YaoLang.jl` with Roger Luo to support more circuit simplification methods (template matching methods, Quon based methods, etc.).

## Acknowledgement

I want to appreciate my mentors, Roger Luo, and Jinguo Liu. Without their help, I couldn't accomplish this project. `ZXCalculus.jl` is highly inspired by `PyZX`. Thank Aleks Kissinger and John van de Wetering, the authors of `PyZX`. They gave me useful advice on the phase teleportation algorithm and reviewed the benchmarks between `PyZX` and `ZXCalculus.jl`. Thank Google for holding the **Google Summer of Code**, which promotes the development of the open-source community.

[^1]: [Graph-theoretic Simplification of Quantum Circuits with the ZX-calculus](https://arxiv.org/abs/1902.03178)
[^2]: [Reducing T-count with the ZX-calculus](https://arxiv.org/abs/1903.10477)
