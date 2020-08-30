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

In the past three months, I participated my first GSoC (Google Summer of Code) and working on the Julia package [`ZXCalculus.jl`](https://github.com/QuantumBFS/ZXCalculus.jl). In this blog post, I will briefly introduce my work during GSoC 2020.

## Quantum circuit simplification

[ZX-calculus](https://en.wikipedia.org/wiki/ZX-calculus) is a graphical language for representing quantum states and operations. ZX-calculus is also used for simplifying quantum circuits. Let me show you how we can use `ZXCalculus.jl` to do circuit simplification.

![](\assets\blog_res\ZX\circuit.png)
Suppose that we have a quantum circuit as above. We can define this circuit with [`YaoLang.jl`](https://github.com/QuantumBFS/YaoLang.jl) by using the macro `@device` easily.
```julia
julia> using YaoLang;

julia> @device function demo_circ()
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
demo_circ (generic circuit with 1 methods)

```
`YaoLang.jl` is a quantum compiler for hybrid quantum-classical programs that are very practical in the current NISQ (noisy intermediate-scale quantum) era. Moreover, `YaoLang.jl` is integrated with `ZXCalculus.jl`. For more details about `YaoLang.jl` and quantum compiling, please read [my second GSoC blog post](https://chenzhao44.github.io/2020/07/28/Quantum-Compiler/). 

If we want to simplify this circuit when compiling, just add an argument `optimizer = [opts...]` in the macro `@device`. Currently, there are only two optimizer, `:zx_clifford` for Clifford simplification [^1] and `:zx_teleport` for phase teleportation [^2]. For example, with `optimizer = [:zx_teleport]`, the compiler will call the phase teleportation algorithm [^2] in `ZXCalculus.jl` to simplify the circuit.
```julia
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
We can use the macro `@code_yao` to see the what circuit we have got. In this example, the gate number of the circuit has been decreased from 24 (`%5` to `%28`) to 20 (`%11` to `%30`).
```julia
julia> @code_yao demo_circ()
circuit demo_circ()
1:
  %1 = shift(5.497787143782138)
  %2 = Rx(0.7853981633974483)
  %3 = shift(4.71238898038469)
  %4 = %new%(##register#253)
  %5 = gate(%1, 1)
  %6 = gate(H, 1)
  %7 = gate(%2, 1)
  %8 = gate(H, 4)
  %9 = ctrl(Z, 4, 1)
  %10 = ctrl(X, 1, 4)
  %11 = gate(H, 1)
  %12 = gate(H, 4)
  %13 = gate(T, 1)
  %14 = gate(%3, 4)
  %15 = gate(X, 4)
  %16 = gate(H, 1)
  %17 = gate(S, 4)
  %18 = gate(X, 4)
  %19 = gate(S, 2)
  %20 = ctrl(X, 3, 2)
  %21 = gate(H, 2)
  %22 = ctrl(X, 3, 2)
  %23 = gate(T, 2)
  %24 = gate(S, 3)
  %25 = gate(H, 2)
  %26 = gate(H, 3)
  %27 = gate(S, 3)
  %28 = ctrl(X, 3, 2)
  return nothing

julia> @code_yao demo_circ_simp()
circuit demo_circ_simp()
1:
  %1 = YaoLang.shift(1.5707963267948966)
  %2 = YaoLang.shift(0.7853981633974483)
  %3 = YaoLang.Rx(0.7853981633974483)
  %4 = YaoLang.shift(1.5707963267948966)
  %5 = YaoLang.shift(4.71238898038469)
  %6 = YaoLang.shift(1.5707963267948966)
  %7 = YaoLang.Rx(3.141592653589793)
  %8 = YaoLang.shift(1.5707963267948966)
  %9 = YaoLang.Rx(3.141592653589793)
  %10 = %new%(##register#260)
  %11 = gate(H, 1)
  %12 = gate(%1, 2)
  %13 = ctrl(X, 3, 2)
  %14 = gate(H, 4)
  %15 = ctrl(Z, 1, 4)
  %16 = gate(H, 2)
  %17 = gate(%2, 2)
  %18 = ctrl(X, 3, 2)
  %19 = gate(%3, 1)
  %20 = ctrl(X, 1, 4)
  %21 = gate(H, 2)
  %22 = gate(%4, 3)
  %23 = gate(H, 4)
  %24 = gate(H, 3)
  %25 = gate(%5, 4)
  %26 = gate(%6, 3)
  %27 = gate(%7, 4)
  %28 = ctrl(X, 3, 2)
  %29 = gate(%8, 4)
  %30 = gate(%9, 4)
  return nothing

```

We can check whether these two circuits are equivalent. We can use [`YaoArrayRegister.jl`](https://github.com/QuantumBFS/YaoArrayRegister.jl) to convert them to matrices.
```julia
using YaoArrayRegister;

circ = demo_circ()
circ_teleport = demo_circ_simp()
n = 4;

mat = zeros(ComplexF64, 2^n, 2^n);
for i = 1:2^n
    st = zeros(ComplexF64, 2^n)
    st[i] = 1
    r0 = ArrayReg(st)
    r0 |> circ
    mat[:,i] = r0.state
end
mat_teleport = zeros(ComplexF64, 2^n, 2^n);
for i = 1:2^n
    st = zeros(ComplexF64, 2^n)
    st[i] = 1
    r0 = ArrayReg(st)
    r0 |> circ_teleport
    mat_teleport[:,i] = r0.state
end

mat_teleport = (mat[1,1]/mat_teleport[1,1]) .* mat_teleport; # fix the global phase difference
```
Then we can check whether two matrices are equivalent.
```julia
julia> mat ≈ mat_teleport
true

```

The above examples showed how `ZXCalculus.jl` works as a circuit simplification engine in `YaoLang.jl`. Now, let's open the black box for more details about `ZXCalculus.jl`.

## ZXCalculus.jl

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

## Read circuit from OpenQASM codes

[OpenQASM](https://en.wikipedia.org/wiki/OpenQASM) is a quantum instruction. OpenQASM codes can be run on IBM Q devices. And quantum circuits can be stored as OpenQASM codes. I used the Julia package [`RBNF.jl`](https://github.com/thautwarm/RBNF.jl) (a Julia parser that parses code to restricted [Backus-Naur form](https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_form)) to parse OpenQASM codes to ASTs, and then convert it to YaoIR, an intermediate representation for hybrid quantum-classical programs in `YaoLang.jl`. This makes it possible to read circuits from OpenQASM codes to `ZXCalculus.jl` via `YaoLang.jl`.

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
pt_circ = phase_teleportation(circ)
```
Here, we got a `ZXDiagram` from QASM codes. And we used the phase teleportation algorithm to simplify it. We can see that the T-count of the circuit decreased from 49 to 7.
```julia
julia> tcount(circ)
49

julia> tcount(pt_circ)
7
```

## Why ZXCalculus.jl?

There is a Python implementation of ZX-calculus, [`PyZX`](https://github.com/Quantomatic/pyzx). `PyZX` is a full-featured library for manipulating large-scale quantum circuits and ZX-diagrams. It provides many amazing features of visualization and supports different forms of quantum circuits including QASM, Quipper, and Quantomatic.

So why we developed `ZXCalculus.jl`? Let me explain the necessity. `ZXCalculus.jl` is not only a full-featured library for ZX-calculus but also one of circuit simplification engines for `YaoLang.jl`. Hence, the performance becomes significantly important. If we use `PyZX` as the ZX-calculus backend, the `YaoLang.jl` compiler may become much slower. And it will be complicated to maintain a package with two languages.

### Benchmarks

We benchmarked the phase teleportation algorithm on 40 circuits of various numbers of gates (from 57 to 91642). `ZXCalculus.jl` has 8x to 63x speed-up in these examples (the run time of `ZXCalculus.jl` is scaled to 1 for each circuit in this picture). These benchmarks are run on a laptop with Intel i7-10710U CPU and 16 GB RAM. 
![](\assets\blog_res\ZX\benchmarks.png "Time benchmarks")
In most examples, the T-count of optimized circuits produced by `ZXCalculus.jl` is the same as `PyZX`. However in 6 examples, `ZXCalculus.jl` has more T-count than `PyZX`. This may be caused by the different simplification strategies between `ZXCalculus.jl` and `PyZX`. We will keep investigating it in the future as mentioned in the next section.
![](\assets\blog_res\ZX\benchmarks t-count.png "T-count benchmarks")

Also, `YaoLang.jl` support hybrid quantum-classical programs. It is possible to optimize hybrid quantum-classical programs with `ZXCalculus.jl`.

## Summary and future works

During GSoC 2020, I mainly accomplished the following works.
- Representing and manipulating ZX-diagrams with high-performance.
- Implementing two simplification algorithms based on ZX-calculus.
- Adding visualization of ZX-diagrams to `YaoPlots.jl`.
- Integrating `ZXCalculus.jl` with `YaoLang.jl`.
- Adding support of OpenQASM to `YaoLang.jl`.

There is still something to be polished. 
* Finding a better simplification strategy to get lower T-counts.
* Fully support of visualization of the `ZXGraph` (the plotting script may fail on some `ZXGraph` with phase gadgets).
* Converting ZX-diagrams to tensor networks without `YaoLang.jl`.
* The conversion between the `YaoIR` and the `ZXDiagram` may cause the circuit different with a global phase. We should record this global phase in the later version.

Also, I will keep working on `YaoLang.jl` with Roger Luo to support more circuit simplification methods (template matching methods, Quon based methods, etc.). 

## Acknowledgement

I want to appreciate my mentors, Roger Luo, and Jinguo Liu. Without their help, I couldn't accomplish this project. `ZXCalculus.jl` is highly inspired by `PyZX`. Thank Aleks Kissinger and John van de Wetering, the authors of `PyZX`. They gave me useful advice on the phase teleportation algorithm and reviewed the benchmarks between `PyZX` and `ZXCalculus.jl`. Thank Google for holding the **Google Summer of Code**, which promotes the development of the open-source community.

[^1]: [Graph-theoretic Simplification of Quantum Circuits with the ZX-calculus](https://arxiv.org/abs/1902.03178)
[^2]: [Reducing T-count with the ZX-calculus](https://arxiv.org/abs/1903.10477)