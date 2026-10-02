---
description: Crea un git worktree en .trees/[nombre] y ejecuta el requerimiento allí, aislado del código principal
argument-hint: <requerimiento a implementar>
---

Requerimiento: $ARGUMENTS

1. Deduce un nombre corto en kebab-case (2-3 palabras) a partir del requerimiento.
2. Crea el worktree desde la raíz del repo: `git worktree add .trees/<nombre> -b <nombre>`. Si la carpeta o la rama ya existen, elige otro nombre.
3. Lanza un agente con la herramienta Agent (run en segundo plano) cuyo prompt incluya el requerimiento completo y la ruta absoluta de `.trees/<nombre>`. Debe trabajar y hacer commits SOLO dentro de esa ruta, sin tocar el código de la raíz ni otros worktrees.
4. Responde solo con el nombre del worktree, su ruta y la rama. Cuando el agente termine, resume qué hizo e indica que para integrar se hace merge de la rama `<nombre>` y luego `git worktree remove .trees/<nombre>`.
