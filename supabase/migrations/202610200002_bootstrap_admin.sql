-- O vínculo administrativo depende de uma identidade criada no Supabase Auth
-- de cada ambiente. Mantê-lo fora das migrações permite replay completo em um
-- banco vazio sem acoplar o schema a um e-mail, UUID ou dado pessoal específico.
--
-- Depois de aplicar as migrações, siga o procedimento administrativo descrito
-- em docs/Implementacao_Estoque.md para criar ou vincular o primeiro admin.
do $$
begin
  raise notice 'Schema preparado. Vincule o administrador do ambiente após as migrações.';
end;
$$;
