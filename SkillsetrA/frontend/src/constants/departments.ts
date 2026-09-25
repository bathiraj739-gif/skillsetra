export const DEPARTMENTS = [
  'AI&DS',
  'AI&ML',
  'BME',
  'CSE',
  'CSE(CS)',
  'ECE',
  'EEE',
  'MECH',
] as const

export type DepartmentName = typeof DEPARTMENTS[number]
