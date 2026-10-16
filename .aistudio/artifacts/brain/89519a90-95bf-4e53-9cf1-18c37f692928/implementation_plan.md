# PokeForge: Web-Based Pokémon Emerald ROM Editor

PokeForge is a zero-install, browser-native binary ROM editor for Pokémon Emerald (US, `BPEE`). It parses authentic GBA ROM byte structures, manages non-destructive project state via a virtual workspace container (`.forge`), and re-compiles modified assets, LZ77-compressed data, and Nintendo BIOS header checksums into verified playable `.gba` binaries.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were established during clarification:
> - **Workspace Ingestion**: Strict clean GBA ROM file upload (`.gba`, 16,777,216 bytes) with CRC32 verification and header signature validation (`BPEE`).
> - **Visual Aesthetics**: *Emerald Cyber-Deck* — deep slate foundations (`#090D16`, `#111827`) paired with neon jade/emerald accents (`#10B981`, `#34D399`), monospace tabular figures (`font-mono tabular-nums`), and clean hairline surface delineation.
> - **Map Studio Priority**: Complete interactive 2D canvas with dual-layer rendering (visual metatile painting + impassable/water/grass/ledge collision tags) and map header properties.

---

## 1. Overview & Core Concept

- **What It Does**: PokeForge operates directly on Pokémon Emerald US binary ROMs. It extracts structured records (Base Stats, Evolutions, Movesets, Item Economics, Map Layouts, Metatiles, Collision Flags, Palettes, and Text tables), tracks all modifications inside an in-memory delta model, exports/imports project archives (`.forge` ZIP), and builds patched `.gba` files with recalculation of the Nintendo BIOS checksum at offset `0xBD`.
- **Target Audience**: ROM hackers, balance modders, competitive theorycrafters, and game preservationists who need instant, cross-platform GBA binary editing without compiling legacy C++/Python desktop tools.
- **Key Value**: Zero compilation setup, 100% client-side privacy (ROM data never leaves the browser), instant visual feedback across tilemaps and base stats, and non-destructive delta isolation.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Ingest & Validation**:
   - The user drops a 16MB `.gba` file onto the dropzone.
   - The engine computes CRC32, checks for the `BPEE` game code at `0xAC`, and inspects header integrity.
   - If a valid ROM is provided, the workspace automatically unlocks all studios and loads data tables into typed memory buffers.

2. **Database Studio (Pokémon & Items)**:
   - **Pokémon Base Stats & Data**: Browse all 411+ species with fast search and type filters. View and edit the 28-byte base stats structure (HP, Attack, Defense, Sp. Atk, Sp. Def, Speed), typing, catch rate, exp yield, gender ratio, abilities, and held items. An interactive radar chart updates real-time base stat totals (BST).
   - **Evolutions & Movesets**: Inspect evolution blocks (level-up, trade, stone, friendship) and level-up moveset sequences terminated by `0xFFFF`.
   - **Items & Economy**: Edit item prices, pocket classification (Items, Key Items, Poké Balls, TMs/HMs, Berries), and item parameters.

3. **Map Studio (Metatiles & Collisions)**:
   - **Map Bank & Layout Selector**: Explore Map Banks (Bank 0: Towns/Cities like Littleroot, Petalburg, Rustboro; Bank 9: Routes 101, 102; Bank 24: Interiors).
   - **Interactive Canvas**: High-performance HTML5 canvas with smooth pan, zoom, grid toggle, and coordinate readout.
   - **Metatile & Behavior Editing**: Metatile picker palette with stamp and bucket tools. Toggle collision/behavior overlay:
     - Passable (`0x00`)
     - Solid / Impassable (`0x01`)
     - Tall Grass (`0x0C`)
     - Water / Surf (`0x10`)
     - Ledge Hop South (`0x38`)
     - Door / Warp Trigger (`0x69`)
   - **Map Header Sidebar**: Edit Dimensions, Music Track, Weather, Cave Flag, and Region Map Section.

4. **Graphics Studio (Tilesheets & Palettes)**:
   - View extracted 8x8 tile grids in 4BPP (16-color) format.
   - 16-color GBA palette editor converting 15-bit BGR (`0x7FFF`) to RGBA with color picker and HEX values.
   - Pencil, eraser, and horizontal/vertical tile flipping tools.

5. **Script & Text Studio**:
   - String table editor decoding Pokémon Emerald's proprietary character table (`0xBB` = `A`, `0x00` = Space, `0xFF` = String Terminator, control codes like `\n`, `\l`, `\p`, `[PLAYER]`).
   - Live character count and byte-limit validator to avoid buffer overrun.

6. **Project Workspace (.forge) & ROM Compiler**:
   - **Save .forge**: Packages project manifest (`manifest.json`), modified JSON delta patches, and binary map arrays into a ZIP archive via JSZip.
   - **Build & Export .gba**: Re-encodes modified records, compresses layout blocks using GBA LZ77 / LZ10, writes to physical ROM offsets, recalculates the BIOS checksum at `0xBD`, and prompts instant browser download.

### Visual Identity & Theme

- **Aesthetic Direction**: *Emerald Cyber-Deck* — sleek, modern, highly legible developer workstation engineered for deep binary inspection and long editing sessions.
- **Color Palette & Tokens**:
  - Background Canvas: Deep Midnight Slate (`#090D16`)
  - Elevated Surfaces & Panels: Structural Charcoal (`#111827`) with subtle `#1E293B` borders
  - Primary Accent: Radiant Emerald (`#10B981`) and Mint Highlight (`#34D399`)
  - Warning / Alert: Solar Amber (`#F59E0B`) and Crimson (`#EF4444`)
  - Typography Colors: Clean White (`#F9FAFB`) headings, Slate Gray (`#94A3B8`) muted labels
- **Typography**:
  - Primary UI: `Plus Jakarta Sans` or system geometric sans for headers and navigation tabs.
  - Data & Hex Telemetry: `JetBrains Mono` / `font-mono tabular-nums` for all hex addresses, byte counters, stat values, and map coordinates.
- **Spatial Principles**: Strict Top Bar contract (Wordmark — 4 Studio Tabs — Export Action), zero-pill metadata discipline, and single-elevation panel hierarchy.

---

## 3. Key Product Decisions & Trade-Offs

- **Delta Patch Model (`.forge`) vs Direct In-Place Mutation**:
  - *Chosen Approach*: Edits are stored in an in-memory delta patch table rather than directly corrupting the pristine source ArrayBuffer.
  - *Why*: Enables unlimited undo/redo, side-by-side binary diffing, clean `.forge` project export, and safe re-builds without risking base ROM corruption.
- **Client-Side GBA LZ77 (LZ10) Compression Engine**:
  - *Chosen Approach*: Pure TypeScript implementation of standard GBA BIOS LZ77 decompressor and greedy sliding-window compressor.
  - *Why*: Graphics and map layouts in Pokémon Emerald rely on LZ77 (`0x10` flag byte). Without decompression, tilesets and layouts cannot be viewed or saved back to ROM.
- **GBA Charset Converter**:
  - *Chosen Approach*: Full bidirectional mapping between UTF-8 and Pokémon Generation 3 proprietary character codes.
  - *Why*: Prevents character corruption in Pokémon names, item names, and dialogue scripts.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PokeForge Top Bar Shell                         │
│  [ Brand: PokeForge ]     [ Database | Map | Graphics | Text | Diffs ] │
│  ROM: BPEE Emerald (U)    CRC: 1F3798D5      [ Save .forge ] [ Export ] │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌────────────────────────────────┐              ┌────────────────────────────────┐
│      ROM Engine / Ingest       │              │     Virtual Workspace Engine   │
│ - 16MB ArrayBuffer Store       │              │ - Delta Patches (JSON/Bytes)   │
│ - CRC32 Checksum Validator     │◄────────────►│ - .forge Manifest & JSZip      │
│ - Emerald Memory Map Offsets   │              │ - Undo / Redo History Stack    │
│ - GBA LZ77 Decompress/Compress │              │ - Binary Diff Inspector        │
└────────┬───────────────────────┘              └────────────────┬───────────────┘
         │                                                       │
         ├───────────────────────────────────────────────────────┤
         ▼                                                       ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Database Studio  │   │   Map Studio     │   │ Graphics Studio  │   │ Text / Script    │
│ - 411 Species    │   │ - Bank & Layout  │   │ - 4BPP Tilesets  │   │ - GBA Charset    │
│ - 28-byte Stats  │   │ - Metatile Stamp │   │ - 15-bit BGR555  │   │ - Item Names     │
│ - Evolutions     │   │ - Collision Layer│   │ - Palette Editor │   │ - Species Names  │
│ - Level Movesets │   │ - Map Properties │   │ - PNG Quantizer  │   │ - Dialogue Box   │
└──────────────────┘   └──────────────────┘   └──────────────────┘   └──────────────────┘
         │                                                       │
         └───────────────────────────┬───────────────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │     Binary Patch & Build Engine   │
                   │ - Apply JSON/Bin Deltas to Copy   │
                   │ - Recalculate 0xBD Header Checksum│
                   │ - Trigger Download (.gba file)    │
                   └───────────────────────────────────┘
```

### Memory Map Offsets Reference (Emerald US `BPEE`)
- Base Stats Table: `0x254784` (28 bytes per entry)
- Evolution Data Pointer Table: `0x259754`
- Moveset Pointer Table: `0x25D7B4`
- Pokémon Names Table: `0x245EE0` (11 bytes per string, `0xFF` padded)
- Item Data Table: `0x5839A0` (44 bytes per entry)
- Map Banks Table Pointer: `0x08053E00` (or bank pointers at `0x486578`)
- GBA Header Complement Checksum: `0xBD`

---

## 5. Step-by-Step Implementation Strategy

1. **Dependencies & Project Architecture**:
   - Install `jszip` for project workspace `.forge` packaging and extraction.
   - Establish core modules for binary parsing, GBA pointer calculation, CRC32, LZ77 compression/decompression, GBA character set mapping, and memory offsets.
2. **ROM Engine & Data Tables**:
   - Implement typed structs for Pokémon 28-byte Base Stats, Evolution tables, Level-up learnset sequences, and 44-byte Item structures.
   - Build complete Generation 3 reference data dictionaries for all 411 species names, move names, ability names, item names, and map bank definitions so the app functions seamlessly and validates ROM contents accurately.
3. **Workspace & Delta System**:
   - Implement the virtual `.forge` delta engine that maps species, item, and map edits to physical ROM addresses without destructive base mutation.
   - Implement `.forge` ZIP import and export using JSZip.
4. **Interactive Studio Views**:
   - Build **Database Studio** (Pokémon stat radar, ev yields, abilities, items, evolutions, moves, item economics).
   - Build **Map Studio** (Interactive canvas with pan/zoom, metatile picker, collision overlay tags, map headers).
   - Build **Graphics Studio** (Tilesheet grid, 15-bit BGR palette editor, pixel editor).
   - Build **Script & Text Studio** (Dialogue & string editor with control tags).
   - Build **Diff & Export Inspector** (Physical address changes, hex diff view, GBA checksum validator, instant `.gba` download).
5. **Verification**:
   - Run compilation and ensure complete zero-error execution.
