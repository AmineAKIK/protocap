import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackingRun } from '../domain/packingRun';
import { PackingFrozenPreparation, PackingPlanningRail, type PackingPlanningFormState } from './PackingPlanningRail';

const emptyForm: PackingPlanningFormState = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  productionStartTime: '',
  referenceCadence: '',
};

function renderPlanningRail(form: PackingPlanningFormState = emptyForm) {
  render(
    <PackingPlanningRail
      form={form}
      input={null}
      calculation={null}
      selectedPolicy={null}
      fieldErrors={{}}
      combinationInvalid={false}
      canLaunch={false}
      launchGuidance="À compléter : Quantité demandée"
      isLaunching={false}
      hasPreparationData={false}
      persistenceDegraded={false}
      onFieldChange={vi.fn()}
      onFieldBlur={vi.fn()}
      onSelectPolicy={vi.fn()}
      onLaunch={vi.fn()}
      onReset={vi.fn()}
    />,
  );
}

afterEach(() => {
  Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
  vi.restoreAllMocks();
});

describe('PackingPlanningRail preparation semantics', () => {
  it('keeps unavailable strategies as disabled radios inside the radio group', () => {
    renderPlanningRail();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect((radio as HTMLButtonElement).disabled).toBe(true);
      expect(radio.getAttribute('aria-checked')).toBe('false');
      expect(radio.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('keeps the incomplete-carton quantity visible in the frozen run reference', () => {
    const run: PackingRun = {
      id: 'run-partial-detail',
      createdAt: '2026-09-15T07:30:00.000Z',
      productionStartedAt: '2026-09-15T07:30:00.000Z',
      requestedUnits: 1_050,
      unitsPerCarton: 100,
      cartonsPerLoad: 8,
      selectedPolicy: 'no-overrun',
      plannedUnits: 1_050,
      varianceUnits: 0,
      referenceCadenceUnitsPerMinute: 60,
      declarations: [],
    };

    render(<PackingFrozenPreparation run={run} onModify={vi.fn()} />);

    expect(screen.getByLabelText('Préparation figée').textContent)
      .toContain('1 partielle (2 cartons complets + 1 carton incomplet de 50 unités)');
  });
});

describe('PackingPlanningRail OC start picker', () => {
  it('keeps the native datetime input out of the visual layer and opens it from the custom shell', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });

    renderPlanningRail();

    const input = screen.getByLabelText('Début OC') as HTMLInputElement;
    expect(input.type).toBe('datetime-local');
    expect(input.classList.contains('packing-v3-datetime-native')).toBe(true);
    expect(input.tabIndex).toBe(-1);

    const trigger = screen.getByRole('button', { name: 'Choisir la date et l’heure de début OC' });
    expect(trigger.textContent).toBe('');
    fireEvent.click(trigger);

    expect(showPicker).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });

  it('shows only the formatted selected value in the visual shell', () => {
    renderPlanningRail({ ...emptyForm, productionStartTime: '2026-09-16T05:42' });

    expect(screen.getByRole('button', { name: 'Début OC : 16/09/2026 · 05:42' }).textContent)
      .toContain('16/09/2026 · 05:42');
  });

  it('blocks paste and drop on the technical native input', () => {
    renderPlanningRail();
    const input = screen.getByLabelText('Début OC') as HTMLInputElement;

    expect(fireEvent.paste(input)).toBe(false);
    expect(fireEvent.drop(input)).toBe(false);
  });

  it('opens the picker from the visible control with Enter', () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
      configurable: true,
      value: showPicker,
    });
    renderPlanningRail();

    const trigger = screen.getByRole('button', { name: 'Choisir la date et l’heure de début OC' });
    expect(fireEvent.keyDown(trigger, { key: 'Enter' })).toBe(false);
    expect(showPicker).toHaveBeenCalledOnce();
  });

  it('falls back to clicking the native datetime input when showPicker is unavailable', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    renderPlanningRail();

    const input = screen.getByLabelText('Début OC') as HTMLInputElement;
    expect('showPicker' in input).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Choisir la date et l’heure de début OC' }));

    expect(click).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
  });
});
