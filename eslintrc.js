module.exports = {
    root: true,
    ignorePatterns: ['artifacts/', 'cache/', 'node_modules/', "**/artifacts/",  "**/*.d.ts", 'hardhat/artifacts/'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'prettier'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended' // Make sure this is always the last configuration in the extends array.
    ],
    env: {
      node: true,
      es6: true,
    },
    overrides: [
      {
        files: ['*.ts', '*.tsx'], // Your TypeScript files extension
        parserOptions: {
          project: ['./tsconfig.json'], // Path to your TS config file
          tsconfigRootDir: __dirname,
        },
      },
    ],
    rules: {
      // Your custom rules here
      'prettier/prettier': 'error',
    },
  };
