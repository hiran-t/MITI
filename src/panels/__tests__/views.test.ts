import { listViews, registerViews, unregisterViews, type SidebarViewDefinition } from '../views';

const Component = () => null;
const view = (id: string, label = id): SidebarViewDefinition => ({
  id,
  label,
  component: Component,
});

afterEach(() => {
  listViews().forEach((v) => unregisterViews(v.source));
});

test("lists views in the order widgets registered them, and replaces a widget's views", () => {
  registerViews('acme.cell', [view('acme.cell/robots', 'Robots'), view('acme.cell/tools')]);
  registerViews('acme.vision', [view('acme.vision/models')]);
  expect(listViews().map((v) => [v.id, v.source])).toEqual([
    ['acme.cell/robots', 'acme.cell'],
    ['acme.cell/tools', 'acme.cell'],
    ['acme.vision/models', 'acme.vision'],
  ]);

  registerViews('acme.cell', [view('acme.cell/scene')]);
  expect(listViews().map((v) => v.id)).toEqual(['acme.vision/models', 'acme.cell/scene']);

  unregisterViews('acme.vision');
  expect(listViews().map((v) => v.id)).toEqual(['acme.cell/scene']);
});

test("refuses a widget's views when one is invalid, and keeps what it registered before", () => {
  registerViews('acme.cell', [view('acme.cell/robots')]);
  expect(() => registerViews('acme.cell', [view('other/robots')])).toThrow(
    'must start with "acme.cell/"'
  );
  expect(() => registerViews('acme.cell', [view('acme.cell/a', ' ')])).toThrow('needs a label');
  expect(() =>
    registerViews('acme.cell', [{ id: 'acme.cell/a', label: 'A' } as SidebarViewDefinition])
  ).toThrow('needs a component');
  expect(() => registerViews('acme.cell', [view('acme.cell/a'), view('acme.cell/a')])).toThrow(
    'is listed twice'
  );
  expect(listViews().map((v) => v.id)).toEqual(['acme.cell/robots']);
});
