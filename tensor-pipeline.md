# Tensor pipeline: slide concepts checked against source

The architecture diagram is the first content in the atlas. The Tensor
mechanism chapter follows it, before the source walkthrough and trace.
All new page text and diagram labels are English.

## Relevant slides

Read from local `~/slides/Chapter2/slides.mjs` and
`~/slides/Chapter3/slides.mjs`, including notes, source audits and the rendered
combined deck. Numbers below follow its current combined-deck manifest.
The decks are reference material; they were not modified or copied into this
repository.

| Chapter / combined pages | Topic | Used in the atlas |
| --- | --- | --- |
| 2 / 31–34 | Tensor unit, tiled accumulation, partial sums, logical I/O/P streams | One 8×8 weight tile applied to multiple vectors; output-to-partial-sum feedback |
| 2 / 36–37 | Circular slots and producer/consumer blocking | DMA reservation, completed-entry visibility and consumer readiness |
| 2 / 41–42 | DMA tile order versus WLD tile transpose | Separate global layout from local load direction |
| 2 / 44 | Weight A/B buffering | Active, filling and pending activation are distinct ownership states |
| 2 / 45 | Full SRAM-to-compute-to-output datapath | Original source-derived diagram, including optional scale |
| 2 / 46 | Scalar / DMA-WLD / Tensor overlap | Logical scheduling illustration, not fixed cycles or measured utilization |
| 3 / 49–53 | GEMM tiling and replacing inner loops with Tensor work | W[16×24] × X[24×8] = Y[16×8]: six weight tiles, eight vectors per start |
| 3 / 54 | Scalar prepares job N+1 while Tensor runs N | Descriptor capture, readiness and bounded lookahead |

## Follow one job

1. **Describe.** Scalar configures pointers, count and mode. The Tensor owner
   snapshots accepted work into direct, queued or weight-waiting state.
   Acceptance is not the same event as compute launch.
2. **Feed SRAM.** Strided DMA arranges source fragments into circular slots.
   Full uses reserved-versus-consumed capacity; empty uses produced-versus-
   consumed entries. WLD requires a complete readable entry and matching slot
   size. The consumer-completion path returns the slot credit.
3. **Prepare local weights.** WLD/WLD-T stage the packed tile. Dot-local
   ingress promotes its transport format into BF16 weight cells and fills
   the inactive physical bank. Active/pending bits prevent overwriting a
   tile still owned by current or younger accepted work.
4. **Issue a vector.** Input responses enter an indexed window. Compute
   admission requires valid data, required scale/psum conditions and output
   launch credit. Eight dot kernels each reduce eight products. This is the
   arithmetic meaning of an 8×8 tile, not a literal systolic topology.
5. **Join arithmetic and output state.** Optional scale precedes the P add.
   P may be zero, one reused vector or a stream. Output data retains its
   address/format while the output queue waits for physical write service.
6. **Handoff and drain.** A younger descriptor may take over after the engine
   handoff condition while old result writes drain with their metadata.
   Final completion additionally waits for queued results and the write tail.
   Tensor sync includes pending starts and Tensor-owned WLD/SLD work; DMA
   remains separately joined.

## Implementation anchors

The interactive phase inspector links directly to these source owners. Its
model records a source token and exact anchor line so the verifier detects
drift.

| Mechanism | Source and signal |
| --- | --- |
| Start admission / captured ownership | `src/edge-e3/edge_tensor_unit/edge_tensor_unit.v`: `start_accept`, `start_wait_accept`, `start_pending_q`, `queued_start_valid_q`, `engine_start` |
| Tensor drain scope | Same file: `tensor_sync_stall` |
| Circular reservation / publication / consume | `src/edge-e3/edge_core/rtl/edge_accel_data_ctrl.v`: `circular_ring_full`, `circular_ring_empty`, `circular_reserved_entries_q`, `circular_produced_entries_q`, `circular_consumed_entries_q` |
| Weight ownership | `src/edge-e3/edge_tensor_unit/rtl/edge_tensor_weight_banks.v`: active/fill/pending bank state and `weight_start_ready_o` |
| Packed ingress | `src/edge-e3/edge_tensor_unit/rtl/weight/edge_tensor_weights.v`: `edge_wld_fixed_group_buffer` and eight dot-local banks |
| Local transport promotion and A/B cells | `src/edge-e3/edge_tensor_unit/rtl/compute/edge_dot8_weight_bank.v` |
| Compute input / response windows | `src/edge-e3/edge_tensor_unit/rtl/edge_tensor_engine.v`: `input_compute_fire`, `output_launch_credit` and input/psum validity |
| Eight-dot arithmetic | `src/edge-e3/edge_tensor_unit/rtl/edge_tensor_datapath.v`: eight `edge_dot_kernel` instances |
| Scale and P join | `src/edge-e3/edge_tensor_unit/rtl/compute/edge_tensor_scale_psum8.v` |
| Handoff versus final write drain | `src/edge-e3/edge_tensor_unit/rtl/edge_tensor_engine.v`: `handoff_ready_next`, `drain_done_next` |
| Current runtime modes | `src/edge-nnc/cpp/libnn/matmul.hpp` and `src/edge-32/include/edge32_intrinsic.hpp` |

## Differences from the older slide snapshots

- The eight-channel butterfly illustration is not a bank-level netlist for
  the current product. The product-default wide-H4 engine checks for sixteen
  64-bit banks and four-edge SRAM read latency; it includes response windows,
  bank-conflict handling and write-tail lifetime checks. I/P/O/WLD/DMA are
  logical stream roles, not five dedicated physical SRAM ports.
- The current Edge32 composition uses its public dispatch/ownership path.
  Do not infer that the older `edge_accel_cmd_queue` slide excerpt is an
  instantiated queue in that path. Pending and queued Tensor descriptors
  are visible in the maintained Tensor owner itself.
- The historical `cpp/libnn/matmul.hpp` path now corresponds to
  `src/edge-nnc/cpp/libnn/matmul.hpp`. The maintained BF16 tile runtime has
  FIRST_TILE / PSUM_TILE / LAST_TILE / SINGLE_TILE modes. Intermediate
  results use 32-bit partial-sum storage; final output is BF16. Storage width
  does not assert full IEEE FP32 arithmetic precision inside the dot kernel.
- The standalone 64×64 example in the atlas walkthrough uses explicit
  zero/partial-sum pointers. Its simpler sequence is separate from the NNC
  runtime mode table.
- The slide's utilization number is not imported as a new measurement.
  The overlap view is illustrative; no fixed initiation interval, zero-bubble
  guarantee or new Tensor timing result is claimed.
- The measured trace section now has separate ACTU and existing-matmul
  workloads. Select Tensor to inspect real DMA/WLD/A-B/compute/write overlap;
  the mechanism diagram itself remains a source-derived functional view.

## Validation

```sh
node --check docs/architecture-renderer/tensor-pipeline.js
node --check docs/architecture-renderer/tensor-view.js
node docs/architecture-renderer/verify.mjs
```

The mechanism chapter is documentation and rendering. The separately added
Tensor trace uses optional testbench observation of the unchanged existing
matmul example; see [the trace guide](https://github.com/exeex/edge-cores/blob/03f7c980cfbcff4ef101f756281c3d1baa8f4840/example/tensor/TRACE.md).

## Configuration path explorer

The diagram now begins with **RV32 Registers → Tensor descriptor / control owner**.
GPR values and instruction option fields are captured by their command owners;
this is not an unlatched connection from live GPRs to a running Tensor job.
Gray dashed control routes terminate at the relevant selectors. Three distinct
control sources are intentionally named:

| Origin | Controls | Maintained source |
| --- | --- | --- |
| tensor_setcsr | dtype [3:0], wtype [7:4] | edge32_intrinsic.hpp; edge_tensor_unit.v |
| tensor_start options | USE_SCALE, PSUM_ONCE, NO_PSUM, SCALE_STREAM, RSUM, tile output | edge_tensor_engine.v |
| WSLD circular descriptor | stype, scales, tiles, wtype, groups | edge_wsld_slot_reader.v; edge32_intrinsic.hpp |

The descriptor box groups configuration and command ownership; it does not assert
that the engine's start descriptor physically stores every WLD/WSLD field. Load
format tags and scale slot state have their own lifetimes in their owning RTL.
The gray format route also includes the tile-mode output override, not just dtype.

Mode buttons inspect one family at a time. They do not compose a runnable command
word, infer unsupported combinations, change RTL or alter the measured trace.
The original six mechanism buttons and trace-to-mechanism navigation remain.
`tensorMode=<id>` persists the selected configuration view in a copied URL.

### Packed WLD and dot-local typecast

WLD retains packed codes and a format tag through staging. At each dot-local
`edge_dot8_weight_bank` ingress, BF16 passes through and INT8, FP8 E4M3FN,
FP4 E2M1 or FP8 E5M2 promotes to BF16 before shifting into the final A/B cells.
The active cells feed the dot; they are not five independently instantiated
converters per operation. The branches explain the selected decoding alternatives.
Public wtype values 1/2/3/4/5 map to transport formats 0/1/2/3/4 respectively in
`edge_tensor_wld_tile.v`. Dot-local `format_i` consumes those transport codes.

### P selection and RSUM

- P stream reads an aligned P vector per input vector.
- PSUM_ONCE captures one P vector and reuses it across per-vector results.
- NO_PSUM selects zero and issues no P reads.
- RSUM accumulates across vectors **inside each dot kernel**, starts from zero on
  its first vector and publishes one final output vector after the last. The E3
  engine retains a drain-ordering fence before publication. RSUM forces no-P
  behavior and disables static/stream scale. It is not the external +P path.

The P source selector and post-dot +P are separate blocks. Wide storage uses FP32
containers for the maintained BF22 arithmetic; container width is not a claim of
full IEEE FP32 arithmetic precision. COPY and other less central start options
remain outside this functional numerical-path explorer.

### Scale encoding and delivery

The WSLD slot reader handles BF16 (stype 0), MXFP4 E8M0 (1), NVFP4 E4M3 with a
BF16 global factor (2), and FP16 (3). FP16 expands exactly to BF20. NV scale
combination also supplies BF20 extra fraction bits. The maintained wide-H4
composition enables SCALE_BF20; high BF16 slices and low extension bits travel
together into the wide post-dot multiplier.

These format branches describe **WSLD slot decoding**, before SLD delivery to
Tensor; plain SLD does not gain an arbitrary quant-type field from tensor_setcsr.
Delivery is separately selected between a held/reused vector and a per-vector
stream FIFO. USE_SCALE selects dot×scale rather than dot bypass; SCALE_STREAM
selects stream consumption and contributes to compute admission. The stream view
uses zero P to isolate scale routing. Scale encoding is independent of weight code
type, so a format label does not imply a fixed weight/scale pair.

Each configuration has an SVG/PNG export named `edge-e3-tensor-<mode>.{svg,png}`.
The overview remains `edge-e3-tensor-pipeline.{svg,png}`. SVG styles are embedded.

### Control routing

CSR fields, START options and WSLD configuration have separate header groups and
spaced horizontal control lanes. Long control routes use the outer corridors and
enter the top ports of WLD, weight/scale/P selectors, the RSUM owner and output
format selection. CSR dtype and START tile-output override have separate top
ports on the output-format group. The header boxes identify control provenance;
they do not introduce new physical RTL pipeline stages.

At unavoidable data/control crossings, the data wire remains continuous and the
dashed control wire has a gap: there is no connected junction. Mode highlighting
also selects only its required control-source group. The verifier checks every
control route for block intersections and verifies downward top-port entry.

### Local scale and partial-sum joins

The held scale and stream FIFO now feed the scale-source selector through straight
horizontal wires. Its selected scale drops directly into the multiplier below.
The dot/scale-select/+P/output-format/O-queue result chain shares one horizontal
level; scale bypass has one bend. The P read, P hold and zero candidates are placed
beside the P selector near +P. Their selector inputs are straight, and the selected
P needs one bend to enter +P from below. P hold remains a one-read reuse mechanism;
this layout change does not change numerical ownership or measured behavior.
Data and control geometry checks cover block intersections in addition to the
source/mode checks. Standalone mode exports use the same final geometry.
