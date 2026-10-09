# ⚠️ GUIA OBRIGATÓRIO PARA FERRAMENTAS DE IA (AI Studio / Agentes) E DESENVOLVEDORES

> **Leia isto ANTES de editar qualquer arquivo ou fazer push neste repositório.**
> Violar estas regras pode derrubar o ambiente de produção (Shard Cloud).

---

## 1. Como este repositório é usado (IMPORTANTE)

- Este repositório **`vinimapfreitas-design/VINIMAP-ACF` (branch `main`)** é a **fonte da verdade** do ambiente de produção **VMAPSACF** hospedado no **Shard Cloud**.
- O ambiente Shard Cloud **puxa automaticamente** da branch `main` a cada **5 minutos** (verificação via `git fetch` + `git reset --hard origin/main`), roda `npm run build` e **reinicia o servidor**.
- Ou seja: **todo push na `main` é aplicado em produção em até ~5 minutos**, automaticamente.

## 2. REGRA DE OURO — SEMPRE ANTES DE COMEÇAR

```bash
git checkout main
git fetch origin
git reset --hard origin/main   # garante que você parte EXATAMENTE do que está em produção
git pull origin main
```

**NUNCA trabalhe a partir de uma cópia antiga do código.** Se o repositório local tiver alterações não enviadas, descarte ou envie-as primeiro. O AI Studio/agente deve SEMPRE começar do HEAD atual da `main`.

## 3. Nunca fazer (proibições absolutas)

- ❌ **NUNCA** faça `git push --force` / `push -f` (ou reescreva o histórico com `rebase` + force).
- ❌ **NUNCA** faça push de uma versão **antiga** do código (sem as correções mais recentes) — isso sobrescreve correções em produção.
- ❌ **NUNCA** remova ou desative o motor de auto-deploy no `server.ts` (bloco `AUTO-DEPLOY (GitHub -> build -> restart automático)` e endpoints `/api/auto-deploy/*`).
- ❌ **NUNCA** remova o arquivo `.github/workflows/build.yml` (mantém o `dist/` buildado no repositório).
- ❌ **NUNCA** remova o polling de contingência do painel admin (`App.tsx`: `Polling de contingência ... a cada 30s`) nem a query ampliada do onSnapshot (`orderBy('versionTimestamp','desc') limit(300)`) — são correções críticas de sincronização.
- ❌ **NUNCA** edite/remova `src/db.json` (dados locais em produção) nem `src/auto-deploy.log`.

## 4. Fluxo correto de alteração (push seguro)

```bash
# 1. Sincronizar (sempre!)
git checkout main
git fetch origin && git reset --hard origin/main

# 2. Fazer as alterações (somente no que for necessário)

# 3. Validar localmente
npm install          # se necessário
npm run build        # DEVE passar sem erros

# 4. Enviar
git add .
git commit -m "descrição clara da mudança"
git push origin main
```

Se o `push` for rejeitado (someone-pushed), faça `git pull --rebase origin main` e resolva conflitos **preservando as alterações existentes do outro lado**.

## 5. Se algo der errado

- O servidor do Shard Cloud **cria um snapshot git automático** antes de cada atualização (`chore: snapshot auto-deploy ...`) — recuperável via `git log`.
- O banco de dados NÃO é afetado pelo deploy (PostgreSQL/Supabase são externos ao código).
- Logs úteis: `src/auto-deploy.log` (atualizações), `/.shardcloudinternal/crash_*.log` e `restart_*.log`.

---

**Regra final:** *"O repositório main é lei. Sempre puxe antes. Nunca force-push. Nunca reverta as proteções."*