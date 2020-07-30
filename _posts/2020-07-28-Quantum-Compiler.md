---
layout: post
title: GSoC 2020&#58; The integration of ZX-calculus with the quantum compiler
description: Metaprogramming, quantum compiling, and circuit optimization in quantum compiling.
author: Chen Zhao
tags:
- GSoC
- Quantum Compiling
- ZX-calculus
---

In the last month, I was mainly working on the integration with `YaoLang.jl` for `ZXCalculus.jl`. It was my first time to work on Julia metaprogramming in practice. I want to appreciate my mentor Roger Luo for teaching me basic notions and useful methods about metaprogramming.

According to [Wikipedia](https://en.wikipedia.org/wiki/Metaprogramming), *metaprogramming is a programming technique in which computer programs have the ability to treat other programs as their data.* To understand metaprogramming in Julia, it's necessary to know how Julia compiler works.


## How Julia works

All Julia codes are essential `Strings` which are stored in disks. When we run Julia codes, Julia will first parse these code into [ASTs (abstract syntax trees)](https://en.wikipedia.org/wiki/Abstract_syntax_tree). The AST will be stored as expressions in the data structure `Expr` in Julia. On this parsing level, we call these expressions surface-level IR (intermediate representation).
```julia
julia> s = "1 + 1 * 2"
"1 + 1 * 2"

julia> ex = Meta.parse(s)
:(1 + 1 * 2)

julia> dump(ex)
Expr
  head: Symbol call
  args: Array{Any}((3,))
    1: Symbol +
    2: Int64 1
    3: Expr
      head: Symbol call
      args: Array{Any}((3,))
        1: Symbol *
        2: Int64 1
        3: Int64 2
```
In this example, `ex` is an AST. Its `head` is `:call` which means it is a function call. It calls the function `+` with arguments `1` and another `Expr`.

Then the next level is lowering. On this level, macros will be expanded and Julia's "syntactic sugar" will be transformed into function calls. For example, `a[i]` will be replaced with `getindex(a, i)`. After a series of transformations, the surface-level IR will be transformed into [SSA (static single assignment)](https://en.wikipedia.org/wiki/Static_single_assignment_form) IR also called "lowered" IR. In the SSA IR, each variable can be assigned only once. In Julia, we can use the macro `@code_lowed` to see the SSA IR of an `Expr`.
```julia
julia> @code_lowered 2 + 3
CodeInfo(
1 ─ %1 = Base.add_int(x, y)
└──      return %1
)
```

Julia will do type inference on SSA IR and optimize it. And then transform it into [LLVM](https://en.wikipedia.org/wiki/LLVM) codes. We can use macros `@code_typed` and `@code_llvm` to see these IRs.
```julia
julia> @code_typed 2 + 3
CodeInfo(
1 ─ %1 = Base.add_int(x, y)::Int64
└──      return %1
) => Int64

julia> @code_llvm 2 + 3

;  @ int.jl:53 within `+'
; Function Attrs: uwtable
define i64 @"julia_+_15307"(i64, i64) #0 {
top:
  %2 = add i64 %1, %0
  ret i64 %2
}
```

Finally, LLVM will transform these codes into native machine codes.
```julia
julia> @code_native 2 + 3
        .text
; ┌ @ int.jl:53 within `+'
        pushq   %rbp
        movq    %rsp, %rbp
        leaq    (%rcx,%rdx), %rax
        popq    %rbp
        retq
        nopw    (%rax,%rax)
; └
```
Here is a picture from JuliaCon 2018 that demonstrates how Julia compiler works.
![](\assets\blog_res\ZX\Julia_Compiling.png)

## How YaoLang.jl works

The goal of `YaoLang.jl` is to construct a user-friendly quantum compiler for hybrid quantum-classical programs in Julia. That is by only using a few macros and add them to native Julia functions, one can define quantum programs. In `YaoLang.jl`, a function decorated with the macro @device will be regarded as a function with quantum operations. In these functions, macros `@ctrl`, `@measure`, `@expect` and "syntax sugar" `locs => gate` are available for defining quantum operations. For example, this represents a circuit for quantum Fourier transformation of `n` qubits.
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

Similar to the compiling procedures of Julia, the macro @device will parse a function into a surface-level IR in `YaoLang.jl`. Then, all macros and syntax sugar for quantum operators will be replaced by function calls. These function calls will be marked with the label `:quantum`. Now the surface-level IR will be transformed into lowered SSA IR. In `YaoLang.jl`, the SSA IR will be stored in the data structure `YaoIR`.

The remaining parts are optimization of `YaoIR` and transformation from `YaoIR` to hardware-level codes. `ZXCalculus.jl` is for quantum circuit optimization and should be integrated on the optimization level.


## Integration of ZXCalculus.jl

Now, we only consider pure quantum programs. Once we get a `YaoIR`, to optimize the quantum circuit, all we need to do is the following steps.
1. Convert it into a ZX-diagram
2. Simplify the ZX-diagram with `ZXCalculus.jl`
3. Convert the simplified ZX-diagram back to `YaoIR`

The second step is already implemented in `ZXCalculus.jl`. We only need to implement the conversion between the `ZXDiagram` and the `YaoIR`.

### YaoIR to ZXDiagram

As each `YaoIR` is an SSA, we can traverse all statements to get information about gates and its location. We can regard the largest location as the number of qubits. To construct the corresponding ZX-diagram, we can construct an empty circuit and push gates into it sequentially when traversing the `YaoIR`. And the code is like
```julia
function ZXDiagram(ir::YaoIR)
    if ir.pure_quantum
        n = count_nqubits(ir)
        circ = ZXDiagram(n)
        stmts = ir.body.blocks[].stmts
        for stmt in stmts
            # push gates
        end
        return circ
    end
end
```

As the parameterization of ZX-diagrams and quantum circuits may be different up to a global phase, the ZX-diagram we get may be different up to a global phase. The information on the global phase should be recorded.

### ZXDiagram to YaoIR

We assume that we get a `ZXDiagram` representing a quantum circuit. To transform it into a `YaoIR`, we need to extract the sequence of quantum gates in the `ZXDiagram`.

This can be extracted from the layout information of the `ZXDiagram`. From the layout, we can know how the spiders sorted from input to output and the location of qubits for each spider. If a spider is of degree 2, it represents a single-qubit gate. Otherwise, it represents a multi-qubits gate. By traverse all spiders from input to output, we can get a sequence of quantum gates. And then we can construct a new YaoIR with the sequence.

### Optimization options

There are multiple circuit simplification methods in `ZXCalculus.jl`. And we propose to implement other simplification methods that are not based on ZX-calculus. It is necessary to allow the user to choose which optimization methods will be applied.

We added these options in the macro `@device`. The optimization options can be set as
```julia
@device optimizer = [opt...] function my_circuit(args...)
    ...
end
```
The `optimizer` can be a subset of `[:zx_clifford, zx_teleport]`. And we will add more methods in the future.


## Examples

By now, `ZXCalculus.jl` has been integrated with `YaoLang.jl`. We can use `YaoLang.jl` to check the correctness of algorithms in `ZXCalculus.jl`. This example is an arithmetic circuit.

We first define two circuits. One is the original circuit, the other is optimized.
```julia
using YaoLang

@device function test_cir()
    5 => H
    5 => shift(0.0)
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    5 => shift($(1/4*π))
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    4 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 1 4 => X
    4 => shift($(7/4*π))
    1 => shift($(1/4*π))
    @ctrl 1 4 => X
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 3 5 => X
    5 => shift($(1/4*π))
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 3 5 => X
    4 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 3 4 => X
    4 => shift($(7/4*π))
    5 => H
    3 => shift($(1/4*π))
    @ctrl 3 4 => X
    5 => shift(0.0)
    @ctrl 4 5 => X
    5 => H
    5 => shift(0.0)
    @ctrl 3 5 => X
    5 => shift($(7/4*π))
    @ctrl 2 5 => X
    5 => shift($(1/4*π))
    @ctrl 3 5 => X
    5 => shift($(7/4*π))
    @ctrl 2 5 => X
    3 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 2 3 => X
    3 => shift($(7/4*π))
    5 => H
    2 => shift($(1/4*π))
    @ctrl 2 3 => X
    5 => shift(0.0)
    @ctrl 3 5 => X
    5 => H
    5 => shift(0.0)
    @ctrl 2 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    5 => shift($(1/4*π))
    @ctrl 2 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    2 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 1 2 => X
    2 => shift($(7/4*π))
    5 => H
    1 => shift($(1/4*π))
    @ctrl 1 2 => X
    5 => shift(0.0)
    @ctrl 2 5 => X
    @ctrl 1 5 => X
end
cir = test_cir()

@device optimizer = [:zx_teleport] function teleport_cir()
    5 => H
    5 => shift(0.0)
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    5 => shift($(1/4*π))
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    4 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 1 4 => X
    4 => shift($(7/4*π))
    1 => shift($(1/4*π))
    @ctrl 1 4 => X
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 3 5 => X
    5 => shift($(1/4*π))
    @ctrl 4 5 => X
    5 => shift($(7/4*π))
    @ctrl 3 5 => X
    4 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 3 4 => X
    4 => shift($(7/4*π))
    5 => H
    3 => shift($(1/4*π))
    @ctrl 3 4 => X
    5 => shift(0.0)
    @ctrl 4 5 => X
    5 => H
    5 => shift(0.0)
    @ctrl 3 5 => X
    5 => shift($(7/4*π))
    @ctrl 2 5 => X
    5 => shift($(1/4*π))
    @ctrl 3 5 => X
    5 => shift($(7/4*π))
    @ctrl 2 5 => X
    3 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 2 3 => X
    3 => shift($(7/4*π))
    5 => H
    2 => shift($(1/4*π))
    @ctrl 2 3 => X
    5 => shift(0.0)
    @ctrl 3 5 => X
    5 => H
    5 => shift(0.0)
    @ctrl 2 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    5 => shift($(1/4*π))
    @ctrl 2 5 => X
    5 => shift($(7/4*π))
    @ctrl 1 5 => X
    2 => shift($(1/4*π))
    5 => shift($(1/4*π))
    @ctrl 1 2 => X
    2 => shift($(7/4*π))
    5 => H
    1 => shift($(1/4*π))
    @ctrl 1 2 => X
    5 => shift(0.0)
    @ctrl 2 5 => X
    @ctrl 1 5 => X
end
tp_cir = teleport_cir()
```
By using the package [`YaoArrayRegister.jl`](https://github.com/QuantumBFS/YaoArrayRegister.jl), we can compute the matrix for each circuit.
```julia
using YaoArrayRegister

mat = zeros(ComplexF64, 32, 32)
for i = 1:32
    st = zeros(ComplexF64, 32)
    st[i] = 1
    r0 = ArrayReg(st)
    r0 |> cir
    mat[:,i] = r0.state
end

tp_mat = zeros(ComplexF64, 32, 32)
for i = 1:32
    st = zeros(ComplexF64, 32)
    st[i] = 1
    r1 = ArrayReg(st)
    r1 |> tp_cir
    tp_mat[:,i] = r1.state
end
```
Comparing these two matrices, we can see that they are the same matrices. Hence, the algorithm returns an equivalent simplified circuit.
```julia
sum(abs.(mat - tp_mat) .> 1e-14) == 0
```


## Summary

During the second coding phase, I implemented the conversion between the `ZXDiagram` and the `YaoIR`, which ensures the integration of `ZXCalculus.jl` with `YaoLang.jl`. Also, the documentation is now available [here](https://yaoquantum.org/ZXCalculus.jl/dev/). And during the test of `ZXCalculus.jl` with `YaoLang.jl` and `YaoArrayRegister.jl`, I find a few bugs in the implementation of circuit extraction and phase teleportation. These bugs have been fixed by now.

In the next phase, I will work on compiling OpenQASM codes into `YaoIR`s. It will enable us to read circuits from OpenQASM code. And I will test the performance of `ZXCalculus.jl` on some benchmark circuits and compare it with `PyZX`.
