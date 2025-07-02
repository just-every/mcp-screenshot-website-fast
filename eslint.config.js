// Import the recommended rules from eslint and @typescript-eslint
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
    // Base configuration with ESLint defaults
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    // Add Prettier config to disable conflicting rules
    eslintConfigPrettier,
    
    // Global ignores
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            'vitest.config.ts',
        ],
    },

    // Project-specific configuration
    {
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 2022,
            sourceType: 'module',
            parserOptions: {
                project: [
                    './tsconfig.eslint.json',
                ],
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': [
                'error',
                { allowDeclarations: true },
            ],
            'no-console': 'off',
        },
        files: ['**/*.ts'],
    },
    // Add Prettier plugin rules
    {
        plugins: {
            prettier: eslintPluginPrettier,
        },
        rules: {
            'prettier/prettier': 'error',
        },
    },
    // Node.js scripts configuration
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Add Node.js globals to prevent undefined warnings
                process: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly'
            }
        },
        files: ['scripts/**/*.js'],
    },
];
