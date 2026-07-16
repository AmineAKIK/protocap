import { describe, expect, it } from 'vitest'

import { quantizeDecimal } from '../decimal'
import {
  calculateMachineSetpoint,
  calculateTargets,
  calculateTargetsFromProfiles,
  estimateVolumeFromGrossMass,
} from '../targets'
import {
  calibrationProfile,
  machineProfile,
  packagingProfile,
  productProfile,
} from './fixtures'

describe('cibles et consignes machine', () => {
  it('conserve les valeurs exactes du cas de référence', () => {
    expect(
      calculateTargets({ volumeMl: '5.17', densityGPerMl: '1.019', tareG: '5.00' }),
    ).toEqual({
      volumeMl: '5.17',
      densityGPerMl: '1.019',
      netMassG: '5.26823',
      tareG: '5',
      grossMassG: '10.26823',
    })
  })

  it('arrondit uniquement la consigne présentée selon une résolution arbitraire', () => {
    const targets = calculateTargetsFromProfiles(productProfile(), packagingProfile())
    const net = calculateMachineSetpoint(targets, machineProfile())
    const gross = calculateMachineSetpoint(
      targets,
      machineProfile({ setpointType: 'gross_mass', unit: 'g' }),
    )
    const volume = calculateMachineSetpoint(
      targets,
      machineProfile({ setpointType: 'volume', unit: 'mL' }),
    )

    expect(net.kind).toBe('direct')
    expect(net.kind === 'direct' && net.value).toMatchObject({ exact: '5.26823', quantized: '5.27' })
    expect(gross.kind === 'direct' && gross.value.quantized).toBe('10.27')
    expect(volume.kind === 'direct' && volume.value.quantized).toBe('5.17')
    expect(targets.netMassG).toBe('5.26823')
  })

  it('quantifie par incrément, pas seulement par nombre de décimales', () => {
    expect(quantizeDecimal('1.03', '0.05', 'nearest_half_up')).toBe('1.05')
    expect(quantizeDecimal('1.025', '0.05', 'nearest_half_even')).toBe('1')
    expect(quantizeDecimal('1.001', '0.01', 'up')).toBe('1.01')
    expect(quantizeDecimal('1.009', '0.01', 'down')).toBe('1')
  })

  it('réutilise exactement la tare et la masse volumique pour la conversion inverse', () => {
    expect(estimateVolumeFromGrossMass('10.26823', '5', '1.019')).toBe('5.17')
    expect(() => estimateVolumeFromGrossMass('4.99', '5', '1.019')).toThrow(
      /inférieure à la tare/,
    )
  })

  it('ne fabrique aucune position mécanique sans calibration', () => {
    const targets = calculateTargetsFromProfiles(productProfile(), packagingProfile())
    const result = calculateMachineSetpoint(
      targets,
      machineProfile({
        setpointType: 'mechanical',
        unit: 'graduation',
        resolution: '0.1',
        minimum: '0',
        maximum: '50',
        increaseDirection: 'clockwise',
      }),
    )
    expect(result.kind).toBe('mechanical_without_calibration')
  })

  it('propose une position seulement dans le domaine d’une calibration vérifiée', () => {
    const targets = calculateTargetsFromProfiles(productProfile(), packagingProfile())
    const machine = machineProfile({
      setpointType: 'mechanical',
      unit: 'graduation',
      resolution: '0.1',
      minimum: '0',
      maximum: '50',
      increaseDirection: 'clockwise',
    })
    const result = calculateMachineSetpoint(targets, machine, calibrationProfile())
    expect(result.kind).toBe('mechanical_estimate')
    expect(result.kind === 'mechanical_estimate' && result.value).toMatchObject({
      exact: '26.34115',
      quantized: '26.3',
    })
  })

  it('bloque une consigne hors capacité', () => {
    const targets = calculateTargetsFromProfiles(productProfile(), packagingProfile())
    expect(() =>
      calculateMachineSetpoint(targets, machineProfile({ maximum: '5' })),
    ).toThrow(/hors de la plage/)
  })
})

