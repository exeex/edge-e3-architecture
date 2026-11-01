# Edge E3 Architecture Atlas

[Open the interactive atlas](https://exeex.github.io/edge-e3-architecture/).

This standalone static site is integrated into `exeex/edge-cores` as the
`docs/architecture-renderer` Git submodule. It contains original diagrams,
explanations and captured trace fixtures; it does not bundle RTL.

## Preview and publish

```sh
python3 -m http.server 8766
# Open http://127.0.0.1:8766/
node verify-site.mjs
node build-site.mjs
```

Push `main` to run `.github/workflows/pages.yml`: validate, package only web
assets, upload the Pages artifact, then deploy with GitHub's Pages environment.
Pull requests validate and build without deploying. No separate hosting token
is required. Pages uses the repository's GitHub Actions publishing source.

`source-manifest.json` records public source repository revisions.
`source-links.js` resolves static and dynamically generated RTL links to those
revisions, including line fragments. Private test files are not published.

For the full source-drift check, run `node verify.mjs` inside the edge-cores
submodule checkout, or set `EDGE_CORES_ROOT=/path/to/edge-cores` when running
from a standalone clone. Standalone CI uses `verify-site.mjs` and requires
neither private tests nor a simulator.

Issues belong in [edge-cores](https://github.com/exeex/edge-cores/issues).

---

# Edge E3 architecture renderer

An original, dependency-free SVG architecture drawing of Edge E3, with a
four-stage RV32 scalar lane and a parallel ASIC command/execution lane.
The page explains captured GPR parameters and `start ≈ fork` / `sync ≈ join`.

## Open

Open `index.html` directly in a browser. There is no install or build step,
and no external font, CDN, or network dependency. Alternatively, from the
repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8765/docs/architecture-renderer/>. Serving the root
also makes the inspector's relative RTL links available.

Use the scenario buttons or play control to walk through parameter capture,
start, overlap, sync wait, and resume. Select a join target to inspect the
four independent engines. Click or keyboard-select an SVG block for its
description and RTL reference. Zoom with the buttons; Shift-drag pans the
scrollable drawing. The SVG export preserves the current scenario and theme
and includes its own styles for standalone rendering. Small screens scroll at the default zoom; Fit provides a whole-width view. Reduced-motion preferences disable flow
animation.

## Files

| File | Responsibility |
| --- | --- |
| `index.html` | Page, controls, inspector and explanatory text |
| `styles.css` | Responsive page layout and light/dark theme |
| `architecture.js` | Node/edge model, explicit positions and routed wires, source references, SVG renderer |
| `guide.js` | Literal source excerpt, walkthrough steps, component contracts and backpressure cases |
| `app.js` | Guided selection, scenarios, timeline, URL state, playback, pan/zoom and export |
| `trace-data.js` / `tensor-trace-data.js` | Separate validated ACTU and matmul captures with signal intervals and provenance |
| `tensor-pipeline.js` / `tensor-view.js` | Tensor diagram, six mechanisms, sixteen configuration paths and RTL evidence |
| `trace-view.js` | Measured signal windows, cycle cursor, event selection and command evidence |
| `verify.mjs` | Source-excerpt drift, model references, English text and measured-source integrity |

Edit the node and edge records in `architecture.js` to change the architecture.
Coordinates are intentionally explicit. Browser-native SVG renders the
schematic; no diagram layout engine or raster image generator is involved.

## Reading the page

The architecture workbench is first, before the title, Tensor chapter or
walkthrough. The Tensor block inspector links to the new Tensor mechanism
chapter. See [Tensor source map](tensor-pipeline.md) for the Chapter 2/3 slide
inventory, exact current RTL owners and differences from historical slides.
Six selectable phases explain descriptors, DMA/ring feeding, WLD/A-B weight
ownership, Compute input valid, scale/psum/output and handoff/drain. The Tensor view
is source-derived, separate from the selectable ACTU and Tensor measured traces.


The source walkthrough follows selected lines from the maintained
[`matmul64x64_128tokens_tiled_circular.cpp`](https://github.com/exeex/edge-cores/blob/03f7c980cfbcff4ef101f756281c3d1baa8f4840/example/tensor/matmul64x64_128tokens_tiled_circular.cpp)
example. Six steps connect configuration, start, preparation of subsequent
work, Tensor sync, DMA sync and scalar resume to the diagram and illustrative
timeline. Each step highlights the original source line numbers and selects
the appropriate join target. Memory initialization, DMA setup and surrounding
loop bodies are omitted from the excerpt, with gaps marked explicitly.
This excerpt is a reading aid, not a standalone executable program.

The component inspector sits beside the diagram on wide screens and below it
on narrow screens. It explains each selected block, its inputs, outputs,
ownership/completion conditions and RTL source. Some symbols represent
functional groups spanning multiple RTL owners; their ports are explanatory
summaries rather than a complete RTL interface declaration.

The backpressure field guide covers GPR dependencies, LSU responses,
multicycle Mul/div and target-specific ASIC sync. Each case describes what
waits, what continues and what releases ownership, with a button to select
the corresponding diagram block.

Mode, selected block, join target and active walkthrough step are retained
in URL query parameters. **Copy view link** copies this address; a local
localhost link is usable only where that server is available. Selecting a
scenario, changing the join target or starting playback exits guided-step
highlighting. Selecting a component keeps the active step and changes its
inspector selection. SVG export preserves the current mode and theme.

The **Fit** control fits the diagram to the available width; zoom and
Shift-drag allow inspection at readable signal-label sizes. The diagram has
its own vertical scroll area so the desktop inspector remains available.
All page text, diagram descriptions and accessibility labels are in English.

## Diagram conventions

- IF / ID / EX / WB is the scalar pipeline. ASIC command blocks do not imply
  a second CPU pipeline with a fixed stage count.
- Solid lines carry data; blue dashed lines carry control, readiness and
  completion. Subdued gray dashed lines summarize cache/system sidebands.
  A crossing is connected only when marked with a junction dot.
- Forward stage traffic crosses the stage interfaces. Backward control/status
  takes exterior upper routes and enters its destination from above.
- ALU groups integer logic and RV32M Mul/div; RTL instantiates separate leaves.
  CSR/counters and Branch are separate functional groups. FPU/FPR is omitted.
- IFU and Predecode share IF ownership. The IFU owns outstanding fetch and
  parcel buffering; Predecode extracts source/destination indices and classes.
  Instruction-matched parcel PC crosses IF/ID and ID/EX. Fetch-PC+4 remains
  in the separate next-PC path; no independent IF/ID PC+4 field is implied.
- IF supplies GPR read indices. Decoder operand-use masks are drawn entering
  Registers for clarity; RTL applies the post-read value-or-zero selection
  during EX capture. The masks do not gate read addresses.
- Hazard / admission summarizes distributed ID dependencies and slot logic.
  EX rd/we feeds RAW checks in the read-port owner. An empty ID can fill while
  EX is busy; a pending EX instruction does not imply every stage is frozen.
- EX completion aggregates class/started-qualified LSU, Mul/div, instret,
  accelerator, cache-maintenance and FENCE.I readiness, plus captured
  immediate-completion/decode-fault state. Ordinary ALU, Branch and most CSR
  operations use the static path. There is no extra generic branch_done.
- CSR/counter, cache and DTCM symbols describe functional ownership. Cache
  maintenance executes in EX, address headers commit in WB, and DTCM
  base/mask/enable are platform inputs. The Cache control tab explains these
  distinctions and the 64-bit address-header concatenation.

Geometry is intentionally explicit in architecture.js. The renderer compacts
horizontal coordinates by 10% while preserving font sizes and vertical
spacing. The exported SVG coordinate space is **1566 × 1730**.

## Architectural contract and sources

This drawing targets the maintained `edge_core_edge32_top` E3 composition.
Sources were inspected at parent revision `7d4b6552`, Edge32 `55a089b`,
and Edge E3 `60be69f` when this drawing was created.
It is an architectural explanation, not a port-complete netlist or a measured
cycle trace. ASIC command blocks do **not** claim a fixed number of pipeline
stages. Internal FPR, cache, BIU, power control and memory-port topology are
omitted or abstracted. Independent progress does not remove data dependencies,
ready/backpressure, memory arbitration or resource ownership requirements.

| Drawing claim | Public source |
| --- | --- |
| IF/predecode → ID/read → EX/execute → WB/retire | [`src/edge-32/README.md`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/README.md), stage modules in `src/edge-32/rtl/` |
| IFU scope, one outstanding fetch, two-entry parcel FIFO, cancellation | [`edge_32_if.sv`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/edge_32_if.sv), [`edge_32_frontend.v`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/edge_32_frontend.v), [`if/admission.svh`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/if/admission.svh) |
| Captured operands, ASIC request, EX completion waits for response | [`ex/completion.svh`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/ex/completion.svh), [`ex/transaction_state.svh`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/ex/transaction_state.svh) |
| IF-issued read indices, GPR read-address capture, post-read operand masks | [`edge_32_gpr_read_port.sv`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/edge_32_gpr_read_port.sv), [`ex/slot.svh`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/ex/slot.svh) |
| RV32 operand zero-extension and `accel_req_src1 → req_capture_value` | [`edge_core_scalar_product_top.v`](https://github.com/exeex/edge-e3/blob/60be69f0bd06b9953d96ced7057e8ec08cb3a2ac/edge_core/edge_core_scalar_product_top.v) |
| Command bridge and accelerator pipe composition | [`edge_lite_accel_dispatch.v`](https://github.com/exeex/edge-e3/blob/60be69f0bd06b9953d96ced7057e8ec08cb3a2ac/edge_core/rtl/edge_lite_accel_dispatch.v) |
| Unit-specific ready, start and sync conditions | [`edge_accel_pipe.v`](https://github.com/exeex/edge-32/blob/55a089b372e2a18f8fa99185db7db264ad72602d/rtl/edge_accel_pipe.v) |
| Product connections and independent engine status | [`edge_lite_accel_platform.v`](https://github.com/exeex/edge-e3/blob/60be69f0bd06b9953d96ced7057e8ec08cb3a2ac/edge_core/rtl/edge_lite_accel_platform.v) |
| E3 8×8 tensor configuration | [`src/edge-e3/README.md`](https://github.com/exeex/edge-e3/blob/60be69f0bd06b9953d96ced7057e8ec08cb3a2ac/README.md) |

The scalar instruction waits for its command response. For start, command
acceptance, actual launch, and whole-job completion are distinct events;
start can wait for capacity or a launch response without waiting for the
whole computation. While an engine runs, scalar work and other accepted
engine work may proceed. A target-specific sync does not finish until that
target's earlier work drains; until the response arrives, the instruction
retains EX ownership and backpressures the frontend. Older WB work may still
retire. Waiting scalar execution does not stop ASIC execution.

“Hardware thread” describes an independently progressing accelerator engine,
not an additional ISA hart, PC, GPR file, or general-purpose software thread.
The timeline is an illustrative ordering/overlap story. Its slots are **not**
clock cycles, latency promises or benchmark results. Other engines' bars mean
independent work that has already been accepted; this is not an executable
program or a dependency schedule for a single tensor job.

## Validation

Syntax checks (no npm dependencies required):

```sh
node --check docs/architecture-renderer/architecture.js
node --check docs/architecture-renderer/app.js
node --check docs/architecture-renderer/guide.js
node docs/architecture-renderer/verify.mjs
```

Browser verification should cover all scenarios, each join target, block
selection, dark/light themes, playback/pause, zoom/reset, narrow viewport
scrolling and standalone SVG export.

Verified locally: both JavaScript syntax checks; all 33 node source paths and
92 edge endpoints; all seven scenario states; four target-specific sync states;
EX hold/release; keyboard block inspection; dark/light switch; zoom/reset;
playback through resume; narrow-screen scrolling; and exported SVG XML parsing.
The measured ACTU fixture is captured from the public SoC simulator using an
optional testbench observer. No synthesizable RTL was changed. The observer
is inactive unless explicitly enabled by a plusarg.

Original drawing and renderer: Apache-2.0, under the root repository license.
Referenced RTL retains each owning submodule's license. No artwork or source
from the DOOMED RV32I project is included.

### Verification scope

The dependency-free verifier checks the source excerpt against its original
line numbers, all node source paths, edge endpoints, walkthrough references,
backpressure sources and English-only page/model strings. If source lines
move, refresh guide.js rather than silently displaying stale code.

Browser checks for the reading tools cover all six steps and their source
highlights/targets, reload persistence, all four wait cases, switching back
to manual scenarios, cache notes, theme controls and responsive inspector
layout. The original timeline remains illustrative and is separate from the
measured ACTU trace described below.

## Observed RTL trace

The **Observed RTL / Verilator** section uses the self-checking
[`example/fork_join`](https://github.com/exeex/edge-cores/blob/03f7c980cfbcff4ef101f756281c3d1baa8f4840/example/fork_join/README.md) program. It configures
ACTU sigmoid for 4,096 BF16 zeros, issues start, performs 32 scalar increments,
joins ACTU and verifies every output is BF16 0.5. This avoids weight packing
and DMA setup so the fork/join boundary is easy to reproduce.

The captured run observes **32 scalar integer commits while ACTU is busy**,
**4,059 cycles of EX sync waiting**, and **4,143 cycles from start acceptance
to sync completion**. These describe this exact run, not a throughput promise
or a comparison against serialized execution. Initialization and validation
are outside the displayed interval.

Use event buttons to select start, scalar overlap, sync entry or completion.
The 32/128/512-cycle and whole-capture views retain actual testbench cycle
numbers. A cycle cursor reports EX ownership, instruction/PC, ACTU busy,
WB commit and pending sync. Event selection also updates the architecture
inspector and uses ACTU as its join target.

IF valid refers to a buffered instruction parcel. ID/EX/WB occupancy is
sampled from each valid/pending state. WB commit is observed directly;
its instruction tag for the scalar-overlap classification is derived from
the preceding EX-to-WB transfer. The observer samples before each rising
edge. The provenance panel records these definitions, captured command
parameters, source revisions, file hashes and simulator PASS report.

```sh
./example/fork_join/run.sh --publish-trace
node docs/architecture-renderer/verify.mjs
```

The runner validates the full output and trace evidence before publishing
the compact fixture. Raw CSV, ELF, logs and reports stay under ignored build
directories. See the example README for plusargs, skip-build support and exact
channel definitions. The verifier rejects documentation fixtures whose
observer, program or build/parser sources no longer match their hashes.

Validated with the public build: fork/join PASS (return 0, cycle 198863),
hello PASS (1676), Tensor PASS including numerical output check (477151),
and ACTU PASS (832579). Fork/join with tracing disabled matches its enabled
PASS report and cycle count. Parser checks reject empty captures, dropped
samples and failed runs. Browser checks cover the four events, window sizes,
cycle cursor, provenance, architecture links and narrow-screen layout.

### Measured Tensor matmul

Select **Tensor tiled matmul** in the observed trace workload menu. It reuses
`example/tensor/matmul64x64_128tokens_tiled_circular.cpp`, not an invented
scheduling waveform. The same public testbench numerically validates all
8,192 final outputs. A/B are physical bank selectors; the first active tile
is B in this capture. Fill lanes use transport activity rather than treating
pending ownership as an ongoing load.

The event buttons inspect actual DMA/WLD/compute overlap, first A/B handoff,
concurrent output writing and target-scoped joins. A separate job menu opens
each of the 64 actual compute launches. The cycle cursor, window sizing,
source provenance and architecture highlighting work for either workload.

Observed simultaneous transfer cycles: DMA write/Compute input valid **191**, WLD
read/Compute input valid **219**, O write/Compute input valid **7926**. The broader WLD
active/compute occupied overlap is **1578** cycles. These definitions are
shown separately in the evidence panel; busy does not mean a transfer.

```sh
./example/tensor/trace.sh --publish-trace
```

See [the exact signal definitions and validation](https://github.com/exeex/edge-cores/blob/03f7c980cfbcff4ef101f756281c3d1baa8f4840/example/tensor/TRACE.md).
Raw traces stay ignored; the compact fixture carries report/tool/source hashes.
Trace-enabled and trace-disabled runs have identical output-check PASS,
return value and testbench cycle count. No Tensor algorithm or synthesizable
RTL is changed.

The default Tensor trace is now the four-lane DMA/WLD/software interface
view: DMA busy, WLD tile loading, Tensor active (RTL tensor_busy) and tensor_sync wait.
Tensor active covers outstanding engine, queued/pending and loading work; it
is not compute utilization. tensor_start acceptance pulses remain in details.
Internal A/B, compute and writeback lanes are behind **Show internal signals**.
The internal per-vector handshake is labeled **Compute input valid**; it is
not a software instruction. The start selector follows actual software
command acceptance and separately reports internal compute launch.

In the captured INT8-weight example, each 64-byte WLD tile takes four accepted
128-bit reads and 24–29 active cycles, then supplies 128 input vectors. The
page explains why those intervals look short in an 8,586-cycle whole view.

## ACTU architecture and modes

The ACTU architecture now precedes its source example and the shared execution
timeline. `actu-pipeline.js` maps all eight RTL modes to selected numerical paths:
Sigmoid, SiLU, Tanh, Softmax Exp + Sum, Softmax Normalize, EXP, reciprocal and RSQRT.
The frontend prepares N/D; the backend inverts D and composes the result. Stable
magnitude-based EXP forms and the separate Softmax passes follow RTL rather than
assuming a direct implementation of the slide identities. See
[the ACTU source map](actu-pipeline.md) for ownership and precision boundaries.
Each mode has a standalone SVG/PNG in `exports/edge-e3-actu-<mode>.*`; the Overview
export is `edge-e3-actu-overview.*`. The current mode is saved as `?actu=<mode>`.

The Tensor diagram now includes RV32 register capture, separate dot-local weight
cast branches and CSR/START/WSLD control routes. Sixteen path views cover five
weight codes, P stream/NO_PSUM/PSUM_ONCE/RSUM, four WSLD scale encodings, and scale
bypass/static/stream delivery. These are independent explanatory views, not a
combined configuration editor. Each mode has a matching PNG/SVG export and a
`tensorMode` URL parameter; the original six mechanism phases still link from
measured trace events. See [Tensor configuration ownership](tensor-pipeline.md#configuration-path-explorer).

## SRAM scheduling

The final [SRAM chapter](sram-scheduling.md) adds an eight-phase interactive
Chapter 2 butterfly and separates it from current fast/slow DTCM service widths
and buffered consumer ownership. The service view follows current RTL bank/half rotation and exposes independent
P/O format and BF16 address-half controls. All 74 SVG/PNG views are in
`exports/edge-e3-sram-*`.

## Page hierarchy

The atlas has one H1 page title and five H2 chapter titles:

1. System architecture — pipeline and command-path explorer.
2. Tensor — datapath/modes, scheduling/accumulation and software walkthrough.
3. ACTU — datapath/modes and software walkthrough.
4. Execution & synchronization — ordering, measured traces, backpressure and recap.
5. SRAM scheduling — rotation explorer and implementation scope.

Numbered H3 subsections sit inside their chapter containers. Inspector titles,
selected-mode explanations and trace workload titles use H4 or small control
labels. Mode buttons do not reuse chapter numbering. Existing deep-link IDs and
all diagram exports remain available; this change only reorganizes the page.

The chapter directory appears before the atlas and stays pinned to the viewport.
`chapter-nav.js` tracks chapter boundaries on scroll, applies `aria-current` to
one link and updates the current-chapter label. Its measured height sets the
anchor offset and inspector sticky offset. On narrow screens, the menu scrolls
horizontally and keeps the current chapter in view without moving the document.

System and Tensor explanations always appear below their full-width figures.
The directory now hosts a compact context dock for the chapter being read:
System modes/target, Tensor paths/configuration, ACTU modes, trace/wait controls,
and SRAM view/phase controls. Original controls remain the single source of
behavior; accessible proxy buttons call them and mirror selected state. The
normal source controls stay available if JavaScript enhancement is disabled.
System mode changes select the corresponding component explanation; explicit
component clicks and deep links still work. The pinned band's stable height and
measured anchor offset keep chapter handoffs from covering their headings.
