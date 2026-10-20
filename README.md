# Sistema Frutalize

Sistema interno e responsivo de gestão da Frutalize. A primeira entrega de estoque inclui cadastros, apresentações, fornecedores, recebimentos com custo e peso, conferência de lotes, saídas, perdas e histórico auditável.

## Contexto e escopo

- [Requisitos consolidados](docs/Requisitos_Sistema_Frutalize.md)
- [Contexto da fábrica](docs/Contexto_Completo_Frutalize.md)
- [Implementação, preparação do banco, aceite e pendências](docs/Implementacao_Estoque.md)

O financeiro, a gestão completa de usuários e a produção são próximas etapas. A primeira fatia do estoque habilita somente administradores vinculados; gestor e colaborador estão modelados, com acesso ainda restrito.

## Tecnologias

- Next.js 16 com App Router e TypeScript
- Tailwind CSS
- Supabase Auth e PostgreSQL
- Vercel

## Ambiente publicado

- Aplicação: https://sistema-frutalize.vercel.app
- Verificação de saúde: https://sistema-frutalize.vercel.app/api/health
- Repositório: https://github.com/GSM-Digital/sistema-frutalize

Todo push na branch `main` gera automaticamente uma nova implantação de produção na Vercel.

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha a URL e a chave publicável do projeto Supabase.
3. Aplique a migração e vincule o administrador conforme o [guia de implantação](docs/Implementacao_Estoque.md#preparar-o-supabase).
4. Use Node 22 (`.nvmrc`). Instale e execute:

```bash
npm ci
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
TURNSTILE_REQUIRED=false
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_EXPECTED_HOSTNAME=
```

Nunca adicione chaves secretas do Supabase a variáveis prefixadas com `NEXT_PUBLIC_`.

O login usa Cloudflare Turnstile em produção. Configure a site key, o segredo e o hostname esperado juntos, como descrito no guia. Produção falha de modo fechado: sem a configuração completa, o formulário informa a indisponibilidade e não permite entrar. Em homologação, use `TURNSTILE_REQUIRED=true`; em desenvolvimento local, `false` permite trabalhar sem as três chaves.

## Verificações

```bash
npm run lint
npm run format:check
npm test
npm run typecheck
npm run build
```

Os testes executam o replay completo das migrações e as regras de estoque e acesso em PostgreSQL embarcado, sem credenciais de produção. A integração com Supabase, a responsividade e o fluxo completo devem passar pelo aceite em homologação documentado antes de publicar em produção.

## Licença

Este é um software proprietário da Frutalize. Todos os direitos são reservados, e sua reprodução ou utilização sem autorização prévia e expressa é proibida. Consulte o arquivo [LICENSE](LICENSE) para os termos completos.
