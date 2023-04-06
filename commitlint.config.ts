import type { UserConfig } from '@commitlint/types'

const Configuration: UserConfig = {
  extends: ['@commitlint/config-angular'],
  rules: {
    'header-max-length': [2, 'always', 80],
    'type-enum': [
      2,
      'always',
      [
        'build',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'release',
        'revert',
        'style',
        'test',
        'chore',
      ],
    ],
  },
  ignores: [(commit) => commit.startsWith('Update package.json')],
}

export default Configuration
