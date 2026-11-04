# Share a Layout

A layout (the panels, their settings and how they tile the workspace) is kept in each browser. To move it to another browser or another MITI, or to deliver it with the widgets it uses, save it as a file.

## Save the layout

Click **Export layout** (the downward arrow) in the title bar. The browser saves `miti-layout-<date>.json`. Besides the panels, the file lists the widgets whose panels it holds, with their versions.

## Open a layout

Click **Import layout** (the upward arrow) and choose the file. MITI says how many panels it has and asks before replacing the current layout.

When the layout uses widgets this MITI does not have, MITI names them before replacing the layout. Their panels keep their settings and show **Widget not installed** until the widgets are imported under **Widgets** (see {doc}`install-a-widget`).

**Reset layout** goes back to MITI's default panels.

## Layouts from older MITI

Layouts saved by MITI 3.4.5 and earlier, in the browser or in a file, open unchanged: the panels keep their places and sizes.

A layout file records its format in `version`:

| `version` | Saved by               | How the panels tile                                                                                         |
| --------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2         | MITI after 3.4.5       | Splits of two or more panels side by side or stacked, each with its share (`children`, `splitPercentages`). |
| 1         | MITI 3.4.5 and earlier | Splits of exactly two (`first`, `second`, `splitPercentage`).                                               |

MITI reads both and saves version 2. MITI 3.4.5 and earlier cannot open a version 2 file, and says so.
