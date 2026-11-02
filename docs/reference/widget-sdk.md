# Widget SDK

What a widget is made of, and what `@miti/sdk` gives its panels. {doc}`../tutorials/write-a-widget` builds one step by step.

Widgets are made outside MITI, in their own repositories:

| Repository                                                    | Holds                                                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [MITI-widget-sdk](https://github.com/hiran-t/MITI-widget-sdk) | The `@miti/sdk` package: the types of this API (`index.d.ts`) and the `miti-widget` command that builds widgets                           |
| [MITI-widget-dev](https://github.com/hiran-t/MITI-widget-dev) | A template to start a widget from: the Gauge panel, `npm run build`, `npm run dev`, and a workflow that publishes the widget in a release |

A widget's repository installs `@miti/sdk` from GitHub:

```bash
npm install --save-dev "@miti/sdk@git+https://github.com/hiran-t/MITI-widget-sdk.git" react @types/react typescript
```

## API version

This MITI provides widget API **1**, which `@miti/sdk` 1.x describes. A widget declares the version it is written for in `manifest.json` as `miti.apiVersion`, and MITI imports only widgets of its own API version. Within one version, what this page lists keeps working; new things are only added. A change that would break widgets comes with a new API version. Anything in MITI that this page does not list may change in any release. MITI-widget-sdk's CI checks that MITI provides everything its `index.d.ts` declares.

## Package

A widget is a `.miti-widget` file: a zip with, at its root,

| File            | Holds                                                                        |
| --------------- | ---------------------------------------------------------------------------- |
| `manifest.json` | The widget's name and version (below)                                        |
| `index.js`      | An ES module whose default export is `defineWidget({ panels: [...] })`       |
| Other files     | Optional, e.g. `README.md` and `LICENSE`; folders and `.`-files are left out |

A package is at most 20 MB, unpacks to at most 64 MB and holds at most 500 files. `miti-widget build` makes one from a folder with `manifest.json` and `src/index.tsx`.

### manifest.json

| Field             | Required | Value                                                                       |
| ----------------- | -------- | --------------------------------------------------------------------------- |
| `id`              | Yes      | Lowercase words joined by dots or dashes, e.g. `acme.vision`; never changes |
| `name`            | Yes      | Shown in the Widgets view, at most 80 characters                            |
| `version`         | Yes      | `major.minor.patch`, optionally with `-prerelease`                          |
| `miti.apiVersion` | Yes      | The widget API the widget is written for: `1`                               |
| `description`     | No       | One or two sentences                                                        |
| `author`          | No       | Person or company                                                           |
| `homepage`        | No       | An `http` or `https` address                                                |
| `license`         | No       | E.g. `MIT` or `Proprietary`                                                 |
| `main`            | No       | The module to load; `miti-widget build` sets it to `index.js`               |

### What the build does

`miti-widget build` bundles the widget's code into one ES module with esbuild, and `miti-widget dev --miti <MITI address>` does it again on every change and imports the result into that MITI:

- `react`, `react-dom`, `react/jsx-runtime` and `@miti/sdk` are not bundled: the widget uses the copies MITI runs, so its hooks, contexts and components work together with MITI's. Other parts of React (for example `react-dom/client`) cannot be imported.
- Any other npm package the widget imports is bundled in.
- TypeScript and JSX are compiled; the result is minified.

## Panels

### definePanel

```typescript
definePanel<Config>({
  type: string;            // '<widget id>/<name>', saved in layouts; never changes
  label: string;           // in Add panel, and the title of a new panel
  description?: string;    // shown when pointing at it in Add panel
  icon?: ComponentType<{ className?: string }>; // e.g. an icon from lucide-react
  defaultConfig?: () => Config;              // settings of a new panel
  normalizeConfig?: (stored: unknown) => Config; // saved settings → current settings
  component: ComponentType<PanelProps<Config>>;
})
```

`normalizeConfig` receives what the layout saved, which may be missing, or come from an older version of the widget; return complete settings. Without it the panel gets the saved settings unchanged.

### PanelProps

| Prop            | Type                               | Meaning                                                             |
| --------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `id`            | `string`                           | The panel's id in the layout                                        |
| `config`        | `Config`                           | The panel's settings                                                |
| `updateConfig`  | `(patch: Partial<Config>) => void` | Merge changes into the settings; they are saved with the layout     |
| `setConfig`     | `(config: Config) => void`         | Replace the settings                                                |
| `client`        | `MitiClient \| null`               | The connection to foxglove_bridge; null while MITI is not connected |
| `topics`        | `TopicInfo[]`                      | The bridge's topics: `{ topic, type }`                              |
| `topicsLoading` | `boolean`                          | Whether the topic list is being read                                |
| `refreshTopics` | `() => void`                       | Read the topic list again                                           |

A panel that throws shows the error and a **Reload panel** button; the other panels keep running.

### MitiClient

| Method                                        | Does                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `subscribe(topic, callback, type?, options?)` | Calls `callback` with each decoded message; `options`: `maxRate` (Hz), `throttleMs`. Prefer `useTopic` |
| `unsubscribe(topic, callback)`                | Stops calling `callback`                                                                               |
| `advertise(topic, type)`                      | Declares a topic to publish on, e.g. `('/cmd', 'std_msgs/msg/String')`                                 |
| `publish(topic, message)`                     | Publishes a message, as a plain object; needs the bridge's `clientPublish` capability                  |
| `callService(name, request?)`                 | Calls a service; resolves with the response, rejects after 5 s or when the service is missing          |
| `getParameter(name)`                          | Reads a parameter named `/node.parameter`                                                              |
| `getServerTime()`                             | The robot's clock in seconds, when the bridge reports it, else `null`                                  |
| `hasCapability(name)`                         | E.g. `clientPublish`, `services`, `parameters`                                                         |
| `getTopics()`, `onTopicsChanged(callback)`    | The bridge's topics, and a callback when they change (returns a function that stops it)                |
| `isConnected()`                               | Whether the bridge connection is open                                                                  |

## What @miti/sdk exports

| Export                                                                                                              | For                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineWidget`, `definePanel`                                                                                       | The widget's default export and its panels                                                                                                                                                     |
| `useTopic(client, topic, type?, { throttleRate?, maxRate? })`                                                       | `{ data, lastUpdate }`: the newest message of a topic. `throttleRate` (ms) limits re-renders, `maxRate` (Hz) how many messages are decoded. While the panel is hidden it keeps only the newest |
| `useTF({ client, tfTopics?, enabled? })`                                                                            | `{ tfTree }`: the TF frames                                                                                                                                                                    |
| `usePanelVisible()`                                                                                                 | Whether the panel is shown (false while another panel is expanded)                                                                                                                             |
| `ImageCanvas`                                                                                                       | The newest frame of a `sensor_msgs/Image` or `CompressedImage` topic, fitted to the panel, with a `draw` callback to paint over it in image pixels                                             |
| `PanelSettings`                                                                                                     | Shows its children in the sidebar while the panel is selected                                                                                                                                  |
| `PanelStatus`                                                                                                       | Shows its children in the panel's tab, e.g. a rate or a state                                                                                                                                  |
| `TreeSection`, `TreeField`, `TextField`, `NumberField`, `ToggleField`, `SelectField`, `ColorField`, `SliderField`   | Settings laid out like MITI's own panels; text and number fields report a value on Enter or when they lose focus                                                                               |
| `SettingsSection`                                                                                                   | A simpler group of settings that opens and closes                                                                                                                                              |
| `TopicInput`                                                                                                        | A topic field that suggests the bridge's topics; `messageType` limits the suggestions                                                                                                          |
| `API_VERSION`                                                                                                       | The widget API of the MITI the widget runs in                                                                                                                                                  |
| Types: `PanelProps`, `PanelDefinition`, `MitiClient`, `TopicInfo`, `TopicOptions`, `ImageFrame`, `WidgetDefinition` |                                                                                                                                                                                                |

### Styles

Widgets are styled with inline styles or their own CSS; MITI's Tailwind classes are not available to them. MITI's colors are CSS variables:

| Variable                                                     | Use                         |
| ------------------------------------------------------------ | --------------------------- |
| `--miti-bg-panel`, `--miti-bg-input`                         | Panel and field backgrounds |
| `--miti-text`, `--miti-text-strong`, `--miti-text-secondary` | Text                        |
| `--miti-border`, `--miti-border-strong`                      | Lines                       |
| `--miti-accent`                                              | Highlights, values          |
| `--miti-ok`, `--miti-warn`, `--miti-error`                   | States                      |
| `--miti-font-mono`                                           | Code and numbers            |

## Patterns

### A robot driver panel

A driver usually publishes its state and offers services to enable, disable or reset the robot. Show the state from its topic and call the services from buttons, waiting for each answer:

```tsx
import { useState } from 'react';
import { useTopic, type PanelProps } from '@miti/sdk';

function Driver({ client, config }: PanelProps<{ status: string; prefix: string }>) {
  const { data } = useTopic<{ mode: number; in_error: boolean }>(client, config.status);
  const [busy, setBusy] = useState(''); // the service being called
  const [error, setError] = useState('');
  const call = async (service: string) => {
    setBusy(service);
    setError('');
    try {
      await client?.callService(`${config.prefix}/${service}`, {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };
  return (
    <div style={{ padding: 12 }}>
      <p>{data ? (data.in_error ? 'Error' : `Mode ${data.mode}`) : 'No status'}</p>
      {['enable', 'disable', 'reset'].map((service) => (
        <button key={service} disabled={!client || busy !== ''} onClick={() => call(service)}>
          {service}
        </button>
      ))}
      {error && <p style={{ color: 'var(--miti-error)' }}>{error}</p>}
    </div>
  );
}
```

Ask before calling services that move the robot, and keep a hardware emergency stop at hand: a panel in a browser is not a safety system.

### A vision panel

`ImageCanvas` shows the camera, and its `draw` callback paints the vision node's results in the image's own pixel coordinates. Pass the results as `redraw` so the overlay updates when they change:

```tsx
import { ImageCanvas, useTopic, type PanelProps } from '@miti/sdk';

interface Detections {
  detections: {
    bbox: { center: { position: { x: number; y: number } }; size_x: number; size_y: number };
  }[];
}

function Vision({ client, config }: PanelProps<{ image: string; detections: string }>) {
  const { data } = useTopic<Detections>(client, config.detections);
  return (
    <ImageCanvas
      client={client}
      topic={config.image}
      maxFps={10}
      redraw={data}
      draw={(context) => {
        context.strokeStyle = '#2fb4c4';
        context.lineWidth = 2;
        for (const { bbox } of data?.detections ?? []) {
          const { x, y } = bbox.center.position;
          context.strokeRect(x - bbox.size_x / 2, y - bbox.size_y / 2, bbox.size_x, bbox.size_y);
        }
      }}
    />
  );
}
```

A trigger for the camera or the vision node is a button that calls its service, as in the driver panel.
