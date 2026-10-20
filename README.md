# Sistema Frutalize

Sistema interno e responsivo de gestão da Frutalize. O primeiro módulo em desenvolvimento é o controle de estoque, lotes e recebimentos.

## Tecnologias

- Next.js 16 com App Router e TypeScript
- Tailwind CSS
- Supabase Auth e PostgreSQL
- Vercel

## Desenvolvimento local

1. Copie `.env.example` para `.env.local`.
2. Preencha a URL e a chave publicável do projeto Supabase.
3. Instale e execute:

```bash
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Nunca adicione chaves secretas do Supabase a variáveis prefixadas com `NEXT_PUBLIC_`.
