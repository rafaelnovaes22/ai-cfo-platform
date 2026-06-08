-- Normaliza e-mails existentes para lowercase.
-- O login e o password-reset passam a normalizar o e-mail (case-insensitive);
-- sem este backfill, usuários cadastrados com letras maiúsculas não conseguiriam
-- mais autenticar (lookup lowercased não casaria com o valor armazenado).
UPDATE "User" SET email = lower(email) WHERE email <> lower(email);
