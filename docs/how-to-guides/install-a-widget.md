# Install a Widget

A widget adds panels to MITI, for example a panel for a robot's driver or for a vision system. It comes as one `.miti-widget` file. Importing it puts its panels in **Add panel** for everyone who opens this MITI; nothing needs to be rebuilt or restarted.

## Import a widget

1. Open **Widgets** in the activity bar on the left (the puzzle piece).
2. Click **Import widget…** and choose the `.miti-widget` file, or drop the file on the Widgets view.
3. MITI shows the widget's name, version, id and author, and asks before importing it.
4. Click **+** in the title bar: the widget's panels are listed under **Widgets**, below MITI's own panels.

### From an address

A widget published on the web, such as a file in a GitHub release, can be imported without downloading it first: paste its address (`https://…/<id>-<version>.miti-widget`) in the field under **Import widget…** and click **Import**. MITI's server downloads it, shows its name, version and author, and asks before importing it.

Only `https` addresses on the public internet are downloaded, never machines on MITI's own network; for a widget kept on a local server, download the file and import it as above.

:::{warning}
A widget runs inside MITI with the same access as MITI: it reads any topic and, when foxglove_bridge allows it, publishes messages and calls services on the robot. Import widgets only from sources you trust.
:::

## Update a widget

Import the newer file. It replaces the installed version, and panels that use the widget start again with the new version, keeping their settings. Other browsers that have MITI open get the new version when they reload the page.

## Remove a widget

Click **Remove** under the widget in the Widgets view. Its panels stay in the layout with their settings and show **Widget not installed** until the widget is imported again.

## Where widgets are kept

Widgets are kept by the MITI server, so every browser and kiosk screen that opens this MITI has them:

| MITI runs with               | Widgets are in                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| The apt package's service    | `/var/lib/miti/widgets`                                                                   |
| `miti run`                   | `~/.config/miti/widgets`                                                                  |
| pixi, or a build from source | `.miti/widgets` in the MITI folder                                                        |
| Docker                       | `/data/widgets` in the container; `docker-compose.yml` keeps it in the `miti-data` volume |

`MITI_STATE_DIR` moves the folder; see {doc}`../reference/configuration`. To install a widget from a script instead of the browser, send the file to MITI:

```bash
curl -H 'Content-Type: application/octet-stream' \
  --data-binary @acme.vision-1.0.0.miti-widget http://<miti-host>:3000/api/widgets
```

## Turn importing off

On a kiosk, or a network where not everyone should add code to MITI, set `MITI_WIDGET_IMPORT=off` where MITI runs. Installed widgets still load, but the browser can no longer import or remove them.

## When a widget does not load

The **Problems** icon shows a count, and each widget that failed to load says why, for example that it needs a newer version of MITI. Its panels show **Widget failed to load** with the same message. Import a version of the widget made for this MITI, or remove it.
