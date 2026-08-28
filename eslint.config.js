// eslint.config.js — Flat config (ESLint 9)
//
// El repo instala eslint ^9.x, que por defecto solo lee `eslint.config.js`
// (flat config) y ya no lee `.eslintrc.js` (formato legacy). Este archivo
// traduce la configuración legacy que sigue viviendo en `.eslintrc.js`
// usando `FlatCompat` (paquete `@eslint/eslintrc`, ya presente en
// node_modules como dependencia transitiva de eslint 9), en vez de migrar
// la configuración a mano o downgradear eslint a la rama 8.x — es la
// opción de menor riesgo/esfuerzo porque no requiere tocar
// package.json/npm install ni reescribir las reglas existentes.
//
// Ver progress/impl_fix-test-infra-backend.md para el detalle de la
// decisión.

const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...compat.config({
    parser: '@typescript-eslint/parser',
    parserOptions: {
      project: 'tsconfig.json',
      tsconfigRootDir: __dirname,
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin'],
    extends: [
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended',
    ],
    env: {
      node: true,
      jest: true,
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }),

  // ------------------------------------------------------------------
  // Deuda de lint preexistente, ajena a la feature fix-test-infra-backend
  // ------------------------------------------------------------------
  // Antes de este eslint.config.js, `npm run lint` no podía ejecutarse en
  // absoluto (error de configuración: eslint ^9 sin flat config), así que
  // nunca reportó ni un solo warning real. Al arreglar la configuración,
  // aparecen violaciones reales preexistentes de @typescript-eslint/no-unused-vars
  // y prettier/prettier en controllers/services/dtos/pipes de negocio real
  // y en specs que esta feature tiene explícitamente prohibido modificar
  // (ver acceptance de fix-test-infra-backend en feature_list.json: "No se
  // debe modificar la lógica de negocio del backend — solo tests,
  // mocks/fixtures, y configuración de eslint"; bachcalls.controller.spec.ts
  // y webhooks.service.spec.ts además están marcados explícitamente como
  // "no tocar" en esta feature). Se documentan aquí, acotadas archivo por
  // archivo y regla por regla (no se relaja la regla para el resto del
  // repo), siguiendo el mismo patrón que .flake8 per-file-ignores usado en
  // fix-test-infra-pipe-writing (feature 2). Limpiarlas requiere su propia
  // feature con spec — no son parte del alcance de esta.
  {
    files: [
      'src/core/database/firestore.repository.ts',
      'src/shared/pipes/validations/security-validation.pipe.ts',
      'src/shared/services/excel-csv-processor.service.ts',
      'src/modules/bachcalls/dto/buscar-registros-sftp-response.dto.ts',
      'src/modules/conversations/dto/conversation-by-id-response.dto.ts',
      'src/modules/conversations/dto/list-conversation.dto.ts',
      'src/modules/bachcalls/bachcalls.controller.spec.ts',
      'src/modules/webhooks/webhooks.controller.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: [
      'src/modules/generics/dtos/create-generic.dto.ts',
      'src/modules/generics/dtos/update-generic.dto.ts',
      'src/modules/generics/generics.service.ts',
      'src/modules/webhooks/webhooks.controller.ts',
      'src/modules/webhooks/webhooks.service.ts',
      'src/modules/webhooks/webhooks.service.spec.ts',
      'src/shared/interceptors/csrf.interceptor.ts',
    ],
    rules: {
      'prettier/prettier': 'off',
    },
  },
];
