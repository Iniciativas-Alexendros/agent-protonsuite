# Contribuir a `@alexendros/protonmail-agent`

Gracias por considerar contribuir. Este proyecto es pequeño y enfocado: exponer las capacidades de Proton Mail a clientes MCP **a través de Bridge**, y añadir una capa de agente autónomo para organización, alertas y configuración guiada.

> 🔒 **Seguridad:** NO abras una issue o PR pública. Escribe a **security@alexendros.me** o usa [GitHub Security Advisories](https://github.com/Iniciativas-Alexendros/agent-protonmail/security/advisories/new). Ver [SECURITY.md](./SECURITY.md) para el threat model completo.

## Formas de contribuir

- **🐛 Reportar un bug** — usa la [plantilla de bug](./.github/ISSUE_TEMPLATE/bug-report.yml). Incluye versión, transporte, Node, SO y pasos de reproducción.
- **💡 Proponer una feature** — usa la [plantilla de feature](./.github/ISSUE_TEMPLATE/feature-request.yml). Sé concreto: nombre de tool, inputs, outputs, o capacidad de agente. El alcance es siempre a través de Bridge; no uses la API web directa de Proton.
- **💬 Preguntar** — usa [Discussions](https://github.com/Iniciativas-Alexendros/agent-protonmail/discussions), no el issue tracker.
- **🧑‍💻 Enviar un patch** — lee el workflow de PR abajo.

## Workflow de pull request

1. **Abre o enlaza una issue primero.** PRs sin issue asociada pueden cerrarse.
2. **Fork + rama.** Nombres: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`, `agent/<slug>`.
3. **Desarrolla.** Sigue la checklist de la [plantilla de PR](./.github/PULL_REQUEST_TEMPLATE.md).
4. **Abre el PR** contra `main` y rellena la plantilla.
5. **Itera.** Revisión normalmente en una semana. Rebase sobre `main` en lugar de merge.
6. **Merge.** Squash-merge por defecto una vez CI verde y revisión aprobada.

## Desarrollo local

Requiere Node ≥ 22 y Proton Mail Bridge corriendo en local (o en Docker) para tests de integración con Bridge real.

```bash
# 1. Clone + install
git clone https://github.com/Iniciativas-Alexendros/agent-protonmail.git
cd agent-protonmail
npm install

# 2. Configura entorno
cp .env.example .env
# Rellena PROTON_BRIDGE_USER y PROTON_BRIDGE_PASS como mínimo.

# 3. Build + verifica
npm run build         # tsc → dist/
npm run typecheck     # tsc --noEmit
npm test              # vitest run
npm run smoke         # smoke stdio

# 4. Ejecuta agente o MCP localmente
npx protonmail-agent setup       # verifica conexión a Bridge
npx protonmail-agent organize    # plan de organización (dry-run por defecto)
npx protonmail-mcp               # MCP server en stdio
# o
PORT=3000 node dist/index.js     # MCP server HTTP en :3000
```

Para depurar HTTP, el [MCP inspector](https://github.com/modelcontextprotocol/inspector) es útil:

```bash
npm run inspect
```

## Convenciones de código

- **Lenguaje:** TypeScript strict (`"strict": true`). Sin `any` nuevo sin comentario justificando.
- **Módulos:** ES Modules (`"type": "module"`). Usa named exports.
- **Manejo de errores:** valida en los boundaries con Zod (`src/config.ts` es la referencia). Nunca tragues errores en silencio: log a stderr y relanza o devuelve un error tipado.
- **Logging:** stderr only. El transporte stdio reserva stdout para el protocolo. Usa el logger existente en `src/config.ts`.
- **Tests:** Vitest. Añade tests en `tests/`. Refleja la estructura (`src/foo.ts` → `tests/foo.test.ts`). Deterministas: sin red real ni Bridge real en unit tests.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat(imap):`, `fix(http):`, `chore(deps):`, `docs:`, `refactor:`, `test:`, `ci:`, `agent(organizer):`).
- **API pública:** todo lo exportado desde `src/index.ts`, `src/agent/index.ts` o registrado en `tools/list` es público. Cambios breaking requieren bump major de SemVer y un footer `BREAKING CHANGE:` en el commit.
- **Agente:** las funciones de agente viven en `src/agent/`. Nunca deben importar `src/server.ts` ni `src/http.ts` para evitar dependencias circulares.
- **Licencias:** `npm run license-check` y `npm run license-check:prod` deben pasar. Nuevas dependencias deben ser compatibles con AGPL-3.0.

## Política de triaje de issues

Al abrir una issue se añade la etiqueta `triage`. El mantenedor:

- **En 7 días:** reconocer, pedir aclaración o etiquetar severidad (`critical` / `bug` / `enhancement` / `wontfix` / `duplicate`).
- **Bugs críticos** (data loss, auth bypass, secret leak): parche ASAP y hotfix release.
- **Bugs:** planificados para la siguiente minor release.
- **Features:** evaluadas contra el alcance; pueden aplazarse o rechazarse con explicación.
- **Issues stale:** sin respuesta del reportero en 30 días pueden cerrarse con etiqueta `stale`. Comenta para reabrir.

## Código de conducta

La participación se rige por el [Contributor Covenant](./CODE_OF_CONDUCT.md). Violaciones: reportar a **conduct@alexendros.me**.

## Licencia

Al enviar un PR aceptas que tu contribución se licencia bajo la [AGPL-3.0](./LICENSE) de este repositorio.
