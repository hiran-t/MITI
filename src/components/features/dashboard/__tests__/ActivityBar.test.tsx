import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ActivityBar, { sidebarViewLabel } from '../ActivityBar';
import type { RegisteredSidebarView } from '@/panels/views';

const Wrench = () => <svg data-testid="wrench" />;
const views: RegisteredSidebarView[] = [
  { id: 'acme.cell/robots', label: 'Robots', component: () => null, source: 'acme.cell' },
  {
    id: 'acme.cell/tools',
    label: 'Tools',
    icon: Wrench,
    component: () => null,
    source: 'acme.cell',
  },
];

test("widgets' views follow the built-in tabs and open like them", () => {
  const onSelect = jest.fn();
  const onFocusTab = jest.fn();
  render(
    <ActivityBar
      activeTab="Topics"
      sidebarOpen
      problemCount={0}
      views={views}
      activeRef={createRef()}
      onSelect={onSelect}
      onFocusTab={onFocusTab}
    />
  );
  expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual([
    'Panel settings',
    'Topics',
    'Problems',
    'Sources',
    'Widgets',
    'Robots',
    'Tools',
  ]);
  expect(screen.getByTestId('wrench')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Robots' }));
  expect(onSelect).toHaveBeenCalledWith('acme.cell/robots');
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Tools' }), { key: 'ArrowDown' });
  expect(onFocusTab).toHaveBeenLastCalledWith('Panel');

  expect(sidebarViewLabel('acme.cell/tools', views)).toBe('Tools');
  expect(sidebarViewLabel('Sources', views)).toBe('Sources');
});

test('without views the bar has only the built-in tabs', () => {
  render(
    <ActivityBar
      activeTab="Topics"
      sidebarOpen={false}
      problemCount={2}
      activeRef={createRef()}
      onSelect={jest.fn()}
      onFocusTab={jest.fn()}
    />
  );
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  expect(screen.getByRole('tab', { name: 'Problems' })).toHaveTextContent('2');
});
