# Print Studio

A visual browser tool for building 3D printable models from editable shapes and useful parts. No installation, account, AI prompts, or network connection is needed to use the finished HTML file.

## Open the tool

Open `index.html` in a current Chrome or Edge browser. The standalone download may be named `Print_Studio.html`; it is the same finished tool. The initial phone stand is an editable example, not a fixed template. Use **Start with → Blank workspace** to build your own object.

## Building pieces

Nineteen types: block, cylinder, wedge, sphere, dome, cone, polygon prism, pyramid, capsule, ellipsoid, torus, arch, star prism, half cylinder, tray, tube, bowl, C hook, and triangular bracket. Expand **More shapes** for the eight new primitives. Each has relevant size controls. Trays include wall/base thickness, corner radius, and 1–8 compartments. Blocks have rounded vertical corners. Tubes have adjustable wall thickness. Cones can end in a point or a flat top.

- Click a piece in the list or preview to select it.
- Enter precise dimensions in **Size & shape**.
- Use **Move**, **Rotate**, and **Resize** handles in the 3D view. Move uses world axes; resizing uses the piece's local axes. Round parts keep a circular diameter. Snapping offers 1, 5, or 10 mm movement, 5° rotation, and 10% scaling.
- Position fields describe the piece's center in world coordinates. Z points up. Front is negative Y.
- **Put on bed** places the lowest point of the selected piece and its attached children at Z = 0. **Center on bed** centers that assembly in X/Y.
- **Copy** stores the selected piece in an internal clipboard. **Paste** creates independent copies beside the original; repeat Paste for more copies. Dimensions, angles, hollow settings, surface patterns, and solid/cutter status are retained. Attached pieces copy at their current world pose and detach from their parent; children are not included. The internal clipboard works offline, without clipboard permission, within this tab.
- Duplicate, delete, undo, and redo are available. Deleting a parent retains its children at their current world positions, with direct children detached.

## Hollow shells and sphere patterns

Fourteen closed primitives support **Make this piece hollow** and **Shell thickness**. The cavity is part of the real exported geometry. Shells remain closed; add a cutter to open a container. Trays, tubes, bowls, hooks, and brackets retain their existing wall or band controls. Ellipsoid and dome shells use reduced inner radii, so thickness is nominal and varies with the proportions. Curved surfaces are faceted approximations.

On a sphere, **Sphere surface** offers round or hexagonal patterns:

- **Through holes** automatically enables Hollow and cuts all the way into the cavity.
- **Shallow dimples / recesses** leaves material beneath each cut. Round dimples use spherical cutters; hexagonal recesses have flat bottoms.
- Set **Opening diameter** or **Hexagon across flats**, **Minimum web spacing**, and, for recesses, **Recess depth**. Web spacing is the requested minimum material between conservatively sized openings; actual gaps vary across the sphere. Shell thickness controls the radial wall independently.
- Patterns use distributed openings, rather than a mathematically exact hexagonal tiling of a sphere. There is a limit of 240 openings per piece; settings that are too dense report an error with instructions to increase size or spacing.
- **Inspect inside** clips the preview in half so you can inspect the cavity. Exports always contain the complete model. The clipping plane goes through the selected piece's center, or the design's center when no piece is selected.

**Start with → Perforated ball** provides an editable 80 mm sphere with a 2.4 mm shell and hexagonal holes. This demonstrates lattice geometry; bounce, durability, and print orientation need physical testing. It does not promise the behavior of a commercial airless basketball. A sealed smooth hollow shell can trap supports; consider an access cutout or two separately printed halves when appropriate.

## Attachments and openings

Choose **Attach to**, choose a side, then **Place & attach**. Placement uses world-aligned outer bounds with a 0.25 mm overlap. This helps solids fuse, but placement against a hollow or angled piece still needs inspection in **Print result**.

With **Move together** enabled, attachments follow their parent when it moves or rotates. Targets exclude the selected piece and its children, preventing attachment loops. Resizing a parent does not reposition its children. Detach keeps the current pose; move the piece afterward to physically separate it.

**Make opening** changes any piece into an editable cutter. Cutters remove material from all visible solids they intersect. They do not export as solids. Hide a cutter to disable its cut. Hidden solids are also excluded from export. An entirely removed design or invalid dimensions pauses exports.

**Edit pieces** shows the individual pieces and red cutters. **Print result** shows the Boolean union of all visible solids, minus all visible cutters. Every original piece remains editable. Disconnected components are reported; they can be intentional separate pieces. The export contains their closed surfaces in one model object.

## Projects and printing

- **Save project** creates an editable `.printstudio.json` file containing dimensions, poses, attachments, cutter flags, visibility, hollow shells, surface patterns, printer volume, and design name. Earlier Print Studio projects continue to open with solid/smooth defaults.
- **Open** reloads this project format. It does not import STL or 3MF meshes.
- Valid designs are also saved locally in the browser where storage is available. This is a convenience, not a substitute for downloading project files. It does not synchronize between devices, browsers, or website addresses.
- **Printer** sets X/Y/Z build volume, starting at 260 × 260 × 255 mm. Each dimension accepts 20–2000 mm. Checks include the full result, upright or rotated 90° on the bed. Diagonal and tilted packing are not searched.
- STL uses millimeter coordinates; 3MF explicitly records millimeter units. Both center the result in X/Y and place its lowest point at Z = 0. Exports are model files, not sliced G-code or printer profiles.
- Open the exported model in your slicer, choose printer/filament, and inspect orientation and temporary supports. The displayed volume is solid model geometry, not an estimate of filament consumption or print time.

Shortcuts: Ctrl/Cmd+C copies a piece and Ctrl/Cmd+V pastes it outside text fields. Ctrl/Cmd+S saves the editable project, Ctrl/Cmd+O opens one, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl+Y redoes. Delete removes the selected piece. Escape clears selection. Text fields keep their normal editing behavior.

On phones, **Preview**, **Add & pieces**, and **Edit selected** switch panels. All main functions are available, although a larger screen is easier for precise handle movements.

## GitHub Pages

The package includes a **finished `index.html` at the top of the `print-studio` folder**. Upload that file to the root of the new GitHub Pages repository. It contains all runtime code, styles, and geometry assets. No build server is required.

**Do not rename or publish `index.template.html` as the website.** It is a source template with placeholders. Publish the finished `index.html`, or rename the finished `Print_Studio.html` download to `index.html`.

The source folders and development files are optional for hosting. Keep them if you want to maintain the source. This package has not been published online.

## Development

Node.js 22 or newer:

```sh
npm ci
npm run build
npm test
```

The build updates both the finished root `index.html` and `dist/index.html`. It bundles Three.js, Manifold WASM, fflate, CSS, and third-party notices. After deliberately changing the Manifold dependency, regenerate `src/wasm-data.js` from that version's WASM file before building.

Geometry verification covers 97 printable designs: all nineteen shapes at three scales with arbitrary rotations, fused starter assemblies, openings, hidden and separate pieces, attachment transforms, printer fit, and editable project round trips. Additional cases verify all fourteen hollow shells, round/hexagonal holes and recesses, copied pieces, pattern validation, and older projects. Serialized STL checks verify closed surfaces, non-collapsed triangles, and placement at Z = 0; 3MF checks verify units and mesh contents. Browser QA exercised all shapes, numeric edits, real move/resize/rotate handles, attachment/detachment, undo/redo, project files, actual model downloads, autosave, printer limits, mobile panels/help, and offline startup.

## Current scope

Up to 60 pieces per design. Geometry comes from the included shapes and Boolean operations. This version does not provide freehand sculpting, arbitrary mesh import, text geometry, hinges, or automatic support generation. It does not predict strength or establish food-contact suitability. Fit and physical performance need a test print. Bowl walls use an inner curved surface rather than a constant-distance shell.

Original application code; bundled dependency licenses are in `THIRD_PARTY_NOTICES.txt`.
