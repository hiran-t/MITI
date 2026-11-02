# Write a Widget

In this tutorial you start a widget from the template, change its panel, build a `.miti-widget` file and import it into MITI, and then keep it imported while you work on it. The widget lives in its own repository; MITI itself does not change.

You need Node.js 20 or newer, Git, and a running MITI to import the widget into.

## Start from the template

[MITI-widget-dev](https://github.com/hiran-t/MITI-widget-dev) is a template holding a working widget, **Gauge**, a panel that shows a number from any topic as a dial. On GitHub, click **Use this template** to make your own repository from it, then clone that and install:

```bash
git clone https://github.com/<you>/<your-widget>.git
cd <your-widget>
npm install
```

`npm install` brings `@miti/sdk` from [MITI-widget-sdk](https://github.com/hiran-t/MITI-widget-sdk): the types of what MITI gives widgets, and the `miti-widget` command that builds them. The folder holds:

```
manifest.json                 the widget's id, name and version
package.json                  npm run build, npm run dev, npm run type-check
tsconfig.json
src/index.tsx                 the widget and its panels
.github/workflows/build.yml   builds the widget, and publishes it in a release for a tag
```

## Name the widget

`manifest.json` names the widget. The template's is `example.gauge`; give yours its own id, here `acme.gauge`, and your name as `author`:

```json
{
  "id": "acme.gauge",
  "name": "Gauge",
  "version": "1.0.0",
  "description": "Shows a number from any topic as a dial.",
  "author": "Acme",
  "miti": { "apiVersion": 1 }
}
```

The `id` is lowercase words joined by dots or dashes, usually your company and the widget, such as `acme.vision`. It never changes once people use the widget: layouts store it in the types of the widget's panels. `miti.apiVersion` is the version of `@miti/sdk` the widget is written for. Rename the package in `package.json` too.

## Change the panel

Open `src/index.tsx`. It exports the widget as its default, and starts with the panel's settings and their defaults:

```tsx
import {
  definePanel,
  defineWidget,
  PanelSettings,
  TextField,
  TopicInput,
  TreeField,
  TreeSection,
  useTopic,
  type PanelProps,
} from '@miti/sdk';

interface GaugeConfig {
  topic: string;
  field: string;
  min: number;
  max: number;
  unit: string;
}

const DEFAULTS: GaugeConfig = {
  topic: '/joint_states',
  field: 'position[0]',
  min: -3.14,
  max: 3.14,
  unit: 'rad',
};
```

The panel is a React component. MITI gives it `PanelProps`: its settings as `config`, `updateConfig` to change them, `client` to talk to the robot (null while MITI is not connected) and the robot's `topics`. `useTopic` subscribes to a topic and returns its newest message; MITI unsubscribes when the panel closes:

```tsx
function Gauge({ client, topics, config, updateConfig }: PanelProps<GaugeConfig>) {
  // A dial cannot show more than ten updates a second; skip decoding the rest.
  const { data } = useTopic(client, config.topic, undefined, { throttleRate: 100 });
  const raw = readField(data, config.field);
  const value = typeof raw === 'number' ? raw : null;

  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <span style={{ fontSize: 32, color: 'var(--miti-text-strong)' }}>
        {value ?? '—'} {config.unit}
      </span>
      <PanelSettings>
        <TreeSection title="Gauge">
          <TreeField label="Topic">
            <TopicInput
              value={config.topic}
              topics={topics}
              onCommit={(topic) => updateConfig({ topic })}
            />
          </TreeField>
          <TextField
            label="Field"
            value={config.field}
            onCommit={(field) => updateConfig({ field })}
          />
        </TreeSection>
      </PanelSettings>
    </div>
  );
}
```

`PanelSettings` shows its content in the sidebar while the panel is selected, laid out like MITI's own panel settings. `updateConfig` saves the change with the layout. Colors come from MITI's CSS variables, such as `--miti-text-strong` and `--miti-accent`, so the panel matches MITI.

The template's Gauge draws an arc instead of plain text and adds **Min**, **Max** and **Unit** with `NumberField` and `TextField`; `readField` follows a path such as `position[0]` into the message.

At the end, the widget is exported with its panel:

```tsx
export default defineWidget({
  panels: [
    definePanel<GaugeConfig>({
      type: 'acme.gauge/gauge',
      label: 'Gauge',
      description: 'A number from any topic, as a dial',
      defaultConfig: () => ({ ...DEFAULTS }),
      normalizeConfig: (stored) => ({ ...DEFAULTS, ...(stored as Partial<GaugeConfig>) }),
      component: Gauge,
    }),
  ],
});
```

A panel's `type` starts with the widget's id and a slash: change the template's `example.gauge/gauge` to `acme.gauge/gauge`. `defaultConfig` gives a new panel its settings; `normalizeConfig` turns saved settings into the current shape, which matters once a later version of the widget adds a setting.

Check the code against `@miti/sdk`:

```bash
npm run type-check
```

## Build and import it

```bash
npm run build
```

`miti-widget build` bundles `src/index.tsx` into one file and writes `dist/acme.gauge-1.0.0.miti-widget`. React and `@miti/sdk` are not copied into it: the widget uses the ones MITI runs. Other npm packages the widget imports, such as an icon set or a charting library, are bundled in.

Open MITI, click **Widgets** in the activity bar, then **Import widget…**, and choose the file. Add the panel with **+ → Gauge**, select it, and set **Topic** and **Field** to a number the robot publishes, for example `/joint_states` and `position[0]`.

## Work on it with MITI open

```bash
npm run dev
```

`miti-widget dev` builds the widget again on every change to `src/` or `manifest.json` and imports it into the MITI at `http://localhost:3000`; reload MITI's page to see the change. Build errors are printed with their file and line. For a MITI elsewhere, change the address after `--miti` in `package.json`'s `dev` script.

## Release it

Raise `version` in `manifest.json`, commit, and push a tag with that version:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions builds the widget and publishes the `.miti-widget` file in a GitHub release, where people download it to import into MITI. Importing a newer version replaces the old one, and panels keep their settings.

## Next steps

- {doc}`../reference/widget-sdk` lists what `@miti/sdk` offers, including calling services and showing camera images, with patterns for a robot driver panel and a vision panel.
- {doc}`../how-to-guides/install-a-widget` covers updating, removing and where MITI keeps widgets.
