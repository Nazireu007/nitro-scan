export const symptomPatterns = [
  {
    id: 'no-power',
    title: 'Aparelho não liga',
    relatedBehaviors: ['forced-command-functional-source', 'cpu-no-activity'],
  },
  {
    id: 'standby-present-no-boot',
    title: 'Standby presente sem boot',
    relatedBehaviors: ['spi-powered-no-boot', 'cpu-no-activity'],
  },
  {
    id: 'rail-collapses',
    title: 'Trilho colapsa sob carga',
    relatedBehaviors: ['shorted-rail'],
  },
  {
    id: 'regulator-no-output',
    title: 'Regulador sem saída',
    relatedBehaviors: ['buck-vin-enable-no-output', 'ldo-no-output', 'buck-no-enable'],
  },
];
