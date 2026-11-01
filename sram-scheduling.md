# SRAM scheduling chapter

The final atlas chapter separates the Chapter 2 teaching butterfly from current
DTCM service classes. All displayed content is English.

## Teaching network

Reference: `~/slides/Chapter2/slides.mjs` and
`~/slides/Chapter2/evidence/rotation-mapping.json`.
Eight channels use `bank = (channel + phase) mod 8`. Route bank-to-channel
through distances 1, 2, 4. At each stage, with current row r and distance d,
select `floor((phase + r % d) / d) % 2`; exchange means `r ^= d`.
The selector offset is local to the row. Stage controls are not divided clocks.
The diagram shows all possible physical connections faintly and highlights one
selected route. This is an illustrative network, not the current product netlist.

## Maintained implementation

The product defaults WIDE_H4 to SRAM_H4. DTCM has sixteen 64-bit banks and
128 KiB storage. The default bank implementation uses four dual-port H1 tiles
and locally compensates phase mapping. See the linked RTL on the page.

- Fast service: 256 bits per accepted cycle, eight FP32 O/P storage containers.
- Slow service: 128 bits per accepted cycle, eight BF16 I/O/P elements.
- Buffered consumers: LSU / ACTU / CMPU consume slow-side service with local
  admission, backpressure and client-specific adaptation. ACTU/CMPU read queues
  reserve in-flight beats, unpack elements and queue writes. The product LSU
  adapter itself is combinational ready/response forwarding; it is deliberately
  not represented as an identical accelerator FIFO.

The wide scheduling derivation documents four group doors and local narrow
half selection. Response reorder is indexed state, not merely a FIFO delay.
The interactive service view uses q = fabric_phase[3:1]. Groups are
P=q[1:0], O=q[1:0]+1, I/WSLD=q[1:0]+2, shared/DMA=q[1:0]+3
(modulo four). I and shared clients use half q[2]; WSLD and DMA use
its complement. Each half is two adjacent 64-bit banks. FP32 P/O use both
halves; aligned BF16 P/O use request address[1] to choose one pair, while
the full group remains owned. The address-half control is an example request
selection shared by the two illustrated P/O requests, not a new hardware CSR.
These are eligible logical bank-door masks, not a record of issued requests.
Local H1 pair swaps at the SRAM edge are compensated and do not rename these
logical banks.

Two widths coexist; these are not two clock speeds. No unconditional sustained
bandwidth or bubble-free execution claim is made.

## Verify and export

Run `node docs/architecture-renderer/verify.mjs`. It checks all 64 teaching paths,
every phase's bijection, source anchors, English content and final chapter order.
It also checks 64 phase/format/address-half service configurations, disjoint bank
masks, all-bank use for wide P/O, half exchange and RTL formula anchors.
The existing architecture, trace and Tensor/ACTU checks also run.

The renderer is dependency-free in `sram-scheduling.js`; UI controls live in
`sram-view.js`. Export `E3SramScheduling.render(view, phase, channel, pWide, oWide, addrHalf)` as SVG,
then rasterize it at 2280 × 1520 with Sharp. Eight phase PNG/SVG pairs highlight
DMA; 64 service pairs cover eight phases, independent P/O formats and both
address halves. The default service alias and buffered view give 74 pairs total.
The service PNG link always matches the selected controls. Browser channel selection
is independent of the predefined DMA exports and is labeled accordingly.
