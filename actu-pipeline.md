# ACTU: shared numerator and denominator paths

This source-derived functional diagram appears before the ACTU software example,
execution timeline and measured trace. The mode buttons select numerical result
dependencies. Muting a path does not claim clock gating, and the two halves are
not two pipeline cycles. The default core has PIPE_STAGES=27; this diagram groups
transport, valid/classification and post-arithmetic registers.

## Front half: prepare the numerator and divisor

`src/edge-asic/rtl/actu/rtl/edge_actu_exp_ingress.v` prepares the EXP operand.
Sigmoid and SiLU use exp(−|x|); tanh uses exp(−2|x|). Softmax mode 5 subtracts
the supplied row maximum before EXP. EXP mode 0 uses x directly.

`edge_actu_exp_frontend.v` forms 1+e and 1−e, selecting an aligned primary
numerator, divisor and original payload. Sigmoid/SiLU select e for negative x
and 1 otherwise. Tanh selects 1−e, with the original sign carried to the end.
The slide identities are mathematical explanations; the diagram uses these
stable magnitude-based RTL forms.

## Back half: denominator inverse and composition

`edge_actu_rcp_backend.v` registers the frontend packet, runs the shared
reciprocal/reciprocal-square-root pipe and aligns numerator, payload and classes.
`edge_actu_finalizer.v` multiplies N by reciprocal(D) for fused modes. SiLU adds
a second multiply by x. Tanh restores the sign. Direct EXP and reciprocal modes
select aligned results instead of the quotient product. Output is rounded to
BF16; internal arithmetic is BF22 with a carried BF19 payload.

RCP mode 1 uses D=x. RSQRT mode 6 uses x+epsilon in its non-negative numerical
domain. Input actions and exceptional-value handling are separate from this
finite numerical-path explanation; consult `edge_actu.v` for those semantics.

## Softmax is two passes

1. Mode 5 computes e_i=exp(x_i−m), writes BF16 exponentials and separately reduces
   S=sum(e_i). The reducer is `edge_actu_softmax_rsum`, instantiated in
   `src/edge-asic/rtl/actu/edge_actu.v`.
2. After `edge_actu_sync()`, software reads `edge_actu_get_exp_sum()`, configures
   mode 7, supplies S with `edge_actu_setscalar()`, and starts normalization over
   the stored exponentials. Mode 7 selects the input payload as the multiply
   numerator and the scalar sum as divisor. It bypasses the EXP result.

The max is supplied, not reduced in this ACTU diagram. Sum publication and a
later software-controlled start are not a same-pass arithmetic feedback wire.
Mode 7 takes scalar bits [31:10] (BF22); the stored exponential input is BF16.
This describes implementation precision, not an exact real-number Softmax claim.

## Software example and evidence

The adjacent literal excerpt comes from `example/fork_join/fork_join.cpp`, lines
21–31: configure BF16 sigmoid, submit 4,096 elements, execute 32 scalar increments,
and join. The full example checks all outputs against sigmoid(0)=0.5. The existing
measured ACTU trace below is unchanged; the mode diagram adds no cycle measurement.

`actu-pipeline.js` owns mode/path metadata, inline SVG styling and RTL anchors.
`actu-view.js` renders the buttons, formula cards, paired Softmax navigation and
source excerpt. The `actu` query parameter preserves the chosen mode in copied
URLs. The PNG link follows the selected mode, including all eight mode exports.
Run `node docs/architecture-renderer/verify.mjs` for source-drift and wiring checks.

## Separate numerator and divisor selectors

The frontend now draws `1 − e`, `1 + e` and `x + epsilon` as distinct arithmetic
blocks, followed by independent N and D muxes. Sigmoid/SiLU illuminate the
constant-1/direct-e N inputs and the 1+e D input. Tanh illuminates 1−e and 1+e.
RCP routes x directly to D; RSQRT routes x+epsilon. Normalization routes the stored
input to N and scalar S to D. EXP-only and Softmax pass 1 use the direct EXP path.
The N mux includes the finalizer's normalize-payload selection as a functional
group; it does not assert that every N choice is physically inside the frontend.

## Separate post-arithmetic and conversion

After N×r, mode 3 routes through a dedicated SiLU ×x block; mode 4 routes through
a sign-restore block. Modes 2 and 7 select N×r directly. EXP/Softmax pass 1 select
the aligned EXP value, while RCP/RSQRT select r directly. Each selected candidate
then enters the common BF16 conversion/output-policy block. This functional result
mux groups the finalizer's distributed bypass selections; it is not an additional
RTL pipeline stage. The blue ×x and sign rails can be highlighted independently.
The row-sum branch remains before the BF16 output conversion and is not normalized
inside the first Softmax pass.
