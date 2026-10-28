# Sistema Frutalize

Sistema interno e responsivo de gestão da Frutalize. A primeira entrega de estoque inclui cadastros, apresentações, fornecedores, recebimentos com custo e peso, conferência de lotes, saídas, perdas e histórico auditável.

## Contexto e escopo

- [Requisitos consolidados](docs/Requisitos_Sistema_Frutalize.md)
- [Contexto da fábrica](docs/Contexto_Completo_Frutalize.md)
- [Implementação, preparação do banco, aceite e pendências](docs/Implementacao_Estoque.md)
- [Evolução de produção e gestão: módulos, implantação e limites](docs/Evolucao_Producao_Gestao.md)
- [Estado do plano técnico e pendências de homologação](docs/Estado_Plano_Tecnico.md)

Esta branch acrescenta terminal de produção, perfis e regras de qualidade versionados, inventário físico, inspeção, alertas, equipe, financeiro, pedidos e portal de consulta. O estoque administrativo segue restrito aos administradores; a produção e os apontamentos usam permissões próprias por papel. A ativação operacional depende das etapas de homologação e aceite descritas no [guia de evolução](docs/Evolucao_Producao_Gestao.md).

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

Para comparar as duas visualizações sem configurar o Supabase, abra
`http://localhost:3000/visualizar` durante `npm run dev`. A página usa dados
fictícios, mantém os comandos desativados e existe apenas em desenvolvimento.
Para testar gravações reais, configure `.env.local` com as credenciais públicas
de **homologação** e entre com uma conta autorizada. O dashboard fica em
`/dashboard/producao`; o terminal touch fica em `/terminal`.

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_EXPECTED_HOSTNAME=
```

Nunca adicione chaves secretas do Supabase a variáveis prefixadas com `NEXT_PUBLIC_`.

O login está preparado para Cloudflare Turnstile opcional. Sem as três variáveis, o acesso por e-mail e senha continua funcionando normalmente. Para ativar a proteção no futuro, configure a site key, o segredo e o hostname esperado juntos, como descrito no guia; uma configuração parcial bloqueia o envio para evitar uma falsa sensação de proteção.

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
