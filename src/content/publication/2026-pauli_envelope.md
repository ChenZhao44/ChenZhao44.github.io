---
title: "Achieving Optimal-Distance Atom-Loss Correction via Pauli Envelope"
description: "Atom loss is a major error source in neutral-atom quantum computers, accounting for over 40% of the total physical errors in recent experiments. Unlike Pauli errors, atom loss poses significant challenges for both syndrome extraction and decoding due to its nonlinearity and correlated nature. Current syndrome extraction circuits either require additional physical overhead or do not provide optimal loss tolerance. On the decoding side, existing methods are either computationally inefficient, achieve suboptimal logical error rates, or rely on machine learning without provable guarantees. To address these challenges, we propose the Pauli Envelope framework. This framework constructs a Pauli envelope that bounds the effect of atom loss while remaining low weight and efficiently computable. Guided by this framework, we first design a new atom-replenishing syndrome extraction circuit, the Mid-SWAP syndrome extraction, that reduces error propagation with no additional space-time cost. We then propose an optimal decoder for Mid-SWAP syndrome extraction: the Envelope-MLE decoder formulated as an MILP that achieves optimal effective code distance d_loss ~ d for atom-loss errors. Inspired by the exclusivity constraint of the optimal decoder, we also propose an Envelope-Matching decoder to approximately enforce the exclusivity constraint within the MWPM framework. This decoder achieves d_loss ~ 2d/3, surpassing the previous best algorithmic decoder, which achieves dloss ~ d/2 even with an MILP formulation. Circuit-level simulations demonstrate that our approach attains up to 40% higher thresholds and 30% higher effective distances compared with existing algorithmic decoders and syndrome extraction circuits in the loss-dominated regime. On recent experimental data, our Envelope-MLE decoder improves the error suppression factor of a hybrid MLE--machine-learning decoder from 2.14 to 2.24."
selectionPriority: 4.5
publishDate: "2026-03-04"
authors: "Pengyu Liu, Shi Jie Samuel Tan, Eric Huang, Umut A. Acar, Hengyun Zhou, and Chen Zhao"
correspondingAuthors:
  - Chen Zhao
paperURL: "PDF: https://arxiv.org/abs/2603.04156"
codeURL: ""
webURL: ""
img: "/figs/2026-pauli_envelope.png"
imgAlt: "Pauli Envelope"
pub: ""
dataURL: ""
---
