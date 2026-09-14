# Pilot responsive reference migration

PR5 converts the Pilot proposal from a visually strong but selector-fragile responsive implementation into the first page that demonstrates the target responsive architecture end to end.

## What stays intentional

The Pilot still uses three layout regimes because its content genuinely needs them:

- phone: below 640 px;
- intermediate tablet / laptop: 640–1199 px;
- wide desktop: 1200 px and above.

The 1200 px transition is a content decision, not a global breakpoint policy. Dense document compositions become comfortable only once reminder panels, explanatory sidebars and document-like page padding have enough room.

## What changed

Responsive composition now lives next to the JSX that owns it:

- document pseudo-print height activates only on wide desktop;
- dense two-column page sections stay stacked until 1200 px;
- three-card summaries use 1 / 2 / 3-column regimes explicitly;
- reminder context uses 1 column, then 2 + 1, then 3 columns;
- sample cards stack on phones;
- the “Aujourd’hui” flow becomes vertical on phones and horizontal from tablet upward;
- the rules table keeps one explicit local horizontal scroll owner.

`pilot-responsive.css` is deliberately small. It contains only scoped domain behavior that remains clearer in CSS: positional border ownership for the 2 + 1 reminder context, the summary-card span in the intermediate regime, arrow rotation for the vertical flow, intrinsic shrinkability, and no-wrap treatment for genuinely atomic values.

## Architecture rule demonstrated by the Pilot

A page-specific responsive stylesheet may express genuine domain composition, but it must not discover layout by matching generated utility-class combinations or tree depth.

The page should be readable from its JSX: a reviewer should be able to see where a composition collapses, where local overflow is owned, and which content waits for a wide desktop before becoming dense.

## Final enforcement state

PR10 removed the repository-wide `overflow-wrap: anywhere` compatibility rule and the Pilot override that existed only to cancel it. The Pilot therefore relies on normal browser text wrapping by default and declares only the exceptions it actually owns.

The rules table remains an intentional local horizontal-scroll surface; the document itself must never depend on root clipping to appear responsive.
