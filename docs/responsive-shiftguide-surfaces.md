# ShiftGuide responsive surfaces

PR8 applies the shared responsive architecture to the protected ShiftGuide feature without creating a second responsive system.

## Shell boundary

`ShiftGuideLayout` remains the owner of persistent navigation geometry. The mobile bottom navigation and the desktop rail consume the shared dimensions from `src/layout/responsiveGeometry.ts`; pages must not duplicate those values.

The desktop rail appears at 1024 px. That transition removes 96 px from the usable content width, so page compositions must not automatically use the same `lg` breakpoint to introduce a major secondary column. A large sidebar, dense table layout or report rail should normally wait until `xl` unless the composition is independently proven comfortable at the reduced width.

Small autonomous grids are different. A set of compact cards may still recover columns at `md` or `lg` when each card has enough intrinsic width and the composition does not depend on a fixed secondary rail.

## Scroll ownership

Normal ShiftGuide pages use document scrolling. The shell already reserves space for the mobile navigation and removes that compensation when the desktop rail takes over.

Céline is the deliberate exception. It is a chat surface with a persistent header and composer, so the conversation owns vertical scrolling. On mobile, `useShiftGuideShell` locks the document and uses `visualViewport` to compensate for the software keyboard while retaining the shared mobile-navigation reserve when the keyboard is closed.

The Lexique previously created its own `100dvh` page and an internal results scroller. PR8 removes that second scroll owner: the header is sticky and the lexicon follows normal document flow.

## Surface decisions

### Urgences

The safety surface keeps its content and visual hierarchy, but its two major secondary-column compositions now wait until `xl`. This avoids adding a 24 rem or 20 rem side region at the same 1024 px breakpoint where the ShiftGuide desktop rail first consumes horizontal space. Compact evacuation steps and golden-rule cards retain earlier grid recovery because they remain independent, self-contained cards.

### LinePulse

LinePulse already places its major cockpit splits in the `xl` regime: the large hero control panel, supervisor rail, manager rail and primary recommendation/event compositions. Smaller internal grids remain at `md` or `lg` where they are autonomous and remain readable. PR8 locks the wide-regime decisions instead of mechanically rewriting every `lg` occurrence.

### Analyse Ligne

The report's own navigation rail already starts at `xl`, with the mobile/tablet summary navigation retained below that point. Its content rail therefore does not compete with the application rail at 1024 px. Smaller result-card and metric grids may continue to recover columns earlier.

### Home, ModuleView and lock screen

These surfaces were already structurally healthy and are intentionally not redesigned in PR8. The responsive architecture should reduce unnecessary page churn, not make every roadmap PR touch every route.

## Validation

The static architecture tests protect the scroll-owner distinction and the breakpoint policy for major ShiftGuide columns. The browser responsive contract now exercises authenticated ShiftGuide surfaces at minimum phone, phone landscape, the exact 1024 px desktop-rail onset and a small laptop. It checks ModuleView, Céline, Lexique, Urgences, LinePulse and Analyse Ligne for document containment and critical-control reachability.

Global compatibility rules such as root horizontal clipping and global emergency word wrapping remain migration debt owned by the final enforcement PR; PR8 does not use them as a substitute for intrinsic page sizing.
