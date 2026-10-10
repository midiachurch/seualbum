import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Regras novas do eslint-plugin-react-hooks v7 (derivadas do React
      // Compiler). O código existente foi escrito antes delas e as acusa em
      // vários componentes (editor de álbum, prova, admin). Corrigir exige
      // reestruturar estado/efeitos/refs caso a caso, com risco de mudar
      // comportamento, então ficam como aviso até serem tratadas uma a uma.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
